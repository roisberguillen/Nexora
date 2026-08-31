import {
  calculateMonthlyTrends,
  type InvestmentPosition,
  type MonthlyJournal,
  type Transaction,
} from "@nexora/domain";
import { FinancialAmount } from "@nexora/ui";
import { useRef, useState, type FormEvent } from "react";

import type { MonthlyJournalInput } from "./journalCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import { localCivilMonth } from "../date/localCivilDate";

export function JournalPage({
  journals,
  onSave,
  onDelete,
  transactions,
  investments,
}: {
  readonly journals: readonly MonthlyJournal[];
  readonly onSave: (input: MonthlyJournalInput, existingId: string | undefined) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly transactions: readonly Transaction[];
  readonly investments: readonly InvestmentPosition[];
}) {
  const currentPeriod = localCivilMonth();
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [editingJournalId, setEditingJournalId] = useState<string | undefined>(
    () => journals.find((journal) => journal.period === currentPeriod)?.id,
  );
  const selected = journals.find((journal) => journal.id === editingJournalId);
  const orderedJournals = [...journals].sort((left, right) =>
    right.period.localeCompare(left.period),
  );
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<MonthlyJournal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const trend = calculateMonthlyTrends(transactions, "EUR").find(
    (item) => item.month === selectedPeriod,
  );
  const invested = investments
    .filter((item) => item.valuationDate.toString().startsWith(selectedPeriod))
    .reduce((sum, item) => sum + item.currentValue.amountMinor, 0n);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const form = new FormData(event.currentTarget);
    const control = String(form.get("perceivedControl"));
    const period = String(form.get("period"));
    try {
      await onSave(
        {
          period,
          ...(String(form.get("note")).trim() === "" ? {} : { note: String(form.get("note")) }),
          ...(String(form.get("nextMonthGoals")).trim() === ""
            ? {}
            : { nextMonthGoals: String(form.get("nextMonthGoals")) }),
          ...(control === "" ? {} : { perceivedControl: Number(control) as 1 | 2 | 3 | 4 | 5 }),
        },
        editingJournalId,
      );
      setSelectedPeriod(period);
      setError(null);
      setFeedback("Diario mensile salvato nei dati locali.");
    } catch {
      setFeedback(null);
      setError("Impossibile salvare il diario. Verifica il periodo e i campi indicati.");
    } finally {
      setIsSaving(false);
    }
  };

  const startNewJournal = () => {
    const currentJournal = journals.find((journal) => journal.period === currentPeriod);
    setSelectedPeriod(currentPeriod);
    setEditingJournalId(currentJournal?.id);
    setError(null);
    setFeedback(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const confirmDelete = async () => {
    if (deleteCandidate === null) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteCandidate.id);
      if (editingJournalId === deleteCandidate.id) {
        setEditingJournalId(undefined);
        setSelectedPeriod(currentPeriod);
      }
      setDeleteCandidate(null);
      setFeedback("Diario mensile eliminato dai dati locali.");
      setError(null);
    } catch {
      setError("Impossibile eliminare il diario. I dati finanziari non sono stati modificati.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="journal">
      <header className="accounts-heading journal-heading">
        <div>
          <p className="eyebrow">Riflessione mensile</p>
          <h1>Diario</h1>
          <p>Annota ciò che ha funzionato e definisci un obiettivo pratico per il mese prossimo.</p>
        </div>
        <button className="primary-action" onClick={startNewJournal} type="button">
          Nuova nota
        </button>
      </header>
      <section aria-labelledby="journal-summary-title" className="data-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Sintesi automatica</p>
            <h2 id="journal-summary-title">{selectedPeriod}</h2>
          </div>
        </div>
        <div className="journal-summary-content">
          <p className="import-help">
            Questa sintesi è derivata dai dati locali e non modifica il ledger.
          </p>
          <div className="metrics-grid">
            <div className="metric-card">
              <span>Entrate</span>
              <FinancialAmount
                amountMinor={trend?.income.amountMinor ?? 0n}
                currency="EUR"
                tone="positive"
              />
            </div>
            <div className="metric-card">
              <span>Spese</span>
              <FinancialAmount
                amountMinor={trend?.expense.amountMinor ?? 0n}
                currency="EUR"
                tone="negative"
              />
            </div>
            <div className="metric-card">
              <span>Risparmio</span>
              <FinancialAmount amountMinor={trend?.savings.amountMinor ?? 0n} currency="EUR" />
            </div>
            <div className="metric-card">
              <span>Valutazioni investimento</span>
              <FinancialAmount amountMinor={invested} currency="EUR" />
            </div>
          </div>
        </div>
      </section>
      <div className="accounts-layout has-editor">
        <section
          className="data-panel account-management-panel"
          aria-labelledby="journal-list-title"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Archivio locale</p>
              <h2 id="journal-list-title">Mesi registrati</h2>
            </div>
            <span className="panel-meta">{orderedJournals.length}</span>
          </div>
          {orderedJournals.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessuna riflessione</h3>
              <p>Il primo diario resta privato sul dispositivo e non modifica saldi o budget.</p>
            </div>
          ) : (
            <ul className="account-list journal-list">
              {orderedJournals.map((journal) => (
                <li key={journal.id}>
                  <div className="account-copy">
                    <strong>{journal.period}</strong>
                    <small>{journal.note ?? "Nessuna nota"}</small>
                    <small>
                      {journal.nextMonthGoals ?? "Nessun obiettivo"}
                      {journal.perceivedControl === undefined
                        ? ""
                        : ` · Controllo ${journal.perceivedControl}/5`}
                    </small>
                  </div>
                  <button
                    className="secondary-action"
                    onClick={() => {
                      setSelectedPeriod(journal.period);
                      setEditingJournalId(journal.id);
                      setFeedback(null);
                      setError(null);
                    }}
                    type="button"
                  >
                    Modifica
                  </button>
                  <button
                    className="text-action"
                    onClick={() => setDeleteCandidate(journal)}
                    type="button"
                  >
                    Elimina…
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside
          aria-labelledby="journal-form-title"
          className="account-editor-panel"
          ref={editorRef}
        >
          <h2 id="journal-form-title">{selected === undefined ? "Nuovo mese" : "Modifica mese"}</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          {feedback === null ? null : (
            <p className="account-feedback" role="status">
              {feedback}
            </p>
          )}
          <form
            className="account-form"
            key={selected?.id ?? selectedPeriod}
            onSubmit={(event) => void save(event)}
          >
            <label>
              Periodo
              <input
                defaultValue={selected?.period ?? selectedPeriod}
                name="period"
                pattern="[0-9]{4}-(0[1-9]|1[0-2])"
                required
              />
            </label>
            <label>
              Come è andato il mese?
              <textarea defaultValue={selected?.note} maxLength={4000} name="note" rows={5} />
            </label>
            <label>
              Obiettivo per il prossimo mese
              <textarea
                defaultValue={selected?.nextMonthGoals}
                maxLength={4000}
                name="nextMonthGoals"
                rows={4}
              />
            </label>
            <label>
              Percezione di controllo
              <select defaultValue={selected?.perceivedControl ?? ""} name="perceivedControl">
                <option value="">Non indicata</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}/5
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="primary-action" disabled={isSaving} type="submit">
                {isSaving ? "Salvataggio…" : "Salva diario"}
              </button>
            </div>
          </form>
        </aside>
      </div>
      {deleteCandidate === null ? null : (
        <AccessibleDialog
          labelledBy="delete-journal-title"
          onClose={() => !isDeleting && setDeleteCandidate(null)}
        >
          <h2 id="delete-journal-title">Eliminare questo diario?</h2>
          <p>Questa azione elimina solo la riflessione mensile, non movimenti, budget o saldi.</p>
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
              {isDeleting ? "Eliminazione…" : "Elimina diario"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
