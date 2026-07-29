export type AppTheme = "light" | "dark" | "system";

export interface AppPreferences {
  readonly reduceMotion: boolean;
  readonly theme: AppTheme;
  readonly textScale: "medium" | "large";
}

const preferencesKey = "nexora.app-preferences.v1";
const defaults: AppPreferences = Object.freeze({
  reduceMotion: false,
  theme: "light",
  textScale: "medium",
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
    });
  } catch {
    return defaults;
  }
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
