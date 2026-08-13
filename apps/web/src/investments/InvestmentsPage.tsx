import type { Account, InvestmentPosition } from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";

import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import type { InvestmentPositionInput } from "./investmentCommands";

export function InvestmentsPage({
  accounts,
  positions,
  onCreate,
  onDelete,
  onUpdate,
}: {
  readonly accounts: readonly Account[];
  readonly positions: readonly InvestmentPosition[];
  readonly onCreate: (input: InvestmentPositionInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onUpdate: (id: string, input: InvestmentPositionInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InvestmentPosition | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<InvestmentPosition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const investmentAccounts = accounts.filter(
    (account) => account.type === "investment" && !account.isArchived,
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const account = investmentAccounts.find((item) => item.id === String(form.get("accountId")));
    if (account === undefined) {
      setError("Crea prima un conto di tipo investimento attivo.");
      return;
    }
    try {
      const input: InvestmentPositionInput = {
        accountId: account.id,
        name: String(form.get("name")),
        costBasisMinor: parseLocalizedAmountMinor(String(form.get("costBasis")), account.currency),
        currentValueMinor: parseLocalizedAmountMinor(
          String(form.get("currentValue")),
          account.currency,
        ),
        valuationDate: String(form.get("valuationDate")),
        ...(String(form.get("symbol")) === "" ? {} : { symbol: String(form.get("symbol")) }),
      };
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, input);
      setError(null);
      setEditing(null);
      if (editing === null) element.reset();
    } catch {
      setError("Impossibile salvare la posizione. Verifica importi e data.");
    }
  };

  const confirmDelete = async () => {
    if (deleteCandidate === null) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteCandidate.id);
      if (editing?.id === deleteCandidate.id) setEditing(null);
      setDeleteCandidate(null);
    } catch {
      setError("Impossibile eliminare la posizione. Il conto e i movimenti restano invariati.");
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div id="investments">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Patrimonio investito</p>
          <h1>Investimenti</h1>
          <p>Registra costo e valore corrente delle posizioni del tuo conto investimento.</p>
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
                    <div className="form-actions">
                      <button
                        className="text-action"
                        onClick={() => setEditing(position)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        onClick={() => setDeleteCandidate(position)}
                        type="button"
                      >
                        Elimina…
                      </button>
                    </div>
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
          <h2 id="investment-form-title">
            {editing === null ? "Nuova posizione" : "Modifica posizione"}
          </h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="account-form"
            key={editing?.id ?? "new"}
            onSubmit={(event) => void save(event)}
          >
            <label>
              Conto investimento
              <select defaultValue={editing?.accountId} name="accountId" required>
                {investmentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome posizione
              <input defaultValue={editing?.name} name="name" placeholder="ETF globale" required />
            </label>
            <label>
              Ticker
              <input defaultValue={editing?.symbol} name="symbol" placeholder="VWCE" />
            </label>
            <label>
              Capitale investito
              <input
                defaultValue={
                  editing === null
                    ? undefined
                    : formatEditableAmountMinor(
                        editing.costBasis.amountMinor,
                        editing.costBasis.currency,
                      )
                }
                inputMode="decimal"
                name="costBasis"
                required
              />
            </label>
            <label>
              Valore corrente
              <input
                defaultValue={
                  editing === null
                    ? undefined
                    : formatEditableAmountMinor(
                        editing.currentValue.amountMinor,
                        editing.currentValue.currency,
                      )
                }
                inputMode="decimal"
                name="currentValue"
                required
              />
            </label>
            <label>
              Data valutazione
              <input
                defaultValue={
                  editing?.valuationDate.toString() ?? new Date().toISOString().slice(0, 10)
                }
                name="valuationDate"
                type="date"
                required
              />
            </label>
            <div className="form-actions">
              {editing === null ? null : (
                <button className="secondary-action" onClick={() => setEditing(null)} type="button">
                  Annulla
                </button>
              )}
              <button
                className="primary-action"
                disabled={investmentAccounts.length === 0}
                type="submit"
              >
                {editing === null ? "Salva posizione" : "Aggiorna posizione"}
              </button>
            </div>
          </form>
        </aside>
      </div>
      {deleteCandidate === null ? null : (
        <AccessibleDialog
          labelledBy="delete-investment-title"
          onClose={() => !isDeleting && setDeleteCandidate(null)}
        >
          <h2 id="delete-investment-title">Eliminare questa posizione?</h2>
          <p>Il conto e i movimenti esistenti restano invariati.</p>
          <div className="form-actions">
            <button
              className="secondary-action"
              disabled={isDeleting}
              onClick={() => setDeleteCandidate(null)}
              type="button"
            >
              Annulla
            </button>
            <button
              className="primary-action"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
              type="button"
            >
              {isDeleting ? "Eliminazione…" : "Elimina posizione"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
