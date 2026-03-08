// MCP tool definitions for VM lifecycle: create, destroy, list.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VmManager } from "../vm-manager.js";

// Register create_vm, destroy_vm, and list_vms tools with the MCP server.
export function registerLifecycleTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  // Create and boot a new QEMU virtual machine.
  server.tool(
    "create_vm",
    "Create and start a new QEMU virtual machine. Returns the VM ID, state, architecture, memory, and process ID. Use this before any other VM tool.",
    {
      arch: z
        .enum(["aarch64", "x86_64"])
        .describe("CPU architecture for the VM"),
      memoryMB: z
        .number()
        .int()
        .min(64)
        .max(16384)
        .describe("Memory allocation in megabytes (64-16384)"),
      cpus: z
        .number()
        .int()
        .min(1)
        .max(16)
        .optional()
        .describe("Number of CPU cores (1-16, default 1)"),
      diskImage: z
        .string()
        .optional()
        .describe("Absolute path to a qcow2 disk image file"),
      kernel: z
        .string()
        .optional()
        .describe("Absolute path to a kernel binary to boot directly"),
      kernelArgs: z
        .string()
        .optional()
        .describe("Kernel command line arguments for direct kernel boot"),
    },
    async (params) => {
      try {
        const vm = await vmManager.createVm(params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: vm.id,
                  state: vm.state,
                  arch: vm.config.arch,
                  memoryMB: vm.config.memoryMB,
                  cpus: vm.config.cpus,
                  pid: vm.pid,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create VM: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Destroy a running VM and clean up its resources.
  server.tool(
    "destroy_vm",
    "Destroy a virtual machine by ID. Sends QMP quit, waits for the process to exit, and removes temporary files. The VM cannot be used after this.",
    {
      vmId: z.string().describe("ID of the VM to destroy"),
    },
    async (params) => {
      try {
        await vmManager.destroyVm(params.vmId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { vmId: params.vmId, status: "destroyed" },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to destroy VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // List all active VMs with their current state.
  server.tool(
    "list_vms",
    "List all active virtual machines. Returns an array of VM objects with ID, state, architecture, memory, and process ID. Returns an empty array if no VMs exist.",
    async () => {
      try {
        const vms = vmManager.listVms();
        const summary = vms.map((vm) => ({
          vmId: vm.id,
          state: vm.state,
          arch: vm.config.arch,
          memoryMB: vm.config.memoryMB,
          cpus: vm.config.cpus,
          pid: vm.pid,
          createdAt: vm.createdAt.toISOString(),
        }));
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list VMs: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
