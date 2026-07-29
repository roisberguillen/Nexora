import type { Budget, Loan, RecurringRule, Transaction } from "@nexora/domain";

export type LocalNotificationKind = "budget" | "loan" | "recurring";

export interface LocalNotification {
  readonly description: string;
  readonly href: string;
  readonly id: string;
  readonly kind: LocalNotificationKind;
  readonly title: string;
}

export interface LocalNotificationState {
  readonly dismissed?: boolean;
  readonly readAt?: string;
}

export type LocalNotificationStates = Readonly<Record<string, LocalNotificationState>>;

const storageKey = "nexora.local-notifications.v1";

export function deriveLocalNotifications({
  budgets,
  loans,
  recurringRules,
  transactions,
  today = new Date(),
}: {
  readonly budgets: readonly Budget[];
  readonly loans: readonly Loan[];
  readonly recurringRules: readonly RecurringRule[];
  readonly today?: Date;
  readonly transactions: readonly Transaction[];
}): readonly LocalNotification[] {
  const currentPeriod = today.toISOString().slice(0, 7);
  const notifications: LocalNotification[] = [];
  for (const budget of budgets) {
    if (budget.period !== currentPeriod) continue;
    const usage = budget.usagePercent(transactions);
    if (budget.alertAt100 && usage >= 100) {
      notifications.push({
        description: `Hai usato il ${usage.toFixed(0)}% del limite mensile.`,
        href: "./#budgets",
        id: `budget-exceeded:${budget.id}:${budget.period}`,
        kind: "budget",
        title: "Budget superato",
      });
    } else if (budget.alertAt80 && usage >= 80) {
      notifications.push({
        description: `Hai usato il ${usage.toFixed(0)}% del limite mensile.`,
        href: "./#budgets",
        id: `budget-warning:${budget.id}:${budget.period}`,
        kind: "budget",
        title: "Budget vicino al limite",
      });
    }
  }
  for (const rule of recurringRules) {
    const days = daysUntil(rule.nextExpectedDate.toString(), today);
    if (!rule.enabled || days < 0 || days > 7) continue;
    notifications.push({
      description: `Prevista ${days === 0 ? "oggi" : `tra ${days} giorni`}.`,
      href: "./#recurring",
      id: `recurring:${rule.id}:${rule.nextExpectedDate.toString()}`,
      kind: "recurring",
      title: rule.name,
    });
  }
  for (const loan of loans) {
    if (loan.nextDueDate === undefined) continue;
    const days = daysUntil(loan.nextDueDate.toString(), today);
    if (days < 0 || days > 7) continue;
    notifications.push({
      description: `Rata prevista ${days === 0 ? "oggi" : `tra ${days} giorni`}.`,
      href: "./#loans",
      id: `loan:${loan.id}:${loan.nextDueDate.toString()}`,
      kind: "loan",
      title: `Rata ${loan.lender}`,
    });
  }
  return notifications;
}

export function readLocalNotificationStates(
  storage: Pick<Storage, "getItem"> = localStorage,
): LocalNotificationStates {
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return {};
    const candidate = JSON.parse(raw) as Record<string, LocalNotificationState>;
    return Object.fromEntries(
      Object.entries(candidate).map(([id, state]) => [
        id,
        {
          ...(state.dismissed === true ? { dismissed: true } : {}),
          ...(typeof state.readAt === "string" ? { readAt: state.readAt } : {}),
        },
      ]),
    );
  } catch {
    return {};
  }
}

export function writeLocalNotificationStates(
  states: LocalNotificationStates,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(storageKey, JSON.stringify(states));
}

function daysUntil(isoDate: string, today: Date): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  return Math.round((target - start) / 86_400_000);
}
