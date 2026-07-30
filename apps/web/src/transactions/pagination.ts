export const transactionPageSize = 100;

export function paginateTransactions<Item>(
  items: readonly Item[],
  requestedPage: number,
): {
  readonly currentPage: number;
  readonly items: readonly Item[];
  readonly pageCount: number;
} {
  const pageCount = Math.max(1, Math.ceil(items.length / transactionPageSize));
  const currentPage = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (currentPage - 1) * transactionPageSize;
  return Object.freeze({
    currentPage,
    items: items.slice(start, start + transactionPageSize),
    pageCount,
  });
}
