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
