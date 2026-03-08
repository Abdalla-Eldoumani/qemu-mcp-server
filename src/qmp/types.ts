// QMP protocol types. Only the subset we actually use.

// Greeting sent by QEMU when a QMP connection opens.
export interface QmpGreeting {
  QMP: {
    version: {
      qemu: { major: number; minor: number; micro: number };
      package: string;
    };
    capabilities: string[];
  };
}

// A command sent to QEMU over QMP.
export interface QmpCommand {
  execute: string;
  arguments?: Record<string, unknown>;
  id?: string;
}

// A successful response from QEMU.
export interface QmpResponse {
  return: unknown;
  id?: string;
}

// An error response from QEMU.
export interface QmpError {
  error: { class: string; desc: string };
  id?: string;
}

// An asynchronous event from QEMU (SHUTDOWN, RESET, etc.).
export interface QmpEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp: { seconds: number; microseconds: number };
}

// Check if a parsed message is a successful QMP response.
export function isQmpResponse(msg: unknown): msg is QmpResponse {
  if (typeof msg !== "object" || msg === null) return false;
  return "return" in msg;
}

// Check if a parsed message is a QMP error.
export function isQmpError(msg: unknown): msg is QmpError {
  if (typeof msg !== "object" || msg === null) return false;
  return "error" in msg;
}

// Check if a parsed message is a QMP event.
export function isQmpEvent(msg: unknown): msg is QmpEvent {
  if (typeof msg !== "object" || msg === null) return false;
  return "event" in msg && "timestamp" in msg;
}

// Check if a parsed message is a QMP greeting.
export function isQmpGreeting(msg: unknown): msg is QmpGreeting {
  if (typeof msg !== "object" || msg === null) return false;
  return "QMP" in msg;
}
