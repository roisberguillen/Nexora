import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const COMMIT_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w.-]+\))?!?:\s+\S.+$/;
const SECRET_PATH_PATTERN =
  /(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key|p12)|secrets?(?:\/|$)|credentials?(?:\/|$))/i;
const SECRET_CONTENT_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]|sk|xox[baprs])-[-_A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}/;

export function parseArguments(argv) {
  const result = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    const value = inlineValue ?? argv[++index];
    if (key === "files")
      result.files = String(value ?? "")
        .split(/[,\s]+/)
        .filter(Boolean);
    else result[key] = value;
  }
  return result;
}

export function parseChangedPaths(status) {
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1));
}

export function hasGitConflict(status) {
  return /^(UU|AA|DD|AU|UA|DU|UD)\s/m.test(status);
}

export function readTaskStatus(contents) {
  const status = contents.match(/^[-*]?\s*Status:\s*([^\r\n]+)/im)?.[1]?.trim() ?? "";
  const normalized = status.toUpperCase().replace(/\s+ON\s+.*$/, "");
  if (["COMPLETE", "BLOCKED", "IN_PROGRESS"].includes(normalized)) return normalized;
  if (/\bIN[ -]PROGRESS\b/i.test(status)) return "IN_PROGRESS";
  if (/\bBLOCKED\b/i.test(status)) return "BLOCKED";
  if (/\bCOMPLETE\b/i.test(status)) return "COMPLETE";
  return "UNKNOWN";
}

export function validateCommitMessage(message) {
  return COMMIT_PATTERN.test(String(message ?? "").trim());
}

export function validateTaskId(taskId) {
  return (
    /^[0-9]+(?:\.[A-Za-z0-9-]+)+$/.test(String(taskId ?? "")) ||
    /^[A-Za-z0-9-]+$/.test(String(taskId ?? ""))
  );
}

export function validateScope(changedPaths, requestedFiles) {
  const requested = new Set(requestedFiles.map((file) => file.replaceAll("\\", "/")));
  if (requested.size === 0)
    return "Explicit --files scope is required; refusing ambiguous staging.";
  const outside = changedPaths.filter((file) => !requested.has(file));
  return outside.length === 0 ? null : `Files outside requested scope: ${outside.join(", ")}`;
}

function defaultExec(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    shell: options.shell ?? false,
  });
  return output == null ? "" : output.trimEnd();
}

function runGate(root, command, args) {
  defaultExec(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export function inspectSensitiveFiles(root, files) {
  for (const relativePath of files) {
    if (SECRET_PATH_PATTERN.test(relativePath)) return `Suspicious secret path: ${relativePath}`;
    const absolutePath = path.join(root, relativePath);
    if (
      existsSync(absolutePath) &&
      SECRET_CONTENT_PATTERN.test(readFileSync(absolutePath, "utf8"))
    ) {
      return `Suspicious secret content: ${relativePath}`;
    }
  }
  return null;
}

export async function finalize({
  root = process.cwd(),
  args = {},
  execute = defaultExec,
  runGates = true,
} = {}) {
  const git = (gitArgs, options = {}) => execute("git", gitArgs, { cwd: root, ...options });
  let staged = false;
  let committed = false;
  try {
    if (path.resolve(git(["rev-parse", "--show-toplevel"])) !== path.resolve(root))
      throw new Error("Not a Git repository.");
    const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
    if (!status.trim()) throw new Error("Working tree is clean; no commit is necessary.");
    if (hasGitConflict(status)) throw new Error("Git conflicts are present.");
    for (const marker of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD"]) {
      if (existsSync(path.join(root, ".git", marker)))
        throw new Error(`Git operation in progress: ${marker}.`);
    }
    const branch = git(["branch", "--show-current"]);
    if (!branch) throw new Error("Detached HEAD is not an authorized finalization branch.");
    const task = readFileSync(path.join(root, ".codex/state/current-task.md"), "utf8");
    const taskStatus = readTaskStatus(task);
    if (taskStatus !== "COMPLETE")
      throw new Error(`Task status is ${taskStatus}; only COMPLETE may finalize.`);
    const changedPaths = parseChangedPaths(status);
    const scopeError = validateScope(changedPaths, args.files ?? []);
    if (scopeError) throw new Error(scopeError);
    const sensitiveError = inspectSensitiveFiles(root, args.files ?? []);
    if (sensitiveError) throw new Error(sensitiveError);
    if (!validateCommitMessage(args.message))
      throw new Error("A valid Conventional Commit --message is required.");
    if (!validateTaskId(args.taskId))
      throw new Error("A valid --task-id is required for verifiable roadmap advancement.");
    if (args.main === "false" && branch === "main")
      throw new Error("Direct push to main is not authorized by this invocation.");
    if (!git(["remote", "get-url", "origin"])) throw new Error("Remote origin is not configured.");

    if (runGates) {
      for (const [command, gateArgs] of [
        ["pnpm", ["verify"]],
        ["pnpm", ["test:e2e"]],
        ["pnpm", ["manifest:update"]],
        ["pnpm", ["manifest:check"]],
        ["pnpm", ["codex:validate"]],
        ["pnpm", ["quality:ui-ux"]],
      ])
        runGate(root, command, gateArgs);
    }

    git(["add", "--", ...(args.files ?? [])], { stdio: "inherit" });
    staged = true;
    git(["diff", "--cached", "--check"], { stdio: "inherit" });
    git(["commit", "-m", args.message, "-m", `Nexora-Task: ${args.taskId}`], { stdio: "inherit" });
    committed = true;
    const sha = git(["rev-parse", "HEAD"]);
    git(["push", "--set-upstream", "origin", branch], { stdio: "inherit" });
    const pushedSha = git(["rev-parse", `origin/${branch}`]);
    if (pushedSha !== sha)
      throw new Error(`Push verification mismatch: local ${sha}, remote ${pushedSha}.`);
    return { branch, sha, pushedSha };
  } catch (error) {
    if (staged && !committed) {
      try {
        git(["reset", "--", ...(args.files ?? [])], { stdio: "inherit" });
      } catch {
        // Preserve the original failure; the caller still receives FINALIZATION BLOCKED.
      }
    }
    throw new Error(`FINALIZATION BLOCKED: ${error.message}`, { cause: error });
  }
}

async function main() {
  try {
    const result = await finalize({ args: parseArguments(process.argv.slice(2)) });
    console.log(
      `FINALIZATION COMPLETE\nBranch: ${result.branch}\nSHA: ${result.sha}\nPush: verified`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
