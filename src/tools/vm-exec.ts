// MCP tool definitions for VM execution: console input, wait for output.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VmManager } from "../vm-manager.js";

// Pause execution for a given number of milliseconds.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Register send_console_input and wait_for_console_output tools.
export function registerExecTools(
  server: McpServer,
  vmManager: VmManager,
): void {
  // Send text to the VM serial console.
  server.tool(
    "send_console_input",
    "Send text to a virtual machine's serial console stdin. The text is written directly to the serial port. Add a newline character (\\n) to simulate pressing Enter.",
    {
      vmId: z.string().describe("ID of the VM to send input to"),
      text: z
        .string()
        .describe(
          "Text to send to the serial console. Include \\n for Enter key.",
        ),
    },
    async (params) => {
      try {
        vmManager.sendConsoleInput(params.vmId, params.text);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  bytesSent: params.text.length,
                  status: "sent",
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
              text: `Failed to send console input to VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Wait for a pattern to appear in console output.
  server.tool(
    "wait_for_console_output",
    "Wait for a specific text pattern to appear in a VM's serial console output. Polls the console buffer until the pattern is found or the timeout expires. Returns the matching line and surrounding context.",
    {
      vmId: z.string().describe("ID of the VM to monitor"),
      pattern: z
        .string()
        .describe(
          "Text or regex pattern to wait for in the console output",
        ),
      timeoutMs: z
        .number()
        .int()
        .min(100)
        .max(300000)
        .optional()
        .describe(
          "Maximum time to wait in milliseconds (default: 30000, max: 300000)",
        ),
    },
    async (params) => {
      const timeout = params.timeoutMs ?? 30000;
      const pollInterval = 500;
      const deadline = Date.now() + timeout;

      let regex: RegExp;
      try {
        regex = new RegExp(params.pattern);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid regex pattern: "${params.pattern}". Provide a valid regular expression or plain text.`,
            },
          ],
          isError: true,
        };
      }

      try {
        while (Date.now() < deadline) {
          const lines = vmManager.getConsoleOutput(params.vmId);
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              // Return the matching line with some surrounding context.
              const contextStart = Math.max(0, i - 3);
              const contextEnd = Math.min(lines.length, i + 4);
              const context = lines.slice(contextStart, contextEnd);
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        vmId: params.vmId,
                        matched: true,
                        matchedLine: lines[i],
                        lineIndex: i,
                        context: context.join("\n"),
                      },
                      null,
                      2,
                    ),
                  },
                ],
              };
            }
          }
          await sleep(pollInterval);
        }

        // Timed out without finding the pattern.
        const recentLines = vmManager.getConsoleOutput(params.vmId, 20);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  vmId: params.vmId,
                  matched: false,
                  pattern: params.pattern,
                  timeoutMs: timeout,
                  recentOutput: recentLines.join("\n"),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to wait for console output on VM ${params.vmId}: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
