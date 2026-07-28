import type { Account, Loan } from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";
import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import type { LoanInput } from "./loanCommands";

export function LoansPage({
  accounts,
  loans,
  onCreate,
}: {
  readonly accounts: readonly Account[];
  readonly loans: readonly Loan[];
  readonly onCreate: (input: LoanInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const loanAccounts = accounts.filter((account) => account.type === "loan" && !account.isArchived);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const account = loanAccounts.find((item) => item.id === String(form.get("accountId")));
    if (account === undefined) {
      setError("Crea prima un conto di tipo prestito.");
      return;
    }
    try {
      await onCreate({
        accountId: account.id,
        lender: String(form.get("lender")),
        installmentMinor: parseLocalizedAmountMinor(
          String(form.get("installment")),
          account.currency,
        ),
        remainingPrincipalMinor: parseLocalizedAmountMinor(
          String(form.get("remaining")),
          account.currency,
        ),
        ...(String(form.get("original")) === ""
          ? {}
          : {
              originalPrincipalMinor: parseLocalizedAmountMinor(
                String(form.get("original")),
                account.currency,
              ),
            }),
        ...(String(form.get("nextDueDate")) === ""
          ? {}
          : { nextDueDate: String(form.get("nextDueDate")) }),
      });
      setError(null);
      element.reset();
    } catch {
      setError("Impossibile salvare il prestito. Verifica importi e capitale residuo.");
    }
  };
  return (
    <div id="loans">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Impegni finanziari</p>
          <h1>Prestiti</h1>
          <p>Monitora rate, capitale residuo e prossime scadenze senza alterare il ledger.</p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section aria-labelledby="loan-list-title" className="data-panel account-management-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Posizioni aperte</p>
              <h2 id="loan-list-title">Riepilogo prestiti</h2>
            </div>
            <span className="panel-meta">{loans.length}</span>
          </div>
          {loans.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessun prestito</h3>
              <p>Registra un finanziamento per iniziare a monitorarne il residuo.</p>
            </div>
          ) : (
            <ul className="account-list">
              {loans.map((loan) => (
                <li key={loan.id}>
                  <div className="account-copy">
                    <strong>{loan.lender}</strong>
                    <small>
                      Rata{" "}
                      {formatMinorUnits(loan.installment.amountMinor, loan.installment.currency)} ·
                      Scadenza {loan.nextDueDate?.toString() ?? "Non impostata"}
                    </small>
                    <small>
                      Residuo{" "}
                      {formatMinorUnits(
                        loan.remainingPrincipal.amountMinor,
                        loan.remainingPrincipal.currency,
                      )}
                      {loan.progressPercent() === undefined
                        ? ""
                        : ` · Progresso ${loan.progressPercent()!.toFixed(0)}%`}
                    </small>
                  </div>
                  <FinancialAmount
                    amountMinor={loan.remainingPrincipal.amountMinor}
                    currency={loan.remainingPrincipal.currency}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside aria-labelledby="loan-form-title" className="account-editor-panel">
          <h2 id="loan-form-title">Nuovo prestito</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" onSubmit={(event) => void save(event)}>
            <label>
              Conto prestito
              <select name="accountId" required>
                {loanAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Finanziaria
              <input name="lender" placeholder="Finanziaria" required />
            </label>
            <label>
              Rata mensile
              <input inputMode="decimal" name="installment" placeholder="172,00" required />
            </label>
            <label>
              Capitale residuo
              <input inputMode="decimal" name="remaining" required />
            </label>
            <label>
              Capitale originario
              <input inputMode="decimal" name="original" />
            </label>
            <label>
              Prossima scadenza
              <input name="nextDueDate" type="date" />
            </label>
            <div className="form-actions">
              <button className="primary-action" disabled={loanAccounts.length === 0} type="submit">
                Salva prestito
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
