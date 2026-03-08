// Integration test: serial console I/O with real QEMU.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { VmManager } from "../../src/vm-manager.js";

// Skip all tests if QEMU is not installed.
function qemuAvailable(): boolean {
  try {
    execSync("qemu-system-x86_64 --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasQemu = qemuAvailable();

describe.skipIf(!hasQemu)("Console I/O integration", () => {
  let vmManager: VmManager;
  let vmId: string;

  beforeAll(async () => {
    vmManager = new VmManager();
    await vmManager.init();

    const vm = await vmManager.createVm({
      arch: "x86_64",
      memoryMB: 128,
    });
    vmId = vm.id;

    // Wait a moment for QEMU to produce some initial output.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await vmManager.shutdown();
  });

  it("should capture console output", () => {
    const output = vmManager.getConsoleOutput(vmId);
    // QEMU produces some output even without a kernel (BIOS messages).
    expect(Array.isArray(output)).toBe(true);
  });

  it("should send console input", () => {
    // Sending input should not throw.
    vmManager.sendConsoleInput(vmId, "test\n");
  });

  it("should read recent console lines", () => {
    const lines = vmManager.getConsoleOutput(vmId, 5);
    expect(lines.length).toBeLessThanOrEqual(5);
  });
});
