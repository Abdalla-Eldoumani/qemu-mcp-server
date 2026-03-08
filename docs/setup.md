# Setup

## Prerequisites

### Node.js 18+

Node.js 18 or later is required (20+ recommended). Download from [nodejs.org](https://nodejs.org) or use a version manager:

```bash
# nvm
nvm install 20
nvm use 20

# fnm
fnm install 20
fnm use 20
```

### QEMU

Install QEMU for the architectures you need.

**Ubuntu/Debian:**
```bash
sudo apt install qemu-system-arm qemu-system-x86
```

**Fedora:**
```bash
sudo dnf install qemu-system-aarch64 qemu-system-x86
```

**macOS:**
```bash
brew install qemu
```

**Windows (via WSL):**
```bash
# First install WSL if you haven't: wsl --install (in PowerShell)
# Then inside WSL:
sudo apt install qemu-system-arm qemu-system-x86
```

The server checks for QEMU at startup and gives clear install instructions if it is missing.

Verify QEMU is on your PATH:
```bash
qemu-system-x86_64 --version
qemu-system-aarch64 --version
```

## Install the server

```bash
npm install -g qemu-mcp-server
```

Or run directly with npx:
```bash
npx qemu-mcp-server
```

## Configure your MCP client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "qemu": {
      "command": "qemu-mcp-server"
    }
  }
}
```

With environment variables:
```json
{
  "mcpServers": {
    "qemu": {
      "command": "qemu-mcp-server",
      "env": {
        "MAX_VMS": "5",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

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

### Claude Code

Add via the CLI:
```bash
claude mcp add qemu-mcp-server -- qemu-mcp-server
```

### HTTP transport

For remote hosting, run with HTTP transport:
```bash
TRANSPORT=http HTTP_PORT=3000 qemu-mcp-server
```

Then connect your MCP client to `http://localhost:3000/mcp`.

## Environment variables

All optional. Set them in your shell or MCP client config.

| Variable | Default | Description |
|----------|---------|-------------|
| TRANSPORT | stdio | Transport mode: "stdio" or "http" |
| HTTP_PORT | 3000 | Port for HTTP transport |
| QEMU_BINARY_DIR | (empty) | Custom path to QEMU binaries |
| VM_TEMP_DIR | os.tmpdir() | Where to store sockets and temp files |
| MAX_VMS | 10 | Maximum concurrent VMs |
| QMP_TIMEOUT_MS | 30000 | QMP command timeout in milliseconds |
| CONSOLE_BUFFER_LINES | 1000 | Console ring buffer size per VM |
| LOG_LEVEL | info | Log level: debug, info, warn, error |

## Verify the install

Run the server directly to check for errors:
```bash
qemu-mcp-server
```

It should start without output on stdout (all logs go to stderr). Press Ctrl+C to stop.

If QEMU is not installed, the server prints clear instructions:
```
Error: No QEMU binaries found. Install QEMU and make sure it is on your PATH.
  Ubuntu/Debian: sudo apt install qemu-system-arm qemu-system-x86
  macOS: brew install qemu
  Or set QEMU_BINARY_DIR to the directory containing QEMU binaries.
```

## Windows setup (WSL)

This server uses Unix sockets for QMP, so it needs Linux or macOS. On Windows, use WSL:

1. Install WSL if you have not already:
   ```powershell
   wsl --install
   ```

2. Inside WSL, install QEMU and Node.js:
   ```bash
   sudo apt update
   sudo apt install qemu-system-arm qemu-system-x86 nodejs npm
   ```

3. Install and build the server inside WSL:
   ```bash
   cd /path/to/qemu-mcp-server
   npm install && npm run build
   ```

4. Configure your MCP client to run through WSL:
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

## Notes on snapshots

Snapshots (`save_snapshot`, `load_snapshot`) require a qcow2 disk image. If you create a VM with only a kernel (no disk), snapshot commands will fail with a clear error explaining why.

To create a blank qcow2 disk for testing:
```bash
qemu-img create -f qcow2 test-disk.qcow2 1G
```

Then create the VM with both a kernel and disk:
```
create_vm with arch="x86_64", memoryMB=512, diskImage="/path/to/test-disk.qcow2", kernel="/path/to/bzImage"
```
