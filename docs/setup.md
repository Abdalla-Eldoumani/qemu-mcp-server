# Setup

## Prerequisites

### Node.js 20+

Download from [nodejs.org](https://nodejs.org) or use a version manager:

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
