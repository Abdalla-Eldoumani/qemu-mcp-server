// Select and create transport based on server config.
import { getConfig } from "../config/index.js";
import { createStdioTransport } from "./stdio.js";
import { createHttpTransport } from "./http.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type http from "node:http";

export interface TransportResult {
  transport: Transport;
  httpServer?: http.Server;
}

// Create transport from config. Returns the transport and an optional HTTP server handle.
export function createTransport(): TransportResult {
  const config = getConfig();

  if (config.transport === "http") {
    const { transport, server } = createHttpTransport(config.httpPort);
    return { transport, httpServer: server };
  }

  return { transport: createStdioTransport() };
}
