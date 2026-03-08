# Tools reference

All tools available to AI agents through the MCP protocol.

## VM lifecycle

### create_vm

Create and start a new QEMU virtual machine.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| arch | "aarch64" \| "x86_64" | yes | CPU architecture |
| memoryMB | number | yes | Memory in megabytes (64-16384) |
| cpus | number | no | CPU cores (1-16, default 1) |
| diskImage | string | no | Path to qcow2 disk image |
| kernel | string | no | Path to kernel binary |
| kernelArgs | string | no | Kernel command line arguments |

**Returns:** JSON with vmId, state, arch, memoryMB, pid.

**Example response:**
```json
{
  "vmId": "swift-fox-4821",
  "state": "running",
  "arch": "aarch64",
  "memoryMB": 256,
  "pid": 12345
}
```

### destroy_vm

Stop a VM and clean up all its resources.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | ID of the VM to destroy |

### list_vms

List all active VMs with their current state.

**Parameters:** None.

**Returns:** JSON array of VM objects with id, state, arch, memoryMB.

## VM control

### pause_vm

Pause VM execution. The VM freezes in place.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | ID of the VM to pause |

### resume_vm

Resume a paused VM.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | ID of the VM to resume |

### reset_vm

Hard reset a VM. Equivalent to pressing the reset button.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | ID of the VM to reset |

### shutdown_vm

Send an ACPI shutdown request. The guest OS handles the actual shutdown.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | ID of the VM to shut down |

## Snapshots

### save_snapshot

Save the current VM state to a named snapshot.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| name | string | yes | Snapshot name |

### load_snapshot

Restore a VM to a previously saved snapshot.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| name | string | yes | Snapshot name to restore |

### delete_snapshot

Remove a saved snapshot.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| name | string | yes | Snapshot name to delete |

### list_snapshots

List all saved snapshots for a VM.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |

**Returns:** Snapshot list from QEMU.

## Inspection

### get_vm_status

Get the current run state of a VM.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |

**Returns:** Run state from QMP plus VM metadata.

### get_vm_info

Get full hardware information about a VM: CPU count, block devices, memory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |

### read_console

Read recent serial console output from a VM.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| lines | number | no | Number of lines to return (default: all buffered) |

**Returns:** Plain text console output.

### dump_memory

Save a region of VM physical memory to a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| address | number | yes | Start address |
| size | number | yes | Number of bytes |
| filepath | string | yes | Output file path |

## Execution

### send_console_input

Type text into the VM serial console.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| text | string | yes | Text to send (include \n for enter) |

### wait_for_console_output

Wait for a pattern to appear in console output.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| vmId | string | yes | VM ID |
| pattern | string | yes | Text pattern to wait for |
| timeoutMs | number | no | Timeout in milliseconds (default: 30000) |

**Returns:** Matched console output.
