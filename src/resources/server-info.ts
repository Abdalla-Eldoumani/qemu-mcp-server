// Register the server://info static resource.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";
import { ARCH_CONFIG } from "../types.js";

// Expose server capabilities, supported architectures, and active VM count.
export function registerServerInfoResource(server: McpServer, vmManager: VmManager): void {
  server.resource(
    "server-info",
    "server://info",
    { description: "Server capabilities, supported architectures, and active VM count" },
    async (uri) => {
      const vms = vmManager.listVms();
      const info = {
        name: "qemu-mcp-server",
        version: "0.1.0",
        supportedArchitectures: Object.keys(ARCH_CONFIG),
        activeVmCount: vms.length,
        activeVms: vms.map((vm) => ({
          id: vm.id,
          state: vm.state,
          arch: vm.config.arch,
        })),
      };
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(info, null, 2),
        }],
      };
    }
  );
}
