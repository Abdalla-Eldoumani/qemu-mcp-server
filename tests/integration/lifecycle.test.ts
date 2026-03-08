// Integration test: VM lifecycle with real QEMU.

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

describe.skipIf(!hasQemu)("VM lifecycle integration", () => {
  let vmManager: VmManager;

  beforeAll(async () => {
    vmManager = new VmManager();
    await vmManager.init();
  });

  afterAll(async () => {
    await vmManager.shutdown();
  });

  it("should create, list, and destroy a VM", async () => {
    const vm = await vmManager.createVm({
      arch: "x86_64",
      memoryMB: 128,
    });

    expect(vm.id).toBeTruthy();
    expect(vm.state).toBe("running");
    expect(vm.pid).toBeGreaterThan(0);

    const listed = vmManager.listVms();
    expect(listed.some((v) => v.id === vm.id)).toBe(true);

    await vmManager.destroyVm(vm.id);

    const listedAfter = vmManager.listVms();
    expect(listedAfter.some((v) => v.id === vm.id)).toBe(false);
  });

  it("should pause and resume a VM", async () => {
    const vm = await vmManager.createVm({
      arch: "x86_64",
      memoryMB: 128,
    });

    await vmManager.pauseVm(vm.id);
    const paused = vmManager.getVm(vm.id);
    expect(paused.state).toBe("paused");

    await vmManager.resumeVm(vm.id);
    const resumed = vmManager.getVm(vm.id);
    expect(resumed.state).toBe("running");

    await vmManager.destroyVm(vm.id);
  });

  it("should reset a VM", async () => {
    const vm = await vmManager.createVm({
      arch: "x86_64",
      memoryMB: 128,
    });

    await vmManager.resetVm(vm.id);
    const after = vmManager.getVm(vm.id);
    expect(after.state).toBe("running");

    await vmManager.destroyVm(vm.id);
  });
});
