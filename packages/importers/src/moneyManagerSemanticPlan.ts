import { Account, Category, Money, type AccountType, type CategoryKindScope } from "@nexora/domain";

import type { MoneyManagerPreviewRow } from "./moneyManagerPreview";

export type SemanticPlanStatus = "existing" | "to_create" | "needs_review";

export interface MoneyManagerAccountPlanItem {
  readonly sourceName: string;
  readonly currency: string | undefined;
  readonly targetAccountId: string | undefined;
  readonly proposedAccount?: Account;
  readonly status: SemanticPlanStatus;
}

export interface MoneyManagerCategoryPlanItem {
  readonly sourceCategory: string;
  readonly sourceSubcategory: string | undefined;
  readonly targetCategoryId: string | undefined;
  readonly proposedCategories: readonly Category[];
  readonly status: SemanticPlanStatus;
}

export interface MoneyManagerSemanticPlan {
  readonly accounts: readonly MoneyManagerAccountPlanItem[];
  readonly categories: readonly MoneyManagerCategoryPlanItem[];
  readonly accountsToCreate: readonly Account[];
  readonly categoriesToCreate: readonly Category[];
}

export interface MoneyManagerSemanticMapping {
  readonly accountMappings?: Readonly<Record<string, string>>;
  readonly accountConfigurations?: Readonly<
    Record<string, { readonly type: AccountType; readonly institution?: string }>
  >;
  readonly categoryMappings?: Readonly<Record<string, string>>;
}

export function buildMoneyManagerSemanticPlan(
  rows: readonly MoneyManagerPreviewRow[],
  accounts: readonly Account[],
  categories: readonly Category[],
  idFactory: () => string = () => crypto.randomUUID(),
  semanticMapping: MoneyManagerSemanticMapping = {},
): MoneyManagerSemanticPlan {
  const accountPlan = unique([
    ...rows.map((row) => row.account).filter(isDefined),
    ...rows
      .filter((row) => /^trasferimento (?:uscita|entrata)$/i.test(row.sourceType ?? ""))
      .map((row) => row.sourceCategory)
      .filter(isDefined),
  ]).map((sourceName) => planAccount(sourceName, rows, accounts, idFactory, semanticMapping));
  const categoryPaths = unique(
    rows
      .filter(isStandardRow)
      .map(
        (row) => `${row.sourceCategory ?? row.category ?? ""}\u0000${row.sourceSubcategory ?? ""}`,
      ),
  ).filter((path) => !path.startsWith("\u0000"));
  const categoryPlan: MoneyManagerCategoryPlanItem[] = [];
  const plannedCategories: Category[] = [...categories];
  for (const path of categoryPaths) {
    const [sourceCategory = "", sourceSubcategory = ""] = path.split("\u0000");
    const item = planCategory(
      sourceCategory,
      sourceSubcategory || undefined,
      rows,
      plannedCategories,
      idFactory,
      semanticMapping,
    );
    categoryPlan.push(item);
    plannedCategories.push(...item.proposedCategories);
  }
  return Object.freeze({
    accounts: Object.freeze(accountPlan),
    categories: Object.freeze(categoryPlan),
    accountsToCreate: Object.freeze(accountPlan.flatMap((item) => item.proposedAccount ?? [])),
    categoriesToCreate: Object.freeze(categoryPlan.flatMap((item) => item.proposedCategories)),
  });
}

function planAccount(
  sourceName: string,
  rows: readonly MoneyManagerPreviewRow[],
  accounts: readonly Account[],
  idFactory: () => string,
  semanticMapping: MoneyManagerSemanticMapping,
): MoneyManagerAccountPlanItem {
  const currencies = unique(
    rows
      .filter(
        (row) =>
          normalize(row.account) === normalize(sourceName) ||
          (/^trasferimento (?:uscita|entrata)$/i.test(row.sourceType ?? "") &&
            normalize(row.sourceCategory) === normalize(sourceName)),
      )
      .map((row) => row.currency)
      .filter(isDefined),
  );
  if (currencies.length !== 1)
    return { sourceName, currency: undefined, targetAccountId: undefined, status: "needs_review" };
  const mappedAccountId = semanticMapping.accountMappings?.[normalize(sourceName)];
  if (mappedAccountId !== undefined) {
    const mapped = accounts.find(
      (account) => !account.isArchived && account.id === mappedAccountId,
    );
    if (mapped !== undefined && mapped.currency === currencies[0]) {
      return {
        sourceName,
        currency: currencies[0],
        targetAccountId: mapped.id,
        status: "existing",
      };
    }
  }
  const exact = accounts.filter(
    (account) => !account.isArchived && normalize(account.name) === normalize(sourceName),
  );
  const known = exact.length > 0 ? exact : knownInstitutionCandidates(sourceName, accounts);
  if (known.length === 1 && known[0]!.currency === currencies[0]) {
    return {
      sourceName,
      currency: currencies[0],
      targetAccountId: known[0]!.id,
      status: "existing",
    };
  }
  if (known.length > 0)
    return {
      sourceName,
      currency: currencies[0],
      targetAccountId: undefined,
      status: "needs_review",
    };
  const configured = semanticMapping.accountConfigurations?.[normalize(sourceName)];
  const accountType = configured?.type ?? approvedAccountType(sourceName);
  if (accountType === undefined)
    return {
      sourceName,
      currency: currencies[0],
      targetAccountId: undefined,
      status: "needs_review",
    };
  const proposedAccount = Account.create({
    id: `account-import-${idFactory()}`,
    name: /^dire(?:cta|tta) sim$/i.test(sourceName.trim()) ? "Directa SIM" : sourceName.trim(),
    type: accountType,
    currency: currencies[0]!,
    openingBalance: Money.zero(currencies[0]!),
    ...(configured?.institution !== undefined
      ? { institution: configured.institution }
      : /^dire(?:cta|tta) sim$/i.test(sourceName.trim())
        ? { institution: "Directa SIM" }
        : {}),
  });
  return {
    sourceName,
    currency: currencies[0],
    targetAccountId: proposedAccount.id,
    proposedAccount,
    status: "to_create",
  };
}

function knownInstitutionCandidates(
  sourceName: string,
  accounts: readonly Account[],
): readonly Account[] {
  if (/^n26$/i.test(sourceName.trim())) {
    return accounts.filter(
      (account) =>
        !account.isArchived &&
        account.type !== "virtual_subaccount" &&
        /\bn26\b/i.test(`${account.name} ${account.institution ?? ""}`),
    );
  }
  if (/^medio banca premiere$/i.test(sourceName.trim())) {
    return accounts.filter(
      (account) =>
        !account.isArchived &&
        /mediobanca\s+premier/i.test(`${account.name} ${account.institution ?? ""}`),
    );
  }
  if (/^dire(?:cta|tta) sim$/i.test(sourceName.trim())) {
    return accounts.filter(
      (account) =>
        !account.isArchived &&
        account.type === "investment" &&
        /direc?ta\s+sim/i.test(`${account.name} ${account.institution ?? ""}`),
    );
  }
  return [];
}

function approvedAccountType(sourceName: string): AccountType | undefined {
  return /^dire(?:cta|tta) sim$/i.test(sourceName.trim()) ? "investment" : undefined;
}

function planCategory(
  sourceCategory: string,
  sourceSubcategory: string | undefined,
  rows: readonly MoneyManagerPreviewRow[],
  categories: readonly Category[],
  idFactory: () => string,
  semanticMapping: MoneyManagerSemanticMapping,
): MoneyManagerCategoryPlanItem {
  const relevant = rows.filter(
    (row) =>
      normalize(row.sourceCategory ?? row.category) === normalize(sourceCategory) &&
      normalize(row.sourceSubcategory) === normalize(sourceSubcategory),
  );
  const scope = categoryScope(relevant);
  const pathKey = categoryPathKey(sourceCategory, sourceSubcategory);
  const mappedCategoryId = semanticMapping.categoryMappings?.[pathKey];
  if (mappedCategoryId !== undefined) {
    const mapped = categories.find(
      (category) => !category.isArchived && category.id === mappedCategoryId,
    );
    if (mapped !== undefined && acceptsScope(mapped, scope)) {
      return {
        sourceCategory,
        sourceSubcategory,
        targetCategoryId: mapped.id,
        proposedCategories: [],
        status: "existing",
      };
    }
  }
  const macro = categories.find(
    (category) =>
      !category.isArchived &&
      category.parentId === undefined &&
      normalize(category.name) === normalize(sourceCategory),
  );
  const child =
    sourceSubcategory === undefined
      ? undefined
      : categories.find(
          (category) =>
            !category.isArchived &&
            category.parentId === macro?.id &&
            normalize(category.name) === normalize(sourceSubcategory),
        );
  const target = sourceSubcategory === undefined ? macro : child;
  if (target !== undefined && acceptsScope(target, scope)) {
    return {
      sourceCategory,
      sourceSubcategory,
      targetCategoryId: target.id,
      proposedCategories: [],
      status: "existing",
    };
  }
  if (
    (macro !== undefined && !acceptsScope(macro, scope)) ||
    (child !== undefined && !acceptsScope(child, scope))
  ) {
    return {
      sourceCategory,
      sourceSubcategory,
      targetCategoryId: undefined,
      proposedCategories: [],
      status: "needs_review",
    };
  }
  const proposedMacro =
    macro ??
    Category.create({
      id: `category-import-${idFactory()}`,
      name: sourceCategory,
      kindScope: scope,
    });
  const proposedChild =
    sourceSubcategory === undefined
      ? undefined
      : Category.create({
          id: `category-import-${idFactory()}`,
          name: sourceSubcategory,
          kindScope: scope,
          parentId: proposedMacro.id,
        });
  return {
    sourceCategory,
    sourceSubcategory,
    targetCategoryId: proposedChild?.id ?? proposedMacro.id,
    proposedCategories: Object.freeze([
      ...(macro === undefined ? [proposedMacro] : []),
      ...(proposedChild === undefined ? [] : [proposedChild]),
    ]),
    status: "to_create",
  };
}

function categoryScope(rows: readonly MoneyManagerPreviewRow[]): CategoryKindScope {
  const kinds = new Set(rows.map((row) => normalize(row.sourceType)));
  return kinds.has("spesa") && kinds.has("guadagno")
    ? "both"
    : kinds.has("guadagno")
      ? "income"
      : "expense";
}
function acceptsScope(category: Category, scope: CategoryKindScope): boolean {
  return scope === "both" ? category.kindScope === "both" : category.accepts(scope);
}
function isStandardRow(row: MoneyManagerPreviewRow): boolean {
  return (
    !/^trasferimento (?:uscita|entrata)$/i.test(row.sourceType ?? "") &&
    normalize(row.sourceCategory ?? row.category) !== "modifica saldo"
  );
}
function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.normalize("NFC")))];
}
function normalize(value: string | undefined): string {
  return (value ?? "").normalize("NFC").trim().toLocaleLowerCase("it-IT").replaceAll(/\s+/g, " ");
}
export function moneyManagerSemanticKey(value: string): string {
  return normalize(value);
}
export function moneyManagerCategoryPathKey(category: string, subcategory?: string): string {
  return categoryPathKey(category, subcategory);
}
function categoryPathKey(category: string, subcategory?: string): string {
  return `${normalize(category)}\u0000${normalize(subcategory)}`;
}
function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined && value !== "";
}
