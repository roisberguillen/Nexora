import { FinancialAmount, NavIcon } from "@nexora/ui";
import { useEffect, useRef, useState } from "react";

import type { TransactionListItem } from "./buildTransactionsViewModel";
import { groupTransactionsByDate } from "./transactionDateGroups";

interface TransactionListProps {
  readonly isSaving: boolean;
  readonly items: readonly TransactionListItem[];
  readonly onCancel: (item: TransactionListItem) => void;
  readonly onEdit: (item: TransactionListItem) => void;
  readonly onTrash: (item: TransactionListItem) => void;
  readonly onOpen?: (item: TransactionListItem, trigger: HTMLElement) => void;
  readonly selectedItemId?: string | undefined;
  readonly sort?: string;
  readonly onToggleSelection: (id: string, selected: boolean) => void;
  readonly selectedIds: ReadonlySet<string>;
  readonly selectionMode: boolean;
}

export function TransactionList({
  isSaving,
  items,
  onCancel,
  onEdit,
  onTrash,
  onOpen,
  selectedItemId,
  onToggleSelection,
  selectedIds,
  selectionMode,
  sort = "recent",
}: TransactionListProps) {
  return (
    <ul aria-label="Movimenti registrati nel ledger" className="transaction-list">
      {groupTransactionsByDate(items, sort).map((group) => (
        <li className="transaction-date-group" key={group.key}>
          <h3>{group.label}</h3>
          <ul>
            {group.items.map((item) => (
              <TransactionListRow
                isSaving={isSaving}
                item={item}
                key={item.id}
                onCancel={onCancel}
                onEdit={onEdit}
                onOpen={onOpen}
                onToggleSelection={onToggleSelection}
                onTrash={onTrash}
                selected={selectedIds.has(item.id)}
                isDetailsSelected={item.id === selectedItemId}
                selectionMode={selectionMode}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

interface TransactionListRowProps {
  readonly isSaving: boolean;
  readonly item: TransactionListItem;
  readonly onCancel: (item: TransactionListItem) => void;
  readonly onEdit: (item: TransactionListItem) => void;
  readonly onOpen?: ((item: TransactionListItem, trigger: HTMLElement) => void) | undefined;
  readonly onTrash: (item: TransactionListItem) => void;
  readonly onToggleSelection: (id: string, selected: boolean) => void;
  readonly selected: boolean;
  readonly isDetailsSelected: boolean;
  readonly selectionMode: boolean;
}

function TransactionListRow({
  isSaving,
  item,
  onCancel,
  onEdit,
  onOpen,
  onTrash,
  onToggleSelection,
  selected,
  isDetailsSelected,
  selectionMode,
}: TransactionListRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayStatus =
    item.status === "expected" || item.status === "cancelled" ? item.statusLabel : undefined;
  const sourceIndicator = item.source === "import" ? "Importato" : undefined;
  const tone = item.isTransfer ? "neutral" : item.amount.amountMinor < 0n ? "negative" : "positive";

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  return (
    <li
      className={`transaction-list-row${item.status === "cancelled" ? " is-cancelled" : ""}${isDetailsSelected ? " is-details-selected" : ""}`}
    >
      {selectionMode ? (
        <label className="transaction-select">
          <input
            aria-label={`Seleziona ${item.title}`}
            checked={selected}
            disabled={!item.canCancel || isSaving}
            onChange={(event) => onToggleSelection(item.id, event.currentTarget.checked)}
            type="checkbox"
          />
        </label>
      ) : null}
      <span aria-hidden="true" className="transaction-category-icon">
        <NavIcon name="transactions" />
      </span>
      <button
        className="transaction-list-open"
        onClick={(event) => onOpen?.(item, event.currentTarget)}
        type="button"
      >
        <div className="transaction-list-main">
          <strong title={item.title}>{item.title}</strong>
          <span
            className="transaction-list-meta"
            title={`${item.categoryLabel} · ${item.accountLabel}`}
          >
            {item.categoryLabel} <span aria-hidden="true">·</span> {item.accountLabel}
          </span>
          <time dateTime={item.bookedDate}>{formatTransactionDate(item.bookedDate)}</time>
        </div>
      </button>
      <div className="transaction-list-summary">
        <FinancialAmount
          amountMinor={item.amount.amountMinor}
          currency={item.amount.currency}
          showPositiveSign={!item.isTransfer && item.amount.amountMinor > 0n}
          tone={tone}
        />
        {displayStatus === undefined && sourceIndicator === undefined ? null : (
          <span className="transaction-status">
            {[displayStatus, sourceIndicator].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <div className="transaction-menu-wrap">
        <button
          aria-controls={`transaction-actions-${item.id}`}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={`Azioni per ${item.title}`}
          className="transaction-menu-trigger"
          disabled={isSaving || !item.canCancel}
          onClick={() => setIsMenuOpen((open) => !open)}
          ref={triggerRef}
          type="button"
        >
          <span aria-hidden="true">⋯</span>
        </button>
        {isMenuOpen ? (
          <div
            aria-label={`Azioni per ${item.title}`}
            className="transaction-action-menu"
            id={`transaction-actions-${item.id}`}
            ref={menuRef}
            role="menu"
          >
            {item.source === "manual" && !item.isTransfer ? (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit(item);
                }}
                role="menuitem"
                type="button"
              >
                Modifica
              </button>
            ) : null}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onCancel(item);
              }}
              role="menuitem"
              type="button"
            >
              Annulla
            </button>
            <button
              className="is-destructive"
              onClick={() => {
                setIsMenuOpen(false);
                onTrash(item);
              }}
              role="menuitem"
              type="button"
            >
              Sposta nel cestino
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function formatTransactionDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
