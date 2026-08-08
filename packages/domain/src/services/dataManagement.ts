import { DomainError } from "../errors/DomainError";
import type { Category } from "../entities/Category";
import { validateCategoryHierarchy } from "./categoryHierarchy";

const systemCategoryIds = new Set(["system-income", "system-expense"]);

/** Guards a category merge before an adapter writes the full re-assignment atomically. */
export function validateCategoryMerge(
  source: Category,
  target: Category,
  categories: readonly Category[] = [],
): void {
  if (source.id === target.id)
    throw new DomainError("invalid_category", "A category cannot be merged into itself.");
  if (systemCategoryIds.has(source.id))
    throw new DomainError("invalid_category", "System categories cannot be merged or removed.");
  if (target.isArchived)
    throw new DomainError(
      "invalid_category",
      "A category can only be merged into an active target.",
    );
  if (source.parentId !== target.parentId)
    throw new DomainError("invalid_category", "Categories can only merge within the same level.");
  if (categories.some((category) => category.parentId === source.id))
    throw new DomainError(
      "invalid_category",
      "A macro category with subcategories cannot be merged.",
    );
  validateCategoryHierarchy(categories);
}

export function isSystemCategory(id: string): boolean {
  return systemCategoryIds.has(id);
}
