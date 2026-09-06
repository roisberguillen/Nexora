export type FinancialAmountTone = "negative" | "neutral" | "positive";

export interface FinancialAmountProps {
  readonly amountMinor: bigint;
  readonly className?: string;
  readonly currency: string;
  readonly locale?: string;
  readonly showPositiveSign?: boolean;
  readonly tone?: FinancialAmountTone;
}

export function FinancialAmount({
  amountMinor,
  className,
  currency,
  locale = "it-IT",
  showPositiveSign = false,
  tone = "neutral",
}: FinancialAmountProps) {
  const classes = ["financial-amount", `is-${tone}`, className]
    .filter((value) => value !== undefined && value.length > 0)
    .join(" ");

  return (
    <span className={classes}>
      {formatMinorUnits(amountMinor, currency, locale, showPositiveSign)}
    </span>
  );
}

export function formatMinorUnits(
  amountMinor: bigint,
  currency: string,
  locale = "it-IT",
  showPositiveSign = false,
): string {
  const currencyFormatter = new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
  });
  const fractionDigits = currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(fractionDigits);
  const isNegative = amountMinor < 0n;
  const absoluteMinor = isNegative ? -amountMinor : amountMinor;
  const integer = absoluteMinor / scale;
  const fraction = (absoluteMinor % scale).toString().padStart(fractionDigits, "0");
  const formattedInteger = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(integer);
  const templateParts = currencyFormatter.formatToParts(isNegative ? -1 : 0);
  const decimalSeparator = templateParts.find((part) => part.type === "decimal")?.value ?? "";
  let hasInsertedAmount = false;
  let formatted = "";

  for (const part of templateParts) {
    if (part.type === "integer") {
      if (!hasInsertedAmount) {
        formatted += formattedInteger;
        if (fractionDigits > 0) {
          formatted += decimalSeparator + fraction;
        }
        hasInsertedAmount = true;
      }
      continue;
    }
    if (part.type === "decimal" || part.type === "fraction" || part.type === "group") {
      continue;
    }
    formatted += part.value;
  }

  return showPositiveSign && amountMinor > 0n ? `+${formatted}` : formatted;
}

export function formatPercentage(
  value: number,
  maximumFractionDigits = 1,
  minimumFractionDigits = 0,
  locale = "it-IT",
): string {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)}%`;
}
