import { execFileSync } from "node:child_process";

const expectedNode = { major: 24, minimumMinor: 14 };
const expectedPnpm = { major: 11, minimumMinor: 9 };
const node = parseVersion(process.versions.node);
const pnpm = readPnpmVersion();
const checks = [
  checkVersion("Node.js", node, expectedNode),
  checkVersion("pnpm", pnpm, expectedPnpm),
  {
    label: "WebAssembly",
    status: typeof WebAssembly === "object" ? "ok" : "error",
    value: typeof WebAssembly === "object" ? "disponibile" : "non disponibile",
  },
  {
    label: "OPFS e File System Access API",
    status: "info",
    value: "da verificare nel browser con pnpm dev (non disponibili nel runtime Node)",
  },
  {
    label: "Google Drive",
    status:
      process.env.VITE_GOOGLE_DRIVE_ENABLED === "true" &&
      (process.env.VITE_GOOGLE_CLIENT_ID?.trim().length ?? 0) > 0
        ? "ok"
        : "info",
    value:
      process.env.VITE_GOOGLE_DRIVE_ENABLED === "true" &&
      (process.env.VITE_GOOGLE_CLIENT_ID?.trim().length ?? 0) > 0
        ? "configurato"
        : "non configurato",
  },
];

for (const check of checks) {
  const marker = check.status === "ok" ? "✓" : check.status === "error" ? "✗" : "i";
  console.log(`${marker} ${check.label}: ${check.value}`);
}
if (checks.some((check) => check.status === "error")) process.exitCode = 1;

function checkVersion(label, actual, expected) {
  const isSupported =
    actual !== undefined &&
    actual.major === expected.major &&
    actual.minor >= expected.minimumMinor;
  return {
    label,
    status: isSupported ? "ok" : "error",
    value:
      actual === undefined
        ? "non rilevato"
        : `${actual.major}.${actual.minor}.${actual.patch} (richiesto ${expected.major}.${expected.minimumMinor}+)`,
  };
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match === null
    ? undefined
    : { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function readPnpmVersion() {
  try {
    const version =
      process.platform === "win32"
        ? execFileSync("cmd.exe", ["/d", "/s", "/c", "pnpm --version"], {
            encoding: "utf8",
          })
        : execFileSync("pnpm", ["--version"], { encoding: "utf8" });
    return parseVersion(version.trim());
  } catch {
    return undefined;
  }
}
