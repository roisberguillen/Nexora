import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "PROJECT_MANIFEST.json");
const ignoredDirectories = new Set([
  ".git",
  "backups",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const ignoredFiles = new Set(["PROJECT_MANIFEST.json"]);

function canonicalizeManifestContents(contents) {
  if (contents.includes(0)) {
    return contents;
  }

  return Buffer.from(contents.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
    if (!ignoredFiles.has(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

async function describeFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const contents = await readFile(absolutePath);
  const canonicalContents = canonicalizeManifestContents(contents);

  return {
    path: relativePath,
    size: canonicalContents.byteLength,
    sha256: createHash("sha256").update(canonicalContents).digest("hex"),
  };
}

async function buildManifest() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const paths = (await collectFiles(root)).sort((left, right) => left.localeCompare(right, "en"));
  const files = await Promise.all(paths.map(describeFile));

  return {
    project: "Nexora",
    version: packageJson.version,
    files,
  };
}

const expected = `${JSON.stringify(await buildManifest(), null, 2)}\n`;
const mode = process.argv[2];

if (mode === "--write") {
  await writeFile(manifestPath, expected, "utf8");
  process.stdout.write("PROJECT_MANIFEST.json updated.\n");
} else if (mode === "--check") {
  const actual = await readFile(manifestPath, "utf8");
  if (actual !== expected) {
    process.stderr.write("PROJECT_MANIFEST.json is stale. Run pnpm manifest:update.\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("PROJECT_MANIFEST.json is current.\n");
  }
} else {
  process.stderr.write("Usage: node scripts/project-manifest.mjs --write|--check\n");
  process.exitCode = 2;
}
