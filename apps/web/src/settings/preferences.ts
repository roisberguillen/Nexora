export type AppTheme = "light" | "dark" | "system";

export interface AppPreferences {
  readonly reduceMotion: boolean;
  readonly theme: AppTheme;
  readonly textScale: "medium" | "large";
  readonly financialMonthStartDay: number;
  /** Local display policy only: expiry never triggers background deletion. */
  readonly trashRetentionDays: 7 | 30 | 90;
}

const preferencesKey = "nexora.app-preferences.v1";
const defaults: AppPreferences = Object.freeze({
  reduceMotion: false,
  theme: "light",
  textScale: "medium",
  financialMonthStartDay: 1,
  trashRetentionDays: 30,
});

export function readAppPreferences(
  storage: Pick<Storage, "getItem"> = localStorage,
): AppPreferences {
  try {
    const raw = storage.getItem(preferencesKey);
    if (raw === null) return defaults;
    const candidate = JSON.parse(raw) as Partial<AppPreferences>;
    return Object.freeze({
      reduceMotion: candidate.reduceMotion === true,
      theme: candidate.theme === "dark" || candidate.theme === "system" ? candidate.theme : "light",
      textScale: candidate.textScale === "large" ? "large" : "medium",
      financialMonthStartDay: normalizeFinancialMonthStartDay(candidate.financialMonthStartDay),
      trashRetentionDays:
        candidate.trashRetentionDays === 7 || candidate.trashRetentionDays === 90
          ? candidate.trashRetentionDays
          : 30,
    });
  } catch {
    return defaults;
  }
}

function normalizeFinancialMonthStartDay(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 28
    ? value
    : 1;
}

export function writeAppPreferences(
  preferences: AppPreferences,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(preferencesKey, JSON.stringify(preferences));
}

export function applyAppPreferences(
  preferences: AppPreferences,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = preferences.theme;
  root.dataset.textScale = preferences.textScale;
  root.dataset.reduceMotion = String(preferences.reduceMotion);
}
