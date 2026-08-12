import type { Account, Loan } from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";
import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import type { LoanInput } from "./loanCommands";

export function LoansPage({
  accounts,
  loans,
  onCreate,
  onDelete,
  onUpdate,
}: {
  readonly accounts: readonly Account[];
  readonly loans: readonly Loan[];
  readonly onCreate: (input: LoanInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onUpdate: (id: string, input: LoanInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const loanAccounts = accounts.filter((account) => account.type === "loan" && !account.isArchived);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const account = loanAccounts.find((item) => item.id === String(form.get("accountId")));
    if (account === undefined) {
      setError("Crea prima un conto di tipo prestito attivo.");
      return;
    }
    try {
      const input = loanInputFromForm(form, account);
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, input);
      setError(null);
      setEditing(null);
      setSelected(null);
      if (editing === null) element.reset();
    } catch {
      setError("Impossibile salvare il prestito. Verifica campi, importi e capitale residuo.");
    }
  };
  const confirmDelete = async () => {
    if (deleteCandidate === null) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteCandidate.id);
      if (selected?.id === deleteCandidate.id) setSelected(null);
      if (editing?.id === deleteCandidate.id) setEditing(null);
      setDeleteCandidate(null);
    } catch {
      setError("Impossibile eliminare il prestito. I dati finanziari non sono stati modificati.");
    } finally {
      setIsDeleting(false);
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
              {loanAccounts.length === 0 ? (
                <p>Serve prima un conto di tipo prestito attivo.</p>
              ) : null}
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
                    <div className="form-actions">
                      <button
                        className="text-action"
                        onClick={() => setSelected(loan)}
                        type="button"
                      >
                        Dettaglio
                      </button>
                      <button
                        className="text-action"
                        onClick={() => setEditing(loan)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        onClick={() => setDeleteCandidate(loan)}
                        type="button"
                      >
                        Elimina…
                      </button>
                    </div>
                  </div>
                  <FinancialAmount
                    amountMinor={loan.remainingPrincipal.amountMinor}
                    currency={loan.remainingPrincipal.currency}
                  />
                </li>
              ))}
            </ul>
          )}
          {selected === null ? null : (
            <LoanDetail
              account={accounts.find((account) => account.id === selected.accountId)}
              loan={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </section>
        <aside aria-labelledby="loan-form-title" className="account-editor-panel">
          <h2 id="loan-form-title">{editing === null ? "Nuovo prestito" : "Modifica prestito"}</h2>
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
              Conto prestito
              <select defaultValue={editing?.accountId} name="accountId" required>
                {loanAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Finanziaria
              <input
                defaultValue={editing?.lender}
                name="lender"
                placeholder="Finanziaria"
                required
              />
            </label>
            <label>
              Rata mensile
              <input
                defaultValue={
                  editing === null
                    ? undefined
                    : formatEditableAmountMinor(
                        editing.installment.amountMinor,
                        editing.installment.currency,
                      )
                }
                inputMode="decimal"
                name="installment"
                placeholder="172,00"
                required
              />
            </label>
            <label>
              Capitale residuo
              <input
                defaultValue={
                  editing === null
                    ? undefined
                    : formatEditableAmountMinor(
                        editing.remainingPrincipal.amountMinor,
                        editing.remainingPrincipal.currency,
                      )
                }
                inputMode="decimal"
                name="remaining"
                required
              />
            </label>
            <label>
              Capitale originario
              <input
                defaultValue={
                  editing?.originalPrincipal === undefined
                    ? undefined
                    : formatEditableAmountMinor(
                        editing.originalPrincipal.amountMinor,
                        editing.originalPrincipal.currency,
                      )
                }
                inputMode="decimal"
                name="original"
              />
            </label>
            <label>
              TAN (%)
              <input
                defaultValue={formatPercent(editing?.annualNominalRateBps)}
                inputMode="decimal"
                name="tan"
              />
            </label>
            <label>
              TAEG (%)
              <input
                defaultValue={formatPercent(editing?.annualEffectiveRateBps)}
                inputMode="decimal"
                name="taeg"
              />
            </label>
            <label>
              Rate pagate
              <input
                defaultValue={editing?.installmentsPaid}
                inputMode="numeric"
                min="0"
                name="installmentsPaid"
                type="number"
              />
            </label>
            <label>
              Rate rimanenti
              <input
                defaultValue={editing?.installmentsRemaining}
                inputMode="numeric"
                min="0"
                name="installmentsRemaining"
                type="number"
              />
            </label>
            <label>
              Prossima scadenza
              <input
                defaultValue={editing?.nextDueDate?.toString()}
                name="nextDueDate"
                type="date"
              />
            </label>
            <div className="form-actions">
              {editing === null ? null : (
                <button className="secondary-action" onClick={() => setEditing(null)} type="button">
                  Annulla
                </button>
              )}
              <button className="primary-action" disabled={loanAccounts.length === 0} type="submit">
                {editing === null ? "Salva prestito" : "Aggiorna prestito"}
              </button>
            </div>
          </form>
        </aside>
      </div>
      {deleteCandidate === null ? null : (
        <AccessibleDialog
          labelledBy="delete-loan-title"
          onClose={() => !isDeleting && setDeleteCandidate(null)}
        >
          <h2 id="delete-loan-title">Eliminare questo prestito?</h2>
          <p>Il conto, i movimenti e le ricorrenze restano invariati.</p>
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
              {isDeleting ? "Eliminazione…" : "Elimina prestito"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}

function LoanDetail({
  account,
  loan,
  onClose,
}: {
  readonly account: Account | undefined;
  readonly loan: Loan;
  readonly onClose: () => void;
}) {
  return (
    <section aria-labelledby="loan-detail-title" className="data-panel account-management-panel">
      <div className="panel-heading">
        <h2 id="loan-detail-title">Dettaglio prestito</h2>
        <button className="text-action" onClick={onClose} type="button">
          Chiudi
        </button>
      </div>
      <dl className="loan-detail-list">
        <dt>Finanziaria</dt>
        <dd>{loan.lender}</dd>
        <dt>Conto collegato</dt>
        <dd>{account?.name ?? "Conto non disponibile"}</dd>
        <dt>Rata</dt>
        <dd>{formatMinorUnits(loan.installment.amountMinor, loan.installment.currency)}</dd>
        <dt>Capitale residuo</dt>
        <dd>
          {formatMinorUnits(loan.remainingPrincipal.amountMinor, loan.remainingPrincipal.currency)}
        </dd>
        <dt>Capitale originario</dt>
        <dd>
          {loan.originalPrincipal === undefined
            ? "Non impostato"
            : formatMinorUnits(loan.originalPrincipal.amountMinor, loan.originalPrincipal.currency)}
        </dd>
        <dt>Progresso</dt>
        <dd>
          {loan.progressPercent() === undefined
            ? "Non disponibile"
            : `${loan.progressPercent()!.toFixed(0)}%`}
        </dd>
        <dt>Prossima scadenza</dt>
        <dd>{loan.nextDueDate?.toString() ?? "Non impostata"}</dd>
        <dt>TAN / TAEG</dt>
        <dd>
          {formatPercent(loan.annualNominalRateBps) || "Non impostato"} /{" "}
          {formatPercent(loan.annualEffectiveRateBps) || "Non impostato"}
        </dd>
        <dt>Rate</dt>
        <dd>
          {loan.installmentsPaid ?? "—"} pagate · {loan.installmentsRemaining ?? "—"} rimanenti
        </dd>
      </dl>
    </section>
  );
}

function loanInputFromForm(form: FormData, account: Account): LoanInput {
  return {
    accountId: account.id,
    lender: String(form.get("lender")),
    installmentMinor: parseLocalizedAmountMinor(String(form.get("installment")), account.currency),
    remainingPrincipalMinor: parseLocalizedAmountMinor(
      String(form.get("remaining")),
      account.currency,
    ),
    ...optionalMinor(form, "original", "originalPrincipalMinor", account),
    ...optionalRate(form, "tan", "annualNominalRateBps"),
    ...optionalRate(form, "taeg", "annualEffectiveRateBps"),
    ...optionalCount(form, "installmentsPaid"),
    ...optionalCount(form, "installmentsRemaining"),
    ...(String(form.get("nextDueDate")) === ""
      ? {}
      : { nextDueDate: String(form.get("nextDueDate")) }),
  };
}
function optionalMinor(
  form: FormData,
  name: string,
  key: "originalPrincipalMinor",
  account: Account,
): Partial<LoanInput> {
  const value = String(form.get(name));
  return value === "" ? {} : { [key]: parseLocalizedAmountMinor(value, account.currency) };
}
function optionalRate(
  form: FormData,
  name: string,
  key: "annualNominalRateBps" | "annualEffectiveRateBps",
): Partial<LoanInput> {
  const value = String(form.get(name)).trim();
  if (value === "") return {};
  const percent = Number(value.replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0) throw new Error("invalid_rate");
  return { [key]: Math.round(percent * 100) };
}
function optionalCount(
  form: FormData,
  name: "installmentsPaid" | "installmentsRemaining",
): Partial<LoanInput> {
  const value = String(form.get(name));
  if (value === "") return {};
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("invalid_count");
  return { [name]: parsed };
}
function formatPercent(rate: number | undefined): string {
  return rate === undefined ? "" : (rate / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");
}
