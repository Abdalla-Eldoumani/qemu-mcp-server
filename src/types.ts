// Shared type definitions for the qemu-mcp-server project.

// Supported CPU architectures. Add more here as needed.
export type ArchType = "aarch64" | "x86_64";

// Maps each architecture to its QEMU binary name and default settings.
export const ARCH_CONFIG: Record<
  ArchType,
  { binary: string; machine: string; cpu: string }
> = {
  aarch64: {
    binary: "qemu-system-aarch64",
    machine: "virt",
    cpu: "cortex-a53",
  },
  x86_64: {
    binary: "qemu-system-x86_64",
    machine: "pc",
    cpu: "qemu64",
  },
};

// Parameters for creating a new VM.
export interface VmConfig {
  arch: ArchType;
  memoryMB: number;
  cpus?: number;
  diskImage?: string;
  kernel?: string;
  kernelArgs?: string;
}

// Run state of a VM. Mirrors QMP's StatusInfo.
export type VmState =
  | "creating"
  | "running"
  | "paused"
  | "shutdown"
  | "crashed"
  | "destroyed";

// A live VM instance tracked by the VM manager.
export interface VmInstance {
  id: string;
  config: VmConfig;
  state: VmState;
  pid: number;
  qmpSocketPath: string;
  createdAt: Date;
  consoleBuffer: string[];
}
