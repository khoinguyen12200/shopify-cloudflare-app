#!/usr/bin/env node
// Install every AI-agent skill this project depends on, for every agent host.
//
//   npm run install:skill                    # detaches, returns immediately
//   npm run install:skill -- --wait          # block until done (use this in CI)
//   npm run install:skill -- --locked        # restore the committed skill set
//   npm run install:skill -- --agent claude-code,codex
//   npm run install:skill -- --jobs 1        # serialize the sources
//
// WHY THIS EXISTS
// `skills-lock.json` names the skill packages this repo uses. Without this
// script you would have to find each source repo and install each skill by hand,
// per agent host. This reads the lockfile and does all of it in one pass.
//
// WHY IT RUNS IN THE BACKGROUND BY DEFAULT
// It downloads ~90 MB and takes minutes. Nothing else in the project needs it to
// finish — skills are agent context, not a build input — so blocking a fresh
// clone on it is pure waiting. It detaches, streams to a log, and you carry on.
// CI must pass `--wait`, since a detached child dies with the runner.
//
// HOW SKILLS REACH AN AGENT
// `.agents/skills/` is the universal store, and most hosts (Codex, opencode,
// Amp, Cline, Cursor, Gemini CLI, Windsurf, Zed, …) read it directly — no
// per-host directory needed. Claude Code and Eve are the exceptions: they get
// symlinks at `.claude/skills/` and `agent/skills/` pointing into that store.
//
// All of those paths are gitignored, because the store is large and fully
// reproducible from `skills-lock.json`. That is the whole reason this command
// exists: clone, `npm install`, `npm run install:skill`, and the skills are back.
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(repoRoot, "skills-lock.json");
const logPath = join(repoRoot, ".skills-install.log");
const selfPath = fileURLToPath(import.meta.url);

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const locked = has("--locked");
const wait = has("--wait") || has("--foreground");

/** `--x v` or `--x=v`. */
function flagValue(name, fallback) {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return fallback;
  const inline = argv[i].split("=")[1];
  return inline || argv[i + 1] || fallback;
}

const defaultAgents = ["claude-code", "codex"];
const agents = flagValue("agent", defaultAgents.join(","))
  .split(",")
  .filter(Boolean);
// 0 (the default) means "one job per source" — i.e. all of them at once.
// Math.max(1, …) here would silently force serial execution.
const jobsRaw = Number(flagValue("jobs", "0"));
const jobs = Number.isFinite(jobsRaw) && jobsRaw > 0 ? Math.floor(jobsRaw) : 0;

const skillsBin = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "skills.cmd" : "skills",
);
if (!existsSync(skillsBin)) {
  console.error(
    "The `skills` CLI is missing. Run `npm install` first — it is a devDependency.",
  );
  process.exit(1);
}

// ── Detach, unless asked to wait ────────────────────────────────────────────
// Re-run this same script with --wait in a detached child whose output goes to
// the log, then return control immediately.
if (!wait) {
  const fd = openSync(logPath, "w");
  const child = spawn(process.execPath, [selfPath, ...argv, "--wait"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  closeSync(fd);
  const log = relative(repoRoot, logPath) || logPath;
  console.log(`Installing AI-agent skills in the background (pid ${child.pid}).`);
  console.log(`  Progress:  tail -f ${log}`);
  console.log(`  Verify:    npx skills list`);
  console.log(
    "\nNothing else needs this to finish — carry on with `npm run dev`.\n" +
      "In CI, pass --wait so the job does not exit before it completes.",
  );
  process.exit(0);
}

// ── From here on we are the worker ─────────────────────────────────────────
if (locked) {
  const lockedLockfile = readFileSync(lockPath, "utf8");
  const lockedSnapshot = JSON.parse(lockedLockfile);
  const universalComplete = Object.keys(lockedSnapshot.skills ?? {}).every(
    (name) => existsSync(join(repoRoot, ".agents/skills", name, "SKILL.md")),
  );

  if (!universalComplete) {
    const install = spawnSync(skillsBin, ["experimental_install"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    writeFileSync(lockPath, lockedLockfile);
    if (install.status !== 0) process.exit(install.status ?? 1);
  }

  linkClaudeSkills(lockedSnapshot);
  verifyInstalledSkills(lockedSnapshot);
  process.exit(0);
}

if (!existsSync(lockPath)) {
  console.error(
    `No skills-lock.json at ${lockPath}. Add a skill first: npx skills add <owner>/<repo>`,
  );
  process.exit(1);
}

const readLock = () => JSON.parse(readFileSync(lockPath, "utf8"));

let snapshot;
try {
  snapshot = readLock();
} catch (err) {
  console.error(`skills-lock.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

// One `skills add` per distinct source repo — the lockfile lists skills
// individually, but they are installed a package at a time.
const sources = [
  ...new Set(
    Object.values(snapshot.skills ?? {})
      .filter((s) => s.sourceType === "github" && s.source)
      .map((s) => s.source),
  ),
].sort();

if (sources.length === 0) {
  console.error("skills-lock.json lists no github sources — nothing to install.");
  process.exit(1);
}

function verifyInstalledSkills(lock) {
  const skillNames = Object.keys(lock.skills ?? {});
  const stores = [".agents/skills", ".claude/skills"];
  const missing = stores.flatMap((store) =>
    skillNames
      .filter((name) => {
        const skillPath = join(repoRoot, store, name);
        return !existsSync(skillPath) || !statSync(skillPath).isDirectory();
      })
      .map((name) => `${store}/${name}`),
  );

  if (missing.length > 0) {
    console.error(`\nMissing ${missing.length} installed skill path(s):`);
    for (const path of missing) console.error(`  ${path}`);
    process.exit(1);
  }

  console.log(
    `\nVerified ${skillNames.length} locked skills for Claude Code and Codex.`,
  );
}

function linkClaudeSkills(lock) {
  const claudeStore = join(repoRoot, ".claude/skills");
  mkdirSync(claudeStore, { recursive: true });

  for (const name of Object.keys(lock.skills ?? {})) {
    const target = join(repoRoot, ".agents/skills", name);
    const link = join(claudeStore, name);
    if (existsSync(link)) continue;

    symlinkSync(
      process.platform === "win32" ? target : relative(claudeStore, target),
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
}

/**
 * Run one `skills add`, buffering its output so parallel runs do not interleave
 * into noise. The buffer is printed as one block when the source finishes.
 */
function installSource(source) {
  return new Promise((resolve) => {
    const args = ["add", source, "--skill", "*", "--agent", ...agents, "-y"];
    const child = spawn(skillsBin, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (err) => resolve({ source, code: 1, out: String(err) }));
    child.on("close", (code) => resolve({ source, code: code ?? 1, out }));
  });
}

/** Run `tasks` with at most `limit` in flight. */
async function withConcurrency(items, limit, run) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const limit = jobs || sources.length;
console.log(
  `Installing skills from ${sources.length} source(s) for agent(s) "${agents.join(",")}" ` +
    `(${limit} in parallel):`,
);
for (const s of sources) console.log(`  • ${s}`);

const started = Date.now();
const results = await withConcurrency(sources, limit, async (source) => {
  console.log(`\n─── started: ${source}`);
  const r = await installSource(source);
  console.log(`\n─── finished: ${source} (exit ${r.code})\n${r.out}`);
  return r;
});

// Parallel `skills add` runs each read-modify-write skills-lock.json, so the
// last writer can drop entries the others added. Union the pre-run snapshot back
// in — this command only ever adds skills, so a union cannot resurrect anything
// that was deliberately removed.
try {
  const after = readLock();
  const merged = { ...after, skills: { ...(snapshot.skills ?? {}), ...(after.skills ?? {}) } };
  const restored = Object.keys(merged.skills).length - Object.keys(after.skills ?? {}).length;
  if (restored > 0) {
    writeFileSync(lockPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(
      `\nRe-merged ${restored} lockfile entr${restored === 1 ? "y" : "ies"} ` +
        "dropped by concurrent writes.",
    );
  }
} catch (err) {
  console.error(`\nCould not reconcile skills-lock.json: ${err.message}`);
}

const failed = results.filter((r) => r.code !== 0);
const seconds = Math.round((Date.now() - started) / 1000);

if (failed.length > 0) {
  console.error(
    `\n✗ ${failed.length} of ${sources.length} source(s) failed after ${seconds}s: ` +
      failed.map((r) => r.source).join(", "),
  );
  process.exit(1);
}

verifyInstalledSkills(readLock());

console.log(
  `\n✓ Skills installed in ${seconds}s. Review them before use — they run with ` +
    "full agent permissions.",
);
