const defaultTimeZone = "Europe/Rome";

/** Formats a civil date without converting it through UTC. */
export function localCivilDate(now: Date = new Date(), timeZone = defaultTimeZone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (kind: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === kind)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function localCivilMonth(now: Date = new Date(), timeZone = defaultTimeZone): string {
  return localCivilDate(now, timeZone).slice(0, 7);
}
