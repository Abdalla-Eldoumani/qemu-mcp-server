import { configSchema, type ServerConfig } from "./schema.js";
import os from "os";

// Load config from env vars and validate.
export function loadConfig(): ServerConfig {
  const raw = {
    transport: process.env.TRANSPORT,
    httpPort: process.env.HTTP_PORT,
    qemuBinaryDir: process.env.QEMU_BINARY_DIR,
    vmTempDir: process.env.VM_TEMP_DIR,
    maxVms: process.env.MAX_VMS,
    qmpTimeoutMs: process.env.QMP_TIMEOUT_MS,
    consoleBufferLines: process.env.CONSOLE_BUFFER_LINES,
    logLevel: process.env.LOG_LEVEL,
  };

  // Strip undefined values so Zod defaults apply.
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && value !== "") {
      cleaned[key] = value;
    }
  }

  const result = configSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  const config = result.data;

  // Apply os.tmpdir() default if vmTempDir is empty.
  if (!config.vmTempDir) {
    config.vmTempDir = os.tmpdir();
  }

  return config;
}

// Singleton config instance. Loaded on first access.
let _config: ServerConfig | null = null;

// Return the singleton config, loading it on first call.
export function getConfig(): ServerConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// Reset config singleton (for testing).
export function resetConfig(): void {
  _config = null;
}
