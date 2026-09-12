import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FinancialAmount, formatPercentage } from "@nexora/ui";
import type { Category, Transaction, TransactionSplit } from "@nexora/domain";
import {
  buildAnalyticsViewModel,
  currentAnalyticsPeriod,
  periodLabel,
  shiftMonth,
  type AnalyticsTrendWindow,
} from "./buildAnalyticsViewModel";

export interface AnalyticsPageProps {
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
  readonly financialMonthStartDay?: number;
}

export function AnalyticsPage({
  categories,
  transactions,
  transactionSplits,
  financialMonthStartDay = 1,
}: AnalyticsPageProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    currentAnalyticsPeriod(transactions, new Date(), financialMonthStartDay),
  );
  const [trendWindow, setTrendWindow] = useState<AnalyticsTrendWindow>(6);
  useEffect(() => {
    setSelectedPeriod(currentAnalyticsPeriod(transactions, new Date(), financialMonthStartDay));
  }, [financialMonthStartDay, transactions]);
  const model = useMemo(
    () =>
      buildAnalyticsViewModel(
        { categories, transactions, transactionSplits },
        selectedPeriod,
        trendWindow,
        "EUR",
        financialMonthStartDay,
      ),
    [
      categories,
      financialMonthStartDay,
      selectedPeriod,
      transactions,
      transactionSplits,
      trendWindow,
    ],
  );
  const moveMonth = (delta: number) => setSelectedPeriod(shiftMonth(selectedPeriod, delta));

  return (
    <div id="analytics">
      <header className="accounts-heading analytics-heading">
        <div>
          <p className="eyebrow">Lettura prudente</p>
          <h1>Analisi</h1>
          <p>Leggi il mese, confrontalo con il precedente e individua dove cambia la spesa.</p>
          <div aria-label="Selezione mese" className="analytics-period-selector">
            <button
              aria-label={`Mese precedente: ${periodLabel(model.previousPeriod, financialMonthStartDay)}`}
              className="secondary-action"
              onClick={() => moveMonth(-1)}
              type="button"
            >
              ‹
            </button>
            <span aria-live="polite">{model.selectedPeriodLabel}</span>
            <button
              aria-label={`Mese successivo: ${periodLabel(shiftMonth(selectedPeriod, 1), financialMonthStartDay)}`}
              className="secondary-action"
              onClick={() => moveMonth(1)}
              type="button"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <section aria-labelledby="summary-title" className="data-panel analytics-section">
        <PanelHeading
          eyebrow="Mese in sintesi"
          title={`Come è andato ${model.selectedPeriodLabel}?`}
          id="summary-title"
        />
        <div className="analytics-panel-content">
          <div className="metrics-grid analytics-summary-grid">
            <SummaryMetric
              label="Entrate"
              amount={model.monthlySummary.income}
              delta={model.monthlySummary.income.subtract(model.previousSummary.income)}
            />
            <SummaryMetric
              label="Spese"
              amount={model.monthlySummary.expense}
              delta={model.monthlySummary.expense.subtract(model.previousSummary.expense)}
              tone="negative"
            />
            <SummaryMetric
              label="Risparmio"
              amount={model.monthlySummary.net}
              delta={model.monthlySummary.net.subtract(model.previousSummary.net)}
              tone={model.monthlySummary.net.isNegative() ? "negative" : "positive"}
            />
            <div className="metric-card">
              <span>Tasso di risparmio</span>
              <strong className="metric-value">
                {model.savingRatePercent === undefined
                  ? "—"
                  : formatPercentage(model.savingRatePercent)}
              </strong>
              <small>
                {model.savingRatePercent === undefined
                  ? "Entrate pari a zero"
                  : "Risparmio / entrate"}
              </small>
            </div>
          </div>
          <p className="analytics-callout">{summarySentence(model)}</p>
        </div>
      </section>

      <section aria-labelledby="comparison-title" className="data-panel analytics-section">
        <PanelHeading
          eyebrow="Confronto"
          title={`Rispetto a ${model.previousPeriodLabel}`}
          id="comparison-title"
        />
        <div className="analytics-panel-content">
          {model.comparisonAvailable ? (
            <div className="analytics-delta-list">
              <DeltaRow
                label="Entrate"
                amount={model.monthlySummary.income.subtract(model.previousSummary.income)}
              />
              <DeltaRow
                label="Spese"
                amount={model.monthlySummary.expense.subtract(model.previousSummary.expense)}
              />
              <DeltaRow
                label="Risparmio"
                amount={model.monthlySummary.net.subtract(model.previousSummary.net)}
              />
            </div>
          ) : (
            <p className="analytics-empty">
              Non ci sono ancora dati sufficienti per confrontare questo mese.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="trend-title" className="data-panel analytics-section">
        <div className="panel-heading analytics-trend-heading">
          <div>
            <p className="eyebrow">Andamento</p>
            <h2 id="trend-title">Ultimi mesi</h2>
          </div>
          <div className="analytics-window-selector" role="group" aria-label="Finestra del trend">
            {([3, 6, 12] as const).map((window) => (
              <button
                aria-pressed={trendWindow === window}
                className={trendWindow === window ? "primary-action" : "secondary-action"}
                key={window}
                onClick={() => setTrendWindow(window)}
                type="button"
              >
                {window} mesi
              </button>
            ))}
          </div>
        </div>
        <div className="analytics-panel-content">
          <div
            aria-label="Andamento mensile di entrate, spese e risparmio"
            className="analytics-trend-chart"
            role="img"
          >
            {model.trends.map((trend) => (
              <div className={trend.isSelected ? "is-selected" : ""} key={trend.month}>
                <span>{trend.month}</span>
                <i
                  aria-hidden="true"
                  style={{ "--analytics-bar": `${trend.expenseBarPercent}%` } as CSSProperties}
                />
                <small className="analytics-trend-values">
                  <span>
                    <b>Entrate</b>
                    <FinancialAmount
                      amountMinor={trend.income.amountMinor}
                      currency="EUR"
                      showPositiveSign
                    />
                  </span>
                  <span>
                    <b>Spese</b>
                    <FinancialAmount
                      amountMinor={trend.expense.amountMinor}
                      currency="EUR"
                      tone="negative"
                    />
                  </span>
                  <span>
                    <b>Risparmio</b>
                    <FinancialAmount amountMinor={trend.savings.amountMinor} currency="EUR" />
                  </span>
                </small>
              </div>
            ))}
          </div>
          <div className="analytics-average">
            <strong>Media spese ultimi {trendWindow} mesi</strong>
            <span className="analytics-average-detail">
              <FinancialAmount amountMinor={model.averageExpense.amountMinor} currency="EUR" /> ·{" "}
              {model.averageExpenseDelta.isZero() ? (
                "in linea con la media"
              ) : (
                <>
                  <FinancialAmount
                    amountMinor={model.averageExpenseDelta.amountMinor}
                    currency="EUR"
                    showPositiveSign
                  />{" "}
                  {model.averageExpenseDelta.isPositive() ? "sopra la media" : "sotto la media"}
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-title" className="data-panel analytics-section">
        <PanelHeading eyebrow="Categorie" title="Dove hai speso" id="categories-title" />
        <div className="analytics-panel-content">
          {model.categories.length === 0 ? (
            <p className="analytics-empty">Non ci sono movimenti di spesa in questo mese.</p>
          ) : (
            <ul className="analytics-category-list">
              {model.categories.map((category) => (
                <li key={category.id}>
                  <div>
                    <strong>{category.label}</strong>
                    <span>
                      {formatPercentage(category.percentage, 2)}
                      del totale
                    </span>
                  </div>
                  <FinancialAmount
                    amountMinor={category.amount.amountMinor}
                    currency="EUR"
                    tone="negative"
                  />
                  <small>
                    {category.delta === undefined || category.delta.isZero() ? (
                      "Nessuna variazione"
                    ) : (
                      <>
                        <FinancialAmount
                          amountMinor={category.delta.amountMinor}
                          currency="EUR"
                          showPositiveSign
                        />{" "}
                        rispetto al mese precedente
                      </>
                    )}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="changes-title" className="data-panel analytics-section">
        <PanelHeading eyebrow="Sintesi numerica" title="Cosa è cambiato" id="changes-title" />
        <div className="analytics-panel-content">
          {model.insights.length === 0 ? (
            <p className="analytics-empty">
              Nessuna variazione significativa rispetto al mese precedente.
            </p>
          ) : (
            <ul className="analytics-insight-list">
              {model.insights.map((insight) => (
                <li className={`is-${insight.tone}`} key={insight.id}>
                  <span>{insight.label}</span>
                  <FinancialAmount
                    amountMinor={insight.amount.amountMinor}
                    currency="EUR"
                    showPositiveSign
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="history-title" className="data-panel analytics-section">
        <PanelHeading eyebrow="Storico" title="Storico mensile" id="history-title" />
        <div className="analytics-panel-content">
          <div className="activity-table-wrap">
            <table className="activity-table analytics-history-table">
              <caption className="sr-only">
                Storico mensile di entrate, spese, risparmio e tasso di risparmio
              </caption>
              <thead>
                <tr>
                  <th>Mese</th>
                  <th>Entrate</th>
                  <th>Spese</th>
                  <th>Risparmio</th>
                  <th>Tasso</th>
                </tr>
              </thead>
              <tbody>
                {[...model.history].reverse().map((trend) => (
                  <tr className={trend.isSelected ? "is-selected" : ""} key={trend.month}>
                    <td data-label="Mese">{trend.month}</td>
                    <td data-label="Entrate">
                      <FinancialAmount
                        amountMinor={trend.income.amountMinor}
                        currency="EUR"
                        showPositiveSign
                      />
                    </td>
                    <td data-label="Spese">
                      <FinancialAmount
                        amountMinor={trend.expense.amountMinor}
                        currency="EUR"
                        tone="negative"
                      />
                    </td>
                    <td data-label="Risparmio">
                      <FinancialAmount
                        amountMinor={trend.savings.amountMinor}
                        currency="EUR"
                        showPositiveSign
                      />
                    </td>
                    <td data-label="Tasso">
                      {trend.income.isZero()
                        ? "—"
                        : formatPercentage(
                            Number(
                              (trend.savings.amountMinor * 10_000n) / trend.income.amountMinor,
                            ) / 100,
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="forecast-title"
        className="data-panel analytics-section analytics-forecast-section"
      >
        <PanelHeading
          eyebrow="Previsione"
          title="Mese successivo"
          id="forecast-title"
          meta="Stima prudente"
        />
        <div className="analytics-panel-content">
          <div className="metrics-grid analytics-summary-grid">
            <SummaryMetric
              label="Spesa attesa"
              amount={model.forecast.expectedExpense}
              tone="negative"
            />
            <SummaryMetric label="Intervallo prudente" amount={model.forecast.lowerExpense} />
            <SummaryMetric
              label="Massimo prudente"
              amount={model.forecast.upperExpense}
              tone="negative"
            />
          </div>
          <p className="import-help">
            Stima basata sulla mediana storica con margine del 10%; non è un dato reale né un
            consiglio finanziario.
          </p>
        </div>
      </section>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  id,
  meta,
}: {
  eyebrow: string;
  title: string;
  id: string;
  meta?: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {meta === undefined ? null : <span className="panel-meta">{meta}</span>}
    </div>
  );
}

function SummaryMetric({
  label,
  amount,
  delta,
  tone,
}: {
  label: string;
  amount: { amountMinor: bigint };
  delta?: { amountMinor: bigint };
  tone?: "negative" | "positive";
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <FinancialAmount
        amountMinor={amount.amountMinor}
        className="metric-value"
        currency="EUR"
        {...(tone === undefined ? {} : { tone })}
      />
      {delta === undefined ? (
        <small>Valore previsto</small>
      ) : (
        <small>
          Variazione:{" "}
          <FinancialAmount
            amountMinor={delta.amountMinor}
            currency="EUR"
            showPositiveSign
            tone={delta.amountMinor < 0n ? "negative" : "positive"}
          />
        </small>
      )}
    </div>
  );
}

function DeltaRow({ label, amount }: { label: string; amount: { amountMinor: bigint } }) {
  return (
    <div>
      <span>{label}</span>
      <FinancialAmount
        amountMinor={amount.amountMinor}
        currency="EUR"
        showPositiveSign
        tone={amount.amountMinor < 0n ? "negative" : "positive"}
      />
    </div>
  );
}

function summarySentence(model: ReturnType<typeof buildAnalyticsViewModel>): string {
  if (!model.comparisonAvailable)
    return model.hasSelectedPeriodData
      ? "Questo è il primo mese disponibile per il confronto."
      : "Non ci sono movimenti in questo mese.";
  const savingsDelta = model.monthlySummary.net.amountMinor - model.previousSummary.net.amountMinor;
  const expenseDelta =
    model.monthlySummary.expense.amountMinor - model.previousSummary.expense.amountMinor;
  if (savingsDelta === 0n && expenseDelta === 0n)
    return "Il mese è sostanzialmente invariato rispetto al precedente.";
  return savingsDelta > 0n
    ? "Il mese è andato meglio del precedente: il risparmio è aumentato."
    : "Il mese è andato peggio del precedente: il risparmio è diminuito.";
}
