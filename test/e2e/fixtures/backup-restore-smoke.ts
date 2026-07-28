import {
  FileSystemDirectoryBackupStore,
  LocalSqliteBackupService,
  openOpfsLedger,
  type OpfsLedger,
} from "../../../packages/database/src";
import { Account, Money } from "../../../packages/domain/src";

export interface BackupRestoreSmokeResult {
  readonly archiveChecksumLength: number;
  readonly failedRestorePreservedData: boolean;
  readonly restoredAmountMinor: string;
  readonly laterAccountRemoved: boolean;
  readonly reopenedSchemaVersion: number;
}

export async function runBackupRestoreSmokeTest(options: {
  readonly filename: string;
  readonly backupDirectoryName: string;
}): Promise<BackupRestoreSmokeResult> {
  const originalAccount = Account.create({
    id: "backup-smoke-original",
    name: "Conto sintetico backup",
    type: "checking",
    currency: "EUR",
    openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
  });
  const laterAccount = Account.create({
    id: "backup-smoke-later",
    name: "Conto sintetico successivo",
    type: "cash",
    currency: "EUR",
    openingBalance: Money.fromMinor(42_000n, "EUR"),
  });
  const databaseDirectoryName = options.filename.split("/").filter(Boolean)[0];
  if (databaseDirectoryName === undefined) {
    throw new Error("The OPFS backup smoke filename has no directory.");
  }

  const root = await navigator.storage.getDirectory();
  const backupDirectory = await root.getDirectoryHandle(options.backupDirectoryName, {
    create: true,
  });
  let ledger: OpfsLedger | undefined;

  try {
    ledger = await openOpfsLedger({ filename: options.filename });
    await ledger.repository.saveAccount(originalAccount);
    const backupService = new LocalSqliteBackupService({
      database: ledger.database,
      store: new FileSystemDirectoryBackupStore(backupDirectory),
      passphrase: "passphrase-sintetica-e2e-backup",
      appVersion: "0.4.0",
      now: () => new Date("2026-07-27T10:00:00.000Z"),
      idFactory: () => "chromium-smoke",
    });
    const backup = await backupService.createBackup();
    await ledger.repository.saveAccount(laterAccount);

    await expectRestoreFailure(ledger);
    const failedRestorePreservedData =
      (await ledger.repository.findAccountById(laterAccount.id)) !== undefined;

    await backupService.restoreBackup(backup.id, backup.checksumSha256);
    const restored = await ledger.repository.findAccountById(originalAccount.id);
    const laterAccountRemoved =
      (await ledger.repository.findAccountById(laterAccount.id)) === undefined;
    await ledger.close();
    ledger = undefined;

    ledger = await openOpfsLedger({ filename: options.filename });
    const reopened = await ledger.repository.findAccountById(originalAccount.id);
    const reopenedSchemaVersion = ledger.migration.fromVersion;
    await ledger.close();
    ledger = undefined;

    if (restored === undefined || reopened === undefined) {
      throw new Error("The restored OPFS account was not preserved.");
    }

    return {
      archiveChecksumLength: backup.checksumSha256.length,
      failedRestorePreservedData,
      restoredAmountMinor: reopened.openingBalance.amountMinor.toString(),
      laterAccountRemoved,
      reopenedSchemaVersion,
    };
  } finally {
    await ledger?.close();
    await root.removeEntry(databaseDirectoryName, { recursive: true });
    await root.removeEntry(options.backupDirectoryName, { recursive: true });
  }
}

async function expectRestoreFailure(ledger: OpfsLedger): Promise<void> {
  try {
    await ledger.database.restoreDatabase(new Uint8Array(512).fill(7), 1);
    throw new Error("The invalid SQLite restore unexpectedly succeeded.");
  } catch (cause) {
    if (
      typeof cause !== "object" ||
      cause === null ||
      !("code" in cause) ||
      cause.code !== "restore_failed"
    ) {
      throw cause;
    }
  }
}
