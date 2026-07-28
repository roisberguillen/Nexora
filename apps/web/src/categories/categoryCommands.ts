import { Category, type CategoryKindScope, type LedgerRepository } from "@nexora/domain";

export interface CategoryInput {
  readonly name: string;
  readonly kindScope: CategoryKindScope;
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
  const updated = existing.update({ name: input.name, isArchived: input.isArchived });
  await repository.updateCategory(updated);
  return updated;
}
