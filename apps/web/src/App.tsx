import { classifyErrorName, createSafeLogger } from "@nexora/config";
import { PersistenceError, seedDemoLedger, type BrowserLedger } from "@nexora/database";
import { executeConfirmedAllocationPlans, LocalDate } from "@nexora/domain";
import type {
  Account,
  AllocationPlan,
  Category,
  ImportBatch,
  RecurringRule,
  Tag,
  Transaction,
} from "@nexora/domain";
import { AppShell, ErrorBoundary, type GlobalSearchResult } from "@nexora/ui";
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

  useEffect(() => {
    let isActive = true;

    void ledgerPromise
      .then(async (ledger) => ({ ...(await loadAppModels(ledger)), ledger }))
      .then(
        ({
          accounts,
          allocationPlans,
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
      <AppShell
        activeRoute={route}
        searchResults={ledgerState.status === "ready" ? buildGlobalSearchResults(ledgerState) : []}
      >
        {ledgerState.status === "ready" ? (
          route === "accounts" ? (
            <AccountsPage
              model={ledgerState.accounts}
              onCreate={createAccount}
              onSetArchived={setAccountArchived}
              onUpdate={updateAccount}
            />
          ) : route === "transactions" ? (
            <TransactionsPage
              model={ledgerState.transactions}
              tags={ledgerState.tags}
              onCancel={cancelMovement}
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
                <section aria-live="polite" className="ledger-state-card is-loading" role="status">
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
    </ErrorBoundary>
  );
}

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
    categories,
    importBatches,
    recurringRules,
    tags,
    transactions,
    transfers,
  ] = await Promise.all([
    ledger.repository.listAccounts(),
    ledger.repository.listAllocationPlans(),
    ledger.repository.listCategories(),
    ledger.repository.listImportBatches(),
    ledger.repository.listRecurringRules(),
    ledger.repository.listTags(),
    ledger.repository.listTransactions(),
    ledger.repository.listTransfers(),
  ]);
  return {
    allocationPlans,
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
  "accounts" | "overview" | "transactions" | "categories" | "tags" | "imports" | "recurring" {
  const [route, setRoute] = useState<
    "accounts" | "overview" | "transactions" | "categories" | "tags" | "imports" | "recurring"
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
  "accounts" | "overview" | "transactions" | "categories" | "tags" | "imports" | "recurring" {
  if (window.location.hash === "#accounts") {
    return "accounts";
  }
  if (window.location.hash === "#transactions") {
    return "transactions";
  }
  if (window.location.hash === "#categories") return "categories";
  if (window.location.hash === "#tags") return "tags";
  if (window.location.hash === "#imports") return "imports";
  if (window.location.hash === "#recurring") return "recurring";
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
