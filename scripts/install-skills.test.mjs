import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceInstaller = path.join(repoRoot, "scripts/install-skills.mjs");
const fixtureHash = "25718360e05d3c2d0963d1381e9dd4dae5fca789244ee4b9f861adcc0cc96218";

async function installerFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const installer = path.join(root, "scripts/install-skills.mjs");
  const codexDir = path.join(root, "codex");
  const claudeDir = path.join(root, "claude");
  await mkdir(path.dirname(installer), { recursive: true });
  await mkdir(path.join(root, "node_modules/.bin"), { recursive: true });
  await mkdir(path.join(codexDir, "fixture"), { recursive: true });
  await cp(sourceInstaller, installer);
  await writeFile(path.join(root, "node_modules/.bin/skills"), "");
  await writeFile(path.join(codexDir, "fixture/SKILL.md"), "original\n");
  await writeFile(path.join(root, "skills-lock.json"), `${JSON.stringify({ version: 1, skills: { fixture: { source: "fixture/source", sourceType: "github", skillPath: "skills/fixture/SKILL.md", computedHash: fixtureHash } } }, null, 2)}\n`);
  return { root, installer, codexDir, claudeDir };
}

function lockedArgs(fixture) {
  return [fixture.installer, "--wait", "--locked", "--temp-root", fixture.root, "--codex-dir", fixture.codexDir, "--claude-dir", fixture.claudeDir];
}

test("locked install uses explicit isolated Claude and Codex directories", async () => {
  const fixture = await installerFixture();
  const before = await readFile(path.join(fixture.root, "skills-lock.json"));
  const result = spawnSync(
    process.execPath,
    lockedArgs(fixture),
    { cwd: fixture.root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(path.join(fixture.codexDir, "fixture", "SKILL.md"), "utf8"), "original\n");
  assert.equal(await readFile(path.join(fixture.claudeDir, "fixture", "SKILL.md"), "utf8"), "original\n");
  assert.deepEqual(await readFile(path.join(fixture.root, "skills-lock.json")), before);
});

test("locked install rejects changed content in symlinked Claude and Codex stores", async () => {
  const fixture = await installerFixture();
  const first = spawnSync(process.execPath, lockedArgs(fixture), { cwd: fixture.root, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  await writeFile(path.join(fixture.codexDir, "fixture", "SKILL.md"), "changed\n");

  const result = spawnSync(process.execPath, lockedArgs(fixture), { cwd: fixture.root, encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing or changed[\s\S]*codex\/fixture/i);
});

test("explicit agent directories must stay under temporary root", async () => {
  const fixture = await installerFixture();
  const result = spawnSync(
    process.execPath,
    [fixture.installer, "--wait", "--locked", "--temp-root", fixture.root, "--codex-dir", path.join(fixture.root, "..", "outside")],
    { cwd: fixture.root, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be under --temp-root/);
});

test("locked install fails when lockfile changes during verification", async () => {
  const fixture = await installerFixture();
  const hook = path.join(fixture.root, "mutate-lock.cjs");
  await writeFile(hook, `const fs = require("node:fs");\nconst read = fs.readFileSync.bind(fs);\nlet reads = 0;\nfs.readFileSync = (file, ...args) => { if (String(file).endsWith("skills-lock.json") && reads++ === 1) fs.writeFileSync(file, Buffer.concat([read(file), Buffer.from(" ")])); return read(file, ...args); };\n`);
  const lockPath = path.join(fixture.root, "skills-lock.json");
  const before = await readFile(lockPath);
  const repoLockBefore = await readFile(path.join(repoRoot, "skills-lock.json"));
  const result = spawnSync(
    process.execPath,
    ["--require", hook, ...lockedArgs(fixture)],
    { cwd: fixture.root, encoding: "utf8" },
  );
  assert.notDeepEqual(await readFile(lockPath), before);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /changed skills-lock\.json/);
  assert.deepEqual(await readFile(path.join(repoRoot, "skills-lock.json")), repoLockBefore);
});

test("existing destination symlink cannot escape temporary root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const installer = path.join(root, "scripts/install-skills.mjs");
  await mkdir(path.dirname(installer), { recursive: true });
  await mkdir(path.join(root, "node_modules/.bin"), { recursive: true });
  await cp(sourceInstaller, installer);
  await writeFile(path.join(root, "node_modules/.bin/skills"), "");
  const outside = await mkdtemp(path.join(tmpdir(), "skills-outside-"));
  await symlink(outside, path.join(root, "codex"));
  const result = spawnSync(
    process.execPath,
    [installer, "--wait", "--locked", "--temp-root", root, "--codex-dir", path.join(root, "codex")],
    { cwd: root, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symlink|under --temp-root/);
});

test("parent symlink cannot redirect destination writes outside temporary root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "skills-installer-"));
  const installer = path.join(root, "scripts/install-skills.mjs");
  await mkdir(path.dirname(installer), { recursive: true });
  await mkdir(path.join(root, "node_modules/.bin"), { recursive: true });
  await cp(sourceInstaller, installer);
  await writeFile(path.join(root, "node_modules/.bin/skills"), "");
  const outside = await mkdtemp(path.join(tmpdir(), "skills-outside-"));
  await symlink(outside, path.join(root, "nest"));
  const codexDir = path.join(root, "nest", "codex");
  const result = spawnSync(
    process.execPath,
    [installer, "--wait", "--locked", "--temp-root", root, "--codex-dir", codexDir],
    { cwd: root, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.equal(await readFile(path.join(outside, "codex", "fixture", "SKILL.md")).catch(() => null), null);
});
