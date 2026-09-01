export const PROFILE_STORAGE_KEY = "nexora.profile.v1";

export interface LocalProfile {
  readonly displayName?: string;
}

type ProfileStorage = Pick<Storage, "getItem" | "setItem">;

export function readLocalProfile(
  storage: ProfileStorage | undefined = safeStorage(),
): LocalProfile {
  if (storage === undefined) return {};
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (raw === null) return {};
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("displayName" in value)) return {};
    const displayName = (value as { displayName?: unknown }).displayName;
    return typeof displayName === "string" && displayName.trim() !== ""
      ? { displayName: displayName.trim() }
      : {};
  } catch {
    return {};
  }
}

export function saveLocalProfile(
  displayName: string,
  storage: ProfileStorage | undefined = safeStorage(),
): LocalProfile {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (normalized === "") throw new Error("profile_name_required");
  if (normalized.length > 120) throw new Error("profile_name_too_long");
  if (storage === undefined) throw new Error("profile_storage_unavailable");
  const profile = { displayName: normalized } satisfies LocalProfile;
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
