#!/usr/bin/env node
// Install every AI-agent skill this project depends on, for every agent host.
//
//   npm run install:skill              # install/refresh from the upstream sources
//   npm run install:skill -- --locked  # restore the exact versions in skills-lock.json
//   npm run install:skill -- --agent claude-code,codex
//
// WHY THIS EXISTS
// `skills-lock.json` names the skill packages this repo uses. Without this
// script you would have to find each source repo and install each skill by hand,
// per agent host. This reads the lockfile and does all of it in one pass.
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
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(repoRoot, "skills-lock.json");

const argv = process.argv.slice(2);
const locked = argv.includes("--locked");

/** `--agent a,b` or `--agent=a,b`; defaults to every supported host. */
function agentArg() {
  const i = argv.findIndex((a) => a === "--agent" || a.startsWith("--agent="));
  if (i === -1) return "*";
  const inline = argv[i].split("=")[1];
  return inline || argv[i + 1] || "*";
}

/** Run the project's pinned `skills` CLI. Returns the exit code. */
function skills(args) {
  const bin = join(repoRoot, "node_modules", ".bin", "skills");
  if (!existsSync(bin)) {
    console.error(
      "The `skills` CLI is missing. Run `npm install` first — it is a devDependency.",
    );
    process.exit(1);
  }
  console.log(`\n$ skills ${args.join(" ")}`);
  const { status } = spawnSync(bin, args, { stdio: "inherit", shell: false });
  return status ?? 1;
}

if (locked) {
  // Exact versions from skills-lock.json. NOTE: this restores the universal
  // `.agents/skills/` store but does NOT create the Claude Code / Eve symlinks
  // — the CLI has no lockfile-aware agent-linking step today. Run without
  // --locked if you need those.
  process.exit(skills(["experimental_install"]));
}

if (!existsSync(lockPath)) {
  console.error(
    `No skills-lock.json at ${lockPath}. Add a skill first: npx skills add <owner>/<repo>`,
  );
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
} catch (err) {
  console.error(`skills-lock.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

// One `skills add` per distinct source repo — the lockfile lists skills
// individually, but they are installed a package at a time.
const sources = [
  ...new Set(
    Object.values(lock.skills ?? {})
      .filter((s) => s.sourceType === "github" && s.source)
      .map((s) => s.source),
  ),
].sort();

if (sources.length === 0) {
  console.error("skills-lock.json lists no github sources — nothing to install.");
  process.exit(1);
}

const agents = agentArg();
console.log(
  `Installing skills from ${sources.length} source(s) for agent(s) "${agents}":`,
);
for (const s of sources) console.log(`  • ${s}`);

let failed = 0;
for (const source of sources) {
  // --skill '*' = every skill in the repo; -y = never prompt (this runs in CI too).
  const code = skills(["add", source, "--skill", "*", "--agent", agents, "-y"]);
  if (code !== 0) {
    failed++;
    console.error(`\n✗ ${source} failed (exit ${code})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${sources.length} source(s) failed to install.`);
  process.exit(1);
}

console.log(
  "\n✓ Skills installed. Review them before use — they run with full agent permissions.",
);
