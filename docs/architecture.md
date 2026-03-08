# Architecture

## Overview

```
AI Agent (Claude, Cursor, VS Code, etc.)
    |  MCP Protocol (stdio or Streamable HTTP)
qemu-mcp-server
    |  Spawns + manages QEMU processes
    |  Connects via QMP Unix sockets
QEMU instances (one per VM)
    |  QMP JSON-RPC over Unix socket
Guest OS inside the VM
```

The server sits between an AI agent and QEMU. It translates MCP tool calls into QEMU operations: spawning processes, sending QMP commands, capturing console output.

## Component map

### src/qmp/ -- QMP client

Low-level QEMU communication. One QmpClient instance per VM.

- `types.ts` -- QMP protocol types (greeting, command, response, event)
- `errors.ts` -- Typed errors for connection, command, timeout, protocol failures
- `client.ts` -- Socket connection, capability handshake, command queue, event buffering

The QMP client knows nothing about MCP. It only speaks QMP.

### src/vm-manager.ts -- VM manager

Central coordinator. Manages the lifecycle of QEMU processes.

- Spawns QEMU with the right command-line flags
- Connects QmpClient to each VM
- Captures serial console output into a ring buffer
- Tracks VM state (creating, running, paused, shutdown, crashed, destroyed)
- Enforces max VM limit
- Cleans up on shutdown (SIGTERM, SIGINT)

### src/tools/ -- MCP tools

Each file registers tools with the MCP server. Tools are the actions agents can take.

- `vm-lifecycle.ts` -- create, destroy, list
- `vm-control.ts` -- pause, resume, reset, shutdown
- `vm-snapshot.ts` -- save, load, delete, list snapshots
- `vm-inspect.ts` -- status, info, console, memory dump
- `vm-exec.ts` -- console input, wait for output

### src/resources/ -- MCP resources

Read-only data agents can fetch. Resources are for reading, tools are for acting.

- `vm-status.ts` -- `vm://{vmId}/status`
- `vm-console.ts` -- `vm://{vmId}/console`
- `vm-snapshots.ts` -- `vm://{vmId}/snapshots`
- `server-info.ts` -- `server://info`

### src/transport/ -- Transport layer

Wires the MCP server to a communication channel.

- `stdio.ts` -- stdin/stdout for local use
- `http.ts` -- Streamable HTTP for remote use

### src/config/ -- Configuration

Loads settings from environment variables, validates with Zod.

### src/utils/ -- Utilities

- `logger.ts` -- JSON structured logging to stderr
- `id.ts` -- Human-readable VM ID generator
- `temp.ts` -- Temp directory management
- `ports.ts` -- Available port finder

## Import direction

```
src/tools/ --> src/vm-manager.ts --> src/qmp/
src/resources/ --> src/vm-manager.ts --> src/qmp/
src/transport/ (independent)
src/config/ (importable by anyone)
src/utils/ (importable by anyone)
src/types.ts (importable by anyone)
```

Tools and resources depend on the VM manager. The VM manager depends on the QMP client. Never reverse this direction.

## QMP protocol flow

1. Server spawns QEMU with `-qmp unix:/path/to/socket,server=on,wait=off`
2. QEMU creates the Unix socket and waits for connections
3. QmpClient connects to the socket
4. QEMU sends a greeting message with version info
5. QmpClient sends `qmp_capabilities` to complete the handshake
6. Now commands can be sent. One at a time, queued internally.
7. Events (SHUTDOWN, RESET, etc.) can arrive at any time between commands

## Console capture

QEMU runs with `-serial mon:stdio` which puts the serial console on stdout. The VM manager reads from the child process stdout pipe and stores lines in a ring buffer (default 1000 lines per VM). Tools and resources read from this buffer.

## QEMU command line

The server builds a QEMU command line from create_vm parameters:

```
qemu-system-{arch}
  -machine {machine}
  -cpu {cpu}
  -m {memoryMB}
  -smp {cpus}
  -nographic
  -serial mon:stdio
  -qmp unix:{socketPath},server=on,wait=off
  [-drive file={diskImage},format=qcow2,if=virtio -snapshot]
  [-kernel {kernelPath}]
  [-append {kernelArgs}]
```

## Error handling

Errors are categorized:

1. **Config errors** -- bad env vars, missing QEMU binary. Caught at startup.
2. **QMP connection errors** -- socket refused, dropped. Mapped to tool error responses.
3. **QMP command errors** -- QEMU rejected the command. Return QEMU's error message.
4. **Timeout errors** -- command took too long. Configurable timeouts.
5. **Resource limit errors** -- too many VMs. Check before acting.

Each error type has a dedicated error class. Tool handlers catch typed errors and return MCP error responses with helpful messages.

## Extending

### Adding a new architecture

Add an entry to `ARCH_CONFIG` in `src/types.ts`:

```typescript
riscv64: {
  binary: "qemu-system-riscv64",
  machine: "virt",
  cpu: "rv64",
}
```

### Adding a new tool

1. Create or edit a file in `src/tools/`
2. Register the tool with `server.tool(name, description, schema, handler)`
3. Import and call in `src/tools/index.ts`

### Adding a new resource

1. Create a file in `src/resources/`
2. Register with `server.resource(name, uri, metadata, handler)`
3. Import and call in `src/resources/index.ts`
