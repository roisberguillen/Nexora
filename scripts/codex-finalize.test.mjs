import assert from "node:assert/strict";
import test from "node:test";

import {
  parseChangedPaths,
  parseArguments,
  hasGitConflict,
  readTaskStatus,
  validateCommitMessage,
  validateScope,
} from "./codex-finalize.mjs";

test("reads COMPLETE, BLOCKED and IN_PROGRESS task states", () => {
  assert.equal(readTaskStatus("- Status: complete on 2026-08-24"), "COMPLETE");
  assert.equal(readTaskStatus("- Status: BLOCKED"), "BLOCKED");
  assert.equal(readTaskStatus("- Status: IN_PROGRESS"), "IN_PROGRESS");
});

test("requires an explicit complete scope", () => {
  assert.equal(validateScope(["scripts/a.mjs"], ["scripts/a.mjs"]), null);
  assert.match(validateScope(["scripts/a.mjs", "secret.env"], ["scripts/a.mjs"]), /outside/);
  assert.match(validateScope(["scripts/a.mjs"], []), /Explicit/);
});

test("parses tracked and untracked status paths without git add dot", () => {
  assert.deepEqual(parseChangedPaths(" M package.json\n?? scripts/codex-finalize.mjs\n"), [
    "package.json",
    "scripts/codex-finalize.mjs",
  ]);
});

test("accepts only Conventional Commit messages", () => {
  assert.equal(validateCommitMessage("chore(codex): automate task finalization"), true);
  assert.equal(validateCommitMessage("update files"), false);
  assert.equal(validateCommitMessage(""), false);
});

test("blocks conflict status and recognizes the supported task states", () => {
  assert.equal(hasGitConflict("UU scripts/codex-finalize.mjs"), true);
  assert.equal(hasGitConflict(" M scripts/codex-finalize.mjs"), false);
});

test("accepts comma- or space-separated explicit scopes", () => {
  assert.deepEqual(parseArguments(["--files", "a.mjs,b.mjs", "--message", "chore: test"]).files, [
    "a.mjs",
    "b.mjs",
  ]);
  assert.deepEqual(parseArguments(["--files", "a.mjs b.mjs"]).files, ["a.mjs", "b.mjs"]);
});
