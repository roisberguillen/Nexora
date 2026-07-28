import { openOpfsLedger } from "../../../packages/database/src";
import { Account, Money } from "../../../packages/domain/src";

export interface OpfsSmokeResult {
  readonly amountMinor: string;
  readonly firstMigrationVersion: number;
  readonly reopenedFromVersion: number;
  readonly storageKind: string;
}

export async function runOpfsSmokeTest(filename: string): Promise<OpfsSmokeResult> {
  const account = Account.create({
    id: "opfs-smoke-account",
    name: "Conto sintetico OPFS",
    type: "checking",
    currency: "EUR",
    openingBalance: Money.fromMinor(900719925474099312345678901234567890n, "EUR"),
  });
  const directoryName = filename.split("/").filter(Boolean)[0];
  if (directoryName === undefined) {
    throw new Error("The OPFS smoke filename has no directory.");
  }

  try {
    const firstLedger = await openOpfsLedger({ filename });
    await firstLedger.repository.saveAccount(account);
    const firstMigrationVersion = firstLedger.migration.toVersion;
    const storageKind = firstLedger.database.storageKind;
    await firstLedger.close();

    const reopenedLedger = await openOpfsLedger({ filename });
    const restored = await reopenedLedger.repository.findAccountById(account.id);
    const reopenedFromVersion = reopenedLedger.migration.fromVersion;
    await reopenedLedger.close();

    if (restored === undefined) {
      throw new Error("The persisted OPFS account was not restored.");
    }

    return {
      amountMinor: restored.openingBalance.amountMinor.toString(),
      firstMigrationVersion,
      reopenedFromVersion,
      storageKind,
    };
  } finally {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(directoryName, { recursive: true });
  }
}
