import type { TransactionListItem } from "./buildTransactionsViewModel";

export interface TransactionDateGroup {
  readonly label: string;
  readonly items: readonly TransactionListItem[];
  readonly key: string;
}

export function groupTransactionsByDate(
  items: readonly TransactionListItem[],
  sort: string,
  now: Date = new Date(),
): readonly TransactionDateGroup[] {
  if (sort !== "recent" && sort !== "oldest") {
    return [{ key: "all", label: "Movimenti", items }];
  }
  const groups = new Map<string, TransactionListItem[]>();
  for (const item of items)
    groups.set(item.bookedDate, [...(groups.get(item.bookedDate) ?? []), item]);
  return [...groups.entries()].map(([key, groupedItems]) => ({
    key,
    label: transactionDateGroupLabel(key, now),
    items: groupedItems,
  }));
}

export function transactionDateGroupLabel(value: string, now: Date): string {
  const date = new Date(`${value}T12:00:00`);
  date.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const previousDay = new Date(today);
  previousDay.setDate(today.getDate() - 1);
  if (date.getTime() === today.getTime()) return "Oggi";
  if (date.getTime() === previousDay.getTime()) return "Ieri";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
