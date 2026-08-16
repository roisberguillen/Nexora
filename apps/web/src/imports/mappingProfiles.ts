import type { AccountType, ImporterType } from "@nexora/domain";
import type {
  MoneyManagerField,
  MoneyManagerMapping,
  MoneyManagerSemanticMapping,
} from "@nexora/importers";

const STORAGE_KEY = "nexora.import-mapping-profiles.v1";
const fields: readonly MoneyManagerField[] = [
  "account",
  "amount",
  "category",
  "subcategory",
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
  readonly semanticMapping?: MoneyManagerSemanticMapping;
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
      record.importerType !== "mediobanca_csv" &&
      record.importerType !== "n26_pdf" &&
      record.importerType !== "generic_csv") ||
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
    ...(record.semanticMapping === undefined
      ? {}
      : { semanticMapping: parseSemanticMapping(record.semanticMapping) }),
  });
}

const accountTypes = new Set<AccountType>([
  "checking",
  "savings",
  "cash",
  "investment",
  "loan",
  "virtual_subaccount",
]);

function parseSemanticMapping(value: unknown): MoneyManagerSemanticMapping {
  if (typeof value !== "object" || value === null) throw new Error("invalid_mapping_profile");
  const record = value as Record<string, unknown>;
  return Object.freeze({
    accountMappings: parseStringRecord(record.accountMappings),
    categoryMappings: parseStringRecord(record.categoryMappings),
    accountConfigurations: parseAccountConfigurations(record.accountConfigurations),
  });
}

function parseStringRecord(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return Object.freeze({});
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("invalid_mapping_profile");
  const entries = Object.entries(value);
  if (
    entries.length > 500 ||
    entries.some(
      ([key, target]) =>
        key.length < 1 || key.length > 300 || typeof target !== "string" || target.length > 200,
    )
  )
    throw new Error("invalid_mapping_profile");
  return Object.freeze(Object.fromEntries(entries));
}

function parseAccountConfigurations(
  value: unknown,
): NonNullable<MoneyManagerSemanticMapping["accountConfigurations"]> {
  if (value === undefined) return Object.freeze({});
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("invalid_mapping_profile");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new Error("invalid_mapping_profile");
  return Object.freeze(
    Object.fromEntries(
      entries.map(([key, candidate]) => {
        if (
          key.length < 1 ||
          key.length > 300 ||
          typeof candidate !== "object" ||
          candidate === null
        )
          throw new Error("invalid_mapping_profile");
        const config = candidate as Record<string, unknown>;
        if (!accountTypes.has(config.type as AccountType))
          throw new Error("invalid_mapping_profile");
        if (
          config.institution !== undefined &&
          (typeof config.institution !== "string" || config.institution.length > 160)
        )
          throw new Error("invalid_mapping_profile");
        return [
          key,
          Object.freeze({
            type: config.type as AccountType,
            ...(config.institution === undefined ? {} : { institution: config.institution }),
          }),
        ];
      }),
    ),
  );
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
