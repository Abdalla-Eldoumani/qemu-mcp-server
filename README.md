# qemu-mcp-server

An MCP server that gives AI agents direct control over QEMU virtual machines.

Create, boot, snapshot, inspect, and destroy VMs through standard MCP tool calls. The server manages QEMU processes and communicates through QMP (QEMU Machine Protocol).

## Quick start

```bash
npm install -g qemu-mcp-server
```

Make sure QEMU is installed and on your PATH:
```bash
# Ubuntu/Debian
sudo apt install qemu-system-arm qemu-system-x86

# macOS
brew install qemu
```

### Claude Desktop

Add to your Claude Desktop MCP config:
```json
{
  "mcpServers": {
    "qemu": {
      "command": "qemu-mcp-server"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:
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

## What agents can do

**Create and manage VMs**
- `create_vm` -- Start a VM with specified architecture, memory, and disk/kernel
- `destroy_vm` -- Stop and clean up a VM
- `list_vms` -- See all running VMs

**Control execution**
- `pause_vm`, `resume_vm`, `reset_vm`, `shutdown_vm`

**Snapshots**
- `save_snapshot`, `load_snapshot`, `delete_snapshot`, `list_snapshots`

**Inspect state**
- `get_vm_status`, `get_vm_info`, `read_console`, `dump_memory`

**Run commands**
- `send_console_input` -- Type into the serial console
- `wait_for_console_output` -- Wait for expected output

## Configuration

All optional. Set via environment variables:

| Variable | Default | What it does |
|----------|---------|-------------|
| TRANSPORT | stdio | "stdio" or "http" |
| HTTP_PORT | 3000 | Port for HTTP transport |
| MAX_VMS | 10 | Max concurrent VMs |
| QMP_TIMEOUT_MS | 30000 | Command timeout (ms) |
| LOG_LEVEL | info | debug, info, warn, error |

## Supported architectures

- aarch64 (ARM64)
- x86_64

## Requirements

- Node.js 20+
- QEMU installed and on PATH
- Linux or macOS

## License

MIT
