import { Category } from "../entities/Category";

/**
 * Stable categories recreated by a financial reset. They are intentionally minimal: the
 * reset never guesses the user's personal taxonomy, but leaves the ledger immediately usable.
 */
export function createSystemCategories(): readonly Category[] {
  return Object.freeze([
    Category.create({ id: "system-income", name: "Entrate", kindScope: "income" }),
    Category.create({ id: "system-expense", name: "Spese", kindScope: "expense" }),
  ]);
}
