// Tests for VmManager with mocked QEMU processes and QMP clients.

import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";

// Mock process stdin/stdout/stderr as EventEmitters with write support.
class MockStream extends EventEmitter {
  writable = true;
  write = vi.fn(() => true);
}

// Mock child process returned by spawn.
function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as unknown as ChildProcess & EventEmitter;
  (proc as any).stdin = new MockStream();
  (proc as any).stdout = new MockStream();
  (proc as any).stderr = new MockStream();
  (proc as any).pid = 12345;
  (proc as any).exitCode = null;
  (proc as any).kill = vi.fn(() => true);
  return proc;
}

let mockProcess: ChildProcess;

// Mock child_process.spawn to return our mock process.
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProcess),
}));

// Mock QMP client with controllable connect and execute.
const mockQmpConnect = vi.fn();
const mockQmpExecute = vi.fn();
const mockQmpDisconnect = vi.fn();
let mockQmpIsConnected = true;

vi.mock("../../src/qmp/client.js", () => ({
  QmpClient: vi.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      connect: mockQmpConnect,
      execute: mockQmpExecute,
      disconnect: mockQmpDisconnect,
      get isConnected() {
        return mockQmpIsConnected;
      },
    });
  }),
}));

// Mock TempManager to avoid filesystem operations.
const mockTempInit = vi.fn().mockResolvedValue("/tmp/qemu-mcp-test");
const mockTempCreateVmDir = vi.fn().mockResolvedValue("/tmp/qemu-mcp-test/vm");
const mockTempGetSocketPath = vi.fn().mockReturnValue("/tmp/qemu-mcp-test/vm/qmp.sock");
const mockTempRemoveVmDir = vi.fn().mockResolvedValue(undefined);
const mockTempCleanup = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/utils/temp.js", () => ({
  TempManager: vi.fn().mockImplementation(() => ({
    init: mockTempInit,
    createVmDir: mockTempCreateVmDir,
    getSocketPath: mockTempGetSocketPath,
    removeVmDir: mockTempRemoveVmDir,
    cleanup: mockTempCleanup,
  })),
}));

// Mock generateVmId to return predictable IDs.
let vmIdCounter = 0;
vi.mock("../../src/utils/id.js", () => ({
  generateVmId: vi.fn(() => `test-vm-${++vmIdCounter}`),
}));

// Mock logger to suppress output during tests.
vi.mock("../../src/utils/logger.js", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock config with sensible defaults.
vi.mock("../../src/config/index.js", () => ({
  getConfig: vi.fn(() => ({
    transport: "stdio",
    httpPort: 3000,
    qemuBinaryDir: "",
    vmTempDir: "/tmp",
    maxVms: 3,
    qmpTimeoutMs: 30000,
    consoleBufferLines: 100,
    logLevel: "info",
  })),
}));

// Import after all mocks are in place.
import { VmManager } from "../../src/vm-manager.js";
import { spawn } from "node:child_process";

// Default VM config for tests.
const DEFAULT_CONFIG = {
  arch: "x86_64" as const,
  memoryMB: 512,
};

describe("VmManager", () => {
  let manager: VmManager;

  beforeEach(async () => {
    vmIdCounter = 0;
    mockProcess = createMockProcess();
    mockQmpConnect.mockResolvedValue(undefined);
    mockQmpExecute.mockResolvedValue({});
    mockQmpDisconnect.mockResolvedValue(undefined);
    mockQmpIsConnected = true;

    manager = new VmManager();
    await manager.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("init", () => {
    it("should create the temp directory on init", () => {
      expect(mockTempInit).toHaveBeenCalled();
    });
  });

  describe("createVm", () => {
    it("should spawn QEMU with correct arguments", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);

      expect(spawn).toHaveBeenCalledWith(
        "qemu-system-x86_64",
        expect.arrayContaining([
          "-machine", "pc",
          "-cpu", "qemu64",
          "-m", "512",
          "-smp", "1",
          "-nographic",
        ]),
        expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] })
      );

      expect(vm.id).toBe("test-vm-1");
      expect(vm.state).toBe("running");
      expect(vm.config).toEqual(DEFAULT_CONFIG);
      expect(vm.pid).toBe(12345);
    });

    it("should connect QMP client after spawning", async () => {
      await manager.createVm(DEFAULT_CONFIG);
      expect(mockQmpConnect).toHaveBeenCalled();
    });

    it("should include disk image args when diskImage is set", async () => {
      await manager.createVm({
        ...DEFAULT_CONFIG,
        diskImage: "/path/to/disk.qcow2",
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          "-drive", "file=/path/to/disk.qcow2,format=qcow2,if=virtio",
          "-snapshot",
        ]),
        expect.any(Object)
      );
    });

    it("should include kernel args when kernel is set", async () => {
      await manager.createVm({
        ...DEFAULT_CONFIG,
        kernel: "/path/to/vmlinuz",
        kernelArgs: "console=ttyS0",
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          "-kernel", "/path/to/vmlinuz",
          "-append", "console=ttyS0",
        ]),
        expect.any(Object)
      );
    });

    it("should capture console output from stdout", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);

      // Simulate QEMU writing to stdout.
      (mockProcess as any).stdout.emit(
        "data",
        Buffer.from("Boot line 1\nBoot line 2\n")
      );

      const output = manager.getConsoleOutput(vm.id);
      expect(output).toContain("Boot line 1");
      expect(output).toContain("Boot line 2");
    });

    it("should return VmInstance with correct fields", async () => {
      const vm = await manager.createVm({
        ...DEFAULT_CONFIG,
        cpus: 4,
      });

      expect(vm.id).toMatch(/^test-vm-/);
      expect(vm.state).toBe("running");
      expect(vm.config.cpus).toBe(4);
      expect(vm.createdAt).toBeInstanceOf(Date);
      expect(vm.consoleBuffer).toEqual([]);
      expect(vm.qmpSocketPath).toBe("/tmp/qemu-mcp-test/vm/qmp.sock");
    });
  });

  describe("destroyVm", () => {
    it("should send QMP quit and clean up resources", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);

      // Simulate process exit after quit.
      mockQmpExecute.mockImplementation(async (cmd: string) => {
        if (cmd === "quit") {
          setTimeout(() => (mockProcess as any).emit("exit", 0, null), 10);
        }
        return {};
      });

      await manager.destroyVm(vm.id);

      expect(mockQmpExecute).toHaveBeenCalledWith("quit");
      expect(mockQmpDisconnect).toHaveBeenCalled();
      expect(mockTempRemoveVmDir).toHaveBeenCalledWith(vm.id);
    });

    it("should remove the VM from tracking after destroy", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      await manager.destroyVm(vm.id);

      expect(() => manager.getVm(vm.id)).toThrow(/not found/);
      expect(manager.listVms()).toHaveLength(0);
    });
  });

  describe("getVm", () => {
    it("should return the VM for a valid ID", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      const found = manager.getVm(vm.id);
      expect(found.id).toBe(vm.id);
    });

    it("should throw for an unknown VM ID", () => {
      expect(() => manager.getVm("nonexistent-vm")).toThrow(/not found/);
    });
  });

  describe("listVms", () => {
    it("should return an empty array when no VMs exist", () => {
      expect(manager.listVms()).toEqual([]);
    });

    it("should return all tracked VMs", async () => {
      await manager.createVm(DEFAULT_CONFIG);
      mockProcess = createMockProcess();
      await manager.createVm(DEFAULT_CONFIG);

      expect(manager.listVms()).toHaveLength(2);
    });
  });

  describe("max VM limit", () => {
    it("should reject when at the maximum VM count", async () => {
      // Config has maxVms = 3.
      await manager.createVm(DEFAULT_CONFIG);
      mockProcess = createMockProcess();
      await manager.createVm(DEFAULT_CONFIG);
      mockProcess = createMockProcess();
      await manager.createVm(DEFAULT_CONFIG);

      mockProcess = createMockProcess();
      await expect(manager.createVm(DEFAULT_CONFIG)).rejects.toThrow(
        /maximum of 3/
      );
    });
  });

  describe("pauseVm", () => {
    it("should send QMP stop command and update state", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      await manager.pauseVm(vm.id);

      expect(mockQmpExecute).toHaveBeenCalledWith("stop");
      expect(manager.getVm(vm.id).state).toBe("paused");
    });
  });

  describe("resumeVm", () => {
    it("should send QMP cont command and update state", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      await manager.pauseVm(vm.id);
      await manager.resumeVm(vm.id);

      expect(mockQmpExecute).toHaveBeenCalledWith("cont");
      expect(manager.getVm(vm.id).state).toBe("running");
    });
  });

  describe("resetVm", () => {
    it("should send QMP system_reset command", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      await manager.resetVm(vm.id);

      expect(mockQmpExecute).toHaveBeenCalledWith("system_reset");
    });
  });

  describe("shutdownVm", () => {
    it("should send QMP system_powerdown and update state", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      await manager.shutdownVm(vm.id);

      expect(mockQmpExecute).toHaveBeenCalledWith("system_powerdown");
      expect(manager.getVm(vm.id).state).toBe("shutdown");
    });
  });

  describe("getConsoleOutput", () => {
    it("should return the last N lines from the buffer", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);

      // Feed lines into the console buffer.
      (mockProcess as any).stdout.emit(
        "data",
        Buffer.from("line1\nline2\nline3\nline4\nline5\n")
      );

      const last3 = manager.getConsoleOutput(vm.id, 3);
      expect(last3).toEqual(["line3", "line4", "line5"]);
    });

    it("should return all lines when count is not specified", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);

      (mockProcess as any).stdout.emit("data", Buffer.from("a\nb\n"));

      const all = manager.getConsoleOutput(vm.id);
      expect(all).toEqual(["a", "b"]);
    });
  });

  describe("sendConsoleInput", () => {
    it("should write to process stdin", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      manager.sendConsoleInput(vm.id, "ls\n");

      expect((mockProcess as any).stdin.write).toHaveBeenCalledWith("ls\n");
    });
  });

  describe("executeQmp", () => {
    it("should forward raw QMP commands", async () => {
      const vm = await manager.createVm(DEFAULT_CONFIG);
      mockQmpExecute.mockResolvedValueOnce({ status: "running" });

      const result = await manager.executeQmp(vm.id, "query-status");
      expect(mockQmpExecute).toHaveBeenCalledWith("query-status", undefined);
      expect(result).toEqual({ status: "running" });
    });
  });

  describe("shutdown", () => {
    it("should destroy all VMs and clean up temp", async () => {
      await manager.createVm(DEFAULT_CONFIG);
      mockProcess = createMockProcess();
      await manager.createVm(DEFAULT_CONFIG);

      // Simulate process exit on quit.
      mockQmpExecute.mockImplementation(async (cmd: string) => {
        if (cmd === "quit") {
          setTimeout(() => (mockProcess as any).emit("exit", 0, null), 10);
        }
        return {};
      });

      await manager.shutdown();

      expect(manager.listVms()).toHaveLength(0);
      expect(mockTempCleanup).toHaveBeenCalled();
    });
  });
});
