// MCP tool definitions for VM snapshots: save, load, delete, list.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VmManager } from "../vm-manager.js";

// Register save_snapshot, load_snapshot, delete_snapshot, and list_snapshots tools.
export function registerSnapshotTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  // Save a named snapshot of the VM state.
  server.tool(
    "save_snapshot",
    "Save a named snapshot of a virtual machine. Captures the full VM state including memory, CPU, and disk. Use load_snapshot to restore it later.",
    {
      vmId: z.string().describe("ID of the VM to snapshot"),
      name: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-zA-Z0-9_-]+$/, "Snapshot names may only contain letters, digits, hyphens, and underscores.")
        .describe("Name for the snapshot. Must be unique within the VM. Letters, digits, hyphens, underscores only."),
    },
    async (params) => {
      try {
        const result = await vmManager.executeQmp(
          params.vmId,
          "human-monitor-command",
          { "command-line": `savevm ${params.name}` },
        );
        const output = typeof result === "string" ? result : "";
        if (output && output.trim().length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Snapshot may have failed: ${output.trim()}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  snapshot: params.name,
                  status: "saved",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to save snapshot "${params.name}" on VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Load a previously saved snapshot.
  server.tool(
    "load_snapshot",
    "Restore a virtual machine to a previously saved snapshot. Replaces current VM state with the snapshot state. The VM must have a snapshot with the given name.",
    {
      vmId: z.string().describe("ID of the VM to restore"),
      name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, "Snapshot names may only contain letters, digits, hyphens, and underscores.").describe("Name of the snapshot to load"),
    },
    async (params) => {
      try {
        const result = await vmManager.executeQmp(
          params.vmId,
          "human-monitor-command",
          { "command-line": `loadvm ${params.name}` },
        );
        const output = typeof result === "string" ? result : "";
        if (output && output.trim().length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Snapshot load may have failed: ${output.trim()}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  snapshot: params.name,
                  status: "loaded",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to load snapshot "${params.name}" on VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Delete a saved snapshot.
  server.tool(
    "delete_snapshot",
    "Delete a saved snapshot from a virtual machine. Frees the storage used by the snapshot. This cannot be undone.",
    {
      vmId: z.string().describe("ID of the VM owning the snapshot"),
      name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, "Snapshot names may only contain letters, digits, hyphens, and underscores.").describe("Name of the snapshot to delete"),
    },
    async (params) => {
      try {
        const result = await vmManager.executeQmp(
          params.vmId,
          "human-monitor-command",
          { "command-line": `delvm ${params.name}` },
        );
        const output = typeof result === "string" ? result : "";
        if (output && output.trim().length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Snapshot delete may have failed: ${output.trim()}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  snapshot: params.name,
                  status: "deleted",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete snapshot "${params.name}" on VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // List all snapshots for a VM.
  server.tool(
    "list_snapshots",
    "List all saved snapshots for a virtual machine. Returns snapshot names, IDs, sizes, and creation times. Returns an empty list if no snapshots exist.",
    {
      vmId: z.string().describe("ID of the VM to list snapshots for"),
    },
    async (params) => {
      try {
        const result = await vmManager.executeQmp(
          params.vmId,
          "human-monitor-command",
          { "command-line": "info snapshots" },
        );
        const output = typeof result === "string" ? result : "";
        return {
          content: [
            {
              type: "text" as const,
              text: output.trim() || "No snapshots found.",
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list snapshots for VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
