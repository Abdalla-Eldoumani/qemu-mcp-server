// Register the vm://{vmId}/status resource template.
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";

// Expose VM state and metadata as a readable resource.
export function registerVmStatusResource(server: McpServer, vmManager: VmManager): void {
  server.resource(
    "vm-status",
    new ResourceTemplate("vm://{vmId}/status", { list: undefined }),
    { description: "Current run state and metadata for a VM" },
    async (uri, variables) => {
      const vmId = variables.vmId as string;
      try {
        const vm = vmManager.getVm(vmId);
        const status = {
          vmId: vm.id,
          state: vm.state,
          arch: vm.config.arch,
          memoryMB: vm.config.memoryMB,
          cpus: vm.config.cpus ?? 1,
          pid: vm.pid,
          createdAt: vm.createdAt.toISOString(),
        };
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(status, null, 2),
          }],
        };
      } catch (err) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Error: ${(err as Error).message}`,
          }],
        };
      }
    }
  );
}
