import { requireIdentifier, requireName } from "../validation";

export interface CreateTagProps {
  readonly id: string;
  readonly name: string;
  readonly isArchived?: boolean;
}

export class Tag {
  public readonly id: string;
  public readonly name: string;
  public readonly isArchived: boolean;

  private constructor(props: CreateTagProps) {
    this.id = requireIdentifier(props.id, "Tag id");
    this.name = requireName(props.name, "Tag name", "invalid_category");
    this.isArchived = props.isArchived ?? false;
    Object.freeze(this);
  }
  public static create(props: CreateTagProps): Tag {
    return new Tag(props);
  }
  public update(input: { readonly name: string; readonly isArchived: boolean }): Tag {
    return Tag.create({ id: this.id, name: input.name, isArchived: input.isArchived });
  }
}
