import type { Budget, Loan, RecurringRule, Transaction } from "@nexora/domain";
import { useMemo, useState } from "react";

import {
  deriveLocalNotifications,
  readLocalNotificationStates,
  writeLocalNotificationStates,
  type LocalNotificationStates,
} from "./localNotifications";

export function NotificationsPage({
  budgets,
  loans,
  recurringRules,
  transactions,
}: {
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly recurringRules: readonly RecurringRule[];
  readonly transactions: readonly Transaction[];
}) {
  const notifications = useMemo(
    () => deriveLocalNotifications({ budgets, loans, recurringRules, transactions }),
    [budgets, loans, recurringRules, transactions],
  );
  const [states, setStates] = useState<LocalNotificationStates>(() =>
    readLocalNotificationStates(),
  );
  const updateStates = (next: LocalNotificationStates) => {
    setStates(next);
    writeLocalNotificationStates(next);
  };
  const visible = notifications.filter(
    (notification) => states[notification.id]?.dismissed !== true,
  );
  const unread = visible.filter((notification) => states[notification.id]?.readAt === undefined);

  return (
    <div id="notifications">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Aggiornamenti locali</p>
          <h1>Notifiche</h1>
          <p>Avvisi derivati dal ledger su questo dispositivo. Nessun dato viene inviato online.</p>
        </div>
        {unread.length === 0 ? null : (
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
        )}
      </header>
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
                    <small>{notification.description}</small>
                  </div>
                  <div className="notification-actions">
                    <a className="text-action" href={notification.href}>
                      Apri
                    </a>
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
