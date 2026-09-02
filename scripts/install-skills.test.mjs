import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const installer = path.join(repoRoot, "scripts/install-skills.mjs");

test("locked install uses explicit isolated Claude and Codex directories", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const codexDir = path.join(root, "codex");
  const claudeDir = path.join(root, "claude");
  const before = await readFile(path.join(repoRoot, "skills-lock.json"));
  const result = spawnSync(
    process.execPath,
    [installer, "--wait", "--locked", "--temp-root", root, "--codex-dir", codexDir, "--claude-dir", claudeDir],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.ok(await readFile(path.join(codexDir, "impeccable", "SKILL.md")));
  assert.ok(await readFile(path.join(claudeDir, "impeccable", "SKILL.md")));
  assert.deepEqual(await readFile(path.join(repoRoot, "skills-lock.json")), before);
});

test("explicit agent directories must stay under temporary root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const result = spawnSync(
    process.execPath,
    [installer, "--wait", "--locked", "--temp-root", root, "--codex-dir", path.join(root, "..", "outside")],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be under --temp-root/);
});

test("locked install fails when lockfile changes during verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const hook = path.join(root, "mutate-lock.cjs");
  await writeFile(hook, `const fs = require("node:fs");\nconst read = fs.readFileSync.bind(fs);\nlet reads = 0;\nfs.readFileSync = (file, ...args) => { if (String(file).endsWith("skills-lock.json") && reads++ === 1) fs.writeFileSync(file, Buffer.concat([read(file), Buffer.from(" ")])); return read(file, ...args); };\n`);
  const lockPath = path.join(repoRoot, "skills-lock.json");
  const before = await readFile(lockPath);
  const result = spawnSync(
    process.execPath,
    ["--require", hook, installer, "--wait", "--locked", "--temp-root", root],
    { cwd: repoRoot, encoding: "utf8" },
  );
  await writeFile(lockPath, before);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /changed skills-lock\.json/);
});

test("existing destination symlink cannot escape temporary root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const outside = await mkdtemp(path.join(tmpdir(), "skills-outside-"));
  await symlink(outside, path.join(root, "codex"));
  const result = spawnSync(
    process.execPath,
    [installer, "--wait", "--locked", "--temp-root", root, "--codex-dir", path.join(root, "codex")],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink|under --temp-root/);
});
