import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const REQUIRED_ROUTES = [
  "documentation",
  "ui_layout",
  "ui_component",
  "localized_bug",
  "repository_refactor",
  "database_query",
  "database_migration",
  "native_sqlite",
  "tauri_desktop",
  "tauri_android",
  "manual_backup",
  "google_drive",
  "encryption",
  "local_hub",
  "synchronization",
  "security_review",
  "final_release",
];
const REQUIRED_PROFILES = ["ECONOMY", "STANDARD", "ADVANCED", "CRITICAL"];
const REQUIRED_SKILLS = [
  "nexora-router",
  "nexora-ui",
  "nexora-database",
  "nexora-backup",
  "nexora-testing",
  "nexora-docs",
  "nexora-security",
  "nexora-sync",
];
const REQUIRED_ROUTE_FIELDS = [
  "profile",
  "reasoning_level",
  "initial_file_limit",
  "subagent_limit",
  "targeted_tests",
  "full_tests_required",
  "max_attempts",
  "escalation_conditions",
  "forbidden_actions",
];
const REQUIRED_FILES = [
  ".codex/orchestration/routing-policy.yaml",
  ".codex/orchestration/task-classifier.md",
  ".codex/orchestration/token-budget-policy.md",
  ".codex/orchestration/escalation-policy.md",
  ".codex/orchestration/execution-protocol.md",
  ".codex/orchestration/model-profiles.example.yaml",
  ".codex/state/current-task.md",
  ".codex/state/roadmap-progress.md",
  ".codex/state/repository-map.md",
  ".codex/state/decisions-index.md",
  ".codex/state/known-failures.md",
  ".codex/state/test-evidence.md",
  ".codex/templates/task-plan.md",
  ".codex/templates/task-result.md",
  ".codex/templates/escalation-request.md",
  ".codex/templates/phase-checkpoint.md",
  "docs/CURRENT_SOURCES.md",
];
const PROFILE_RANK = { ECONOMY: 0, STANDARD: 1, ADVANCED: 2, CRITICAL: 3 };

export function parseYamlSubset(source, label = "configuration") {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} must use the JSON-compatible YAML 1.2 subset`, { cause: error });
  }
}

export function findNextRoadmapPhase(roadmap) {
  return roadmap.match(/^\|\s*(\d+)\s*\|.*\|\s*pianificata\s*\|$/m)?.[1];
}

export function parseRoadmapTasks(progress) {
  return [
    ...String(progress).matchAll(/^\|\s*([0-9]+(?:\.[A-Za-z0-9-]+)*)\s*\|\s*([^|]+)\|/gm),
  ].map(([, id, description]) => ({
    id,
    description: description.trim(),
    complete: /^complete\b/i.test(description.trim()),
  }));
}

export function extractTaskId(value) {
  return String(value).match(/\b\d+(?:\.\d+|\.[A-Za-z0-9-]+)+\b/)?.[0] ?? null;
}

export function resolveNextTask({ progress, currentTask }) {
  const currentStatus = String(currentTask).match(/^[-*]?\s*Status:\s*([^\r\n]+)/im)?.[1] ?? "";
  if (!/\bCOMPLETE\b/i.test(currentStatus))
    return { canAdvance: false, reason: "Current task is not COMPLETE." };
  const nextLine = String(currentTask).match(/^[-*]?\s*Next task:\s*`?([^`\r\n]+)`?/im)?.[1] ?? "";
  const nextId = extractTaskId(nextLine);
  if (!nextId) {
    const remaining = parseRoadmapTasks(progress).find((task) => !task.complete);
    return remaining
      ? { canAdvance: false, reason: "Current task does not declare the next task." }
      : { canAdvance: true, task: "ROADMAP_COMPLETE" };
  }
  const task = parseRoadmapTasks(progress).find((candidate) => candidate.id === nextId);
  if (!task)
    return { canAdvance: false, reason: `Next task ${nextId} is not present in roadmap progress.` };
  if (task.complete)
    return { canAdvance: false, reason: `Next task ${nextId} is already complete.` };
  const currentId = extractTaskId(
    String(currentTask).match(/^[-*]?\s*Task:\s*([^\r\n]+)/im)?.[1] ?? "",
  );
  const tasks = parseRoadmapTasks(progress);
  const currentIndex = currentId ? tasks.findIndex((candidate) => candidate.id === currentId) : -1;
  const nextAtomic = tasks
    .slice(currentIndex + 1)
    .find((candidate) => !candidate.complete && /(?:\.\d+|\.F)$/i.test(candidate.id));
  if (nextAtomic && nextAtomic.id !== nextId)
    return {
      canAdvance: false,
      reason: `Skipping authorized task ${nextAtomic.id} is not allowed.`,
    };
  return { canAdvance: true, task: { id: task.id, description: task.description } };
}

export function canAdvance(checks) {
  const failures = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([name]) => name);
  return { canAdvance: failures.length === 0, failures };
}

function gitValue(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

export async function inspectAdvanceState(root = process.cwd()) {
  const currentTaskPath = path.join(root, ".codex", "state", "current-task.md");
  const currentTask = await readFile(currentTaskPath, "utf8");
  const progress = await readFile(
    path.join(root, ".codex", "state", "roadmap-progress.md"),
    "utf8",
  );
  const status = (currentTask.match(/^[-*]?\s*Status:\s*([^\r\n]+)/im)?.[1] ?? "").replaceAll(
    "`",
    "",
  );
  const taskId = extractTaskId(currentTask.match(/^[-*]?\s*Task:\s*([^\r\n]+)/im)?.[1] ?? "");
  const evidencePath = currentTask.match(/^[-*]?\s*Evidence:\s*([^;\r\n]+)/im)?.[1]?.trim();
  const evidence = evidencePath ? await readIfPresent(path.resolve(root, evidencePath)) : "";
  const head = gitValue(root, ["rev-parse", "HEAD"]);
  const branch = gitValue(root, ["branch", "--show-current"]);
  const remote = branch ? gitValue(root, ["rev-parse", `origin/${branch}`]) : "";
  const commitBody = gitValue(root, ["show", "-s", "--format=%B", "HEAD"]);
  const treeClean = gitValue(root, ["status", "--porcelain", "--untracked-files=all"]) === "";
  const blockers = /P[012]\s*\/\s*[1-9]|security blocker|recovery blocker/i.test(
    `${currentTask}\n${evidence}`,
  );
  return canAdvance({
    statusComplete: /^COMPLETE\b/i.test(status),
    gatesPass: /\bPASS\b/i.test(evidence) && !/\bFAIL(?:ED|URE)?\b/i.test(evidence),
    evidencePresent: Boolean(evidencePath && evidence),
    documentationPresent: parseRoadmapTasks(progress).some(
      (task) => task.id === taskId && task.complete,
    ),
    commitPresent: Boolean(taskId && commitBody.includes(`Nexora-Task: ${taskId}`)),
    pushVerified: Boolean(head && head === remote),
    treeClean,
    noBlockers: !blockers,
  });
}

export async function loadPolicy(root = process.cwd()) {
  const policyPath = path.join(root, ".codex", "orchestration", "routing-policy.yaml");
  return parseYamlSubset(await readFile(policyPath, "utf8"), "routing-policy.yaml");
}

function normalizeText(task, files = []) {
  return `${task} ${files.join(" ")}`.toLocaleLowerCase("en");
}

function containsAny(text, terms = []) {
  return terms.some((term) => text.includes(term.toLocaleLowerCase("en")));
}

function selectRoute(policy, task, files) {
  const text = normalizeText(task, files);
  const priority = [
    "encryption",
    "local_hub",
    "synchronization",
    "security_review",
    "final_release",
    "google_drive",
    "manual_backup",
    "database_migration",
    "native_sqlite",
    "tauri_android",
    "tauri_desktop",
    "repository_refactor",
    "ui_layout",
    "ui_component",
    "database_query",
    "documentation",
    "localized_bug",
  ];

  if (files.some((file) => /database-tauri|native.*sqlite/i.test(file))) return "native_sqlite";
  if (files.some((file) => /migrations|migration/i.test(file))) return "database_migration";
  if (files.some((file) => /src-tauri/i.test(file))) return "tauri_desktop";

  for (const routeName of priority) {
    if (containsAny(text, policy.routes[routeName].keywords)) return routeName;
  }
  if (/import|export|data quality|qualit[aà] dati/.test(text)) return "repository_refactor";
  return "localized_bug";
}

function bumpProfile(profile) {
  return REQUIRED_PROFILES[Math.min(PROFILE_RANK[profile] + 1, REQUIRED_PROFILES.length - 1)];
}

export function classifyTask(policy, input) {
  const task = String(input.task ?? "").trim();
  if (task.length === 0) throw new Error("A non-empty task is required.");
  const files = input.files ?? [];
  const text = normalizeText(task, files);
  const routeName = selectRoute(policy, task, files);
  const route = policy.routes[routeName];
  let profile = route.profile;
  let dataRisk = "low";

  if (containsAny(text, policy.risk_rules.data_loss_terms)) {
    profile = "CRITICAL";
    dataRisk = "high";
  } else if (containsAny(text, policy.risk_rules.critical_terms)) {
    profile = "CRITICAL";
    dataRisk = "medium";
  } else if (containsAny(text, policy.risk_rules.advanced_terms)) {
    profile = PROFILE_RANK[profile] < PROFILE_RANK.ADVANCED ? "ADVANCED" : profile;
    dataRisk = /migration|backup|restore|recovery|sqlite/.test(text) ? "medium" : "low";
  }

  if (Number(input.failedAttempts ?? 0) >= policy.escalation_rules.failed_attempts) {
    profile = bumpProfile(profile);
  }

  const profileDefaults = policy.profiles[profile];
  const currentProfile = input.currentProfile?.toUpperCase();
  const switchNecessary =
    currentProfile in PROFILE_RANK && PROFILE_RANK[currentProfile] < PROFILE_RANK[profile];

  return {
    task,
    phase: input.phase || "prima fase realmente incompleta",
    category: routeName,
    profile,
    dataRisk,
    initialFiles: Math.min(route.initial_file_limit, profileDefaults.initial_file_limit),
    subagentLimit: Math.min(route.subagent_limit, profileDefaults.subagent_limit),
    targetedTests: route.targeted_tests,
    escalationConditions: route.escalation_conditions,
    modelRecommendation: `${profile} capability profile; bind a concrete model only in local runtime configuration`,
    switchNecessary,
    maxAttempts: Math.min(route.max_attempts, profileDefaults.max_attempts),
    fullTestsRequired: route.full_tests_required,
  };
}

export function formatClassification(result) {
  return [
    `Task: ${result.task}`,
    `Fase roadmap: ${result.phase}`,
    `Categoria: ${result.category}`,
    `Profilo: ${result.profile}`,
    `Rischio dati: ${result.dataRisk}`,
    `File iniziali: massimo ${result.initialFiles}`,
    `Test mirati: ${result.targetedTests.join("; ")}`,
    `Condizioni di escalation: ${result.escalationConditions.join("; ")}`,
    `Modello raccomandato: ${result.modelRecommendation}`,
    `Switch necessario: ${result.switchNecessary ? "sì, manuale se il runtime non lo supporta" : "no"}`,
  ].join("\n");
}

async function readIfPresent(filePath) {
  return existsSync(filePath) ? readFile(filePath, "utf8") : "";
}

export async function validateRepository(root = process.cwd()) {
  const errors = [];
  for (const relativePath of REQUIRED_FILES) {
    if (!existsSync(path.join(root, relativePath)))
      errors.push(`Missing required file: ${relativePath}`);
  }

  let policy;
  let modelProfiles;
  try {
    policy = await loadPolicy(root);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    const modelPath = path.join(root, ".codex", "orchestration", "model-profiles.example.yaml");
    modelProfiles = parseYamlSubset(
      await readFile(modelPath, "utf8"),
      "model-profiles.example.yaml",
    );
  } catch (error) {
    errors.push(error.message);
  }

  if (policy) {
    for (const profile of REQUIRED_PROFILES) {
      if (!policy.profiles?.[profile]) errors.push(`Missing profile: ${profile}`);
    }
    for (const routeName of REQUIRED_ROUTES) {
      const route = policy.routes?.[routeName];
      if (!route) {
        errors.push(`Missing route: ${routeName}`);
        continue;
      }
      for (const field of REQUIRED_ROUTE_FIELDS) {
        if (!(field in route)) errors.push(`Route ${routeName} is missing ${field}`);
      }
      if (!(route.initial_file_limit > 0)) errors.push(`Route ${routeName} has no file limit`);
      if (!(route.max_attempts > 0)) errors.push(`Route ${routeName} has no attempt limit`);
      if (!(route.subagent_limit >= 0 && route.subagent_limit <= 2)) {
        errors.push(`Route ${routeName} exceeds the agent limit`);
      }
    }
  }
  if (modelProfiles) {
    for (const profile of REQUIRED_PROFILES) {
      if (!modelProfiles.profiles?.[profile]) errors.push(`Model example is missing ${profile}`);
    }
    if (modelProfiles.runtime_contract?.automatic_model_switch_assumed !== false) {
      errors.push("Model configuration must not assume automatic switching");
    }
  }

  for (const skillName of REQUIRED_SKILLS) {
    const skillPath = path.join(root, ".codex", "skills", skillName, "SKILL.md");
    const metadataPath = path.join(root, ".codex", "skills", skillName, "agents", "openai.yaml");
    const skill = await readIfPresent(skillPath);
    const metadata = await readIfPresent(metadataPath);
    if (!skill) {
      errors.push(`Missing skill: ${skillName}`);
      continue;
    }
    const frontmatter = skill.match(
      /^---\r?\nname:\s*([^\r\n]+)\r?\ndescription:\s*([^\r\n]+)\r?\n---/,
    );
    if (!frontmatter) errors.push(`Invalid skill frontmatter: ${skillName}`);
    else {
      if (frontmatter[1].trim() !== skillName) errors.push(`Skill name mismatch: ${skillName}`);
      if (frontmatter[2].trim().length < 40)
        errors.push(`Skill description is incomplete: ${skillName}`);
    }
    if (/\[TODO|TODO:/i.test(skill)) errors.push(`Skill contains a placeholder: ${skillName}`);
    if (!metadata.includes(`$${skillName}`))
      errors.push(`Skill metadata must reference $${skillName}`);
  }

  const roadmap = await readIfPresent(path.join(root, "docs", "ROADMAP_UI_ARCHITECTURE.md"));
  const progress = await readIfPresent(path.join(root, ".codex", "state", "roadmap-progress.md"));
  const completedPhases = [...roadmap.matchAll(/^\|\s*(\d+)\s*\|.*\|\s*completata\s*\|$/gm)].map(
    (match) => match[1],
  );
  for (const phase of completedPhases) {
    const represented =
      phase === "0" ? progress.includes("0–6") : progress.includes(`| ${phase} |`);
    if (!represented && Number(phase) > 6)
      errors.push(`Roadmap progress does not represent Phase ${phase}`);
  }
  const nextPhase = findNextRoadmapPhase(roadmap);
  const activePhase = roadmap.match(/^\|\s*(\d+)\s*\|.*\|\s*in corso\b.*\|$/m)?.[1];
  const activePhaseIsRepresented =
    activePhase !== undefined &&
    new RegExp(`^\\| ${activePhase}(?:\\.\\d+)? \\| (?:current|in progress) \\|`, "m").test(
      progress,
    );
  if (activePhase !== undefined && !activePhaseIsRepresented) {
    errors.push(`Roadmap progress must identify active Phase ${activePhase} as current`);
  } else if (
    activePhase === undefined &&
    nextPhase !== undefined &&
    !progress.includes(`| ${nextPhase} | next |`)
  ) {
    errors.push(`Roadmap progress must identify Phase ${nextPhase} as next`);
  }

  const currentTask = await readIfPresent(path.join(root, ".codex", "state", "current-task.md"));
  if (/Profile:\s*CRITICAL/i.test(currentTask)) {
    const checkpoint = currentTask.match(/Checkpoint:\s*`?([^`\r\n]+)`?/i)?.[1]?.trim();
    if (!checkpoint || checkpoint.toLocaleLowerCase("en").startsWith("not required")) {
      errors.push("CRITICAL current task requires a checkpoint path");
    } else if (!existsSync(path.resolve(root, checkpoint))) {
      errors.push(`CRITICAL checkpoint does not exist: ${checkpoint}`);
    }
  }

  const operationalFiles = [
    "AGENTS.md",
    "README.md",
    "docs/CURRENT_SOURCES.md",
    ...REQUIRED_FILES.filter((file) => file.startsWith(".codex/")),
  ];
  const operationalPattern =
    /smb:\/\/|\\\\server|destination[_ -]type:\s*nas|mount\s+nas|backup[_ -]agent\s+(enabled|active)/i;
  for (const relativePath of new Set(operationalFiles)) {
    const contents = await readIfPresent(path.join(root, relativePath));
    if (operationalPattern.test(contents))
      errors.push(`Operational legacy backup reference: ${relativePath}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    routeCount: policy ? Object.keys(policy.routes).length : 0,
  };
}

function slugify(value) {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function createCheckpoint(root, input) {
  const task = String(input.task ?? "").trim();
  if (!task) throw new Error("Checkpoint requires --task.");
  const profile = String(input.profile ?? "STANDARD").toUpperCase();
  const timestamp = new Date().toISOString();
  const relativePath = `.codex/state/checkpoints/${timestamp.slice(0, 10)}-${slugify(task) || "task"}.md`;
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const contents = `# Phase checkpoint\n\n- Timestamp: ${timestamp}\n- Task and roadmap phase: ${task}; ${input.phase || "not specified"}\n- Profile and data risk: ${profile}; ${input.risk || "not specified"}\n- Working branch/commit: record before resume\n- Scope completed: record before resume\n- Pending scope: record before resume\n- Files changed/analyzed: record before resume\n- Data backup or non-destructive guarantee: record before resume\n- Tests executed: record before resume\n- Known failures: see ../known-failures.md\n- Resume command/instruction: pnpm codex:status\n`;
  await writeFile(absolutePath, contents, "utf8");
  return relativePath.replaceAll("\\", "/");
}

function parseArguments(argv) {
  const values = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    if (key === "files")
      values.files = String(value ?? "")
        .split(",")
        .filter(Boolean);
    else values[key] = value;
  }
  return values;
}

async function showStatus(root) {
  const current = await readFile(path.join(root, ".codex", "state", "current-task.md"), "utf8");
  const progress = await readFile(
    path.join(root, ".codex", "state", "roadmap-progress.md"),
    "utf8",
  );
  process.stdout.write(`${current.trim()}\n\n${progress.trim()}\n`);
}

async function showAutopilotStatus(root) {
  const currentTask = await readFile(path.join(root, ".codex", "state", "current-task.md"), "utf8");
  const progress = await readFile(
    path.join(root, ".codex", "state", "roadmap-progress.md"),
    "utf8",
  );
  const resolution = resolveNextTask({ progress, currentTask });
  const hardGate = await inspectAdvanceState(root);
  process.stdout.write(
    resolution.task === "ROADMAP_COMPLETE"
      ? "ROADMAP_COMPLETE\n"
      : `${resolution.canAdvance && hardGate.canAdvance ? "READY" : "DO NOT ADVANCE"}\n${JSON.stringify({ resolution, hardGate })}\n`,
  );
}

async function main() {
  const [, , command, ...argumentTokens] = process.argv;
  const root = process.cwd();
  const args = parseArguments(argumentTokens);
  if (command === "route") {
    const result = classifyTask(await loadPolicy(root), args);
    process.stdout.write(
      args.json === "true"
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatClassification(result)}\n`,
    );
    return;
  }
  if (command === "validate") {
    const result = await validateRepository(root);
    if (!result.valid) {
      result.errors.forEach((error) => process.stderr.write(`- ${error}\n`));
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Nexora Task Orchestrator valid: ${result.routeCount} routes.\n`);
    return;
  }
  if (command === "status") {
    await showStatus(root);
    return;
  }
  if (command === "checkpoint") {
    process.stdout.write(`${await createCheckpoint(root, args)}\n`);
    return;
  }
  if (command === "next") {
    const currentTask = await readFile(
      path.join(root, ".codex", "state", "current-task.md"),
      "utf8",
    );
    const progress = await readFile(
      path.join(root, ".codex", "state", "roadmap-progress.md"),
      "utf8",
    );
    const result = resolveNextTask({ progress, currentTask });
    if (!result.canAdvance) {
      process.stderr.write(`DO NOT ADVANCE: ${result.reason}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `${typeof result.task === "string" ? result.task : `${result.task.id} — ${result.task.description}`}\n`,
    );
    return;
  }
  if (command === "can-advance") {
    const result = await inspectAdvanceState(root);
    process.stdout.write(
      `${result.canAdvance ? "ADVANCE" : "DO NOT ADVANCE"}\n${JSON.stringify(result)}\n`,
    );
    if (!result.canAdvance) process.exitCode = 1;
    return;
  }
  if (command === "autopilot-status") {
    await showAutopilotStatus(root);
    return;
  }
  process.stderr.write(
    "Usage: codex-orchestrator.mjs route|validate|status|checkpoint|next|can-advance|autopilot-status [options]\n",
  );
  process.exitCode = 2;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) await main();
