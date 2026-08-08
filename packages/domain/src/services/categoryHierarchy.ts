import { DomainError } from "../errors/DomainError";
import type { Category, CategoryKindScope } from "../entities/Category";

/** Enforces Nexora's deliberately shallow Macro category -> Subcategory model. */
export function validateCategoryHierarchy(categories: readonly Category[]): void {
  const byId = new Map(categories.map((category) => [category.id, category]));
  if (byId.size !== categories.length)
    throw new DomainError("duplicate_entity", "Category identifiers must be unique.");

  for (const category of categories) {
    if (category.parentId === undefined) continue;
    const parent = byId.get(category.parentId);
    if (parent === undefined)
      throw new DomainError("missing_reference", "Parent category does not exist.");
    if (parent.isArchived)
      throw new DomainError("invalid_category", "An archived category cannot be a parent.");
    if (parent.parentId !== undefined)
      throw new DomainError("invalid_category", "Categories support only two hierarchy levels.");
    if (!parentAcceptsChildScope(parent.kindScope, category.kindScope))
      throw new DomainError(
        "invalid_category",
        "Parent and child category scopes are incompatible.",
      );
  }
}

export function parentAcceptsChildScope(
  parentScope: CategoryKindScope,
  childScope: CategoryKindScope,
): boolean {
  return parentScope === "both" || parentScope === childScope;
}

export function categoryLabel(
  category: Pick<Category, "id" | "name" | "parentId">,
  categories: readonly Pick<Category, "id" | "name" | "parentId">[],
): string {
  if (category.parentId === undefined) return category.name;
  const parent = categories.find((candidate) => candidate.id === category.parentId);
  return parent === undefined ? category.name : `${parent.name} → ${category.name}`;
}
