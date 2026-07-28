import type { SqliteValue } from "../sqlite/SqliteDatabase";

export type OpfsWorkerRequest =
  | {
      readonly id: number;
      readonly type: "open";
      readonly filename: string;
    }
  | {
      readonly id: number;
      readonly type: "execute";
      readonly sql: string;
    }
  | {
      readonly id: number;
      readonly type: "query";
      readonly sql: string;
      readonly parameters: readonly SqliteValue[];
    }
  | {
      readonly id: number;
      readonly type: "run";
      readonly sql: string;
      readonly parameters: readonly SqliteValue[];
    }
  | {
      readonly id: number;
      readonly type: "export";
    }
  | {
      readonly id: number;
      readonly type: "restore";
      readonly bytes: Uint8Array;
      readonly expectedSchemaVersion: number;
    }
  | {
      readonly id: number;
      readonly type: "close";
    };

export type OpfsWorkerResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly rows?: readonly Record<string, SqliteValue>[];
      readonly bytes?: Uint8Array;
    }
  | {
      readonly id: number;
      readonly ok: false;
      readonly code: "opfs_unavailable" | "restore_failed" | "worker_failed";
    };

export type OpfsWorkerRequestWithoutId = OpfsWorkerRequest extends infer Request
  ? Request extends { readonly id: number }
    ? Omit<Request, "id">
    : never
  : never;

export type OpfsWorkerSuccessResponse = Extract<OpfsWorkerResponse, { readonly ok: true }>;

export function isOpfsWorkerResponse(value: unknown): value is OpfsWorkerResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!Number.isInteger(candidate.id) || typeof candidate.ok !== "boolean") {
    return false;
  }
  if (candidate.ok === true) {
    return (
      (candidate.rows === undefined || Array.isArray(candidate.rows)) &&
      (candidate.bytes === undefined || candidate.bytes instanceof Uint8Array)
    );
  }
  return (
    candidate.code === "opfs_unavailable" ||
    candidate.code === "restore_failed" ||
    candidate.code === "worker_failed"
  );
}
