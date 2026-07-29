import { DEFAULT_LOCALE } from "@nexora/config";
import { DomainError, type AccountType } from "@nexora/domain";
import { FinancialAmount } from "@nexora/ui";
import { useState, type FormEvent } from "react";

import {
  formatEditableAmountMinor,
  parseLocalizedAmountMinor,
  type CreateLedgerAccountInput,
  type UpdateLedgerAccountInput,
} from "./accountCommands";
import {
  accountTypeLabel,
  type AccountManagementItem,
  type AccountsViewModel,
} from "./buildAccountsViewModel";

interface AccountsPageProps {
  readonly model: AccountsViewModel;
  readonly onCreate: (input: CreateLedgerAccountInput) => Promise<void>;
  readonly onDeleteUnused: (accountId: string) => Promise<void>;
  readonly onSetArchived: (accountId: string, isArchived: boolean) => Promise<void>;
  readonly onUpdate: (accountId: string, input: UpdateLedgerAccountInput) => Promise<void>;
}

type AccountEditor =
  | { readonly mode: "create"; readonly values: AccountFormValues }
  | {
      readonly accountId: string;
      readonly canEditOpeningBalance: boolean;
      readonly mode: "edit";
      readonly values: AccountFormValues;
    };

interface AccountFormValues {
  readonly currency: string;
  readonly institution: string;
  readonly name: string;
  readonly openingBalance: string;
  readonly parentAccountId: string;
  readonly type: AccountType;
}

const accountTypes: readonly AccountType[] = [
  "checking",
  "savings",
  "cash",
  "investment",
  "loan",
  "virtual_subaccount",
];

const emptyForm: AccountFormValues = {
  currency: "EUR",
  institution: "",
  name: "",
  openingBalance: "0,00",
  parentAccountId: "",
  type: "checking",
};

export function AccountsPage({
  model,
  onCreate,
  onDeleteUnused,
  onSetArchived,
  onUpdate,
}: AccountsPageProps) {
  const [editor, setEditor] = useState<AccountEditor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openCreate = () => {
    setEditor({ mode: "create", values: emptyForm });
    clearMessages();
  };

  const openEdit = (account: AccountManagementItem) => {
    setEditor({
      accountId: account.id,
      canEditOpeningBalance: account.canEditOpeningBalance,
      mode: "edit",
      values: {
        currency: account.currency,
        institution: account.institution ?? "",
        name: account.name,
        openingBalance: formatEditableAmountMinor(
          account.openingBalance.amountMinor,
          account.currency,
        ),
        parentAccountId: account.parentAccountId ?? "",
        type: account.type,
      },
    });
    clearMessages();
  };

  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editor === null || isSaving) {
      return;
    }

    setIsSaving(true);
    clearMessages();
    try {
      const openingBalanceMinor = parseLocalizedAmountMinor(
        editor.values.openingBalance,
        editor.values.currency,
      );
      if (editor.mode === "create") {
        await onCreate({
          currency: editor.values.currency,
          institution: editor.values.institution,
          name: editor.values.name,
          openingBalanceMinor,
          type: editor.values.type,
          ...(editor.values.parentAccountId === ""
            ? {}
            : { parentAccountId: editor.values.parentAccountId }),
        });
        setFeedback("Conto creato e salvato nel ledger locale.");
      } else {
        await onUpdate(editor.accountId, {
          institution: editor.values.institution,
          name: editor.values.name,
          ...(editor.canEditOpeningBalance ? { openingBalanceMinor } : {}),
        });
        setFeedback("Modifiche del conto salvate.");
      }
      setEditor(null);
    } catch (error) {
      setErrorMessage(accountErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchived = async (account: AccountManagementItem) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    clearMessages();
    try {
      await onSetArchived(account.id, !account.isArchived);
      setFeedback(account.isArchived ? "Conto riattivato." : "Conto archiviato.");
      if (editor?.mode === "edit" && editor.accountId === account.id) {
        setEditor(null);
      }
    } catch (error) {
      setErrorMessage(accountErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUnused = async (account: AccountManagementItem) => {
    if (isSaving) return;
    setIsSaving(true);
    clearMessages();
    try {
      await onDeleteUnused(account.id);
      setFeedback("Conto vuoto eliminato definitivamente.");
    } catch (error) {
      setErrorMessage(accountErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateValues = (changes: Partial<AccountFormValues>) => {
    setEditor((current) =>
      current === null
        ? null
        : {
            ...current,
            values: { ...current.values, ...changes },
          },
    );
  };

  const selectType = (type: AccountType) => {
    if (type !== "virtual_subaccount") {
      updateValues({ parentAccountId: "", type });
      return;
    }
    const firstParent = model.parentOptions[0];
    updateValues({
      currency: firstParent?.currency ?? "EUR",
      parentAccountId: firstParent?.id ?? "",
      type,
    });
  };

  const selectParent = (parentAccountId: string) => {
    const parent = model.parentOptions.find((option) => option.id === parentAccountId);
    updateValues({
      currency: parent?.currency ?? "EUR",
      parentAccountId,
    });
  };

  function clearMessages() {
    setFeedback(null);
    setErrorMessage(null);
  }

  return (
    <div id="accounts">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Ledger locale</p>
          <h1>Gestisci i tuoi conti</h1>
          <p>
            Crea conti, contanti, investimenti e sottoconti. Archiviare conserva movimenti e saldi
            nello storico.
          </p>
        </div>
        <button className="primary-action" onClick={openCreate} type="button">
          Nuovo conto
        </button>
      </header>

      <section aria-label="Riepilogo conti" className="accounts-stats">
        <article>
          <span>Conti attivi</span>
          <strong>{model.activeCount}</strong>
        </article>
        <article>
          <span>Conti archiviati</span>
          <strong>{model.archivedCount}</strong>
        </article>
        <article>
          <span>Saldo complessivo EUR</span>
          <FinancialAmount
            amountMinor={model.totalEur.amountMinor}
            currency={model.totalEur.currency}
            tone={model.totalEur.amountMinor < 0n ? "negative" : "neutral"}
          />
        </article>
      </section>

      <div aria-live="polite" className="account-message-region">
        {feedback === null ? null : (
          <p className="account-feedback" role="status">
            {feedback}
          </p>
        )}
        {errorMessage === null ? null : (
          <p className="account-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <div className={`accounts-layout${editor === null ? "" : " has-editor"}`}>
        <AccountList
          accounts={model.accounts}
          isSaving={isSaving}
          onEdit={openEdit}
          onDeleteUnused={(account) => void deleteUnused(account)}
          onToggleArchived={(account) => void toggleArchived(account)}
        />
        {editor === null ? (
          <aside aria-labelledby="accounts-help-title" className="account-help-panel">
            <p className="eyebrow">Regole protette</p>
            <h2 id="accounts-help-title">Storico sempre ricostruibile</h2>
            <p>
              Dopo il primo movimento, valuta, tipo, conto padre e saldo iniziale non vengono
              alterati retroattivamente. Le correzioni future useranno una rettifica contabile.
            </p>
            <button className="secondary-action" onClick={openCreate} type="button">
              Crea il primo conto
            </button>
          </aside>
        ) : (
          <AccountForm
            editor={editor}
            isSaving={isSaving}
            onCancel={() => setEditor(null)}
            onSelectParent={selectParent}
            onSelectType={selectType}
            onSubmit={(event) => void submitEditor(event)}
            onUpdate={updateValues}
            parentOptions={model.parentOptions}
          />
        )}
      </div>
    </div>
  );
}

interface AccountListProps {
  readonly accounts: readonly AccountManagementItem[];
  readonly isSaving: boolean;
  readonly onEdit: (account: AccountManagementItem) => void;
  readonly onDeleteUnused: (account: AccountManagementItem) => void;
  readonly onToggleArchived: (account: AccountManagementItem) => void;
}

function AccountList({
  accounts,
  isSaving,
  onDeleteUnused,
  onEdit,
  onToggleArchived,
}: AccountListProps) {
  return (
    <section aria-labelledby="account-list-title" className="data-panel account-management-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Disponibilità</p>
          <h2 id="account-list-title">Elenco conti</h2>
        </div>
        <span className="panel-meta">{accounts.length}</span>
      </div>
      {accounts.length === 0 ? (
        <div className="account-list-empty">
          <h3>Nessun conto registrato</h3>
          <p>Usa “Nuovo conto” per iniziare senza caricare dati dimostrativi.</p>
        </div>
      ) : (
        <div className="account-table-wrap">
          <table className="account-table">
            <caption className="sr-only">
              Conti registrati con saldo, stato e azioni disponibili
            </caption>
            <thead>
              <tr>
                <th scope="col">Conto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Saldo iniziale</th>
                <th scope="col">Saldo attuale</th>
                <th scope="col">Stato</th>
                <th scope="col">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr className={account.isArchived ? "is-archived" : ""} key={account.id}>
                  <td data-label="Conto">
                    <span aria-hidden="true" className="account-mark">
                      {account.name.slice(0, 1).toLocaleUpperCase(DEFAULT_LOCALE)}
                    </span>
                    <span>
                      <strong>{account.name}</strong>
                      <small>
                        {account.institution ?? account.parentLabel ?? `Valuta ${account.currency}`}
                      </small>
                    </span>
                  </td>
                  <td data-label="Tipo">{account.typeLabel}</td>
                  <td data-label="Saldo iniziale">
                    <FinancialAmount
                      amountMinor={account.openingBalance.amountMinor}
                      currency={account.currency}
                    />
                  </td>
                  <td data-label="Saldo attuale">
                    <FinancialAmount
                      amountMinor={account.balance.amountMinor}
                      currency={account.currency}
                      tone={account.balance.amountMinor < 0n ? "negative" : "neutral"}
                    />
                  </td>
                  <td data-label="Stato">
                    <span
                      className={`account-status is-${account.isArchived ? "archived" : "active"}`}
                    >
                      {account.isArchived ? "Archiviato" : "Attivo"}
                    </span>
                  </td>
                  <td data-label="Azioni">
                    <div className="table-actions">
                      <button
                        className="text-action"
                        disabled={isSaving}
                        onClick={() => onEdit(account)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        disabled={isSaving}
                        onClick={() => onToggleArchived(account)}
                        type="button"
                      >
                        {account.isArchived ? "Riattiva" : "Archivia"}
                      </button>
                      <button
                        aria-label={`Elimina il conto vuoto ${account.name}`}
                        className="text-action"
                        disabled={isSaving}
                        onClick={() => onDeleteUnused(account)}
                        type="button"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface AccountFormProps {
  readonly editor: AccountEditor;
  readonly isSaving: boolean;
  readonly onCancel: () => void;
  readonly onSelectParent: (parentAccountId: string) => void;
  readonly onSelectType: (type: AccountType) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onUpdate: (changes: Partial<AccountFormValues>) => void;
  readonly parentOptions: AccountsViewModel["parentOptions"];
}

function AccountForm({
  editor,
  isSaving,
  onCancel,
  onSelectParent,
  onSelectType,
  onSubmit,
  onUpdate,
  parentOptions,
}: AccountFormProps) {
  const isCreate = editor.mode === "create";
  const isVirtual = editor.values.type === "virtual_subaccount";

  return (
    <aside aria-labelledby="account-form-title" className="account-editor-panel">
      <div className="account-editor-heading">
        <div>
          <p className="eyebrow">{isCreate ? "Nuovo elemento" : "Modifica"}</p>
          <h2 id="account-form-title">{isCreate ? "Crea un conto" : "Dettagli conto"}</h2>
        </div>
        <button
          aria-label="Chiudi modulo conto"
          className="editor-close"
          onClick={onCancel}
          type="button"
        >
          ×
        </button>
      </div>
      <form className="account-form" onSubmit={onSubmit}>
        <label>
          Nome conto
          <input
            autoFocus
            maxLength={160}
            name="account-name"
            onChange={(event) => onUpdate({ name: event.currentTarget.value })}
            required
            value={editor.values.name}
          />
        </label>

        <label>
          Tipo
          <select
            disabled={!isCreate}
            name="account-type"
            onChange={(event) => onSelectType(event.currentTarget.value as AccountType)}
            value={editor.values.type}
          >
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {accountTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        {isVirtual ? (
          <label>
            Conto padre
            <select
              disabled={!isCreate}
              name="parent-account"
              onChange={(event) => onSelectParent(event.currentTarget.value)}
              required
              value={editor.values.parentAccountId}
            >
              {parentOptions.length === 0 ? (
                <option value="">Crea prima un conto principale</option>
              ) : null}
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.currency}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Istituto
          <input
            maxLength={160}
            name="account-institution"
            onChange={(event) => onUpdate({ institution: event.currentTarget.value })}
            placeholder="Facoltativo"
            value={editor.values.institution}
          />
        </label>

        <label>
          Valuta
          <input
            aria-label="Valuta"
            aria-describedby="currency-help"
            disabled={!isCreate || isVirtual}
            inputMode="text"
            maxLength={3}
            minLength={3}
            name="account-currency"
            onChange={(event) => onUpdate({ currency: event.currentTarget.value.toUpperCase() })}
            pattern="[A-Za-z]{3}"
            required
            value={editor.values.currency}
          />
          <small id="currency-help">Codice ISO a tre lettere, ad esempio EUR.</small>
        </label>

        <label>
          Saldo iniziale
          <input
            aria-label="Saldo iniziale"
            aria-describedby="opening-balance-help"
            disabled={editor.mode === "edit" && !editor.canEditOpeningBalance}
            inputMode="decimal"
            name="opening-balance"
            onChange={(event) => onUpdate({ openingBalance: event.currentTarget.value })}
            required
            value={editor.values.openingBalance}
          />
          <small id="opening-balance-help">
            {editor.mode === "edit" && !editor.canEditOpeningBalance
              ? "Bloccato perché il conto contiene già movimenti."
              : "Usa la virgola per i decimali; sono ammessi anche saldi negativi."}
          </small>
        </label>

        {!isCreate ? (
          <p className="immutable-note">
            Tipo, valuta e conto padre restano invariati per proteggere lo storico.
          </p>
        ) : null}

        <div className="form-actions">
          <button className="secondary-action" onClick={onCancel} type="button">
            Annulla
          </button>
          <button className="primary-action" disabled={isSaving} type="submit">
            {isSaving ? "Salvataggio…" : isCreate ? "Crea conto" : "Salva modifiche"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function accountErrorMessage(error: unknown): string {
  if (!(error instanceof DomainError)) {
    return "Il conto non è stato salvato. I dati esistenti non sono stati modificati.";
  }
  if (error.code === "invalid_money") {
    return error.message;
  }
  if (error.code === "currency_mismatch") {
    return "La valuta del sottoconto deve coincidere con quella del conto padre.";
  }
  if (error.code === "missing_reference") {
    return "Il conto o il conto padre non è più disponibile. Ricarica la pagina.";
  }
  if (error.code === "invalid_currency") {
    return "Inserisci un codice valuta ISO valido di tre lettere.";
  }
  return "Operazione non consentita: verifica saldo iniziale e gerarchia dei sottoconti.";
}
