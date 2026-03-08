// MCP tool definitions for VM inspection: status, info, console, memory dump.

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VmManager } from "../vm-manager.js";

// Register get_vm_status, get_vm_info, read_console, and dump_memory tools.
export function registerInspectTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  // Get the current status of a VM.
  server.tool(
    "get_vm_status",
    "Get the current status of a virtual machine. Returns the QMP run state (running, paused, etc.) along with VM metadata like architecture, memory, and uptime.",
    {
      vmId: z.string().describe("ID of the VM to check"),
    },
    async (params) => {
      try {
        const vm = vmManager.getVm(params.vmId);
        const qmpStatus = await vmManager.executeQmp(
          params.vmId,
          "query-status",
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: vm.id,
                  state: vm.state,
                  qmpStatus,
                  arch: vm.config.arch,
                  memoryMB: vm.config.memoryMB,
                  cpus: vm.config.cpus,
                  pid: vm.pid,
                  createdAt: vm.createdAt.toISOString(),
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
              text: `Failed to get status for VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get detailed info about a VM including CPUs and block devices.
  server.tool(
    "get_vm_info",
    "Get detailed information about a virtual machine. Returns combined data from QMP: run status, CPU topology, and block device configuration. More detailed than get_vm_status.",
    {
      vmId: z.string().describe("ID of the VM to inspect"),
    },
    async (params) => {
      try {
        const vm = vmManager.getVm(params.vmId);
        const [status, cpus, blockDevices] = await Promise.all([
          vmManager.executeQmp(params.vmId, "query-status"),
          vmManager.executeQmp(params.vmId, "query-cpus-fast"),
          vmManager.executeQmp(params.vmId, "query-block"),
        ]);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: vm.id,
                  state: vm.state,
                  config: vm.config,
                  pid: vm.pid,
                  createdAt: vm.createdAt.toISOString(),
                  qmp: {
                    status,
                    cpus,
                    blockDevices,
                  },
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
              text: `Failed to get info for VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Read recent serial console output.
  server.tool(
    "read_console",
    "Read recent serial console output from a virtual machine. Returns the last N lines from the console buffer. Useful for checking boot progress, command output, or error messages.",
    {
      vmId: z.string().describe("ID of the VM to read console from"),
      lines: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .optional()
        .describe("Number of recent lines to return (default: all available)"),
    },
    async (params) => {
      try {
        const output = vmManager.getConsoleOutput(params.vmId, params.lines);
        return {
          content: [
            {
              type: "text" as const,
              text: output.length > 0
                ? output.join("\n")
                : "(no console output yet)",
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to read console for VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Dump guest physical memory to a file.
  server.tool(
    "dump_memory",
    "Dump guest physical memory to a file on the host. Writes raw bytes from the specified address range. Useful for debugging guest OS state or extracting data.",
    {
      vmId: z.string().describe("ID of the VM to dump memory from"),
      address: z
        .number()
        .int()
        .min(0)
        .describe("Physical memory address to start reading from"),
      size: z
        .number()
        .int()
        .min(1)
        .max(1048576)
        .describe("Number of bytes to dump (max 1MB)"),
      filepath: z
        .string()
        .describe("File name for the dump (written to the VM temp directory)"),
    },
    async (params) => {
      try {
        // Restrict dump output to the VM temp directory to prevent arbitrary writes.
        const vm = vmManager.getVm(params.vmId);
        const basename = path.basename(params.filepath);
        if (!basename || basename !== params.filepath) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid filepath "${params.filepath}". Provide a simple file name (no path separators). The file will be written to the VM temp directory.`,
              },
            ],
            isError: true,
          };
        }
        const safePath = path.join(path.dirname(vm.qmpSocketPath), basename);
        await vmManager.executeQmp(params.vmId, "pmemsave", {
          val: params.address,
          size: params.size,
          filename: safePath,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  address: params.address,
                  size: params.size,
                  filepath: safePath,
                  status: "dumped",
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
              text: `Failed to dump memory for VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
