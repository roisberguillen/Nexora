import {
  calculateMonthlyTrends,
  calculatePrudentExpenseForecast,
  type Transaction,
} from "@nexora/domain";
import { FinancialAmount } from "@nexora/ui";

export function AnalyticsPage({ transactions }: { readonly transactions: readonly Transaction[] }) {
  const currency = "EUR";
  const trends = calculateMonthlyTrends(transactions, currency);
  const forecast = calculatePrudentExpenseForecast(transactions, currency);
  const latest = trends.at(-1);
  const previous = trends.at(-2);
  const maximumExpense = trends.reduce(
    (maximum, trend) => (trend.expense.amountMinor > maximum ? trend.expense.amountMinor : maximum),
    0n,
  );

  return (
    <div id="analytics">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Lettura prudente</p>
          <h1>Analisi</h1>
          <p>
            Trend e previsione usano solo entrate e spese contabilizzate in EUR: trasferimenti,
            rettifiche e movimenti annullati restano esclusi.
          </p>
        </div>
      </header>
      <section aria-labelledby="forecast-title" className="data-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Prossimo mese</p>
            <h2 id="forecast-title">Previsione spese</h2>
          </div>
          <span className="panel-meta">Mediana di {forecast.historyMonths} mesi</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card">
            <span>Spesa attesa</span>
            <FinancialAmount
              amountMinor={forecast.expectedExpense.amountMinor}
              currency={currency}
              tone="negative"
            />
          </div>
          <div className="metric-card">
            <span>Intervallo prudente</span>
            <FinancialAmount amountMinor={forecast.lowerExpense.amountMinor} currency={currency} />
          </div>
          <div className="metric-card">
            <span>Massimo prudente</span>
            <FinancialAmount
              amountMinor={forecast.upperExpense.amountMinor}
              currency={currency}
              tone="negative"
            />
          </div>
        </div>
        <p className="import-help">
          La fascia applica un margine del 10% alla mediana storica; non è una garanzia né un
          consiglio finanziario.
        </p>
      </section>
      <section aria-labelledby="comparison-title" className="data-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Confronto</p>
            <h2 id="comparison-title">Ultimo mese rispetto al precedente</h2>
          </div>
        </div>
        {latest === undefined || previous === undefined ? (
          <p className="import-help">Servono almeno due mesi contabilizzati per il confronto.</p>
        ) : (
          <div className="metrics-grid">
            <Metric
              label="Entrate"
              current={latest.income.amountMinor}
              previous={previous.income.amountMinor}
              currency={currency}
            />
            <Metric
              label="Spese"
              current={latest.expense.amountMinor}
              previous={previous.expense.amountMinor}
              currency={currency}
            />
            <Metric
              label="Risparmio"
              current={latest.savings.amountMinor}
              previous={previous.savings.amountMinor}
              currency={currency}
            />
          </div>
        )}
      </section>
      <section aria-labelledby="trends-title" className="data-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Storico</p>
            <h2 id="trends-title">Trend mensili</h2>
          </div>
          <span className="panel-meta">{trends.length}</span>
        </div>
        {trends.length === 0 ? (
          <div className="account-list-empty">
            <h3>Dati insufficienti</h3>
            <p>Registra entrate o spese contabilizzate per vedere i trend.</p>
          </div>
        ) : (
          <div className="activity-table-wrap">
            <div aria-label="Grafico delle spese mensili" className="analytics-bars" role="img">
              {trends.map((trend) => (
                <div key={trend.month}>
                  <span>{trend.month}</span>
                  <meter
                    aria-label={`Spese ${trend.month}`}
                    max={Number(maximumExpense || 1n)}
                    value={Number(trend.expense.amountMinor)}
                  />{" "}
                  <FinancialAmount
                    amountMinor={trend.expense.amountMinor}
                    currency={currency}
                    tone="negative"
                  />
                </div>
              ))}
            </div>
            <table className="activity-table">
              <caption className="sr-only">Trend mensili di entrate, spese e risparmio</caption>
              <thead>
                <tr>
                  <th scope="col">Mese</th>
                  <th scope="col">Entrate</th>
                  <th scope="col">Spese</th>
                  <th scope="col">Risparmio</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend) => (
                  <tr key={trend.month}>
                    <td data-label="Mese">{trend.month}</td>
                    <td data-label="Entrate">
                      <FinancialAmount
                        amountMinor={trend.income.amountMinor}
                        currency={currency}
                        showPositiveSign
                        tone="positive"
                      />
                    </td>
                    <td data-label="Spese">
                      <FinancialAmount
                        amountMinor={trend.expense.amountMinor}
                        currency={currency}
                        tone="negative"
                      />
                    </td>
                    <td data-label="Risparmio">
                      <FinancialAmount
                        amountMinor={trend.savings.amountMinor}
                        currency={currency}
                        showPositiveSign={trend.savings.amountMinor > 0n}
                        tone={trend.savings.amountMinor < 0n ? "negative" : "positive"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  current,
  previous,
  currency,
}: {
  label: string;
  current: bigint;
  previous: bigint;
  currency: string;
}) {
  const delta = current - previous;
  return (
    <div className="metric-card">
      <span>{label}</span>
      <FinancialAmount amountMinor={current} currency={currency} />
      <small>
        Variazione:{" "}
        <FinancialAmount
          amountMinor={delta}
          currency={currency}
          showPositiveSign={delta > 0n}
          tone={delta < 0n ? "negative" : "positive"}
        />
      </small>
    </div>
  );
}
