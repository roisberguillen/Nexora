import { classifyErrorName, createSafeLogger } from "@nexora/config";
import { PersistenceError, seedDemoLedger, type BrowserLedger } from "@nexora/database";
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
import { getAppLockTimeoutMilliseconds, readAppLock, type AppLockConfig } from "./security/appLock";

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
  readonly seedLedger?: typeof seedDemoLedger;
}

export function App({ ledgerPromise, seedLedger = seedDemoLedger }: AppProps) {
  const route = useAppRoute();
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    status: "loading",
  });
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeedFeedback, setHasSeedFeedback] = useState(false);
  const [appLockConfig, setAppLockConfig] = useState<AppLockConfig | undefined>(() =>
    readAppLock(),
  );
  const [isAppLocked, setIsAppLocked] = useState(() => readAppLock() !== undefined);

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
                model={ledgerState.accounts}
                onCreate={createAccount}
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
                onCreateManual={createManualMovement}
                onCreateTransfer={createTransferMovement}
                onExecuteSalaryAllocations={executeAllocations}
              />
            ) : route === "categories" ? (
              <CategoriesPage
                categories={ledgerState.categories}
                onCreate={createCategory}
                onUpdate={updateCategory}
              />
            ) : route === "tags" ? (
              <TagsPage tags={ledgerState.tags} onCreate={createTag} onUpdate={updateTag} />
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
              <ProfilePage ledger={ledgerState.ledger} />
            ) : route === "settings" ? (
              <SettingsPage />
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
                onAddDemoData={() => void addDemoData()}
                schemaVersion={ledgerState.ledger.schemaVersion}
                storageKind={ledgerState.ledger.storageKind}
              />
            )
          ) : (
            <PersistenceState state={ledgerState} />
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

function PersistenceState({ state }: { readonly state: Exclude<LedgerState, ReadyLedgerState> }) {
  if (state.status === "loading") {
    return (
      <section aria-live="polite" className="ledger-state-card is-loading" role="status">
        <span aria-hidden="true" className="ledger-state-mark">
          …
        </span>
        <div>
          <h1>Preparazione dell’archivio locale</h1>
          <p>Nexora sta verificando backend, schema e disponibilità offline.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ledger-state-card is-error" role="alert">
      <span aria-hidden="true" className="ledger-state-mark">
        !
      </span>
      <div>
        <h1>Archivio locale non disponibile</h1>
        <p>{persistenceErrorMessage(state.error)}</p>
        <button className="secondary-action" onClick={() => window.location.reload()} type="button">
          Ricarica Nexora
        </button>
      </div>
    </section>
  );
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

function persistenceErrorMessage(error: unknown): string {
  if (error instanceof PersistenceError && error.code === "opfs_unavailable") {
    return "Questo profilo usa SQLite/OPFS, ma il browser non espone più i requisiti necessari. Nessun archivio IndexedDB alternativo è stato aperto.";
  }
  if (error instanceof PersistenceError && error.code === "upgrade_blocked") {
    return "Un’altra scheda di Nexora sta bloccando l’aggiornamento del database. Chiudila e ricarica l’app.";
  }
  return "Nexora ha interrotto l’apertura per proteggere i dati. Nessun archivio alternativo è stato aperto.";
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
