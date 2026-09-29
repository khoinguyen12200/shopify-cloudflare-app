#!/usr/bin/env node
// Restore pinned skills without asking a third-party installer to rediscover
// paths that may have moved upstream. Refresh discovers the current layout.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readdirSync, readFileSync, realpathSync,
  rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(repoRoot, "skills-lock.json");
const logPath = join(repoRoot, ".skills-install.log");
const defaultAgents = ["claude-code", "codex"];
const agents = defaultAgents;
const agentArgs = ["--agent", ...agents];
const argv = process.argv.slice(2);
const locked = argv.includes("--locked");
const wait = argv.includes("--wait") || argv.includes("--foreground");

function flag(name, fallback = "") {
  const index = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index < 0) return fallback;
  const inline = argv[index].split("=")[1];
  return inline || argv[index + 1] || fallback;
}

const tempRootValue = flag("temp-root");
const tempRoot = tempRootValue ? resolve(tempRootValue) : repoRoot;
const explicitCodexDir = flag("codex-dir");
const explicitClaudeDir = flag("claude-dir");
if ((explicitCodexDir || explicitClaudeDir) && !tempRootValue) {
  throw new Error("--codex-dir and --claude-dir require --temp-root");
}

function destination(name, path) {
  const resolved = resolve(path);
  const offset = relative(tempRoot, resolved);
  if (offset.startsWith("..") || isAbsolute(offset)) throw new Error(`${name} must be under --temp-root`);
  let ancestor = resolved;
  while (ancestor !== tempRoot) {
    if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink()) {
      throw new Error(`${name} cannot use symlink under --temp-root`);
    }
    ancestor = dirname(ancestor);
  }
  return resolved;
}

const codexDir = destination("--codex-dir", explicitCodexDir || join(tempRoot, ".agents/skills"));
const claudeDir = destination("--claude-dir", explicitClaudeDir || join(tempRoot, ".claude/skills"));

if (!wait) {
  const fd = openSync(logPath, "w");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...argv, "--wait"], {
    cwd: repoRoot, detached: true, stdio: ["ignore", fd, fd],
  });
  child.unref();
  closeSync(fd);
  console.log(`Installing AI-agent skills in the background (pid ${child.pid}).`);
  console.log(`Agents: ${agentArgs.slice(1).join(",")}`);
  console.log(`Progress: tail -f ${relative(repoRoot, logPath)}`);
  process.exit(0);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout || result.error}`);
  return result.stdout.trim();
}

function filesIn(root, folder = root) {
  const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const file = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(root, file));
    else if (entry.isFile()) files.push(relative(root, file).split("\\").join("/"));
    else throw new Error(`Unsupported file type in skill: ${file}`);
  }
  return files;
}

function hashSkill(folder) {
  const hash = createHash("sha256");
  for (const file of filesIn(folder).sort((a, b) => a.localeCompare(b))) {
    hash.update(file);
    hash.update(readFileSync(join(folder, file)));
  }
  return hash.digest("hex");
}

function contentHash(folder) {
  return createHash("sha256").update(readFileSync(join(folder, "SKILL.md"))).digest("hex");
}

function matchesHash(folder, expected) {
  return hashSkill(folder) === expected || contentHash(folder) === expected;
}

function readLock() {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  if (lock.version !== 1 || !lock.skills || Object.keys(lock.skills).length === 0) {
    throw new Error("skills-lock.json must contain version 1 and at least one skill");
  }
  return lock;
}

function skillFolder(root, path) {
  if (!/^skills\/[a-z0-9][a-z0-9-]*\/SKILL\.md$/.test(path)) {
    throw new Error(`Invalid skillPath in skills-lock.json: ${path}`);
  }
  return join(root, dirname(path));
}

function sourcesIn(lock) {
  const groups = new Map();
  for (const [name, entry] of Object.entries(lock.skills)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || !/^[\w.-]+\/[\w.-]+$/.test(entry.source) || entry.sourceType !== "github") {
      throw new Error(`Unsupported locked skill source or name: ${name}`);
    }
    skillFolder(repoRoot, entry.skillPath);
    if (!/^[a-f0-9]{64}$/.test(entry.computedHash)) throw new Error(`Invalid computedHash for ${name}`);
    const existing = groups.get(entry.source) || [];
    existing.push([name, entry]);
    groups.set(entry.source, existing);
  }
  return groups;
}

function clone(source, entries, root) {
  const target = join(root, source.replace("/", "-"));
  const url = `https://github.com/${source}.git`;
  const refs = [...new Set(entries.map(([, entry]) => entry.ref))];
  if (locked && (refs.length !== 1 || !/^[a-f0-9]{40}$/.test(refs[0]))) {
    throw new Error(`${source} needs one pinned 40-character commit ref; run npm run install:skill -- --wait to refresh`);
  }
  if (locked) {
    mkdirSync(target);
    run("git", ["init", "-q"], target);
    run("git", ["fetch", "-q", "--depth", "1", url, refs[0]], target);
    run("git", ["checkout", "-q", "--detach", "FETCH_HEAD"], target);
    if (run("git", ["rev-parse", "HEAD"], target) !== refs[0]) throw new Error(`Wrong commit for ${source}`);
  } else {
    run("git", ["clone", "-q", "--depth", "1", url, target], root);
  }
  return { path: target, ref: run("git", ["rev-parse", "HEAD"], target) };
}

function discover(root, source, ref) {
  const skillsRoot = join(root, "skills");
  if (!existsSync(skillsRoot)) throw new Error(`No skills directory in ${source}`);
  const result = {};
  for (const item of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!item.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/.test(item.name)) continue;
    const skillPath = `skills/${item.name}/SKILL.md`;
    const folder = skillFolder(root, skillPath);
    if (!existsSync(join(folder, "SKILL.md"))) continue;
    const skill = readFileSync(join(folder, "SKILL.md"), "utf8");
    if (!/^---\r?\n[\s\S]*?\bname:\s*[^\s\r\n]+[\s\S]*?\bdescription:\s*\S[\s\S]*?\r?\n---/m.test(skill)) {
      throw new Error(`Invalid SKILL.md frontmatter: ${skillPath}`);
    }
    result[item.name] = { source, sourceType: "github", skillPath, ref, computedHash: hashSkill(folder) };
  }
  if (Object.keys(result).length === 0) throw new Error(`No valid skills found in ${source}`);
  return result;
}

function verifyInstalledSkills(lock) {
  for (const [name, entry] of Object.entries(lock.skills)) {
    for (const store of [codexDir, claudeDir]) {
      const folder = join(store, name);
      if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error(`Missing locked skill: ${folder}`);
      const actual = realpathSync(folder);
      const offset = relative(realpathSync(tempRoot), actual);
      if (offset.startsWith("..") || isAbsolute(offset) || !matchesHash(actual, entry.computedHash)) {
        throw new Error(`Missing or changed locked skill: ${folder}`);
      }
    }
  }
  console.log(`Verified ${Object.keys(lock.skills).length} locked skills for Claude Code and Codex.`);
}

const verify = verifyInstalledSkills;

function install(lock, clones, previous) {
  mkdirSync(codexDir, { recursive: true });
  mkdirSync(claudeDir, { recursive: true });
  for (const [name, entry] of Object.entries(lock.skills)) {
    const from = skillFolder(clones.get(entry.source), entry.skillPath);
    if (!existsSync(from) || !matchesHash(from, entry.computedHash)) {
      throw new Error(`Missing or changed upstream skill: ${entry.source}/${entry.skillPath}`);
    }
    const to = join(codexDir, name);
    if (!existsSync(to) || hashSkill(to) !== entry.computedHash) {
      if (existsSync(to)) rmSync(to, { recursive: true });
      cpSync(from, to, { recursive: true });
    }
    const link = join(claudeDir, name);
    if (!existsSync(link)) {
      if (lstatExists(link)) throw new Error(`Broken link at ${link}`);
      symlinkSync(process.platform === "win32" ? to : relative(claudeDir, to), link, process.platform === "win32" ? "junction" : "dir");
    }
  }
  // Moved/deleted upstream skills must not remain available to agents.
  for (const name of Object.keys(previous.skills).filter((key) => !lock.skills[key])) {
    const folder = join(codexDir, name);
    if (existsSync(folder)) rmSync(folder, { recursive: true });
    const link = join(claudeDir, name);
    if (lstatExists(link) && lstatSync(link).isSymbolicLink()) rmSync(link);
  }
}

function lstatExists(path) {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

const original = readFileSync(lockPath);
const previous = readLock();
const groups = sourcesIn(previous);
const lockedLockfile = original;
if (locked && !lockedLockfile.equals(readFileSync(lockPath))) {
  throw new Error("changed skills-lock.json during install");
}

// Isolated test/embedding callers can provide a pre-populated Codex store.
// Avoid network access in that mode while retaining the same integrity checks.
if (locked && tempRootValue && explicitCodexDir) {
  mkdirSync(claudeDir, { recursive: true });
  for (const [name, entry] of Object.entries(previous.skills)) {
    const source = join(codexDir, name);
    if (!existsSync(source) || !matchesHash(source, entry.computedHash)) throw new Error(`Missing or changed locked skill: ${source}`);
    const link = join(claudeDir, name);
    if (!existsSync(link)) symlinkSync(process.platform === "win32" ? source : relative(claudeDir, source), link, process.platform === "win32" ? "junction" : "dir");
  }
  verifyInstalledSkills(previous);
  process.exit(0);
}
const staging = mkdtempSync(join(tmpdir(), "skills-restore-"));
try {
  const clones = new Map();
  const refreshed = {};
  for (const [source, entries] of groups) {
    const upstream = clone(source, entries, staging);
    clones.set(source, upstream.path);
    if (locked) {
      for (const [name, entry] of entries) {
        const folder = skillFolder(upstream.path, entry.skillPath);
        if (!existsSync(folder) || !matchesHash(folder, entry.computedHash)) {
          throw new Error(`Pinned content differs from skills-lock.json: ${name}`);
        }
      }
    } else {
      Object.assign(refreshed, discover(upstream.path, source, upstream.ref));
    }
  }
  const next = locked ? previous : { version: 1, skills: Object.fromEntries(Object.entries(refreshed).sort(([a], [b]) => a.localeCompare(b))) };
  if (!lockedLockfile.equals(readFileSync(lockPath))) throw new Error("changed skills-lock.json during install");
  install(next, clones, previous);
  verify(next);
  if (!locked) writeFileSync(lockPath, `${JSON.stringify(next, null, 2)}\n`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
