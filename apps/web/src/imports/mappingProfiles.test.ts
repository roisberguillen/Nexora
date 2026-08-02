import { describe, expect, it } from "vitest";

import { loadImportMappingProfiles, saveImportMappingProfile } from "./mappingProfiles";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("import mapping profiles", () => {
  it("persists and reloads a validated reusable mapping", () => {
    const storage = memoryStorage();
    saveImportMappingProfile(
      {
        id: "profile-money-manager",
        name: "Money Manager personale",
        importerType: "money_manager_xlsx",
        mapping: { date: 0, account: 1, amount: 2 },
      },
      storage,
    );

    expect(loadImportMappingProfiles(storage)).toEqual([
      expect.objectContaining({
        id: "profile-money-manager",
        mapping: { date: 0, account: 1, amount: 2 },
      }),
    ]);
  });

  it("ignores corrupt persisted profiles and rejects duplicate column mappings", () => {
    const corrupt = memoryStorage();
    corrupt.setItem("nexora.import-mapping-profiles.v1", "not-json");
    expect(loadImportMappingProfiles(corrupt)).toEqual([]);
    expect(() =>
      saveImportMappingProfile(
        {
          id: "invalid-profile",
          name: "Duplicato",
          importerType: "money_manager_xlsx",
          mapping: { date: 0, amount: 0 },
        },
        corrupt,
      ),
    ).toThrow("invalid_mapping_profile");
  });
});
