// QMP client. Connects to a QEMU instance over a Unix socket and sends commands.

import { EventEmitter } from "node:events";
import net from "node:net";
import {
  type QmpCommand,
  type QmpGreeting,
  isQmpError,
  isQmpEvent,
  isQmpGreeting,
  isQmpResponse,
} from "./types.js";
import {
  QmpCommandError,
  QmpConnectionError,
  QmpProtocolError,
  QmpTimeoutError,
} from "./errors.js";

// Default timeout for QMP commands in milliseconds.
const DEFAULT_TIMEOUT_MS = 30_000;

// A pending command waiting for its response from QEMU.
interface PendingCommand {
  id: string;
  command: string;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// A queued command waiting to be sent.
interface QueuedCommand {
  command: string;
  args?: Record<string, unknown>;
  timeout: number;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

// Manages a QMP connection to a single QEMU instance.
export class QmpClient extends EventEmitter {
  private readonly socketPath: string;
  private socket: net.Socket | null = null;
  private buffer = "";
  private commandCounter = 0;
  private pending: PendingCommand | null = null;
  private queue: QueuedCommand[] = [];
  private connected = false;

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;
  }

  // Whether the QMP connection is active.
  get isConnected(): boolean {
    return this.connected;
  }

  // Open the socket, complete the QMP handshake, and negotiate capabilities.
  async connect(): Promise<QmpGreeting> {
    if (this.connected) {
      throw new QmpConnectionError(
        "Already connected. Call disconnect() first."
      );
    }

    return new Promise<QmpGreeting>((resolve, reject) => {
      let handshakeComplete = false;
      let greeting: QmpGreeting | null = null;

      const socket = net.createConnection(this.socketPath);
      this.socket = socket;
      this.buffer = "";

      // Handle connection failure before handshake completes.
      const onError = (err: Error) => {
        if (!handshakeComplete) {
          cleanup();
          reject(
            new QmpConnectionError(
              `Failed to connect to QMP socket at ${this.socketPath}. ` +
                `Check that QEMU is running and the socket path is correct.`,
              { cause: err }
            )
          );
        }
      };

      // Handle premature close during handshake.
      const onClose = () => {
        if (!handshakeComplete) {
          cleanup();
          reject(
            new QmpConnectionError(
              `QMP socket closed before handshake completed. ` +
                `QEMU may have crashed during startup.`
            )
          );
        }
      };

      // Remove temporary handshake listeners.
      const cleanup = () => {
        socket.removeListener("error", onError);
        socket.removeListener("close", onClose);
      };

      socket.on("error", onError);
      socket.on("close", onClose);

      // Buffer incoming data and process complete JSON lines.
      socket.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      // Process parsed messages during handshake and normal operation.
      this.on("_message", (msg: unknown) => {
        // During handshake: expect greeting, then capabilities response.
        if (!handshakeComplete) {
          if (!greeting && isQmpGreeting(msg)) {
            greeting = msg;
            // Send qmp_capabilities to complete the handshake.
            const capCmd: QmpCommand = {
              execute: "qmp_capabilities",
              id: "handshake",
            };
            socket.write(JSON.stringify(capCmd) + "\n");
            return;
          }

          if (greeting && isQmpResponse(msg)) {
            handshakeComplete = true;
            this.connected = true;
            cleanup();
            this.installPermanentListeners();
            resolve(greeting);
            return;
          }

          if (greeting && isQmpError(msg)) {
            handshakeComplete = true;
            cleanup();
            socket.destroy();
            reject(
              new QmpProtocolError(
                `Capabilities negotiation failed: ${msg.error.desc}. ` +
                  `The QEMU version may not support this client.`
              )
            );
            return;
          }
        }
      });
    });
  }

  // Send a QMP command and wait for its response.
  async execute(
    command: string,
    args?: Record<string, unknown>,
    timeout?: number
  ): Promise<unknown> {
    if (!this.connected) {
      throw new QmpConnectionError(
        "Not connected. Call connect() before sending commands."
      );
    }

    const timeoutMs = timeout ?? DEFAULT_TIMEOUT_MS;

    return new Promise<unknown>((resolve, reject) => {
      this.queue.push({ command, args, timeout: timeoutMs, resolve, reject });
      this.drainQueue();
    });
  }

  // Close the socket and reject any pending commands.
  async disconnect(): Promise<void> {
    if (!this.socket) return;

    this.connected = false;
    this.rejectPending(
      new QmpConnectionError("Disconnected by client.")
    );
    this.rejectQueue(
      new QmpConnectionError("Disconnected by client.")
    );
    this.socket.destroy();
    this.socket = null;
    this.buffer = "";
    this.removeAllListeners("_message");
  }

  // Split buffered data on newlines and parse each complete line as JSON.
  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    // Keep the last (possibly incomplete) chunk in the buffer.
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        this.emit(
          "error",
          new QmpProtocolError(
            `Failed to parse QMP message as JSON: ${trimmed.slice(0, 200)}`
          )
        );
        continue;
      }

      this.emit("_message", parsed);
    }
  }

  // Set up socket listeners for normal operation after handshake.
  private installPermanentListeners(): void {
    if (!this.socket) return;

    this.on("_message", (msg: unknown) => {
      // Route responses to the pending command.
      if (isQmpResponse(msg)) {
        this.resolvePending(msg.return);
        return;
      }

      if (isQmpError(msg)) {
        const err = new QmpCommandError(msg.error.class, msg.error.desc);
        this.rejectPending(err);
        return;
      }

      // Forward events to external listeners.
      if (isQmpEvent(msg)) {
        this.emit("event", msg);
        return;
      }
    });

    this.socket.on("close", () => {
      this.connected = false;
      this.rejectPending(
        new QmpConnectionError(
          "QMP socket closed unexpectedly. QEMU may have shut down."
        )
      );
      this.rejectQueue(
        new QmpConnectionError(
          "QMP socket closed unexpectedly. QEMU may have shut down."
        )
      );
      this.emit("close");
    });

    this.socket.on("error", (err: Error) => {
      this.connected = false;
      this.rejectPending(
        new QmpConnectionError("QMP socket error.", { cause: err })
      );
      this.rejectQueue(
        new QmpConnectionError("QMP socket error.", { cause: err })
      );
    });
  }

  // Send the next queued command if nothing is in flight.
  private drainQueue(): void {
    if (this.pending) return;
    if (this.queue.length === 0) return;

    const next = this.queue.shift()!;
    const id = String(++this.commandCounter);

    const timer = setTimeout(() => {
      if (this.pending?.id === id) {
        const err = new QmpTimeoutError(next.command, next.timeout);
        this.pending = null;
        next.reject(err);
        this.drainQueue();
      }
    }, next.timeout);

    this.pending = {
      id,
      command: next.command,
      resolve: next.resolve,
      reject: next.reject,
      timer,
    };

    const cmd: QmpCommand = { execute: next.command, id };
    if (next.args) {
      cmd.arguments = next.args;
    }

    this.socket!.write(JSON.stringify(cmd) + "\n");
  }

  // Resolve the current pending command and move to the next.
  private resolvePending(value: unknown): void {
    if (!this.pending) return;

    clearTimeout(this.pending.timer);
    const p = this.pending;
    this.pending = null;
    p.resolve(value);
    this.drainQueue();
  }

  // Reject the current pending command with an error.
  private rejectPending(err: Error): void {
    if (!this.pending) return;

    clearTimeout(this.pending.timer);
    const p = this.pending;
    this.pending = null;
    p.reject(err);
  }

  // Reject all queued commands with an error.
  private rejectQueue(err: Error): void {
    const queued = this.queue.splice(0);
    for (const item of queued) {
      item.reject(err);
    }
  }
}
