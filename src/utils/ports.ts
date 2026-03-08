/** Find available TCP ports for QEMU instances. */

import * as net from "net";

/** Find an available TCP port by binding to port 0 and reading the assigned port. */
export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", (err: Error) => {
      reject(new Error(`Failed to find available port: ${err.message}`));
    });

    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to get port from server address."));
        return;
      }

      const port = address.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}
