# qemu-mcp-server

[![npm](https://img.shields.io/npm/v/qemu-mcp-server)](https://www.npmjs.com/package/qemu-mcp-server)

An MCP server that gives AI agents direct control over QEMU virtual machines.

Create, boot, snapshot, inspect, and destroy VMs through standard MCP tool calls. The server manages QEMU processes and communicates through QMP (QEMU Machine Protocol).

## Quick start

### 1. Install QEMU

```bash
# Ubuntu/Debian
sudo apt install qemu-system-arm qemu-system-x86

# Fedora
sudo dnf install qemu-system-aarch64 qemu-system-x86

# macOS
brew install qemu

# Windows -- use WSL (see "Windows support" below)
```

### 2. Install the server

```bash
npm install -g qemu-mcp-server
```

Or run without installing:
```bash
npx qemu-mcp-server
```

Or from source:
```bash
git clone [<repo-url>](https://github.com/Abdalla-Eldoumani/qemu-mcp-server)
cd qemu-mcp-server
npm install && npm run build
```

The server checks for QEMU on startup and tells you exactly what to install if anything is missing.

### 3. Connect your AI client

**Claude Desktop** -- add to your MCP config:
```json
{
  "mcpServers": {
    "qemu": {
      "command": "qemu-mcp-server"
    }
  }
}
```

**Cursor** -- add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "qemu": {
      "command": "npx",
      "args": ["qemu-mcp-server"]
    }
  }
}
```

**Claude Code**:
```bash
claude mcp add qemu -- npx qemu-mcp-server
```

### 4. Try it

Ask your AI agent:

> "Create an aarch64 VM with 128MB of memory and tell me what you see on the console."

The agent will call `create_vm`, wait for output, read the console, and report back.

## What agents can do

**Create and manage VMs**
- `create_vm` -- Start a VM with specified architecture, memory, and disk/kernel
- `destroy_vm` -- Stop and clean up a VM
- `list_vms` -- See all running VMs

**Control execution**
- `pause_vm`, `resume_vm`, `reset_vm`, `shutdown_vm`

**Snapshots** (requires a qcow2 disk image)
- `save_snapshot`, `load_snapshot`, `delete_snapshot`, `list_snapshots`

**Inspect state**
- `get_vm_status`, `get_vm_info`, `read_console`, `dump_memory`

**Run commands**
- `send_console_input` -- Type into the serial console
- `wait_for_console_output` -- Wait for expected text in output

## Example: bare-metal ARM program

You can boot a custom kernel or bare-metal binary. The `test-arm/` directory has a working example:

```bash
# Cross-compile (needs aarch64-linux-gnu-as and ld)
cd test-arm
aarch64-linux-gnu-as -o hello.o hello.s
aarch64-linux-gnu-ld -T link.ld -o hello.elf hello.o
aarch64-linux-gnu-objcopy -O binary hello.elf hello.bin
```

Then ask your agent:

> "Create an aarch64 VM with 128MB memory using /path/to/hello.bin as the kernel, wait a second, then read the console."

The agent will see "Hello from ARM!" printed by the bare-metal program writing to the PL011 UART.

## Example: booting a Linux kernel

If you have a Linux kernel image and root filesystem:

> "Create an x86_64 VM with 512MB memory, disk image /path/to/rootfs.qcow2, and kernel /path/to/bzImage with kernel args 'console=ttyS0 root=/dev/vda'."

The agent can then interact with the Linux system through the serial console using `send_console_input` and `wait_for_console_output`.

## Windows support

This server uses Unix sockets for QMP communication, so it does not run natively on Windows. Use WSL instead:

1. Install WSL: `wsl --install` in PowerShell
2. Install QEMU inside WSL: `sudo apt install qemu-system-arm qemu-system-x86`
3. Install Node.js inside WSL
4. Run the server inside WSL

For Claude Desktop or Cursor on Windows, configure the MCP server to run through WSL:
```json
{
  "mcpServers": {
    "qemu": {
      "command": "wsl",
      "args": ["node", "/path/in/wsl/to/qemu-mcp-server/dist/index.js"]
    }
  }
}
```

## Configuration

All optional. Set via environment variables:

| Variable | Default | What it does |
|----------|---------|-------------|
| TRANSPORT | stdio | "stdio" or "http" |
| HTTP_PORT | 3000 | Port for HTTP transport |
| QEMU_BINARY_DIR | (empty) | Custom path to QEMU binaries |
| VM_TEMP_DIR | os.tmpdir() | Where to store sockets and temp files |
| MAX_VMS | 10 | Max concurrent VMs |
| QMP_TIMEOUT_MS | 30000 | Command timeout (ms) |
| CONSOLE_BUFFER_LINES | 1000 | Console output buffer size per VM |
| LOG_LEVEL | info | debug, info, warn, error |

## Supported architectures

- aarch64 (ARM64)
- x86_64

## Requirements

- Node.js 18+ (20+ recommended)
- QEMU installed and on PATH
- Linux, macOS, or Windows with WSL

## License

MIT
