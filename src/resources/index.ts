// Register all MCP resources on the server.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";
import { registerVmStatusResource } from "./vm-status.js";
import { registerVmConsoleResource } from "./vm-console.js";
import { registerVmSnapshotsResource } from "./vm-snapshots.js";
import { registerServerInfoResource } from "./server-info.js";

// Wire up all resource handlers.
export function registerAllResources(server: McpServer, vmManager: VmManager): void {
  registerVmStatusResource(server, vmManager);
  registerVmConsoleResource(server, vmManager);
  registerVmSnapshotsResource(server, vmManager);
  registerServerInfoResource(server, vmManager);
}
