import { classifyErrorName, createSafeLogger } from "@nexora/config";
import { PersistenceError, seedDemoLedger, type BrowserLedger } from "@nexora/database";
import type { Category } from "@nexora/domain";
import { AppShell, ErrorBoundary } from "@nexora/ui";
import { useEffect, useState } from "react";

import {
  createLedgerAccount,
  setLedgerAccountArchived,
  updateLedgerAccount,
  type CreateLedgerAccountInput,
  type UpdateLedgerAccountInput,
} from "./accounts/accountCommands";
import { AccountsPage } from "./accounts/AccountsPage";
import { CategoriesPage } from "./categories/CategoriesPage";
import {
  createLedgerCategory,
  updateLedgerCategory,
  type CategoryInput,
} from "./categories/categoryCommands";
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

const logger = createSafeLogger();

interface ReadyLedgerState {
  readonly accounts: AccountsViewModel;
  readonly categories: readonly Category[];
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
      .then(({ accounts, categories, dashboard, transactions, ledger }) => {
        if (!isActive) {
          return;
        }
        logger.info("persistence.opened", {
          component: "persistence",
          status: "completed",
          storageKind: ledger.storageKind,
        });
        setLedgerState({ accounts, categories, dashboard, ledger, status: "ready", transactions });
      })
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

  const createManualMovement = (input: CreateManualTransactionInput): Promise<void> =>
    mutateLedger(async (ledger) => {
      await createManualTransaction(ledger.repository, input);
    });

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
      <AppShell activeRoute={route}>
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
              onCancel={cancelMovement}
              onCreateManual={createManualMovement}
              onCreateTransfer={createTransferMovement}
            />
          ) : route === "categories" ? (
            <CategoriesPage
              categories={ledgerState.categories}
              onCreate={createCategory}
              onUpdate={updateCategory}
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
  readonly accounts: AccountsViewModel;
  readonly categories: readonly Category[];
  readonly dashboard: DashboardViewModel;
  readonly transactions: TransactionsViewModel;
}

async function loadAppModels(ledger: BrowserLedger): Promise<AppModels> {
  const [accounts, categories, transactions, transfers] = await Promise.all([
    ledger.repository.listAccounts(),
    ledger.repository.listCategories(),
    ledger.repository.listTransactions(),
    ledger.repository.listTransfers(),
  ]);
  return {
    categories,
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

function useAppRoute(): "accounts" | "overview" | "transactions" | "categories" {
  const [route, setRoute] = useState<"accounts" | "overview" | "transactions" | "categories">(
    readAppRoute,
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(readAppRoute());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}

function readAppRoute(): "accounts" | "overview" | "transactions" | "categories" {
  if (window.location.hash === "#accounts") {
    return "accounts";
  }
  if (window.location.hash === "#transactions") {
    return "transactions";
  }
  if (window.location.hash === "#categories") return "categories";
  return "overview";
}
