import type { Account, InvestmentPosition } from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";
import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import type { InvestmentPositionInput } from "./investmentCommands";
export function InvestmentsPage({
  accounts,
  positions,
  onCreate,
}: {
  readonly accounts: readonly Account[];
  readonly positions: readonly InvestmentPosition[];
  readonly onCreate: (input: InvestmentPositionInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const investmentAccounts = accounts.filter(
    (account) => account.type === "investment" && !account.isArchived,
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const account = investmentAccounts.find((item) => item.id === String(form.get("accountId")));
    if (account === undefined) {
      setError("Crea prima un conto di tipo investimento.");
      return;
    }
    try {
      await onCreate({
        accountId: account.id,
        name: String(form.get("name")),
        costBasisMinor: parseLocalizedAmountMinor(String(form.get("costBasis")), account.currency),
        currentValueMinor: parseLocalizedAmountMinor(
          String(form.get("currentValue")),
          account.currency,
        ),
        valuationDate: String(form.get("valuationDate")),
        ...(String(form.get("symbol")) === "" ? {} : { symbol: String(form.get("symbol")) }),
      });
      setError(null);
      element.reset();
    } catch {
      setError("Impossibile salvare la posizione. Verifica importi e data.");
    }
  };
  return (
    <div id="investments">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Patrimonio investito</p>
          <h1>Investimenti</h1>
          <p>Registra costo e valore corrente delle posizioni, anche del conto Directa.</p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section
          aria-labelledby="investment-list-title"
          className="data-panel account-management-panel"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Valutazioni</p>
              <h2 id="investment-list-title">Posizioni</h2>
            </div>
            <span className="panel-meta">{positions.length}</span>
          </div>
          {positions.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessuna posizione</h3>
              <p>Aggiungi una posizione manuale per iniziare.</p>
            </div>
          ) : (
            <ul className="account-list">
              {positions.map((position) => (
                <li key={position.id}>
                  <div className="account-copy">
                    <strong>{position.name}</strong>
                    <small>
                      {position.symbol ?? "Senza ticker"} · Valutata il{" "}
                      {position.valuationDate.toString()}
                    </small>
                    <small>
                      Investito{" "}
                      {formatMinorUnits(
                        position.costBasis.amountMinor,
                        position.costBasis.currency,
                      )}{" "}
                      · Rendimento{" "}
                      {formatMinorUnits(
                        position.gainLoss().amountMinor,
                        position.gainLoss().currency,
                      )}
                      {position.gainLossPercent() === undefined
                        ? ""
                        : ` (${position.gainLossPercent()!.toFixed(2)}%)`}
                    </small>
                  </div>
                  <FinancialAmount
                    amountMinor={position.currentValue.amountMinor}
                    currency={position.currentValue.currency}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside aria-labelledby="investment-form-title" className="account-editor-panel">
          <h2 id="investment-form-title">Nuova posizione</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" onSubmit={(event) => void save(event)}>
            <label>
              Conto investimento
              <select name="accountId" required>
                {investmentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome posizione
              <input name="name" placeholder="ETF globale" required />
            </label>
            <label>
              Ticker
              <input name="symbol" placeholder="VWCE" />
            </label>
            <label>
              Capitale investito
              <input inputMode="decimal" name="costBasis" required />
            </label>
            <label>
              Valore corrente
              <input inputMode="decimal" name="currentValue" required />
            </label>
            <label>
              Data valutazione
              <input
                defaultValue={new Date().toISOString().slice(0, 10)}
                name="valuationDate"
                type="date"
                required
              />
            </label>
            <div className="form-actions">
              <button
                className="primary-action"
                disabled={investmentAccounts.length === 0}
                type="submit"
              >
                Salva posizione
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
