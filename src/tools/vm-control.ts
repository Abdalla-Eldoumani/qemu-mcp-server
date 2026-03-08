// MCP tool definitions for VM control: pause, resume, reset, shutdown.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VmManager } from "../vm-manager.js";

// Register pause_vm, resume_vm, reset_vm, and shutdown_vm tools with the MCP server.
export function registerControlTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  // Pause a running VM.
  server.tool(
    "pause_vm",
    "Pause a running virtual machine. The VM stops executing but stays in memory. Use resume_vm to continue execution.",
    {
      vmId: z.string().describe("ID of the VM to pause"),
    },
    async (params) => {
      try {
        await vmManager.pauseVm(params.vmId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { vmId: params.vmId, status: "paused" },
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
              text: `Failed to pause VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Resume a paused VM.
  server.tool(
    "resume_vm",
    "Resume a paused virtual machine. The VM continues executing from where it was paused. Only works on VMs in the paused state.",
    {
      vmId: z.string().describe("ID of the VM to resume"),
    },
    async (params) => {
      try {
        await vmManager.resumeVm(params.vmId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { vmId: params.vmId, status: "running" },
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
              text: `Failed to resume VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Reset a VM (hard reboot).
  server.tool(
    "reset_vm",
    "Hard reset a virtual machine. Equivalent to pressing the reset button. The VM reboots immediately without a clean shutdown. Use shutdown_vm for a graceful shutdown instead.",
    {
      vmId: z.string().describe("ID of the VM to reset"),
    },
    async (params) => {
      try {
        await vmManager.resetVm(params.vmId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { vmId: params.vmId, status: "reset" },
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
              text: `Failed to reset VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Gracefully shut down a VM via ACPI.
  server.tool(
    "shutdown_vm",
    "Gracefully shut down a virtual machine via ACPI power button. The guest OS handles the shutdown. If the guest ignores ACPI, use destroy_vm to force termination.",
    {
      vmId: z.string().describe("ID of the VM to shut down"),
    },
    async (params) => {
      try {
        await vmManager.shutdownVm(params.vmId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { vmId: params.vmId, status: "shutdown requested" },
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
              text: `Failed to shut down VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
