import { FinancialAmount } from "@nexora/ui";
import { useEffect, useRef } from "react";

import type { TransactionListItem } from "./buildTransactionsViewModel";

interface TransactionDetailsPanelProps {
  readonly item: TransactionListItem;
  readonly onClose: () => void;
}

export function TransactionDetailsPanel({ item, onClose }: TransactionDetailsPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const tone = item.isTransfer ? "neutral" : item.amount.amountMinor < 0n ? "negative" : "positive";
  const [fromAccount, toAccount] = item.isTransfer ? item.accountLabel.split(" → ") : [];

  return (
    <aside aria-labelledby="transaction-details-title" className="transaction-details-panel">
      <header>
        <div>
          <p className="eyebrow">Dettaglio movimento</p>
          <h2 id="transaction-details-title">{item.title}</h2>
        </div>
        <button
          aria-label="Chiudi dettaglio movimento"
          className="transaction-details-close"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          ×
        </button>
      </header>
      <FinancialAmount
        amountMinor={item.amount.amountMinor}
        className="transaction-details-amount"
        currency={item.amount.currency}
        showPositiveSign={!item.isTransfer && item.amount.amountMinor > 0n}
        tone={tone}
      />
      {item.isTransfer ? (
        <section>
          <h3>Trasferimento</h3>
          <dl>
            <Detail label="Da" value={fromAccount} />
            <Detail label="A" value={toAccount} />
          </dl>
        </section>
      ) : null}
      <dl>
        {item.isTransfer ? null : <Detail label="Conto" value={item.accountLabel} />}
        <Detail label="Categoria" value={item.categoryLabel} />
        <Detail label="Data" value={formatDate(item.bookedDate)} />
        <Detail label="Tipo movimento" value={item.kindLabel} />
        <Detail label="Origine" value={sourceLabel(item.source)} />
        <Detail label="Controparte" value={item.payee} />
        <Detail label="Descrizione" value={item.description} />
      </dl>
      {item.statusLabel ? <p className="transaction-status">{item.statusLabel}</p> : null}
    </aside>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string | undefined }) {
  return value?.trim() ? (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  ) : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function sourceLabel(source: TransactionListItem["source"]) {
  if (source === "import") return "Importato";
  if (source === "recurring") return "Ricorrenza";
  if (source === "system") return "Sistema";
  return source === "manual" ? "Manuale" : undefined;
}
