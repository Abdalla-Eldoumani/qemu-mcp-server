import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import { loadConfig, getConfig, resetConfig } from "../../src/config/index.js";

// Env var names used by the config loader.
const ENV_KEYS = [
  "TRANSPORT",
  "HTTP_PORT",
  "QEMU_BINARY_DIR",
  "VM_TEMP_DIR",
  "MAX_VMS",
  "QMP_TIMEOUT_MS",
  "CONSOLE_BUFFER_LINES",
  "LOG_LEVEL",
];

// Save and restore env vars around each test.
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  resetConfig();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
  resetConfig();
});

describe("config", () => {
  // Verify all defaults apply when no env vars are set.
  it("returns default values when no env vars are set", () => {
    const config = loadConfig();
    expect(config.transport).toBe("stdio");
    expect(config.httpPort).toBe(3000);
    expect(config.qemuBinaryDir).toBe("");
    expect(config.vmTempDir).toBe(os.tmpdir());
    expect(config.maxVms).toBe(10);
    expect(config.qmpTimeoutMs).toBe(30000);
    expect(config.consoleBufferLines).toBe(1000);
    expect(config.logLevel).toBe("info");
  });

  // Verify vmTempDir falls back to os.tmpdir() when not specified.
  it("defaults vmTempDir to os.tmpdir()", () => {
    const config = loadConfig();
    expect(config.vmTempDir).toBe(os.tmpdir());
  });

  // Verify TRANSPORT env var overrides the default.
  it("overrides transport from env", () => {
    process.env.TRANSPORT = "http";
    const config = loadConfig();
    expect(config.transport).toBe("http");
  });

  // Verify HTTP_PORT env var overrides the default.
  it("overrides httpPort from env", () => {
    process.env.HTTP_PORT = "8080";
    const config = loadConfig();
    expect(config.httpPort).toBe(8080);
  });

  // Verify QEMU_BINARY_DIR env var overrides the default.
  it("overrides qemuBinaryDir from env", () => {
    process.env.QEMU_BINARY_DIR = "/usr/local/bin";
    const config = loadConfig();
    expect(config.qemuBinaryDir).toBe("/usr/local/bin");
  });

  // Verify VM_TEMP_DIR env var overrides the os.tmpdir() default.
  it("overrides vmTempDir from env", () => {
    process.env.VM_TEMP_DIR = "/custom/tmp";
    const config = loadConfig();
    expect(config.vmTempDir).toBe("/custom/tmp");
  });

  // Verify MAX_VMS env var overrides the default.
  it("overrides maxVms from env", () => {
    process.env.MAX_VMS = "50";
    const config = loadConfig();
    expect(config.maxVms).toBe(50);
  });

  // Verify QMP_TIMEOUT_MS env var overrides the default.
  it("overrides qmpTimeoutMs from env", () => {
    process.env.QMP_TIMEOUT_MS = "5000";
    const config = loadConfig();
    expect(config.qmpTimeoutMs).toBe(5000);
  });

  // Verify CONSOLE_BUFFER_LINES env var overrides the default.
  it("overrides consoleBufferLines from env", () => {
    process.env.CONSOLE_BUFFER_LINES = "5000";
    const config = loadConfig();
    expect(config.consoleBufferLines).toBe(5000);
  });

  // Verify LOG_LEVEL env var overrides the default.
  it("overrides logLevel from env", () => {
    process.env.LOG_LEVEL = "debug";
    const config = loadConfig();
    expect(config.logLevel).toBe("debug");
  });

  // Verify invalid TRANSPORT value throws a clear error.
  it("throws on invalid transport value", () => {
    process.env.TRANSPORT = "invalid";
    expect(() => loadConfig()).toThrow("Invalid configuration");
  });

  // Verify non-numeric MAX_VMS throws a clear error.
  it("throws on non-numeric MAX_VMS", () => {
    process.env.MAX_VMS = "abc";
    expect(() => loadConfig()).toThrow("Invalid configuration");
  });

  // Verify MAX_VMS out of range throws.
  it("throws when MAX_VMS exceeds maximum", () => {
    process.env.MAX_VMS = "999";
    expect(() => loadConfig()).toThrow("Invalid configuration");
  });

  // Verify HTTP_PORT out of range throws.
  it("throws when HTTP_PORT is out of range", () => {
    process.env.HTTP_PORT = "0";
    expect(() => loadConfig()).toThrow("Invalid configuration");
  });

  // Verify invalid LOG_LEVEL throws.
  it("throws on invalid logLevel", () => {
    process.env.LOG_LEVEL = "verbose";
    expect(() => loadConfig()).toThrow("Invalid configuration");
  });

  // Verify getConfig returns the same instance on repeated calls.
  it("getConfig returns singleton", () => {
    const first = getConfig();
    const second = getConfig();
    expect(first).toBe(second);
  });

  // Verify resetConfig clears the singleton so getConfig reloads.
  it("resetConfig clears the singleton", () => {
    const first = getConfig();
    resetConfig();
    process.env.TRANSPORT = "http";
    const second = getConfig();
    expect(second.transport).toBe("http");
    expect(first.transport).toBe("stdio");
  });
});
