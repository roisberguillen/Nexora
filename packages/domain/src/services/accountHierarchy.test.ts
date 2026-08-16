import { describe, expect, it } from "vitest";

import { Account } from "../entities/Account";
import { sortAccountsParentFirst, validateAccountHierarchy } from "./accountHierarchy";

describe("account hierarchy", () => {
  const parent = Account.create({
    id: "parent",
    name: "Parent",
    type: "checking",
    currency: "EUR",
  });
  const child = Account.create({
    id: "child",
    name: "Child",
    type: "virtual_subaccount",
    currency: "EUR",
    parentAccountId: parent.id,
  });

  it("validates a complete hierarchy and orders parents before children", () => {
    expect(() => validateAccountHierarchy([child, parent])).not.toThrow();
    expect(sortAccountsParentFirst([child, parent])).toEqual([parent, child]);
  });

  it("rejects missing, archived, nested and currency-incompatible parents", () => {
    expect(() => validateAccountHierarchy([child])).toThrow("Parent account does not exist");
    expect(() => validateAccountHierarchy([child, parent.update({ isArchived: true })])).toThrow(
      "active parent",
    );
    expect(() =>
      validateAccountHierarchy([
        Account.create({
          id: "nested",
          name: "Nested",
          type: "virtual_subaccount",
          currency: "EUR",
          parentAccountId: child.id,
        }),
        child,
        parent,
      ]),
    ).toThrow("cannot be nested");
    expect(() =>
      validateAccountHierarchy([
        Account.create({
          id: "foreign-child",
          name: "Foreign child",
          type: "virtual_subaccount",
          currency: "USD",
          parentAccountId: parent.id,
        }),
        parent,
      ]),
    ).toThrow("parent currency");
  });
});
