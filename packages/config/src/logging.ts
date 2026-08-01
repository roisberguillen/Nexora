export type SafeLogLevel = "info" | "warn" | "error";
export type SafeLogEvent =
  | "app.started"
  | "app.error-boundary"
  | "persistence.opened"
  | "persistence.failed"
  | "persistence.demo-seed"
  | "pwa.offline"
  | "pwa.online"
  | "pwa.update";
export type SafeLogComponent = "app" | "error-boundary" | "persistence" | "service-worker";
export type SafeLogStatus = "started" | "completed" | "failed" | "online" | "offline";
export type SafeStorageKind = "indexeddb" | "opfs" | "native-sqlite";
export type SafeErrorName =
  "Error" | "RangeError" | "ReferenceError" | "SyntaxError" | "TypeError" | "UnknownError";

export interface SafeLogMetadata {
  readonly component?: SafeLogComponent;
  readonly status?: SafeLogStatus;
  readonly errorName?: SafeErrorName;
  readonly storageKind?: SafeStorageKind;
}

export interface SafeLogRecord {
  readonly timestamp: string;
  readonly level: SafeLogLevel;
  readonly event: SafeLogEvent;
  readonly metadata: SafeLogMetadata;
}

export type SafeLogSink = (record: SafeLogRecord) => void;

function defaultSink(record: SafeLogRecord): void {
  const writer = record.level === "error" ? console.error : console.info;
  writer("[nexora]", record);
}

export function classifyErrorName(error: unknown): SafeErrorName {
  if (!(error instanceof Error)) {
    return "UnknownError";
  }

  switch (error.name) {
    case "Error":
    case "RangeError":
    case "ReferenceError":
    case "SyntaxError":
    case "TypeError":
      return error.name;
    default:
      return "UnknownError";
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/giu, "Bearer [REDACTED]")
    .replace(
      /\b(access_token|authorization_code|passphrase|pin)\s*[:=]\s*[^\s,;]+/giu,
      "$1=[REDACTED]",
    )
    .replace(/\bIT\d{2}[A-Z]\d{10}[A-Z0-9]{12}\b/giu, "[REDACTED_IBAN]");
}

export function createSafeLogger(
  sink: SafeLogSink = defaultSink,
  now: () => Date = () => new Date(),
) {
  function write(level: SafeLogLevel, event: SafeLogEvent, metadata: SafeLogMetadata = {}): void {
    sink({
      timestamp: now().toISOString(),
      level,
      event,
      metadata,
    });
  }

  return {
    info: (event: SafeLogEvent, metadata?: SafeLogMetadata) => {
      write("info", event, metadata);
    },
    warn: (event: SafeLogEvent, metadata?: SafeLogMetadata) => {
      write("warn", event, metadata);
    },
    error: (event: SafeLogEvent, metadata?: SafeLogMetadata) => {
      write("error", event, metadata);
    },
  } as const;
}
