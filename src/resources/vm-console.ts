// Register the vm://{vmId}/console resource template.
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";

// Expose the serial console output buffer as plain text.
export function registerVmConsoleResource(server: McpServer, vmManager: VmManager): void {
  server.resource(
    "vm-console",
    new ResourceTemplate("vm://{vmId}/console", { list: undefined }),
    { description: "Serial console output buffer for a VM" },
    async (uri, variables) => {
      const vmId = variables.vmId as string;
      try {
        const lines = vmManager.getConsoleOutput(vmId);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: lines.join("\n"),
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
