import type { BrowserLedger } from "@nexora/database";

export interface FinancialResetPreview {
  readonly accounts: number;
  readonly categories: number;
  readonly transactions: number;
  readonly imports: number;
  readonly plans: number;
  readonly budgets: number;
  readonly loans: number;
  readonly investments: number;
  readonly kept: readonly string[];
}

export async function previewFinancialReset(ledger: BrowserLedger): Promise<FinancialResetPreview> {
  const repository = ledger.repository;
  const [
    accounts,
    categories,
    transactions,
    imports,
    recurring,
    allocations,
    budgets,
    loans,
    investments,
  ] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
    repository.listTransactions(),
    repository.listImportBatches(),
    repository.listRecurringRules(),
    repository.listAllocationPlans(),
    repository.listBudgets(),
    repository.listLoans(),
    repository.listInvestmentPositions(),
  ]);
  return Object.freeze({
    accounts: accounts.length,
    categories: categories.length,
    transactions: transactions.length,
    imports: imports.length,
    plans: recurring.length + allocations.length,
    budgets: budgets.length,
    loans: loans.length,
    investments: investments.length,
    kept: Object.freeze(["Preferenze dell’app", "Backup esistenti", "Blocco app"]),
  });
}

export interface FinancialResetReceipt {
  readonly version: 1;
  readonly occurredAt: string;
  readonly storageKind: BrowserLedger["storageKind"];
  readonly backupChecksumPrefix?: string;
  readonly reset: FinancialResetPreview;
}

export function writeFinancialResetReceipt(
  receipt: FinancialResetReceipt,
  storage = localStorage,
): void {
  storage.setItem("nexora.financial-reset-receipt.v1", JSON.stringify(receipt));
}

export async function createVerifiedResetBackup(
  ledger: BrowserLedger,
  passphrase: string,
  saveArchive: (archive: Uint8Array, filename: string) => void,
): Promise<string> {
  if (passphrase.trim().length < 12 || ledger.createEncryptedBackupArchive === undefined) {
    throw new Error("Inserisci una passphrase backup di almeno 12 caratteri.");
  }
  const backup = await ledger.createEncryptedBackupArchive({ passphrase });
  await ledger.verifyEncryptedBackupArchive?.({ archive: backup.archive, passphrase });
  saveArchive(backup.archive, backup.id);
  return backup.checksumSha256.slice(0, 12);
}
