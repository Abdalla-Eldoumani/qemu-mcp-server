// Unit tests for vm-lifecycle tools: create_vm, destroy_vm, list_vms.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerLifecycleTools } from "../../../src/tools/vm-lifecycle.js";
import type { VmManager } from "../../../src/vm-manager.js";
import type { VmInstance, VmConfig } from "../../../src/types.js";

// Build a mock VmManager with sensible defaults.
function createMockVmManager(): VmManager {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    createVm: vi.fn().mockResolvedValue({
      id: "vm-test-001",
      config: { arch: "x86_64", memoryMB: 512, cpus: 2 },
      state: "running",
      pid: 12345,
      qmpSocketPath: "/tmp/qmp-test.sock",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      consoleBuffer: [],
    } as VmInstance),
    destroyVm: vi.fn().mockResolvedValue(undefined),
    getVm: vi.fn(),
    listVms: vi.fn().mockReturnValue([]),
    pauseVm: vi.fn().mockResolvedValue(undefined),
    resumeVm: vi.fn().mockResolvedValue(undefined),
    resetVm: vi.fn().mockResolvedValue(undefined),
    shutdownVm: vi.fn().mockResolvedValue(undefined),
    getConsoleOutput: vi.fn().mockReturnValue([]),
    sendConsoleInput: vi.fn(),
    executeQmp: vi.fn().mockResolvedValue({}),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as VmManager;
}

// Connect an MCP client to a server over in-memory transport.
async function setupClientServer(vmManager: VmManager) {
  const server = new McpServer({ name: "test-server", version: "0.0.1" });
  registerLifecycleTools(server, vmManager);

  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { server, client };
}

describe("vm-lifecycle tools", () => {
  let vmManager: VmManager;

  beforeEach(() => {
    vmManager = createMockVmManager();
  });

  describe("create_vm", () => {
    it("creates a VM and returns its details", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "create_vm",
        arguments: { arch: "x86_64", memoryMB: 512, cpus: 2 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-test-001");
      expect(parsed.state).toBe("running");
      expect(parsed.arch).toBe("x86_64");
      expect(parsed.memoryMB).toBe(512);
      expect(parsed.pid).toBe(12345);

      expect(vmManager.createVm).toHaveBeenCalledWith({
        arch: "x86_64",
        memoryMB: 512,
        cpus: 2,
      });
    });

    it("returns an error when creation fails", async () => {
      (vmManager.createVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("QEMU binary not found on PATH"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "create_vm",
        arguments: { arch: "aarch64", memoryMB: 256 },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("QEMU binary not found");
    });
  });

  describe("destroy_vm", () => {
    it("destroys a VM and confirms", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "destroy_vm",
        arguments: { vmId: "vm-test-001" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-test-001");
      expect(parsed.status).toBe("destroyed");
      expect(vmManager.destroyVm).toHaveBeenCalledWith("vm-test-001");
    });

    it("returns an error when destroy fails", async () => {
      (vmManager.destroyVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("VM not found: vm-bogus"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "destroy_vm",
        arguments: { vmId: "vm-bogus" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("VM not found");
    });
  });

  describe("list_vms", () => {
    it("returns an empty array when no VMs exist", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "list_vms",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toEqual([]);
    });

    it("returns VM summaries when VMs exist", async () => {
      (vmManager.listVms as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          id: "vm-001",
          config: { arch: "x86_64", memoryMB: 1024, cpus: 4 },
          state: "running",
          pid: 1111,
          qmpSocketPath: "/tmp/qmp-1.sock",
          createdAt: new Date("2025-01-01T00:00:00Z"),
          consoleBuffer: [],
        },
        {
          id: "vm-002",
          config: { arch: "aarch64", memoryMB: 512, cpus: 1 },
          state: "paused",
          pid: 2222,
          qmpSocketPath: "/tmp/qmp-2.sock",
          createdAt: new Date("2025-01-02T00:00:00Z"),
          consoleBuffer: [],
        },
      ] as VmInstance[]);

      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "list_vms",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].vmId).toBe("vm-001");
      expect(parsed[0].state).toBe("running");
      expect(parsed[1].vmId).toBe("vm-002");
      expect(parsed[1].state).toBe("paused");
    });
  });
});
