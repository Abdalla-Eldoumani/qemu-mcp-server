// Custom error classes for QMP client failures.

// Socket connection failed or dropped unexpectedly.
export class QmpConnectionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "QmpConnectionError";
  }
}

// QEMU returned an error response to a command.
export class QmpCommandError extends Error {
  readonly errorClass: string;
  readonly desc: string;

  constructor(errorClass: string, desc: string) {
    super(`QMP command failed: ${errorClass} -- ${desc}`);
    this.name = "QmpCommandError";
    this.errorClass = errorClass;
    this.desc = desc;
  }
}

// No response received within the allowed time.
export class QmpTimeoutError extends Error {
  readonly command: string;
  readonly timeoutMs: number;

  constructor(command: string, timeoutMs: number) {
    super(
      `QMP command "${command}" timed out after ${timeoutMs}ms. ` +
        `QEMU may be unresponsive or the command may take longer than expected.`
    );
    this.name = "QmpTimeoutError";
    this.command = command;
    this.timeoutMs = timeoutMs;
  }
}

// Received data that is not valid JSON or does not match QMP protocol format.
export class QmpProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QmpProtocolError";
  }
}
