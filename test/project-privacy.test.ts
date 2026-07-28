import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootsToInspect = ["apps/web/src", "examples"];
const privateContextNames = ["Mediobanca", "N26", "Directa", "Findomestic", "Agos", "iTowers"];
const searchableExtensions = new Set([".csv", ".json", ".ts", ".tsx"]);

async function collectSearchableFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSearchableFiles(entryPath)));
    } else if (searchableExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

describe("project privacy", () => {
  it("non replica i nomi del contesto personale in fixture o UI", async () => {
    const files = (
      await Promise.all(rootsToInspect.map((root) => collectSearchableFiles(root)))
    ).flat();
    const violations: string[] = [];

    for (const file of files) {
      const contents = await readFile(file, "utf8");
      for (const name of privateContextNames) {
        if (contents.includes(name)) {
          violations.push(`${file}: ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
