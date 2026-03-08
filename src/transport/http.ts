// Create HTTP transport for remote MCP connections.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as logger from "../utils/logger.js";

// Max request body size: 1MB.
const MAX_BODY_BYTES = 1_048_576;

// Build an HTTP server that routes /mcp requests to the StreamableHTTP transport.
export function createHttpTransport(port: number): {
  transport: StreamableHTTPServerTransport;
  server: http.Server;
} {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // Only handle /mcp path.
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found. Use POST /mcp for MCP requests.");
      return;
    }

    // Reject oversized requests before processing.
    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (contentLength > MAX_BODY_BYTES) {
      res.writeHead(413, { "Content-Type": "text/plain" });
      res.end("Request body too large.");
      return;
    }

    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      logger.error("HTTP transport error", { error: (err as Error).message });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal server error");
      }
    }
  });

  httpServer.maxHeadersCount = 50;

  httpServer.listen(port, () => {
    logger.info("HTTP transport listening", { port });
  });

  return { transport, server: httpServer };
}
