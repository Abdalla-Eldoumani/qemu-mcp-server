// Integration test: VM snapshots with real QEMU.

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

describe.skipIf(!hasQemu)("VM snapshot integration", () => {
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
  });

  afterAll(async () => {
    await vmManager.shutdown();
  });

  it("should save and list a snapshot", async () => {
    const saveResult = await vmManager.executeQmp(vmId, "human-monitor-command", {
      "command-line": "savevm test-snap",
    });
    expect(saveResult).toBeDefined();

    const listResult = await vmManager.executeQmp(vmId, "human-monitor-command", {
      "command-line": "info snapshots",
    });
    expect(String(listResult)).toContain("test-snap");
  });

  it("should load a snapshot", async () => {
    const result = await vmManager.executeQmp(vmId, "human-monitor-command", {
      "command-line": "loadvm test-snap",
    });
    expect(result).toBeDefined();
  });

  it("should delete a snapshot", async () => {
    const result = await vmManager.executeQmp(vmId, "human-monitor-command", {
      "command-line": "delvm test-snap",
    });
    expect(result).toBeDefined();
  });
});
