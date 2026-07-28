import { Tag, type LedgerRepository } from "@nexora/domain";

export interface TagInput {
  readonly name: string;
}

export async function createLedgerTag(
  repository: LedgerRepository,
  input: TagInput,
  idFactory: () => string = () => `tag-${crypto.randomUUID()}`,
): Promise<Tag> {
  const tag = Tag.create({ id: idFactory(), name: input.name });
  await repository.saveTag(tag);
  return tag;
}

export async function updateLedgerTag(
  repository: LedgerRepository,
  id: string,
  input: TagInput & { readonly isArchived: boolean },
): Promise<Tag> {
  const existing = (await repository.listTags()).find((tag) => tag.id === id);
  if (existing === undefined) throw new Error("Tag does not exist.");
  const updated = existing.update(input);
  await repository.updateTag(updated);
  return updated;
}
