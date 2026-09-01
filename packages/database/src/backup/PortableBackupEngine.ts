import type { LedgerRepository } from "@nexora/domain";

import { BackupError } from "./BackupError";
import {
  BACKUP_FILE_EXTENSION,
  createEncryptedPayloadBackup,
  decryptEncryptedPayloadBackup,
  sha256Hex,
  type BackupManifest,
} from "./EncryptedSqliteBackup";
import {
  capturePortableLedgerSnapshot,
  decodePortableLedgerSnapshot,
  encodePortableLedgerSnapshot,
  validatePortableLedgerSnapshot,
  type PortableLedgerSnapshot,
  type ValidatedPortableLedgerSnapshot,
} from "./PortableLedgerSnapshot";
import { validateBackupId } from "./PhysicalBackupStore";

export interface PortableBackupRepository extends LedgerRepository {
  replacePortableSnapshot(snapshot: ValidatedPortableLedgerSnapshot): Promise<void>;
}

export interface PortableBackupEngineOptions {
  readonly repository: PortableBackupRepository;
  readonly schemaVersion: number;
  readonly appVersion?: string;
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  readonly cryptoProvider?: Crypto;
}

export interface CreatedPortableBackup {
  readonly id: string;
  readonly archive: Uint8Array;
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly size: number;
  readonly manifest: BackupManifest;
  readonly summary: PortableBackupContentsSummary;
}

export interface PortableBackupContentsSummary {
  readonly accounts: number;
  readonly categories: number;
  readonly tags: number;
  readonly transactions: number;
  readonly splits: number;
  readonly transfers: number;
  readonly budgets: number;
  readonly recurringRules: number;
  readonly allocationPlans: number;
  readonly loans: number;
  readonly investmentPositions: number;
  readonly monthlyJournals: number;
  readonly importBatches: number;
  readonly importRows: number;
  readonly transactionTags: number;
}

export interface VerifiedPortableBackup {
  readonly checksumSha256: string;
  readonly size: number;
  readonly manifest: BackupManifest;
  readonly summary: PortableBackupContentsSummary;
}

interface DecodedPortableBackup extends VerifiedPortableBackup {
  readonly snapshot: ValidatedPortableLedgerSnapshot;
  readonly canonicalSnapshot: string;
}

export class PortableBackupEngine {
  private readonly repository: PortableBackupRepository;
  private readonly schemaVersion: number;
  private readonly appVersion: string | undefined;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly cryptoProvider: Crypto;
  private operationTail: Promise<void> = Promise.resolve();

  public constructor(options: PortableBackupEngineOptions) {
    if (!Number.isInteger(options.schemaVersion) || options.schemaVersion < 0) {
      throw new BackupError("backup_failed", "The supported backup schema version is invalid.");
    }
    this.repository = options.repository;
    this.schemaVersion = options.schemaVersion;
    this.appVersion = options.appVersion;
    this.now = options.now ?? (() => new Date());
    this.cryptoProvider = options.cryptoProvider ?? globalThis.crypto;
    this.idFactory = options.idFactory ?? (() => this.cryptoProvider.randomUUID());
  }

  public createBackup(passphrase: string): Promise<CreatedPortableBackup> {
    return this.enqueue(async () => {
      try {
        const createdAt = timestamp(this.now());
        const payload = encodePortableLedgerSnapshot(
          await capturePortableLedgerSnapshot(this.repository),
        );
        const archive = await createEncryptedPayloadBackup({
          payloadBytes: payload,
          path: "ledger.json",
          schemaVersion: this.schemaVersion,
          createdAt,
          passphrase,
          ...(this.appVersion === undefined ? {} : { appVersion: this.appVersion }),
          cryptoProvider: this.cryptoProvider,
        });
        const verified = await this.decodeAndVerify(archive, passphrase);
        return {
          id: this.createBackupId(),
          archive,
          checksumSha256: verified.checksumSha256,
          createdAt,
          size: verified.size,
          manifest: verified.manifest,
          summary: verified.summary,
        };
      } catch (cause) {
        if (cause instanceof BackupError) throw cause;
        throw new BackupError(
          "backup_failed",
          "The encrypted portable backup could not be created.",
          cause,
        );
      }
    });
  }

  public verifyBackup(archive: Uint8Array, passphrase: string): Promise<VerifiedPortableBackup> {
    return this.enqueue(async () => {
      const verified = await this.decodeAndVerify(archive, passphrase);
      return {
        checksumSha256: verified.checksumSha256,
        size: verified.size,
        manifest: verified.manifest,
        summary: verified.summary,
      };
    });
  }

  public restoreBackup(archive: Uint8Array, passphrase: string): Promise<void> {
    return this.enqueue(async () => {
      const target = await this.decodeAndVerify(archive, passphrase);
      const rollbackSnapshot = normalizeSnapshot(
        await capturePortableLedgerSnapshot(this.repository),
      );
      const validatedRollback = validatePortableLedgerSnapshot(rollbackSnapshot);
      const canonicalRollback = canonicalSnapshot(rollbackSnapshot);

      try {
        await this.repository.replacePortableSnapshot(target.snapshot);
        const restoredSnapshot = normalizeSnapshot(
          await capturePortableLedgerSnapshot(this.repository),
        );
        validatePortableLedgerSnapshot(restoredSnapshot);
        if (canonicalSnapshot(restoredSnapshot) !== target.canonicalSnapshot) {
          throw new BackupError(
            "restore_failed",
            "The restored ledger does not match the verified backup.",
          );
        }
      } catch (cause) {
        try {
          await this.repository.replacePortableSnapshot(validatedRollback);
          const rolledBack = normalizeSnapshot(
            await capturePortableLedgerSnapshot(this.repository),
          );
          validatePortableLedgerSnapshot(rolledBack);
          if (canonicalSnapshot(rolledBack) !== canonicalRollback) {
            throw new Error("Rollback snapshot mismatch.");
          }
        } catch (rollbackCause) {
          throw new BackupError(
            "restore_failed",
            "The portable backup restore failed and the rollback could not be verified.",
            { cause, rollbackCause },
          );
        }
        throw new BackupError(
          "restore_failed",
          "The portable backup restore failed; the previous ledger was restored.",
          cause,
        );
      }
    });
  }

  private async decodeAndVerify(
    archive: Uint8Array,
    passphrase: string,
  ): Promise<DecodedPortableBackup> {
    const checksumSha256 = await sha256Hex(archive, this.cryptoProvider);
    const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase, this.cryptoProvider);
    if (decrypted.manifest.files[0].path !== "ledger.json") {
      throw new BackupError(
        "unsupported_backup",
        "The backup does not contain a portable Nexora ledger.",
      );
    }
    if (decrypted.manifest.schemaVersion > this.schemaVersion) {
      throw new BackupError(
        "unsupported_backup",
        "The backup was created by a newer Nexora database schema.",
      );
    }
    try {
      const decoded = decodePortableLedgerSnapshot(decrypted.payloadBytes);
      return {
        checksumSha256,
        size: archive.byteLength,
        manifest: decrypted.manifest,
        snapshot: validatePortableLedgerSnapshot(decoded),
        canonicalSnapshot: canonicalSnapshot(decoded),
        summary: summarizeSnapshot(decoded),
      };
    } catch (cause) {
      throw new BackupError("invalid_archive", "The portable ledger payload is invalid.", cause);
    }
  }

  private createBackupId(): string {
    const suffix = this.idFactory();
    if (
      typeof suffix !== "string" ||
      suffix.length < 1 ||
      suffix.length > 64 ||
      !/^[A-Za-z0-9-]+$/.test(suffix)
    ) {
      throw new BackupError("backup_failed", "The backup identifier factory is invalid.");
    }
    const id = `nexora-portable-${suffix}${BACKUP_FILE_EXTENSION}`;
    validateBackupId(id);
    return id;
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function summarizeSnapshot(snapshot: PortableLedgerSnapshot): PortableBackupContentsSummary {
  const entityCount = (name: string): number => snapshot.entities[name]?.length ?? 0;
  const relationCount = (name: string): number =>
    snapshot.relations[name]?.reduce<number>((total, relation) => {
      if (!relation || typeof relation !== "object" || Array.isArray(relation)) return total;
      const values = (relation as { readonly values?: unknown }).values;
      return total + (Array.isArray(values) ? values.length : 0);
    }, 0) ?? 0;
  return {
    accounts: entityCount("accounts"),
    categories: entityCount("categories"),
    tags: entityCount("tags"),
    transactions: entityCount("transactions"),
    splits: relationCount("splits"),
    transfers: entityCount("transfers"),
    budgets: entityCount("budgets"),
    recurringRules: entityCount("recurringRules"),
    allocationPlans: entityCount("allocationPlans"),
    loans: entityCount("loans"),
    investmentPositions: entityCount("investmentPositions"),
    monthlyJournals: entityCount("monthlyJournals"),
    importBatches: entityCount("importBatches"),
    importRows: relationCount("importRows"),
    transactionTags: relationCount("transactionTags"),
  };
}

function canonicalSnapshot(snapshot: PortableLedgerSnapshot): string {
  const parsed = JSON.parse(new TextDecoder().decode(encodePortableLedgerSnapshot(snapshot))) as
    null | boolean | number | string | readonly unknown[] | Record<string, unknown>;
  return JSON.stringify(canonicalValue(parsed));
}

function normalizeSnapshot(snapshot: PortableLedgerSnapshot): PortableLedgerSnapshot {
  return decodePortableLedgerSnapshot(encodePortableLedgerSnapshot(snapshot));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

function timestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) {
    throw new BackupError("backup_failed", "The backup clock returned an invalid timestamp.");
  }
  return value.toISOString();
}
