#!/usr/bin/env node

// Entry point for qemu-mcp-server.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VmManager } from "./vm-manager.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { getConfig } from "./config/index.js";
import { createTransport } from "./transport/index.js";
import { setLevel } from "./utils/logger.js";
import * as logger from "./utils/logger.js";

// Boot the server, register tools and resources, connect transport.
async function main(): Promise<void> {
  const config = getConfig();
  setLevel(config.logLevel);

  logger.info("Starting qemu-mcp-server", { transport: config.transport });

  const vmManager = new VmManager();
  await vmManager.init();

  const server = new McpServer({
    name: "qemu-mcp-server",
    version: "0.1.0",
  });

  registerAllTools(server, vmManager);
  registerAllResources(server, vmManager);

  const { transport, httpServer } = createTransport();
  await server.connect(transport);

  if (config.transport === "http") {
    logger.info("MCP server running on HTTP", { port: config.httpPort });
  } else {
    logger.info("MCP server running on stdio");
  }

  // Shut down cleanly on signals.
  const cleanup = async () => {
    logger.info("Shutting down");
    await server.close();
    await vmManager.shutdown();
    if (httpServer) {
      httpServer.close();
    }
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

main().catch((err) => {
  logger.error("Fatal error", { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
