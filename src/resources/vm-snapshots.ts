// Register the vm://{vmId}/snapshots resource template.
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";

// Expose VM snapshot list by querying QMP for snapshot info.
export function registerVmSnapshotsResource(server: McpServer, vmManager: VmManager): void {
  server.resource(
    "vm-snapshots",
    new ResourceTemplate("vm://{vmId}/snapshots", { list: undefined }),
    { description: "List of snapshots saved for a VM" },
    async (uri, variables) => {
      const vmId = variables.vmId as string;
      try {
        const result = await vmManager.executeQmp(vmId, "human-monitor-command", {
          "command-line": "info snapshots",
        });
        const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ vmId, snapshots: output }, null, 2),
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
