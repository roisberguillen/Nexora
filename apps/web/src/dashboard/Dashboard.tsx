import { DEFAULT_LOCALE } from "@nexora/config";
import { FinancialAmount, MetricCard } from "@nexora/ui";
import type { DashboardActivityItem, DashboardViewModel } from "./buildDashboardViewModel";
import type { TotalResetReport } from "../reset/totalReset";
import { barSize } from "./trendBar";

interface DashboardProps {
  readonly hasSeedFeedback: boolean;
  readonly isSeeding: boolean;
  readonly model: DashboardViewModel;
  readonly onAddDemoData: () => void;
  readonly totalResetReport?: TotalResetReport;
}
export function Dashboard({
  hasSeedFeedback,
  isSeeding,
  model,
  onAddDemoData,
  totalResetReport,
}: DashboardProps) {
  return (
    <div id="overview" className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">{model.periodLabel}</p>
          <h1 aria-label="Il tuo quadro finanziario">Panoramica finanziaria</h1>
        </div>
        <span className={`month-status is-${model.monthStatus.toLowerCase().replaceAll(" ", "-")}`}>
          {model.monthStatus}
        </span>
      </header>
      {totalResetReport ? (
        <p className="dashboard-feedback" role="status">
          Ripristino locale {totalResetReport.local === "succeeded" ? "riuscito" : "non riuscito"}.
        </p>
      ) : null}
      {isDashboardEmpty(model) ? (
        <EmptyDashboard isSeeding={isSeeding} onAddDemoData={onAddDemoData} />
      ) : (
        <>
          {hasSeedFeedback ? (
            <p className="dashboard-feedback" role="status">
              Dataset dimostrativo salvato nel dispositivo.
            </p>
          ) : null}
          <section aria-label="Riepilogo finanziario" className="dashboard-priority-grid">
            <MetricCard
              amountMinor={model.availableBalance.amountMinor}
              currency={model.availableBalance.currency}
              isFeatured
              label="Disponibilità attuale"
              supportingText={`${model.activeLiquidAccountCount} conti attivi · conti correnti, risparmio e contanti`}
            />
            <MetricCard
              amountMinor={model.income.amountMinor}
              currency={model.income.currency}
              label="Entrate del mese"
              supportingText="Solo operazioni contabilizzate di questo mese"
              tone="positive"
            />
            <MetricCard
              amountMinor={model.expense.amountMinor}
              currency={model.expense.currency}
              label="Spese del mese"
              supportingText="Trasferimenti e annullati esclusi"
              tone="negative"
            />
            <MetricCard
              amountMinor={model.savings.amountMinor}
              currency={model.savings.currency}
              label="Risparmio del mese"
              supportingText={
                model.savingRatePercent === undefined
                  ? "Tasso non disponibile senza entrate"
                  : `Tasso di risparmio ${formatPercent(model.savingRatePercent)}`
              }
              tone={model.savings.amountMinor < 0n ? "negative" : "positive"}
            />
          </section>
          <section aria-labelledby="budget-title" className="dashboard-decision-grid">
            <div className="data-panel dashboard-budget-panel">
              <PanelHeading
                eyebrow="Piano mensile"
                title="Budget"
                meta={`${model.budget.activeCount} attivi`}
              />
              {model.budget.activeCount ? (
                <div className="dashboard-budget-content">
                  <p className="dashboard-budget-status">
                    {model.budget.attentionCount
                      ? `${model.budget.attentionCount} richiede attenzione`
                      : "Tutti i budget sono in linea"}
                  </p>
                  {model.budget.criticalCategories.length ? (
                    <ul className="dashboard-compact-list">
                      {model.budget.criticalCategories.map((item) => (
                        <li key={item.id}>
                          <span>{item.label}</span>
                          <strong>
                            {formatPercent(item.percentage)} · {item.status}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dashboard-muted">Nessuna categoria oltre soglia.</p>
                  )}
                  <a className="text-action" href="#budgets">
                    Vedi budget
                  </a>
                </div>
              ) : (
                <div className="dashboard-budget-content">
                  <p className="dashboard-muted">Budget non configurato.</p>
                  <a className="text-action" href="#budgets">
                    Configura budget
                  </a>
                </div>
              )}
            </div>
            <div className="data-panel">
              <PanelHeading
                eyebrow="Previsioni registrate"
                title="Prossime uscite"
                meta={`${model.upcomingExpenses.length}`}
              />
              {model.upcomingExpenses.length ? (
                <ul className="dashboard-compact-list upcoming-list">
                  {model.upcomingExpenses.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {formatLocalDate(item.expectedDate)} · tra {item.daysUntil} giorni
                        </small>
                      </span>
                      <FinancialAmount
                        amountMinor={item.amount.amountMinor}
                        currency={item.amount.currency}
                        tone="negative"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-muted">
                  Nessuna ricorrenza in scadenza. Le uscite derivano solo da ricorrenze attive.
                </p>
              )}
            </div>
          </section>
          <section aria-labelledby="trend-title" className="dashboard-analytics-grid">
            <div className="data-panel">
              <PanelHeading
                eyebrow="Confronto"
                title="Andamento spese"
                meta={
                  model.expenseTrend.differencePercent === undefined
                    ? "Base non disponibile"
                    : `${formatPercent(Math.abs(model.expenseTrend.differencePercent))}`
                }
              />
              <p className="trend-copy">{trendText(model)}</p>
              <div
                className="trend-bars"
                aria-label="Confronto spese mese corrente e precedente"
                role="img"
              >
                <span
                  className={model.expenseTrend.current.amountMinor === 0n ? "is-zero" : undefined}
                  style={
                    {
                      "--bar-size": `${barSize(model.expenseTrend.current.amountMinor, model.expenseTrend.previous.amountMinor)}%`,
                    } as React.CSSProperties
                  }
                >
                  <small>{model.periodLabel}</small>
                </span>
                <span
                  className={model.expenseTrend.previous.amountMinor === 0n ? "is-zero" : undefined}
                  style={
                    {
                      "--bar-size": `${barSize(model.expenseTrend.previous.amountMinor, model.expenseTrend.current.amountMinor)}%`,
                    } as React.CSSProperties
                  }
                >
                  <small>Mese scorso</small>
                </span>
              </div>
            </div>
            <div className="data-panel">
              <PanelHeading eyebrow="Dove spendi" title="Spese principali" meta="Top 3" />
              {model.topExpenseCategories.length ? (
                <ul className="dashboard-compact-list">
                  {model.topExpenseCategories.map((item) => (
                    <li key={item.id}>
                      <span>{item.label}</span>
                      <strong>
                        <FinancialAmount
                          amountMinor={item.amount.amountMinor}
                          currency={item.amount.currency}
                          tone="negative"
                        />
                        <small>{formatPercent(item.percentageOfExpenses)}</small>
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-muted">Nessuna spesa contabilizzata nel mese.</p>
              )}
            </div>
          </section>
          <RecentActivity activity={model.activity} />
          <AccountOverview model={model} />
        </>
      )}
    </div>
  );
}
function PanelHeading({
  eyebrow,
  title,
  meta,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly meta: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span className="panel-meta">{meta}</span>
    </div>
  );
}
function RecentActivity({ activity }: { readonly activity: readonly DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-title" className="data-panel activity-panel">
      <PanelHeading eyebrow="Ledger" title="Movimenti recenti" meta={`Ultimi ${activity.length}`} />
      <div className="activity-table-wrap">
        <table className="activity-table">
          <caption className="sr-only">Ultimi movimenti registrati nel ledger</caption>
          <thead>
            <tr>
              <th>Operazione</th>
              <th>Categoria</th>
              <th>Conto</th>
              <th>Data</th>
              <th>Importo</th>
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
      <a className="text-action dashboard-more-action" href="#transactions">
        Vedi tutti i movimenti
      </a>
    </section>
  );
}

function AccountOverview({ model }: { readonly model: DashboardViewModel }) {
  return (
    <aside aria-label="Conti" className="data-panel accounts-panel dashboard-accounts-secondary">
      <PanelHeading eyebrow="Disponibilità" title="Conti" meta={String(model.counts.accounts)} />
      <ul className="account-list">
        {model.accounts.map((account) => (
          <li key={account.id}>
            <span aria-hidden="true" className="account-mark">
              {account.name.slice(0, 1).toLocaleUpperCase(DEFAULT_LOCALE)}
            </span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small>
                {account.typeLabel}
                {account.institution === undefined ? "" : ` · ${account.institution}`}
              </small>
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
function EmptyDashboard({
  isSeeding,
  onAddDemoData,
}: {
  readonly isSeeding: boolean;
  readonly onAddDemoData: () => void;
}) {
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
function trendText(model: DashboardViewModel): string {
  const amount = model.expenseTrend.difference.amountMinor;
  if (amount === 0n) return "Hai speso quanto il mese scorso.";
  const formatted = formatMoney(
    model.expenseTrend.difference.amountMinor < 0n
      ? -model.expenseTrend.difference.amountMinor
      : model.expenseTrend.difference.amountMinor,
    model.currency,
  );
  return amount < 0n
    ? `Hai speso ${formatted} meno del mese scorso.`
    : `Hai speso ${formatted} in più rispetto al mese scorso.`;
}
function formatMoney(amountMinor: bigint, currency: string): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}
function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 1 }).format(value)}%`;
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
