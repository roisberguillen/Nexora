export function barSize(current: bigint, previous: bigint): number {
  const max = current > previous ? current : previous;
  return max > 0n && current > 0n ? Math.max(8, Number((current * 100n) / max)) : 0;
}
