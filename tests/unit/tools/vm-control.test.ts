// Unit tests for vm-control tools: pause_vm, resume_vm, reset_vm, shutdown_vm.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerControlTools } from "../../../src/tools/vm-control.js";
import type { VmManager } from "../../../src/vm-manager.js";

// Build a mock VmManager with sensible defaults.
function createMockVmManager(): VmManager {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    createVm: vi.fn().mockResolvedValue(undefined),
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
  registerControlTools(server, vmManager);

  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { server, client };
}

describe("vm-control tools", () => {
  let vmManager: VmManager;

  beforeEach(() => {
    vmManager = createMockVmManager();
  });

  describe("pause_vm", () => {
    it("pauses a VM and confirms", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "pause_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-001");
      expect(parsed.status).toBe("paused");
      expect(vmManager.pauseVm).toHaveBeenCalledWith("vm-001");
    });

    it("returns an error when pause fails", async () => {
      (vmManager.pauseVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("VM is not running"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "pause_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("VM is not running");
    });
  });

  describe("resume_vm", () => {
    it("resumes a VM and confirms", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "resume_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-001");
      expect(parsed.status).toBe("running");
      expect(vmManager.resumeVm).toHaveBeenCalledWith("vm-001");
    });

    it("returns an error when resume fails", async () => {
      (vmManager.resumeVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("VM is not paused"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "resume_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("VM is not paused");
    });
  });

  describe("reset_vm", () => {
    it("resets a VM and confirms", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "reset_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-001");
      expect(parsed.status).toBe("reset");
      expect(vmManager.resetVm).toHaveBeenCalledWith("vm-001");
    });

    it("returns an error when reset fails", async () => {
      (vmManager.resetVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("VM not found: vm-bogus"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "reset_vm",
        arguments: { vmId: "vm-bogus" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("VM not found");
    });
  });

  describe("shutdown_vm", () => {
    it("shuts down a VM and confirms", async () => {
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "shutdown_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.vmId).toBe("vm-001");
      expect(parsed.status).toBe("shutdown requested");
      expect(vmManager.shutdownVm).toHaveBeenCalledWith("vm-001");
    });

    it("returns an error when shutdown fails", async () => {
      (vmManager.shutdownVm as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("VM already shut down"),
      );
      const { client } = await setupClientServer(vmManager);

      const result = await client.callTool({
        name: "shutdown_vm",
        arguments: { vmId: "vm-001" },
      });

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("VM already shut down");
    });
  });
});
