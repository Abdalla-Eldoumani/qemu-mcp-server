/** Temp directory manager for server and per-VM temp files. */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

export class TempManager {
  private basePath: string;
  private serverDir: string | null = null;

  /** Create a temp manager. Uses os.tmpdir() if no basePath given. */
  constructor(basePath?: string) {
    this.basePath = basePath ?? os.tmpdir();
  }

  /** Create the server temp directory. Must be called before other methods. */
  async init(): Promise<string> {
    const suffix = crypto.randomBytes(4).toString("hex");
    this.serverDir = path.join(this.basePath, `qemu-mcp-${suffix}`);
    await fs.mkdir(this.serverDir, { recursive: true });
    return this.serverDir;
  }

  /** Get the server temp directory path. Throws if init() was not called. */
  private getServerDir(): string {
    if (!this.serverDir) {
      throw new Error(
        "TempManager not initialized. Call init() before using other methods."
      );
    }
    return this.serverDir;
  }

  /** Create a subdirectory for a VM and return its path. */
  async createVmDir(vmId: string): Promise<string> {
    const vmDir = path.join(this.getServerDir(), vmId);
    await fs.mkdir(vmDir, { recursive: true });
    return vmDir;
  }

  /** Return the QMP socket file path for a VM. */
  getSocketPath(vmId: string): string {
    return path.join(this.getServerDir(), vmId, "qmp.sock");
  }

  /** Remove the temp directory for a VM. */
  async removeVmDir(vmId: string): Promise<void> {
    const vmDir = path.join(this.getServerDir(), vmId);
    await fs.rm(vmDir, { recursive: true, force: true });
  }

  /** Remove the entire server temp directory and all VM subdirectories. */
  async cleanup(): Promise<void> {
    const dir = this.serverDir;
    if (!dir) {
      return;
    }
    await fs.rm(dir, { recursive: true, force: true });
    this.serverDir = null;
  }
}
