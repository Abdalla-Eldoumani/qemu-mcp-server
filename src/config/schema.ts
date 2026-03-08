import { z } from "zod";

// Schema for all server configuration values.
export const configSchema = z.object({
  transport: z.enum(["stdio", "http"]).default("stdio"),
  httpPort: z.coerce.number().int().min(1).max(65535).default(3000),
  qemuBinaryDir: z.string().default(""),
  vmTempDir: z.string().default(""), // empty means os.tmpdir()
  maxVms: z.coerce.number().int().min(1).max(100).default(10),
  qmpTimeoutMs: z.coerce.number().int().min(1000).max(300000).default(30000),
  consoleBufferLines: z.coerce
    .number()
    .int()
    .min(100)
    .max(100000)
    .default(1000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerConfig = z.infer<typeof configSchema>;
