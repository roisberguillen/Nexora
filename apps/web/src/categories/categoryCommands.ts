import {
  Category,
  createDefaultFinancialTaxonomy,
  type CategoryKindScope,
  type LedgerRepository,
} from "@nexora/domain";

export interface CategoryInput {
  readonly name: string;
  readonly kindScope: CategoryKindScope;
  readonly parentId?: string;
}

export async function createLedgerCategory(
  repository: LedgerRepository,
  input: CategoryInput,
  idFactory: () => string = () => `category-${crypto.randomUUID()}`,
): Promise<Category> {
  const category = Category.create({
    id: idFactory(),
    name: input.name,
    kindScope: input.kindScope,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
  });
  await repository.saveCategory(category);
  return category;
}

export async function updateLedgerCategory(
  repository: LedgerRepository,
  id: string,
  input: CategoryInput & { readonly isArchived: boolean },
): Promise<Category> {
  const existing = await repository.findCategoryById(id);
  if (existing === undefined) throw new Error("Category does not exist.");
  const updated = existing.update({
    name: input.name,
    kindScope: input.kindScope,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    isArchived: input.isArchived,
  });
  await repository.updateCategory(updated);
  return updated;
}

/** Installs the curated two-level taxonomy only after an explicit action on a fresh ledger. */
export async function installDefaultCategoryTaxonomy(repository: LedgerRepository): Promise<void> {
  const existing = await repository.listCategories();
  const defaults = createDefaultFinancialTaxonomy();
  const defaultsById = new Map(defaults.map((category) => [category.id, category]));
  const nonSystem = existing.filter((category) => !isSystemCategory(category.id));
  if (
    nonSystem.some((category) => {
      const expected = defaultsById.get(category.id);
      return expected === undefined || !sameCategory(category, expected);
    })
  ) {
    throw new Error("default_taxonomy_requires_empty_categories");
  }
  const existingIds = new Set(existing.map((category) => category.id));
  for (const category of defaults) {
    if (!existingIds.has(category.id)) await repository.saveCategory(category);
  }
}

function isSystemCategory(id: string): boolean {
  return id === "system-income" || id === "system-expense";
}

function sameCategory(left: Category, right: Category): boolean {
  return (
    left.name === right.name &&
    left.kindScope === right.kindScope &&
    left.parentId === right.parentId &&
    left.isArchived === right.isArchived
  );
}
