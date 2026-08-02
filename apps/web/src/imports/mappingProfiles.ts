import type { ImporterType } from "@nexora/domain";
import type { MoneyManagerField, MoneyManagerMapping } from "@nexora/importers";

const STORAGE_KEY = "nexora.import-mapping-profiles.v1";
const fields: readonly MoneyManagerField[] = [
  "account",
  "amount",
  "category",
  "currency",
  "date",
  "note",
  "payee",
  "type",
];

export interface ImportMappingProfile {
  readonly id: string;
  readonly name: string;
  readonly importerType: ImporterType;
  readonly mapping: MoneyManagerMapping;
}

type ProfileStorage = Pick<Storage, "getItem" | "setItem">;

export function loadImportMappingProfiles(
  storage: ProfileStorage | undefined = safeStorage(),
): readonly ImportMappingProfile[] {
  if (storage === undefined) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const candidate: unknown = JSON.parse(raw);
    if (!Array.isArray(candidate)) return [];
    return Object.freeze(candidate.map(parseProfile).filter(isDefined));
  } catch {
    return [];
  }
}

export function saveImportMappingProfile(
  profile: ImportMappingProfile,
  storage: ProfileStorage | undefined = safeStorage(),
): readonly ImportMappingProfile[] {
  const valid = parseProfile(profile);
  if (valid === undefined) throw new Error("invalid_mapping_profile");
  const profiles = loadImportMappingProfiles(storage).filter(({ id }) => id !== valid.id);
  const updated = Object.freeze([...profiles, valid].sort((a, b) => a.name.localeCompare(b.name)));
  if (storage !== undefined) storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

function parseProfile(value: unknown): ImportMappingProfile | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(record.id) ||
    typeof record.name !== "string" ||
    record.name.trim().length < 1 ||
    record.name.trim().length > 80 ||
    (record.importerType !== "money_manager_xlsx" &&
      record.importerType !== "mediobanca_xlsx" &&
      record.importerType !== "n26_pdf") ||
    typeof record.mapping !== "object" ||
    record.mapping === null
  ) {
    return undefined;
  }
  const mappingRecord = record.mapping as Record<string, unknown>;
  const entries: [MoneyManagerField, number][] = [];
  const usedIndexes = new Set<number>();
  for (const field of fields) {
    const index = mappingRecord[field];
    if (index === undefined) continue;
    if (!Number.isInteger(index) || (index as number) < 0 || usedIndexes.has(index as number)) {
      return undefined;
    }
    usedIndexes.add(index as number);
    entries.push([field, index as number]);
  }
  return Object.freeze({
    id: record.id,
    name: record.name.trim(),
    importerType: record.importerType,
    mapping: Object.freeze(Object.fromEntries(entries) as MoneyManagerMapping),
  });
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
