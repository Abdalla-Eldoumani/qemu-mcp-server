// Create stdio transport for local MCP connections.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Build a stdio transport that reads from stdin and writes to stdout.
export function createStdioTransport(): StdioServerTransport {
  return new StdioServerTransport();
}
