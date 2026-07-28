export type DemoSeedErrorCode = "non_empty_ledger" | "seed_conflict";

export class DemoSeedError extends Error {
  public readonly code: DemoSeedErrorCode;

  public constructor(code: DemoSeedErrorCode, message: string) {
    super(message);
    this.name = "DemoSeedError";
    this.code = code;
  }
}
