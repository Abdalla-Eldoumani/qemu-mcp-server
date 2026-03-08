/** Tests for the structured JSON logger. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debug, info, warn, error, setLevel } from "../../src/utils/logger.js";

describe("logger", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  /** Set up stderr mock before each test. */
  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    setLevel("debug");
  });

  /** Restore stderr and reset level after each test. */
  afterEach(() => {
    writeSpy.mockRestore();
    setLevel("info");
  });

  /** Parse the JSON written to stderr in the most recent call. */
  function getLastEntry(): Record<string, unknown> {
    const lastCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const raw = lastCall[0] as string;
    return JSON.parse(raw.trimEnd());
  }

  it("should write debug messages to stderr", () => {
    debug("test debug");
    const entry = getLastEntry();
    expect(entry.level).toBe("debug");
    expect(entry.message).toBe("test debug");
    expect(entry.timestamp).toBeDefined();
  });

  it("should write info messages to stderr", () => {
    info("test info");
    const entry = getLastEntry();
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test info");
  });

  it("should write warn messages to stderr", () => {
    warn("test warn");
    const entry = getLastEntry();
    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("test warn");
  });

  it("should write error messages to stderr", () => {
    error("test error");
    const entry = getLastEntry();
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("test error");
  });

  it("should include a valid ISO timestamp", () => {
    info("timestamp check");
    const entry = getLastEntry();
    const timestamp = entry.timestamp as string;
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("should output one JSON line per log call", () => {
    info("line one");
    info("line two");
    expect(writeSpy).toHaveBeenCalledTimes(2);
    for (const call of writeSpy.mock.calls) {
      const raw = call[0] as string;
      expect(raw.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });

  it("should merge context fields into the log entry", () => {
    info("with context", { vmId: "swift-fox-1234", port: 5900 });
    const entry = getLastEntry();
    expect(entry.vmId).toBe("swift-fox-1234");
    expect(entry.port).toBe(5900);
    expect(entry.message).toBe("with context");
  });

  it("should suppress debug and info when level is set to warn", () => {
    setLevel("warn");
    debug("should not appear");
    info("should not appear either");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("should allow warn and error when level is set to warn", () => {
    setLevel("warn");
    warn("visible warn");
    error("visible error");
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it("should suppress everything below error when level is error", () => {
    setLevel("error");
    debug("no");
    info("no");
    warn("no");
    expect(writeSpy).not.toHaveBeenCalled();
    error("yes");
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it("should not write to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    info("stderr only");
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });
});
