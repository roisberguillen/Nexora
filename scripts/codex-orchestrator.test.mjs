import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifyTask,
  createCheckpoint,
  findNextRoadmapPhase,
  formatClassification,
  parseRoadmapTasks,
  resolveNextTask,
  canAdvance,
  loadPolicy,
  parseYamlSubset,
  validateRepository,
} from "./codex-orchestrator.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("routing policy is valid JSON-compatible YAML", async () => {
  const source = await readFile(
    path.join(root, ".codex/orchestration/routing-policy.yaml"),
    "utf8",
  );
  assert.equal(parseYamlSubset(source).version, 1);
});

test("classifies representative tasks and does not promise model switching", async () => {
  const policy = await loadPolicy(root);
  const examples = [
    ["allinea il padding della card", "ui_layout", "ECONOMY"],
    ["aggiungi una migrazione SQLite additiva", "database_migration", "ADVANCED"],
    ["implementa Google Drive con cartella scelta", "google_drive", "ADVANCED"],
    ["sincronizzazione operation log del Local Hub", "local_hub", "CRITICAL"],
  ];
  for (const [task, category, profile] of examples) {
    const result = classifyTask(policy, { task, phase: "test" });
    assert.equal(result.category, category);
    assert.equal(result.profile, profile);
    assert.equal(result.switchNecessary, false);
    assert.match(formatClassification(result), /Switch necessario: no/);
  }
});

test("escalates after two failed attempts and detects manual profile gap", async () => {
  const policy = await loadPolicy(root);
  const result = classifyTask(policy, {
    task: "correggi bug localizzato",
    failedAttempts: 2,
    currentProfile: "ECONOMY",
  });
  assert.equal(result.profile, "ADVANCED");
  assert.equal(result.switchNecessary, true);
});

test("creates a persistent checkpoint without touching application data", async () => {
  const temporaryRoot = path.join(tmpdir(), `nexora-orchestrator-${crypto.randomUUID()}`);
  try {
    await mkdir(temporaryRoot, { recursive: true });
    const relativePath = await createCheckpoint(temporaryRoot, {
      task: "security review",
      phase: "15",
      profile: "CRITICAL",
      risk: "high",
    });
    const contents = await readFile(path.join(temporaryRoot, relativePath), "utf8");
    assert.match(contents, /CRITICAL; high/);
    assert.match(contents, /security review/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("rejects non-JSON YAML input instead of accepting an ambiguous policy", () => {
  assert.throws(() => parseYamlSubset("version: 1"), /JSON-compatible YAML/);
});

test("derives the next phase from the first planned roadmap row", () => {
  assert.equal(
    findNextRoadmapPhase("| 8 | Importazione | completata |\n| 9 | Backup Engine | pianificata |"),
    "9",
  );
  assert.equal(findNextRoadmapPhase("| 17 | Hardening | completata |"), undefined);
});

test("permits a current active phase before the next planned roadmap phase", async () => {
  const result = await validateRepository(root);
  assert.deepEqual(result.errors, []);
});

test("validates all required routes, profiles, skills and roadmap state", async () => {
  const result = await validateRepository(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.routeCount, 17);
});

const progressFixture = `| 12.5.E.1 | complete — PASS |\n| 12.5.E.2 | complete — PASS |\n| 12.5.E.3 | pending |\n| 12.5.F | planned |`;

test("resolves only the declared immediate next task", () => {
  const result = resolveNextTask({
    progress: progressFixture,
    currentTask: "- Status: COMPLETE\n- Next task: `12.5.E.3` — Data Integrity",
  });
  assert.deepEqual(result.task, { id: "12.5.E.3", description: "pending" });
  assert.equal(parseRoadmapTasks(progressFixture).length, 4);
  assert.equal(
    resolveNextTask({ progress: progressFixture, currentTask: "- Status: IN_PROGRESS" }).canAdvance,
    false,
  );
});

test("rejects an attempt to skip the immediate roadmap task", () => {
  assert.equal(
    resolveNextTask({
      progress: progressFixture,
      currentTask: "- Task: 12.5.E.1\n- Status: COMPLETE\n- Next task: `12.5.F`",
    }).canAdvance,
    false,
  );
});

test("canAdvance is false for every missing hard-gate condition", () => {
  const checks = {
    statusComplete: true,
    gatesPass: true,
    evidencePresent: true,
    commitPresent: true,
    pushVerified: true,
    treeClean: true,
    noBlockers: true,
  };
  for (const key of Object.keys(checks)) {
    const failed = { ...checks, [key]: false };
    assert.equal(canAdvance(failed).canAdvance, false, key);
    assert.deepEqual(canAdvance(failed).failures, [key]);
  }
});

test("returns ROADMAP_COMPLETE only when no incomplete task remains", () => {
  assert.deepEqual(
    resolveNextTask({ progress: "| 1 | complete — PASS |", currentTask: "- Status: COMPLETE" }),
    {
      canAdvance: true,
      task: "ROADMAP_COMPLETE",
    },
  );
});
