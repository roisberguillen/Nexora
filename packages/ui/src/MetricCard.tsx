import { FinancialAmount, type FinancialAmountTone } from "./FinancialAmount";

export interface MetricCardProps {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly isFeatured?: boolean;
  readonly label: string;
  readonly supportingText: string;
  readonly tone?: FinancialAmountTone;
}

export function MetricCard({
  amountMinor,
  currency,
  isFeatured = false,
  label,
  supportingText,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <article className={`metric-card${isFeatured ? " is-featured" : ""}`}>
      <p className="metric-label">{label}</p>
      <FinancialAmount
        amountMinor={amountMinor}
        className="metric-value"
        currency={currency}
        showPositiveSign={tone === "positive"}
        tone={isFeatured ? "neutral" : tone}
      />
      <p className="metric-supporting">{supportingText}</p>
    </article>
  );
}
