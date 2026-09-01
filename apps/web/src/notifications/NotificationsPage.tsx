import type {
  Account,
  Budget,
  Category,
  Loan,
  RecurringRule,
  Transaction,
  TransactionSplit,
} from "@nexora/domain";
import { useMemo, useState } from "react";

import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { enableBrowserNotifications, type BrowserNotificationStatus } from "./browserNotifications";
import {
  deriveLocalNotifications,
  readLocalNotificationPreferences,
  readLocalNotificationStates,
  writeLocalNotificationPreferences,
  writeLocalNotificationStates,
  type LocalNotificationPreferences,
  type LocalNotificationStates,
} from "./localNotifications";

export function NotificationsPage({
  accounts,
  budgets,
  categories,
  loans,
  recurringRules,
  transactions,
  transactionSplits,
}: {
  readonly accounts: readonly Account[];
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly loans: readonly Loan[];
  readonly recurringRules: readonly RecurringRule[];
  readonly transactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
}) {
  const [preferences, setPreferences] = useState<LocalNotificationPreferences>(() =>
    readLocalNotificationPreferences(),
  );
  const [thresholdText, setThresholdText] = useState(() =>
    formatEditableAmountMinor(preferences.lowBalanceThresholdMinor, "EUR"),
  );
  const [preferenceError, setPreferenceError] = useState<string>();
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState<
    BrowserNotificationStatus | undefined
  >();
  const notifications = useMemo(
    () =>
      deriveLocalNotifications({
        accounts,
        budgets,
        categories,
        loans,
        lowBalanceThresholdMinor: preferences.lowBalanceThresholdMinor,
        recurringRules,
        transactions,
        transactionSplits,
      }),
    [
      accounts,
      budgets,
      categories,
      loans,
      preferences.lowBalanceThresholdMinor,
      recurringRules,
      transactions,
      transactionSplits,
    ],
  );
  const [states, setStates] = useState<LocalNotificationStates>(() =>
    readLocalNotificationStates(),
  );
  const updateStates = (next: LocalNotificationStates) => {
    setStates(next);
    writeLocalNotificationStates(next);
  };
  const visible = notifications
    .filter((notification) => states[notification.id]?.dismissed !== true)
    .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority));
  const unread = visible.filter((notification) => states[notification.id]?.readAt === undefined);
  const markRead = (notificationId: string) =>
    updateStates({
      ...states,
      [notificationId]: { ...states[notificationId], readAt: new Date().toISOString() },
    });

  return (
    <div id="notifications">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Aggiornamenti locali</p>
          <h1>Notifiche</h1>
          <p>Avvisi derivati dal ledger su questo dispositivo. Nessun dato viene inviato online.</p>
        </div>
        {unread.length === 0 ? null : (
          <div className="notification-header-actions">
            <button
              className="secondary-action"
              onClick={() =>
                updateStates(
                  Object.fromEntries(
                    visible.map((notification) => [
                      notification.id,
                      { ...states[notification.id], readAt: new Date().toISOString() },
                    ]),
                  ),
                )
              }
              type="button"
            >
              Segna tutte come lette
            </button>
            <span aria-label={`${unread.length} notifiche non lette`} className="panel-meta">
              {unread.length}
            </span>
          </div>
        )}
      </header>
      <section aria-labelledby="system-notification-heading" className="data-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dispositivo</p>
            <h2 id="system-notification-heading">Notifiche di sistema</h2>
            <p>
              Il centro notifiche interno resta disponibile anche se il browser non supporta o nega
              le notifiche di sistema.
            </p>
          </div>
          <button
            className="secondary-action"
            onClick={() => void enableBrowserNotifications().then(setBrowserNotificationStatus)}
            type="button"
          >
            Attiva sul dispositivo
          </button>
        </div>
        {browserNotificationStatus === undefined ? null : (
          <p aria-live="polite" className="form-success" role="status">
            {browserNotificationStatus === "granted"
              ? "Notifiche di sistema abilitate."
              : browserNotificationStatus === "denied"
                ? "Permesso non concesso: continuerai a vedere gli avvisi in questa schermata."
                : "Notifiche di sistema non supportate: continuerai a vedere gli avvisi in questa schermata."}
          </p>
        )}
      </section>
      <section aria-labelledby="notification-preferences-heading" className="data-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Soglie</p>
            <h2 id="notification-preferences-heading">Preferenze avvisi</h2>
          </div>
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const next = {
                lowBalanceThresholdMinor: parseLocalizedAmountMinor(thresholdText, "EUR"),
              };
              writeLocalNotificationPreferences(next);
              setPreferences(next);
              setPreferenceError(undefined);
            } catch (error) {
              setPreferenceError(error instanceof Error ? error.message : "Soglia non valida.");
            }
          }}
        >
          <label>
            Soglia saldo basso (EUR)
            <input
              aria-describedby="notification-threshold-help notification-threshold-error"
              inputMode="decimal"
              onChange={(event) => setThresholdText(event.currentTarget.value)}
              value={thresholdText}
            />
          </label>
          <button className="secondary-action" type="submit">
            Salva soglia
          </button>
        </form>
        <p id="notification-threshold-help">
          Vengono segnalati gli account attivi con saldo uguale o inferiore a questa soglia.
        </p>
        {preferenceError === undefined ? null : (
          <p
            aria-live="polite"
            className="form-error"
            id="notification-threshold-error"
            role="alert"
          >
            {preferenceError}
          </p>
        )}
      </section>
      <section aria-label="Elenco notifiche" className="data-panel notification-list">
        {visible.length === 0 ? (
          <div className="account-list-empty">
            <h2>Nessuna notifica</h2>
            <p>
              Quando un budget, una rata o una ricorrenza richiederanno attenzione, compariranno
              qui.
            </p>
          </div>
        ) : (
          <ul className="account-list">
            {visible.map((notification) => {
              const isRead = states[notification.id]?.readAt !== undefined;
              return (
                <li className={isRead ? "is-read" : ""} key={notification.id}>
                  <div className="account-copy">
                    <strong>{notification.title}</strong>
                    <small>
                      {notification.priority === "high"
                        ? "Priorità alta · "
                        : notification.priority === "medium"
                          ? "Priorità media · "
                          : "Priorità bassa · "}
                      {notification.description}
                    </small>
                  </div>
                  <div className="notification-actions">
                    <a
                      className="text-action"
                      href={notification.href}
                      onClick={() => markRead(notification.id)}
                    >
                      Apri
                    </a>
                    {isRead ? null : (
                      <button
                        aria-label={`Segna come letta: ${notification.title}`}
                        className="text-action"
                        onClick={() => markRead(notification.id)}
                        type="button"
                      >
                        Segna come letta
                      </button>
                    )}
                    <button
                      aria-label={`Ignora notifica: ${notification.title}`}
                      className="text-action"
                      onClick={() =>
                        updateStates({
                          ...states,
                          [notification.id]: { ...states[notification.id], dismissed: true },
                        })
                      }
                      type="button"
                    >
                      Ignora
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function priorityRank(priority: "high" | "medium" | "low"): number {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}
