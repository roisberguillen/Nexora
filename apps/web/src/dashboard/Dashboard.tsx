import { DEFAULT_LOCALE } from "@nexora/config";
import type { BrowserLedgerStorageKind } from "@nexora/database";
import { FinancialAmount, MetricCard } from "@nexora/ui";

import type { DashboardActivityItem, DashboardViewModel } from "./buildDashboardViewModel";

interface DashboardProps {
  readonly hasSeedFeedback: boolean;
  readonly isSeeding: boolean;
  readonly model: DashboardViewModel;
  readonly onAddDemoData: () => void;
  readonly schemaVersion: number;
  readonly storageKind: BrowserLedgerStorageKind;
}

export function Dashboard({
  hasSeedFeedback,
  isSeeding,
  model,
  onAddDemoData,
  schemaVersion,
  storageKind,
}: DashboardProps) {
  const storageLabel = storageKind === "opfs" ? "SQLite su OPFS" : "IndexedDB";

  return (
    <div id="overview">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Panoramica</p>
          <h1>Il tuo quadro finanziario</h1>
          <p>
            Saldi e flussi vengono calcolati dal ledger locale verificato. I trasferimenti interni
            non alterano entrate o spese.
          </p>
        </div>
        <div aria-label="Stato archivio" className="storage-pill">
          <span aria-hidden="true" className="status-dot" />
          <span>{storageLabel}</span>
          <span aria-hidden="true">·</span>
          <span>Schema {schemaVersion}</span>
        </div>
      </header>

      {isDashboardEmpty(model) ? (
        <EmptyDashboard isSeeding={isSeeding} onAddDemoData={onAddDemoData} />
      ) : (
        <>
          {hasSeedFeedback ? (
            <p className="dashboard-feedback" role="status">
              Dataset dimostrativo salvato nel dispositivo.
            </p>
          ) : null}
          <section aria-label="Riepilogo finanziario" className="metrics-grid">
            <MetricCard
              amountMinor={model.netWorth.amountMinor}
              currency={model.netWorth.currency}
              isFeatured
              label="Patrimonio locale"
              supportingText="Saldo complessivo dei conti nella valuta principale"
            />
            <MetricCard
              amountMinor={model.income.amountMinor}
              currency={model.income.currency}
              label="Entrate"
              supportingText="Totale registrato, trasferimenti esclusi"
              tone="positive"
            />
            <MetricCard
              amountMinor={model.expense.amountMinor}
              currency={model.expense.currency}
              label="Spese"
              supportingText="Totale registrato, operazioni annullate escluse"
              tone="negative"
            />
            <MetricCard
              amountMinor={model.netCashFlow.amountMinor}
              currency={model.netCashFlow.currency}
              label="Saldo dei flussi"
              supportingText="Entrate meno spese nello storico disponibile"
              tone={model.netCashFlow.amountMinor < 0n ? "negative" : "positive"}
            />
            <MetricCard
              amountMinor={model.loanBalance.amountMinor}
              currency={model.loanBalance.currency}
              label="Debiti residui"
              supportingText="Capitale residuo dei prestiti registrati"
              tone="negative"
            />
            <MetricCard
              amountMinor={model.investmentValue.amountMinor}
              currency={model.investmentValue.currency}
              label="Investimenti"
              supportingText={`Rendimento ${model.investmentGainLoss.amountMinor < 0n ? "negativo" : "positivo"}`}
              tone={model.investmentGainLoss.amountMinor < 0n ? "negative" : "positive"}
            />
          </section>

          {model.excludedCurrencyAccountCount > 0 ? (
            <p className="currency-notice" role="note">
              {model.excludedCurrencyAccountCount}{" "}
              {model.excludedCurrencyAccountCount === 1
                ? "conto in altra valuta è escluso"
                : "conti in altre valute sono esclusi"}{" "}
              dal patrimonio {model.currency}: Nexora non applica cambi impliciti.
            </p>
          ) : null}

          <div className="dashboard-grid">
            <RecentActivity activity={model.activity} />
            <AccountOverview model={model} />
          </div>
        </>
      )}
    </div>
  );
}

interface EmptyDashboardProps {
  readonly isSeeding: boolean;
  readonly onAddDemoData: () => void;
}

function EmptyDashboard({ isSeeding, onAddDemoData }: EmptyDashboardProps) {
  return (
    <section aria-labelledby="empty-dashboard-title" className="empty-dashboard">
      <span aria-hidden="true" className="empty-dashboard-mark">
        N
      </span>
      <div>
        <p className="eyebrow">Archivio verificato</p>
        <h2 id="empty-dashboard-title">Il ledger è pronto per i primi dati</h2>
        <p>
          Nessun dato è stato inserito automaticamente. Puoi usare un dataset interamente sintetico
          per esplorare la dashboard.
        </p>
        <button
          className="primary-action"
          disabled={isSeeding}
          onClick={onAddDemoData}
          type="button"
        >
          {isSeeding ? "Creazione dati demo…" : "Carica dati dimostrativi"}
        </button>
      </div>
    </section>
  );
}

function RecentActivity({ activity }: { readonly activity: readonly DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-title" className="data-panel activity-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ledger</p>
          <h2 id="activity-title">Movimenti recenti</h2>
        </div>
        <span className="panel-meta">Ultimi {activity.length}</span>
      </div>
      <div className="activity-table-wrap">
        <table className="activity-table">
          <caption className="sr-only">Ultimi movimenti registrati nel ledger</caption>
          <thead>
            <tr>
              <th scope="col">Operazione</th>
              <th scope="col">Categoria</th>
              <th scope="col">Conto</th>
              <th scope="col">Data</th>
              <th scope="col">Importo</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item) => (
              <tr className={item.isCancelled ? "is-cancelled" : ""} key={item.id}>
                <td data-label="Operazione">
                  <strong>{item.title}</strong>
                  <span className={`kind-badge is-${item.isCancelled ? "neutral" : item.tone}`}>
                    {item.kindLabel}
                  </span>
                </td>
                <td data-label="Categoria">{item.categoryLabel}</td>
                <td data-label="Conto">{item.accountLabel}</td>
                <td data-label="Data">{formatLocalDate(item.bookedDate)}</td>
                <td data-label="Importo">
                  <FinancialAmount
                    amountMinor={item.amount.amountMinor}
                    currency={item.amount.currency}
                    showPositiveSign={item.tone === "positive"}
                    tone={item.isCancelled ? "neutral" : item.tone}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountOverview({ model }: { readonly model: DashboardViewModel }) {
  return (
    <aside aria-labelledby="accounts-title" className="data-panel accounts-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Disponibilità</p>
          <h2 id="accounts-title">Conti</h2>
        </div>
        <span className="panel-meta">{model.counts.accounts}</span>
      </div>
      <ul className="account-list">
        {model.accounts.map((account) => (
          <li key={account.id}>
            <span aria-hidden="true" className="account-mark">
              {account.name.slice(0, 1).toLocaleUpperCase(DEFAULT_LOCALE)}
            </span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small>
                {account.institution === undefined
                  ? account.typeLabel
                  : `${account.typeLabel} · ${account.institution}`}
              </small>
              {account.isArchived ? <span className="archived-badge">Archiviato</span> : null}
            </span>
            <FinancialAmount
              amountMinor={account.balance.amountMinor}
              className="account-balance"
              currency={account.balance.currency}
              tone={account.balance.amountMinor < 0n ? "negative" : "neutral"}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function formatLocalDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function isDashboardEmpty(model: DashboardViewModel): boolean {
  return (
    model.counts.accounts === 0 && model.counts.transactions === 0 && model.counts.transfers === 0
  );
}
