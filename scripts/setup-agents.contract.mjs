import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readProjectFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

test("npm install runs the agent bootstrap automatically", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));

  assert.equal(packageJson.scripts?.postinstall, "node scripts/setup-agents.mjs");
});

test("the installer targets Claude Code and Codex by default", async () => {
  const installer = await readProjectFile("scripts/install-skills.mjs");

  assert.match(installer, /const defaultAgents = \["claude-code", "codex"\]/);
  assert.match(installer, /"--agent", \.\.\.agents/);
});

test("the installer verifies every locked skill for both primary hosts", async () => {
  const installer = await readProjectFile("scripts/install-skills.mjs");

  assert.match(installer, /verifyInstalledSkills/);
  assert.match(installer, /\.claude\/skills/);
  assert.match(installer, /\.agents\/skills/);
});

test("locked installs verify committed lockfile bytes without restoring mutations", async () => {
  const installer = await readProjectFile("scripts/install-skills.mjs");

  assert.match(installer, /lockedLockfile\.equals\(readFileSync\(lockPath\)\)/);
  assert.doesNotMatch(installer, /writeFileSync\(lockPath, lockedLockfile\)/);
});

test("installer supports isolated, validated destinations", async () => {
  const installer = await readProjectFile("scripts/install-skills.mjs");

  assert.match(installer, /--temp-root/);
  assert.match(installer, /--claude-dir/);
  assert.match(installer, /--codex-dir/);
  assert.match(installer, /must be under --temp-root/);
});

test("Codex receives the project-scoped Shopify MCP server", async () => {
  const config = await readProjectFile(".codex/config.toml");

  assert.match(config, /\[mcp_servers\.shopify-dev-mcp\]/);
  assert.match(config, /command = "npx"/);
  assert.match(config, /args = \["-y", "@shopify\/dev-mcp@latest"\]/);
});

test("the design skill required by agent rules and hooks is installed", async () => {
  const lock = JSON.parse(await readProjectFile("skills-lock.json"));

  assert.ok(lock.skills?.impeccable);
});
