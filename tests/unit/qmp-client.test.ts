// Tests for QmpClient using a mock net.Socket.

import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock socket that behaves like a net.Socket for testing.
class MockSocket extends EventEmitter {
  write = vi.fn((_data: string) => true);
  end = vi.fn();
  destroy = vi.fn();
}

let mockSocket: MockSocket;

// Replace net.createConnection so QmpClient uses our mock.
vi.mock("node:net", () => ({
  default: {
    createConnection: () => {
      return mockSocket;
    },
  },
}));

// Import after mocking so the mock is in place.
import { QmpClient } from "../../src/qmp/client.js";
import { QmpConnectionError, QmpTimeoutError } from "../../src/qmp/errors.js";

// Send a JSON message through the mock socket as if QEMU sent it.
function sendFromQemu(data: unknown): void {
  mockSocket.emit("data", Buffer.from(JSON.stringify(data) + "\n"));
}

// Standard QMP greeting message.
const GREETING = {
  QMP: {
    version: { qemu: { major: 8, minor: 2, micro: 0 }, package: "" },
    capabilities: [],
  },
};

// Perform the full handshake sequence on a client.
async function performHandshake(client: QmpClient): Promise<void> {
  const connectPromise = client.connect();

  // Send greeting from QEMU.
  sendFromQemu(GREETING);

  // The client should have sent qmp_capabilities. Send success response.
  sendFromQemu({ return: {}, id: "handshake" });

  await connectPromise;
}

describe("QmpClient", () => {
  beforeEach(() => {
    mockSocket = new MockSocket();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("handshake", () => {
    it("completes the greeting and capabilities negotiation", async () => {
      const client = new QmpClient("/tmp/test.sock");
      const connectPromise = client.connect();

      // QEMU sends greeting.
      sendFromQemu(GREETING);

      // Client should send qmp_capabilities.
      expect(mockSocket.write).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockSocket.write.mock.calls[0][0] as string);
      expect(sent.execute).toBe("qmp_capabilities");

      // QEMU responds with success.
      sendFromQemu({ return: {}, id: "handshake" });

      const greeting = await connectPromise;
      expect(greeting.QMP.version.qemu.major).toBe(8);
      expect(client.isConnected).toBe(true);
    });

    it("rejects if socket fails to connect", async () => {
      const client = new QmpClient("/tmp/bad.sock");
      const connectPromise = client.connect();

      mockSocket.emit("error", new Error("ECONNREFUSED"));

      await expect(connectPromise).rejects.toThrow(QmpConnectionError);
    });

    it("rejects if socket closes before handshake", async () => {
      const client = new QmpClient("/tmp/test.sock");
      const connectPromise = client.connect();

      mockSocket.emit("close");

      await expect(connectPromise).rejects.toThrow(QmpConnectionError);
    });
  });

  describe("command execution", () => {
    it("sends a command and returns the response", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      mockSocket.write.mockClear();
      const execPromise = client.execute("query-status");

      // Verify the command was sent.
      expect(mockSocket.write).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockSocket.write.mock.calls[0][0] as string);
      expect(sent.execute).toBe("query-status");

      // QEMU responds.
      sendFromQemu({ return: { running: true, status: "running" }, id: sent.id });

      const result = await execPromise;
      expect(result).toEqual({ running: true, status: "running" });
    });

    it("passes arguments to QEMU", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      mockSocket.write.mockClear();
      const execPromise = client.execute("human-monitor-command", {
        "command-line": "info version",
      });

      const sent = JSON.parse(mockSocket.write.mock.calls[0][0] as string);
      expect(sent.arguments).toEqual({ "command-line": "info version" });

      sendFromQemu({ return: "QEMU 8.2.0", id: sent.id });

      const result = await execPromise;
      expect(result).toBe("QEMU 8.2.0");
    });
  });

  describe("event buffering", () => {
    it("emits QMP events to listeners", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      const events: unknown[] = [];
      client.on("event", (evt) => events.push(evt));

      sendFromQemu({
        event: "SHUTDOWN",
        data: { guest: true },
        timestamp: { seconds: 1000, microseconds: 0 },
      });

      expect(events).toHaveLength(1);
      expect((events[0] as { event: string }).event).toBe("SHUTDOWN");
    });
  });

  describe("timeout", () => {
    it("rejects with QmpTimeoutError when no response arrives", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      const execPromise = client.execute("query-status", undefined, 5000);

      // Advance time past the timeout.
      vi.advanceTimersByTime(5001);

      await expect(execPromise).rejects.toThrow(QmpTimeoutError);
      await expect(execPromise).rejects.toThrow(/query-status/);
    });
  });

  describe("connection drop", () => {
    it("rejects pending commands when socket closes", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      const execPromise = client.execute("query-status");

      // Socket drops.
      mockSocket.emit("close");

      await expect(execPromise).rejects.toThrow(QmpConnectionError);
      expect(client.isConnected).toBe(false);
    });

    it("emits close event on disconnection", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      let closed = false;
      client.on("close", () => {
        closed = true;
      });

      mockSocket.emit("close");

      expect(closed).toBe(true);
    });
  });

  describe("command queue", () => {
    it("queues multiple commands and executes one at a time", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      mockSocket.write.mockClear();

      // Send three commands at once.
      const p1 = client.execute("query-status");
      const p2 = client.execute("query-block");
      const p3 = client.execute("query-cpus-fast");

      // Only the first should be sent immediately.
      expect(mockSocket.write).toHaveBeenCalledTimes(1);
      const sent1 = JSON.parse(mockSocket.write.mock.calls[0][0] as string);
      expect(sent1.execute).toBe("query-status");

      // Respond to first command.
      sendFromQemu({ return: { status: "running" }, id: sent1.id });
      await p1;

      // Second command should now be sent.
      expect(mockSocket.write).toHaveBeenCalledTimes(2);
      const sent2 = JSON.parse(mockSocket.write.mock.calls[1][0] as string);
      expect(sent2.execute).toBe("query-block");

      // Respond to second command.
      sendFromQemu({ return: [], id: sent2.id });
      await p2;

      // Third command should now be sent.
      expect(mockSocket.write).toHaveBeenCalledTimes(3);
      const sent3 = JSON.parse(mockSocket.write.mock.calls[2][0] as string);
      expect(sent3.execute).toBe("query-cpus-fast");

      // Respond to third command.
      sendFromQemu({ return: [{ cpu: 0 }], id: sent3.id });
      const result3 = await p3;
      expect(result3).toEqual([{ cpu: 0 }]);
    });

    it("rejects all queued commands when socket drops", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      const p1 = client.execute("query-status");
      const p2 = client.execute("query-block");

      // Socket drops.
      mockSocket.emit("close");

      await expect(p1).rejects.toThrow(QmpConnectionError);
      await expect(p2).rejects.toThrow(QmpConnectionError);
    });
  });

  describe("disconnect", () => {
    it("cleans up socket and rejects pending commands", async () => {
      const client = new QmpClient("/tmp/test.sock");
      await performHandshake(client);

      const execPromise = client.execute("query-status");

      await client.disconnect();

      await expect(execPromise).rejects.toThrow(QmpConnectionError);
      expect(client.isConnected).toBe(false);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });
});
