/** Structured JSON logger that writes to stderr only. stdout is reserved for MCP stdio transport. */

type LogLevel = "debug" | "info" | "warn" | "error";

/** Numeric priority for each level. Higher means more severe. */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

/** Set the minimum log level. Messages below this level are suppressed. */
export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Get the current minimum log level. */
export function getLevel(): LogLevel {
  return currentLevel;
}

/** Write a structured log entry to stderr if it meets the minimum level. */
function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) {
    return;
  }

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  process.stderr.write(JSON.stringify(entry) + "\n");
}

/** Log a debug message. */
export function debug(
  message: string,
  context?: Record<string, unknown>
): void {
  log("debug", message, context);
}

/** Log an info message. */
export function info(
  message: string,
  context?: Record<string, unknown>
): void {
  log("info", message, context);
}

/** Log a warning message. */
export function warn(
  message: string,
  context?: Record<string, unknown>
): void {
  log("warn", message, context);
}

/** Log an error message. */
export function error(
  message: string,
  context?: Record<string, unknown>
): void {
  log("error", message, context);
}
