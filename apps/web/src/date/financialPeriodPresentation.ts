import { financialPeriodBounds, LocalDate } from "@nexora/domain";

export function formatFinancialPeriod(period: string, startDay = 1): string {
  const bounds = financialPeriodBounds(period, startDay);
  if (startDay === 1) {
    return new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(toUtcDate(bounds.startDate))
      .replace(/^./, (letter) => letter.toUpperCase());
  }
  return `${formatDate(bounds.startDate)} – ${formatDate(previousDate(bounds.endDateExclusive))}`;
}

function formatDate(value: LocalDate): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(value));
}

function toUtcDate(value: LocalDate): Date {
  return new Date(`${value.toString()}T00:00:00.000Z`);
}

function previousDate(value: LocalDate): LocalDate {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return LocalDate.parse(date.toISOString().slice(0, 10));
}
