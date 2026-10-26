import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Handler = (request: unknown, extra: unknown) => Promise<unknown>;

// The SDK stamps "$schema": draft-07 on every tool input schema, and the Anthropic
// API rejects a tool schema that declares an older draft. The bodies use nothing
// draft-07-specific, so dropping the declaration leaves valid draft-2020-12.
function stripDialect(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) stripDialect(item);
    return;
  }
  const record = node as Record<string, unknown>;
  delete record.$schema;
  for (const value of Object.values(record)) stripDialect(value);
}

// Wrap the tools/list handler after every tool is registered. The handler map is
// internal to the SDK, so this degrades to a no-op if a future release renames it.
export function stripToolSchemaDialect(server: McpServer): void {
  const handlers = (server.server as unknown as { _requestHandlers?: Map<string, Handler> })
    ._requestHandlers;
  const list = handlers?.get("tools/list");
  if (!handlers || !list) return;
  handlers.set("tools/list", async (request, extra) => {
    const result = await list(request, extra);
    stripDialect((result as { tools?: unknown }).tools);
    return result;
  });
}
