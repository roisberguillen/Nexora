import { DomainError } from "../errors/DomainError";
import { requireIdentifier, requireName } from "../validation";
import type { TransactionKind } from "./Transaction";

export type CategoryKindScope = "income" | "expense" | "both";

const categoryKindScopes = new Set<CategoryKindScope>(["income", "expense", "both"]);

export interface CreateCategoryProps {
  readonly id: string;
  readonly name: string;
  readonly kindScope: CategoryKindScope;
  readonly parentId?: string;
  readonly isArchived?: boolean;
}

export class Category {
  public readonly id: string;
  public readonly name: string;
  public readonly kindScope: CategoryKindScope;
  public readonly parentId: string | undefined;
  public readonly isArchived: boolean;

  private constructor(props: CreateCategoryProps) {
    this.id = requireIdentifier(props.id, "Category id");
    this.name = requireName(props.name, "Category name", "invalid_category");
    if (!categoryKindScopes.has(props.kindScope)) {
      throw new DomainError("invalid_category", "Category scope is not supported.");
    }
    this.kindScope = props.kindScope;
    this.parentId =
      props.parentId === undefined
        ? undefined
        : requireIdentifier(props.parentId, "Parent category id");
    this.isArchived = props.isArchived ?? false;

    if (this.parentId === this.id) {
      throw new DomainError("invalid_category", "A category cannot be its own parent.");
    }

    Object.freeze(this);
  }

  public static create(props: CreateCategoryProps): Category {
    return new Category(props);
  }

  public accepts(kind: TransactionKind): boolean {
    if (kind === "income") {
      return this.kindScope === "income" || this.kindScope === "both";
    }
    if (kind === "expense") {
      return this.kindScope === "expense" || this.kindScope === "both";
    }
    return false;
  }
}
