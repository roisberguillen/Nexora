export interface GlobalSearchResult {
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly label: string;
}

export function filterGlobalSearchResults(
  results: readonly GlobalSearchResult[],
  query: string,
): readonly GlobalSearchResult[] {
  const normalized = query.trim().toLocaleLowerCase("it-IT");
  if (normalized === "") return [];
  return results.filter((result) =>
    `${result.label} ${result.detail}`.toLocaleLowerCase("it-IT").includes(normalized),
  );
}
