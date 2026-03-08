// Central VM manager. Spawns QEMU processes, connects QMP, tracks lifecycle.

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { QmpClient } from "./qmp/client.js";
import { type VmConfig, type VmInstance, type VmState, ARCH_CONFIG } from "./types.js";
import { generateVmId } from "./utils/id.js";
import { TempManager } from "./utils/temp.js";
import * as logger from "./utils/logger.js";
import { getConfig } from "./config/index.js";

// How long to wait between QMP socket connection retries.
const QMP_RETRY_DELAY_MS = 200;

// Maximum number of retries when waiting for the QMP socket.
const QMP_MAX_RETRIES = 25;

// Manages a pool of QEMU virtual machines.
export class VmManager {
  private vms: Map<string, VmInstance> = new Map();
  private qmpClients: Map<string, QmpClient> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private tempManager: TempManager;
  private initialized = false;

  constructor() {
    const config = getConfig();
    this.tempManager = new TempManager(config.vmTempDir || undefined);
  }

  // Set up temp directories and register shutdown handlers.
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.tempManager.init();
    this.initialized = true;

    // Clean up VMs on process exit signals.
    const shutdownHandler = async () => {
      await this.shutdown();
      process.exit(0);
    };

    process.on("SIGTERM", shutdownHandler);
    process.on("SIGINT", shutdownHandler);

    logger.info("VM manager initialized.");
  }

  // Create and boot a new VM with the given config.
  async createVm(config: VmConfig): Promise<VmInstance> {
    const serverConfig = getConfig();

    if (this.vms.size >= serverConfig.maxVms) {
      throw new Error(
        `Cannot create VM. Already at the maximum of ${serverConfig.maxVms} VMs. ` +
          `Destroy an existing VM first.`
      );
    }

    const vmId = generateVmId();
    await this.tempManager.createVmDir(vmId);
    const socketPath = this.tempManager.getSocketPath(vmId);
    const archConfig = ARCH_CONFIG[config.arch];

    // Build the QEMU binary path.
    const binary = serverConfig.qemuBinaryDir
      ? path.join(serverConfig.qemuBinaryDir, archConfig.binary)
      : archConfig.binary;

    // Build the command line arguments.
    const args: string[] = [
      "-machine", archConfig.machine,
      "-cpu", archConfig.cpu,
      "-m", String(config.memoryMB),
      "-smp", String(config.cpus || 1),
      "-nographic",
      "-serial", "mon:stdio",
      "-qmp", `unix:${socketPath},server=on,wait=off`,
    ];

    if (config.diskImage) {
      args.push("-drive", `file=${config.diskImage},format=qcow2,if=virtio`);
      args.push("-snapshot");
    }

    if (config.kernel) {
      args.push("-kernel", config.kernel);
    }

    if (config.kernelArgs) {
      args.push("-append", config.kernelArgs);
    }

    // Register the VM in creating state before spawning.
    const instance: VmInstance = {
      id: vmId,
      config,
      state: "creating",
      pid: 0,
      qmpSocketPath: socketPath,
      createdAt: new Date(),
      consoleBuffer: [],
    };
    this.vms.set(vmId, instance);

    logger.info("Spawning QEMU process.", { vmId, binary, arch: config.arch });

    // Spawn the QEMU process.
    const proc = spawn(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.processes.set(vmId, proc);
    instance.pid = proc.pid ?? 0;

    // Capture stdout into the console ring buffer.
    proc.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.length === 0) continue;
        instance.consoleBuffer.push(line);
        while (instance.consoleBuffer.length > serverConfig.consoleBufferLines) {
          instance.consoleBuffer.shift();
        }
      }
    });

    // Log stderr output from QEMU.
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        logger.warn("QEMU stderr output.", { vmId, text });
      }
    });

    // Detect unexpected process exit.
    proc.on("exit", (code, signal) => {
      const vm = this.vms.get(vmId);
      if (!vm) return;

      if (vm.state !== "destroyed" && vm.state !== "shutdown") {
        vm.state = "crashed";
        logger.error("QEMU process exited unexpectedly.", { vmId, code, signal });
      }

      // Clean up the QMP client reference.
      const client = this.qmpClients.get(vmId);
      if (client?.isConnected) {
        client.disconnect().catch(() => {});
      }
    });

    // Wait for QMP socket to become available.
    const qmpClient = new QmpClient(socketPath);
    await this.waitForQmp(qmpClient, vmId);

    this.qmpClients.set(vmId, qmpClient);

    // Handle QMP connection drops.
    qmpClient.on("close", () => {
      const vm = this.vms.get(vmId);
      if (vm && vm.state === "running") {
        logger.warn("QMP connection closed while VM was running.", { vmId });
      }
    });

    instance.state = "running";
    logger.info("VM created and running.", { vmId, pid: instance.pid });

    return instance;
  }

  // Retry connecting the QMP client until the socket is ready.
  private async waitForQmp(client: QmpClient, vmId: string): Promise<void> {
    for (let attempt = 0; attempt < QMP_MAX_RETRIES; attempt++) {
      try {
        await client.connect();
        logger.debug("QMP connection established.", { vmId, attempt });
        return;
      } catch {
        // Check if the process has already exited.
        const proc = this.processes.get(vmId);
        if (proc && proc.exitCode !== null) {
          throw new Error(
            `QEMU process exited before QMP socket was ready. ` +
              `Exit code: ${proc.exitCode}. Check QEMU arguments and disk image path.`
          );
        }

        await this.delay(QMP_RETRY_DELAY_MS);
      }
    }

    throw new Error(
      `QMP socket did not become available after ${QMP_MAX_RETRIES} retries. ` +
        `QEMU may have failed to start. Check logs for details.`
    );
  }

  // Destroy a VM: send quit command, wait for process exit, clean up.
  async destroyVm(vmId: string): Promise<void> {
    const vm = this.requireVm(vmId);
    const client = this.qmpClients.get(vmId);
    const proc = this.processes.get(vmId);

    // Send QMP quit if connected.
    if (client?.isConnected) {
      try {
        await client.execute("quit");
      } catch {
        logger.warn("Failed to send QMP quit command. Forcing process kill.", { vmId });
      }
      await client.disconnect();
    }

    // Wait for the process to exit, or force kill.
    if (proc && proc.exitCode === null) {
      await this.waitForProcessExit(proc, vmId);
    }

    vm.state = "destroyed";

    // Clean up all references and temp files.
    this.qmpClients.delete(vmId);
    this.processes.delete(vmId);
    this.vms.delete(vmId);

    await this.tempManager.removeVmDir(vmId).catch((err) => {
      logger.warn("Failed to remove VM temp directory.", { vmId, error: String(err) });
    });

    logger.info("VM destroyed.", { vmId });
  }

  // Wait for a process to exit with a timeout, then force kill.
  private async waitForProcessExit(proc: ChildProcess, vmId: string): Promise<void> {
    const timeout = 5000;
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn("QEMU process did not exit in time. Sending SIGKILL.", { vmId });
        proc.kill("SIGKILL");
        resolve();
      }, timeout);

      proc.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  // Look up a VM by ID. Throws if not found.
  getVm(vmId: string): VmInstance {
    return this.requireVm(vmId);
  }

  // Return all tracked VM instances.
  listVms(): VmInstance[] {
    return Array.from(this.vms.values());
  }

  // Pause a running VM.
  async pauseVm(vmId: string): Promise<void> {
    const vm = this.requireVm(vmId);
    const client = this.requireQmpClient(vmId);

    await client.execute("stop");
    vm.state = "paused";
    logger.info("VM paused.", { vmId });
  }

  // Resume a paused VM.
  async resumeVm(vmId: string): Promise<void> {
    const vm = this.requireVm(vmId);
    const client = this.requireQmpClient(vmId);

    await client.execute("cont");
    vm.state = "running";
    logger.info("VM resumed.", { vmId });
  }

  // Reset a VM (like pressing the reset button).
  async resetVm(vmId: string): Promise<void> {
    this.requireVm(vmId);
    const client = this.requireQmpClient(vmId);

    await client.execute("system_reset");
    logger.info("VM reset.", { vmId });
  }

  // Request a graceful shutdown (like pressing the power button).
  async shutdownVm(vmId: string): Promise<void> {
    const vm = this.requireVm(vmId);
    const client = this.requireQmpClient(vmId);

    await client.execute("system_powerdown");
    vm.state = "shutdown";
    logger.info("VM shutdown requested.", { vmId });
  }

  // Return the last N lines from the console buffer.
  getConsoleOutput(vmId: string, lines?: number): string[] {
    const vm = this.requireVm(vmId);
    const count = lines ?? vm.consoleBuffer.length;
    return vm.consoleBuffer.slice(-count);
  }

  // Write text to the VM's serial console stdin.
  sendConsoleInput(vmId: string, text: string): void {
    this.requireVm(vmId);
    const proc = this.processes.get(vmId);

    if (!proc?.stdin?.writable) {
      throw new Error(
        `Cannot write to VM "${vmId}" stdin. The process stdin is not available.`
      );
    }

    proc.stdin.write(text);
  }

  // Execute a raw QMP command on a VM.
  async executeQmp(
    vmId: string,
    command: string,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    this.requireVm(vmId);
    const client = this.requireQmpClient(vmId);
    return client.execute(command, args);
  }

  // Destroy all VMs and clean up temp directories.
  async shutdown(): Promise<void> {
    logger.info("Shutting down VM manager. Destroying all VMs.");

    const vmIds = Array.from(this.vms.keys());
    for (const vmId of vmIds) {
      try {
        await this.destroyVm(vmId);
      } catch (err) {
        logger.error("Failed to destroy VM during shutdown.", {
          vmId,
          error: String(err),
        });
      }
    }

    await this.tempManager.cleanup();
    logger.info("VM manager shutdown complete.");
  }

  // Look up a VM or throw a descriptive error.
  private requireVm(vmId: string): VmInstance {
    const vm = this.vms.get(vmId);
    if (!vm) {
      throw new Error(
        `VM "${vmId}" not found. Use listVms() to see available VMs.`
      );
    }
    return vm;
  }

  // Look up a QMP client or throw a descriptive error.
  private requireQmpClient(vmId: string): QmpClient {
    const client = this.qmpClients.get(vmId);
    if (!client || !client.isConnected) {
      throw new Error(
        `QMP client for VM "${vmId}" is not connected. The VM may have crashed or been destroyed.`
      );
    }
    return client;
  }

  // Sleep helper.
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
