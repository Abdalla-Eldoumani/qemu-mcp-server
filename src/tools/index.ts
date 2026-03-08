// Barrel file that registers all MCP tools with the server.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VmManager } from "../vm-manager.js";
import { registerLifecycleTools } from "./vm-lifecycle.js";
import { registerControlTools } from "./vm-control.js";
import { registerSnapshotTools } from "./vm-snapshot.js";
import { registerInspectTools } from "./vm-inspect.js";
import { registerExecTools } from "./vm-exec.js";

// Register all tool groups with the MCP server.
export function registerAllTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  registerLifecycleTools(server, vmManager);
  registerControlTools(server, vmManager);
  registerSnapshotTools(server, vmManager);
  registerInspectTools(server, vmManager);
  registerExecTools(server, vmManager);
}
