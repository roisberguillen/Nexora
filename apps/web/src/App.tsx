import { classifyErrorName, createSafeLogger } from "@nexora/config";
import { seedDemoLedger, type BrowserLedger } from "@nexora/database";
import { executeConfirmedAllocationPlans, LocalDate } from "@nexora/domain";
import type {
  Account,
  AllocationPlan,
  Budget,
  Loan,
  InvestmentPosition,
  MonthlyJournal,
  Category,
  ImportBatch,
  RecurringRule,
  Tag,
  TrashedTransaction,
  Transaction,
} from "@nexora/domain";
import { AppShell, ErrorBoundary, type GlobalSearchResult, type QuickAction } from "@nexora/ui";
import { lazy, Suspense, useEffect, useState } from "react";

import {
  createLedgerAccount,
  setLedgerAccountArchived,
  updateLedgerAccount,
  type CreateLedgerAccountInput,
  type UpdateLedgerAccountInput,
} from "./accounts/accountCommands";
import { AccountsPage } from "./accounts/AccountsPage";
import { CategoriesPage } from "./categories/CategoriesPage";
import { TagsPage } from "./tags/TagsPage";
import {
  createLedgerCategory,
  updateLedgerCategory,
  type CategoryInput,
} from "./categories/categoryCommands";
import { createLedgerTag, updateLedgerTag, type TagInput } from "./tags/tagCommands";
import { buildAccountsViewModel, type AccountsViewModel } from "./accounts/buildAccountsViewModel";
import {
  buildDashboardViewModel,
  type DashboardViewModel,
} from "./dashboard/buildDashboardViewModel";
import { Dashboard } from "./dashboard/Dashboard";
import {
  createManualTransaction,
  createTransfer,
  type CreateManualTransactionInput,
  type CreateTransferInput,
} from "./transactions/transactionCommands";
import {
  buildTransactionsViewModel,
  type TransactionsViewModel,
} from "./transactions/buildTransactionsViewModel";
import { TransactionsPage } from "./transactions/TransactionsPage";
import { commitMoneyManagerImport } from "./imports/importCommands";
import { RecurringPage } from "./recurring/RecurringPage";
import {
  createRecurringRule,
  updateRecurringRule,
  type RecurringRuleInput,
} from "./recurring/recurringCommands";
import { createAllocationPlan, type AllocationPlanInput } from "./recurring/allocationCommands";
import { BudgetsPage } from "./budgets/BudgetsPage";
import { createBudget, type BudgetInput } from "./budgets/budgetCommands";
import { LoansPage } from "./loans/LoansPage";
import { createLoan, type LoanInput } from "./loans/loanCommands";
import { InvestmentsPage } from "./investments/InvestmentsPage";
import {
  createInvestmentPosition,
  type InvestmentPositionInput,
} from "./investments/investmentCommands";
import { ExportsPage } from "./exports/ExportsPage";
import { BackupPage } from "./backup/BackupPage";
import { JournalPage } from "./journal/JournalPage";
import { saveMonthlyJournal, type MonthlyJournalInput } from "./journal/journalCommands";
import { AnalyticsPage } from "./analytics/AnalyticsPage";
import { ProfilePage } from "./profile/ProfilePage";
import { SettingsPage } from "./settings/SettingsPage";
import { NotificationsPage } from "./notifications/NotificationsPage";
import { PrivacySecurityPage } from "./security/PrivacySecurityPage";
import { AppLockScreen } from "./security/AppLockScreen";
import {
  getAppLockTimeoutMilliseconds,
  readAppLock,
  verifyAppLock,
  type AppLockConfig,
} from "./security/appLock";
import { resetLocalApp } from "./reset/resetLocalApp";
import {
  createVerifiedResetBackup,
  previewFinancialReset,
  writeFinancialResetReceipt,
} from "./reset/financialReset";
import { readTotalResetReport, runTotalReset, writeTotalResetReport } from "./reset/totalReset";
import { GoogleDriveBackupProvider } from "./cloud/GoogleDriveBackupProvider";
import { GoogleIdentityAuth } from "./cloud/GoogleIdentityAuth";
import { readGoogleCloudConfig } from "./cloud/cloudConfig";
import { loadGoogleIdentity } from "./cloud/loadGoogleIdentity";
import { StartupLoadingScreen } from "./startup/StartupLoadingScreen";
import { StartupRecoveryScreen } from "./startup/StartupRecoveryScreen";
import {
  selectableRecoveryArchives,
  StartupRecoveryRequiredError,
  writeRecoverySelection,
} from "./startup/StartupRecovery";
import {
  createStartupDiagnostics,
  serializeStartupDiagnostics,
} from "./startup/StartupDiagnostics";
import type { StartupBootstrap } from "./startup/StartupBootstrap";
import type { StartupProgressEvent } from "./startup/StartupOrchestrator";

const logger = createSafeLogger();
const ImportsPage = lazy(async () => {
  const module = await import("./imports/ImportsPage");
  return { default: module.ImportsPage };
});

interface ReadyLedgerState {
  readonly rawAccounts: readonly Account[];
  readonly rawTransactions: readonly Transaction[];
  readonly importBatches: readonly ImportBatch[];
  readonly recurringRules: readonly RecurringRule[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly investmentPositions: readonly InvestmentPosition[];
  readonly monthlyJournals: readonly MonthlyJournal[];
  readonly accounts: AccountsViewModel;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly trashedTransactions: readonly TrashedTransaction[];
  readonly dashboard: DashboardViewModel;
  readonly transactions: TransactionsViewModel;
  readonly ledger: BrowserLedger;
  readonly status: "ready";
}

type LedgerState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: unknown }
  | ReadyLedgerState;

interface AppProps {
  readonly ledgerPromise: Promise<BrowserLedger>;
  readonly startupBootstrap?: Pick<StartupBootstrap, "getProgress" | "subscribe">;
  readonly seedLedger?: typeof seedDemoLedger;
}

export function App({ ledgerPromise, seedLedger = seedDemoLedger, startupBootstrap }: AppProps) {
  const route = useAppRoute();
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    status: "loading",
  });
  const [startupProgress, setStartupProgress] = useState<StartupProgressEvent | undefined>(() =>
    startupBootstrap?.getProgress(),
  );
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeedFeedback, setHasSeedFeedback] = useState(false);
  const [appLockConfig, setAppLockConfig] = useState<AppLockConfig | undefined>(() =>
    readAppLock(),
  );
  const [isAppLocked, setIsAppLocked] = useState(() => readAppLock() !== undefined);
  const [totalResetReport] = useState(() => readTotalResetReport());

  useEffect(() => {
    if (!appLockConfig || isAppLocked) return;
    let timeoutId: number | undefined;
    const refreshTimeout = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(
        () => setIsAppLocked(true),
        getAppLockTimeoutMilliseconds(appLockConfig),
      );
    };
    window.addEventListener("pointerdown", refreshTimeout);
    window.addEventListener("keydown", refreshTimeout);
    refreshTimeout();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", refreshTimeout);
      window.removeEventListener("keydown", refreshTimeout);
    };
  }, [appLockConfig, isAppLocked]);

  useEffect(() => {
    let isActive = true;

    void ledgerPromise
      .then(async (ledger) => ({ ...(await loadAppModels(ledger)), ledger }))
      .then(
        ({
          accounts,
          allocationPlans,
          budgets,
          loans,
          investmentPositions,
          monthlyJournals,
          categories,
          dashboard,
          importBatches,
          recurringRules,
          rawAccounts,
          rawTransactions,
          tags,
          trashedTransactions,
          transactions,
          ledger,
        }) => {
          if (!isActive) {
            return;
          }
          logger.info("persistence.opened", {
            component: "persistence",
            status: "completed",
            storageKind: ledger.storageKind,
          });
          setLedgerState({
            accounts,
            allocationPlans,
            budgets,
            loans,
            investmentPositions,
            monthlyJournals,
            categories,
            dashboard,
            importBatches,
            recurringRules,
            ledger,
            rawAccounts,
            rawTransactions,
            status: "ready",
            tags,
            trashedTransactions,
            transactions,
          });
        },
      )
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        logger.error("persistence.failed", {
          component: "persistence",
          status: "failed",
          errorName: classifyErrorName(error),
        });
        setLedgerState({ error, status: "error" });
      });

    return () => {
      isActive = false;
    };
  }, [ledgerPromise]);

  useEffect(() => startupBootstrap?.subscribe(setStartupProgress), [startupBootstrap]);

  const addDemoData = async (): Promise<void> => {
    if (ledgerState.status !== "ready" || isSeeding) {
      return;
    }

    setIsSeeding(true);
    setHasSeedFeedback(false);
    logger.info("persistence.demo-seed", {
      component: "persistence",
      status: "started",
      storageKind: ledgerState.ledger.storageKind,
    });

    try {
      await seedLedger(ledgerState.ledger.repository);
      const models = await loadAppModels(ledgerState.ledger);
      setLedgerState({ ...ledgerState, ...models });
      setHasSeedFeedback(true);
      logger.info("persistence.demo-seed", {
        component: "persistence",
        status: "completed",
        storageKind: ledgerState.ledger.storageKind,
      });
    } catch (error) {
      logger.error("persistence.demo-seed", {
        component: "persistence",
        status: "failed",
        errorName: classifyErrorName(error),
        storageKind: ledgerState.ledger.storageKind,
      });
      setLedgerState({ error, status: "error" });
    } finally {
      setIsSeeding(false);
    }
  };

  const mutateLedger = async (
    operation: (ledger: BrowserLedger) => Promise<void>,
  ): Promise<void> => {
    if (ledgerState.status !== "ready") {
      return;
    }
    await operation(ledgerState.ledger);
    const models = await loadAppModels(ledgerState.ledger);
    setLedgerState({ ...ledgerState, ...models });
  };

  const createAccount = (input: CreateLedgerAccountInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createLedgerAccount(ledger.repository, input);
    });

  const updateAccount = (accountId: string, input: UpdateLedgerAccountInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await updateLedgerAccount(ledger.repository, accountId, input);
    });

  const setAccountArchived = (accountId: string, isArchived: boolean): Promise<void> =>
    mutateLedger(async (ledger) => {
      await setLedgerAccountArchived(ledger.repository, accountId, isArchived);
    });

  const createCategory = (input: CategoryInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createLedgerCategory(ledger.repository, input);
    });
  const updateCategory = (
    id: string,
    input: CategoryInput & { readonly isArchived: boolean },
  ): Promise<void> =>
    mutateLedger(async (ledger) => {
      await updateLedgerCategory(ledger.repository, id, input);
    });
  const deleteUnusedCategory = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.deleteUnusedCategory(id);
    });
  const mergeCategory = (sourceId: string, targetId: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.mergeCategory(sourceId, targetId);
    });

  const createTag = (input: TagInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createLedgerTag(ledger.repository, input);
    });
  const updateTag = (
    id: string,
    input: TagInput & { readonly isArchived: boolean },
  ): Promise<void> =>
    mutateLedger(async (ledger) => {
      await updateLedgerTag(ledger.repository, id, input);
    });
  const deleteUnusedTag = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.deleteUnusedTag(id);
    });
  const mergeTag = (sourceId: string, targetId: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.mergeTag(sourceId, targetId);
    });
  const removeTagGlobally = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.removeTagGlobally(id);
    });

  const createManualMovement = async (
    input: CreateManualTransactionInput,
  ): Promise<readonly string[]> => {
    let salaryAllocationPlanIds: readonly string[] = [];
    await mutateLedger(async (ledger) => {
      const transaction = await createManualTransaction(ledger.repository, input);
      const [rules, plans] = await Promise.all([
        ledger.repository.listRecurringRules(),
        ledger.repository.listAllocationPlans(),
      ]);
      if (
        rules.some(
          (rule) =>
            rule.weekendPolicy === "salary_italy" && rule.matchesBookedTransaction(transaction),
        )
      ) {
        salaryAllocationPlanIds = plans
          .filter((plan) => plan.enabled && plan.trigger === "salary")
          .map((plan) => plan.id);
      }
    });
    return salaryAllocationPlanIds;
  };

  const createTransferMovement = (input: CreateTransferInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createTransfer(ledger.repository, input);
    });

  const cancelMovement = (id: string, isTransfer: boolean): Promise<void> =>
    mutateLedger(async (ledger) => {
      if (isTransfer) {
        await ledger.repository.cancelTransfer(id);
      } else {
        await ledger.repository.cancelTransaction(id);
      }
    });
  const trashMovement = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.trashTransaction(id);
    });
  const trashMovements = (ids: readonly string[]): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.trashTransactions(ids);
    });
  const deleteUnusedAccount = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.deleteUnusedAccount(id);
    });
  const emptyAccount = async (accountId: string, pin?: string): Promise<void> => {
    if (appLockConfig && !(await verifyAppLock(pin ?? "", appLockConfig)))
      throw new Error("PIN o passphrase non corretti.");
    await mutateLedger(async (ledger) => {
      const accounts = await ledger.repository.listAccounts();
      if (accounts.some((account) => account.parentAccountId === accountId && !account.isArchived))
        throw new Error("Archivia prima tutti i sottoconti attivi.");
      const transactionIds = (await ledger.repository.listTransactions())
        .filter((transaction) => transaction.accountId === accountId)
        .map((transaction) => transaction.id);
      if (transactionIds.length === 0) return;
      await ledger.repository.trashTransactions(transactionIds);
    });
  };
  const previewResetFinancialData = () =>
    ledgerState.status === "ready"
      ? previewFinancialReset(ledgerState.ledger)
      : Promise.reject(new Error("Ledger non pronto"));
  const createResetBackup = async (passphrase: string): Promise<string> => {
    if (ledgerState.status !== "ready") throw new Error("Ledger non pronto");
    return createVerifiedResetBackup(ledgerState.ledger, passphrase, (archive, filename) => {
      const anchor = document.createElement("a");
      const bytes = new Uint8Array(archive);
      const url = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" }),
      );
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  };
  const resetFinancialData = async (input: {
    readonly backupChecksumPrefix?: string;
    readonly pin?: string;
  }): Promise<void> => {
    const preview = await previewResetFinancialData();
    if (appLockConfig && !(await verifyAppLock(input.pin ?? "", appLockConfig))) {
      throw new Error("PIN o passphrase non corretti.");
    }
    await mutateLedger(async (ledger) => {
      await ledger.repository.resetFinancialData();
    });
    window.localStorage.removeItem("nexora.local-notifications.v1");
    writeFinancialResetReceipt({
      version: 1,
      occurredAt: new Date().toISOString(),
      storageKind: ledgerState.status === "ready" ? ledgerState.ledger.storageKind : "indexeddb",
      ...(input.backupChecksumPrefix === undefined
        ? {}
        : { backupChecksumPrefix: input.backupChecksumPrefix }),
      reset: preview,
    });
  };
  const restoreTrashedTransaction = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.restoreTransaction(id);
    });
  const purgeTrashedTransaction = (id: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.purgeTrashedTransaction(id);
    });
  const purgeTrashedTransactions = (ids: readonly string[]): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.purgeTrashedTransactions(ids);
    });
  const resetApplication = async (input: { readonly deleteCloud: boolean }) => {
    if (ledgerState.status !== "ready") throw new Error("Ledger non pronto");
    let cloud: GoogleDriveBackupProvider | undefined;
    if (input.deleteCloud) {
      const config = readGoogleCloudConfig();
      if (config.enabled) {
        try {
          await loadGoogleIdentity();
          const auth = new GoogleIdentityAuth(config.clientId);
          await auth.connect();
          cloud = new GoogleDriveBackupProvider(() => auth.getAccessToken());
        } catch {
          // The local reset remains independent from a failed optional cloud authorization.
        }
      }
    }
    const report = await runTotalReset({
      deleteCloud: input.deleteCloud,
      resetLocal: () => resetLocalApp(ledgerState.ledger),
      ...(cloud === undefined ? {} : { cloud }),
    });
    if (report.local === "succeeded") {
      writeTotalResetReport(report);
      window.location.hash = "#overview";
      window.location.reload();
    }
    return report;
  };
  const commitImport = (input: Parameters<typeof commitMoneyManagerImport>[1]): Promise<void> =>
    mutateLedger(async (ledger) => {
      await commitMoneyManagerImport(ledger.repository, input);
    });
  const undoImport = (batchId: string): Promise<void> =>
    mutateLedger(async (ledger) => {
      await ledger.repository.undoImportBatch(batchId);
    });
  const createRecurring = (input: RecurringRuleInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createRecurringRule(ledger.repository, input);
    });
  const updateRecurring = (id: string, input: RecurringRuleInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await updateRecurringRule(ledger.repository, id, input);
    });
  const createAllocation = (input: AllocationPlanInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createAllocationPlan(ledger.repository, input);
    });
  const createMonthlyBudget = (input: BudgetInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createBudget(ledger.repository, input);
    });
  const createLoanPosition = (input: LoanInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createLoan(ledger.repository, input);
    });
  const createInvestment = (input: InvestmentPositionInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createInvestmentPosition(ledger.repository, input);
    });
  const saveJournal = (input: MonthlyJournalInput, existingId: string | undefined): Promise<void> =>
    mutateLedger(async (ledger) => {
      await saveMonthlyJournal(ledger.repository, input, existingId);
    });
  const executeAllocations = (planIds: readonly string[]): Promise<void> =>
    mutateLedger(async (ledger) => {
      const plans = (await ledger.repository.listAllocationPlans()).filter((plan) =>
        planIds.includes(plan.id),
      );
      const bookedDate = new Intl.DateTimeFormat("sv-SE", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Rome",
        year: "numeric",
      }).format(new Date());
      await executeConfirmedAllocationPlans(ledger.repository, plans, LocalDate.parse(bookedDate));
    });

  return (
    <ErrorBoundary
      onError={(error) => {
        logger.error("app.error-boundary", {
          component: "error-boundary",
          status: "failed",
          errorName: classifyErrorName(error),
        });
      }}
    >
      {appLockConfig && isAppLocked ? (
        <AppLockScreen config={appLockConfig} onUnlock={() => setIsAppLocked(false)} />
      ) : (
        <AppShell
          activeRoute={route}
          quickActions={quickActions}
          searchResults={
            ledgerState.status === "ready" ? buildGlobalSearchResults(ledgerState) : []
          }
        >
          {ledgerState.status === "ready" ? (
            route === "accounts" ? (
              <AccountsPage
                activityByAccount={Object.fromEntries(
                  ledgerState.rawAccounts.map((account) => {
                    const transactions = ledgerState.rawTransactions.filter(
                      (transaction) => transaction.accountId === account.id,
                    );
                    return [
                      account.id,
                      {
                        transactions: transactions.length,
                        transfers: transactions.filter(
                          (transaction) => transaction.kind === "transfer",
                        ).length,
                      },
                    ];
                  }),
                )}
                model={ledgerState.accounts}
                onCreate={createAccount}
                onDeleteUnused={deleteUnusedAccount}
                onEmpty={emptyAccount}
                requiresEmptyPin={appLockConfig !== undefined}
                onSetArchived={setAccountArchived}
                onUpdate={updateAccount}
              />
            ) : route === "transactions" || route === "new-transaction" ? (
              <TransactionsPage
                initialEditorOpen={route === "new-transaction"}
                model={ledgerState.transactions}
                standaloneEditor={route === "new-transaction"}
                tags={ledgerState.tags}
                onCancel={cancelMovement}
                onTrash={trashMovement}
                onTrashMany={trashMovements}
                onCreateManual={createManualMovement}
                onCreateTransfer={createTransferMovement}
                onExecuteSalaryAllocations={executeAllocations}
              />
            ) : route === "categories" ? (
              <CategoriesPage
                categories={ledgerState.categories}
                onCreate={createCategory}
                onDeleteUnused={deleteUnusedCategory}
                onMerge={mergeCategory}
                onUpdate={updateCategory}
              />
            ) : route === "tags" ? (
              <TagsPage
                tags={ledgerState.tags}
                onCreate={createTag}
                onDeleteUnused={deleteUnusedTag}
                onMerge={mergeTag}
                onRemoveGlobally={removeTagGlobally}
                onUpdate={updateTag}
              />
            ) : route === "imports" ? (
              <Suspense
                fallback={
                  <section
                    aria-live="polite"
                    className="ledger-state-card is-loading"
                    role="status"
                  >
                    Preparazione dell’anteprima XLSX…
                  </section>
                }
              >
                <ImportsPage
                  accounts={ledgerState.rawAccounts}
                  categories={ledgerState.categories}
                  transactions={ledgerState.rawTransactions}
                  onCommit={commitImport}
                  onUndo={undoImport}
                  batches={ledgerState.importBatches}
                />
              </Suspense>
            ) : route === "budgets" ? (
              <BudgetsPage
                budgets={ledgerState.budgets}
                categories={ledgerState.categories}
                onCreate={createMonthlyBudget}
                transactions={ledgerState.rawTransactions}
              />
            ) : route === "loans" ? (
              <LoansPage
                accounts={ledgerState.rawAccounts}
                loans={ledgerState.loans}
                onCreate={createLoanPosition}
              />
            ) : route === "investments" ? (
              <InvestmentsPage
                accounts={ledgerState.rawAccounts}
                onCreate={createInvestment}
                positions={ledgerState.investmentPositions}
              />
            ) : route === "recurring" ? (
              <RecurringPage
                accounts={ledgerState.rawAccounts}
                allocationPlans={ledgerState.allocationPlans}
                categories={ledgerState.categories}
                onCreateAllocation={createAllocation}
                onExecuteAllocations={executeAllocations}
                rules={ledgerState.recurringRules}
                onCreate={createRecurring}
                onUpdate={updateRecurring}
              />
            ) : route === "exports" ? (
              <ExportsPage
                accounts={ledgerState.rawAccounts}
                categories={ledgerState.categories}
                transactions={ledgerState.rawTransactions}
              />
            ) : route === "backup" ? (
              <BackupPage ledger={ledgerState.ledger} />
            ) : route === "journal" ? (
              <JournalPage journals={ledgerState.monthlyJournals} onSave={saveJournal} />
            ) : route === "analytics" ? (
              <AnalyticsPage transactions={ledgerState.rawTransactions} />
            ) : route === "notifications" ? (
              <NotificationsPage
                accounts={ledgerState.rawAccounts}
                budgets={ledgerState.budgets}
                loans={ledgerState.loans}
                recurringRules={ledgerState.recurringRules}
                transactions={ledgerState.rawTransactions}
              />
            ) : route === "profile" ? (
              <ProfilePage />
            ) : route === "settings" ? (
              <SettingsPage
                onResetFinancialData={resetFinancialData}
                onCreateResetBackup={createResetBackup}
                cloudResetAvailable={readGoogleCloudConfig().enabled}
                requiresResetPin={appLockConfig !== undefined}
                onPreviewFinancialReset={previewResetFinancialData}
                onResetApplication={resetApplication}
                onRestoreTransaction={restoreTrashedTransaction}
                onPurgeTransaction={purgeTrashedTransaction}
                onPurgeTransactions={purgeTrashedTransactions}
                trashedTransactions={ledgerState.trashedTransactions}
              />
            ) : route === "privacy-security" ? (
              <PrivacySecurityPage
                ledger={ledgerState.ledger}
                lockConfig={appLockConfig}
                onLockConfigChanged={(config) => {
                  setAppLockConfig(config);
                  setIsAppLocked(false);
                }}
                onManualLock={() => setIsAppLocked(true)}
              />
            ) : (
              <Dashboard
                hasSeedFeedback={hasSeedFeedback}
                isSeeding={isSeeding}
                model={ledgerState.dashboard}
                {...(totalResetReport === undefined ? {} : { totalResetReport })}
                onAddDemoData={() => void addDemoData()}
                schemaVersion={ledgerState.ledger.schemaVersion}
                storageKind={ledgerState.ledger.storageKind}
              />
            )
          ) : (
            <PersistenceState progress={startupProgress} state={ledgerState} />
          )}
        </AppShell>
      )}
    </ErrorBoundary>
  );
}

const quickActions: readonly QuickAction[] = [
  {
    label: "Aggiungi nuovo movimento",
    description: "Entrata, uscita o trasferimento",
    icon: "transactions",
    onSelect: () => {
      window.location.hash = "#new-transaction";
    },
  },
  {
    label: "Nuovo conto",
    icon: "accounts",
    onSelect: () => {
      window.location.hash = "#accounts";
    },
  },
  {
    label: "Nuova ricorrenza",
    icon: "recurring",
    onSelect: () => {
      window.location.hash = "#recurring";
    },
  },
  {
    label: "Nuovo prestito",
    icon: "accounts",
    onSelect: () => {
      window.location.hash = "#loans";
    },
  },
  {
    label: "Nuovo investimento",
    icon: "overview",
    onSelect: () => {
      window.location.hash = "#investments";
    },
  },
];

function PersistenceState({
  progress,
  state,
}: {
  readonly progress: StartupProgressEvent | undefined;
  readonly state: Exclude<LedgerState, ReadyLedgerState>;
}) {
  if (state.status === "loading") {
    return <StartupLoadingScreen progress={progress} />;
  }

  return (
    <StartupRecoveryScreen
      onExportDiagnostics={downloadStartupDiagnostics}
      recoveryArchives={
        state.error instanceof StartupRecoveryRequiredError
          ? selectableRecoveryArchives(state.error.archives)
          : undefined
      }
      onOpenSafeCopy={(storageKind) => {
        writeRecoverySelection(storageKind);
        window.location.reload();
      }}
      onRetry={() => window.location.reload()}
    />
  );
}

function downloadStartupDiagnostics(): void {
  const report = serializeStartupDiagnostics(
    createStartupDiagnostics({
      appVersion: import.meta.env.VITE_APP_VERSION,
      buildId: import.meta.env.VITE_APP_VERSION,
      archives: [],
      errorCode: "NX-START-001",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([report], { type: "application/json" }));
  anchor.download = "nexora-startup-diagnostics.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

interface AppModels {
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly investmentPositions: readonly InvestmentPosition[];
  readonly monthlyJournals: readonly MonthlyJournal[];
  readonly importBatches: readonly ImportBatch[];
  readonly recurringRules: readonly RecurringRule[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly rawAccounts: readonly Account[];
  readonly rawTransactions: readonly Transaction[];
  readonly accounts: AccountsViewModel;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly trashedTransactions: readonly TrashedTransaction[];
  readonly dashboard: DashboardViewModel;
  readonly transactions: TransactionsViewModel;
}

async function loadAppModels(ledger: BrowserLedger): Promise<AppModels> {
  const [
    accounts,
    allocationPlans,
    budgets,
    loans,
    investmentPositions,
    monthlyJournals,
    categories,
    importBatches,
    recurringRules,
    tags,
    transactions,
    transfers,
    trashedTransactions,
  ] = await Promise.all([
    ledger.repository.listAccounts(),
    ledger.repository.listAllocationPlans(),
    ledger.repository.listBudgets(),
    ledger.repository.listLoans(),
    ledger.repository.listInvestmentPositions(),
    ledger.repository.listMonthlyJournals(),
    ledger.repository.listCategories(),
    ledger.repository.listImportBatches(),
    ledger.repository.listRecurringRules(),
    ledger.repository.listTags(),
    ledger.repository.listTransactions(),
    ledger.repository.listTransfers(),
    ledger.repository.listTrashedTransactions(),
  ]);
  return {
    allocationPlans,
    budgets,
    loans,
    investmentPositions,
    monthlyJournals,
    importBatches,
    recurringRules,
    rawAccounts: accounts,
    rawTransactions: transactions,
    categories,
    tags,
    trashedTransactions,
    accounts: buildAccountsViewModel({ accounts, transactions }),
    dashboard: buildDashboardViewModel({
      accounts,
      categories,
      loans,
      investmentPositions,
      transactions,
      transfers,
    }),
    transactions: buildTransactionsViewModel({
      accounts,
      categories,
      transactions,
      transfers,
    }),
  };
}

function useAppRoute():
  | "accounts"
  | "overview"
  | "transactions"
  | "categories"
  | "tags"
  | "imports"
  | "budgets"
  | "loans"
  | "investments"
  | "recurring"
  | "exports"
  | "backup"
  | "journal"
  | "analytics"
  | "profile"
  | "settings"
  | "notifications"
  | "privacy-security"
  | "new-transaction" {
  const [route, setRoute] = useState<
    | "accounts"
    | "overview"
    | "transactions"
    | "categories"
    | "tags"
    | "imports"
    | "budgets"
    | "loans"
    | "investments"
    | "recurring"
    | "exports"
    | "backup"
    | "journal"
    | "analytics"
    | "profile"
    | "settings"
    | "notifications"
    | "privacy-security"
    | "new-transaction"
  >(readAppRoute);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(readAppRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}

function readAppRoute():
  | "accounts"
  | "overview"
  | "transactions"
  | "categories"
  | "tags"
  | "imports"
  | "budgets"
  | "loans"
  | "investments"
  | "recurring"
  | "exports"
  | "backup"
  | "journal"
  | "analytics"
  | "profile"
  | "settings"
  | "notifications"
  | "privacy-security"
  | "new-transaction" {
  if (window.location.hash === "#accounts") {
    return "accounts";
  }
  if (window.location.hash === "#transactions") {
    return "transactions";
  }
  if (window.location.hash === "#categories") return "categories";
  if (window.location.hash === "#tags") return "tags";
  if (window.location.hash === "#imports") return "imports";
  if (window.location.hash === "#budgets") return "budgets";
  if (window.location.hash === "#loans") return "loans";
  if (window.location.hash === "#investments") return "investments";
  if (window.location.hash === "#recurring") return "recurring";
  if (window.location.hash === "#exports") return "exports";
  if (window.location.hash === "#backup") return "backup";
  if (window.location.hash === "#journal") return "journal";
  if (window.location.hash === "#analytics") return "analytics";
  if (window.location.hash === "#profile") return "profile";
  if (window.location.hash === "#settings") return "settings";
  if (window.location.hash === "#notifications") return "notifications";
  if (window.location.hash === "#privacy-security") return "privacy-security";
  if (window.location.hash === "#new-transaction") return "new-transaction";
  return "overview";
}

function buildGlobalSearchResults(state: ReadyLedgerState): readonly GlobalSearchResult[] {
  return [
    ...state.accounts.accounts.map((account) => ({
      id: `account-${account.id}`,
      href: "./#accounts",
      label: account.name,
      detail: `Conto · ${account.typeLabel}`,
    })),
    ...state.categories.map((category) => ({
      id: `category-${category.id}`,
      href: "./#categories",
      label: category.name,
      detail: "Categoria",
    })),
    ...state.tags.map((tag) => ({
      id: `tag-${tag.id}`,
      href: "./#tags",
      label: tag.name,
      detail: tag.isArchived ? "Tag archiviato" : "Tag",
    })),
    ...state.transactions.items.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      href: "./#transactions",
      label: transaction.title,
      detail: `${transaction.kindLabel} · ${transaction.accountLabel} · ${transaction.categoryLabel}`,
    })),
  ];
}
