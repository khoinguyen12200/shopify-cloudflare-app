#!/usr/bin/env node
// Pre-deploy guard: refuse to deploy an environment whose bindings still hold
// placeholder ids.
//
//   node scripts/check-placeholders.mjs production
//
// A fresh project copies wrangler.jsonc, fills in some ids and forgets others.
// Without this, `wrangler deploy` succeeds and ships a Worker whose D1 and KV
// point at nothing — which fails at RUNTIME, on a real request, with an error
// that says nothing about the cause. Cheap to check, expensive to discover.
//
// Wired into `cf:deploy` before the build, so it fails in seconds rather than
// after a full verify.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/** Anything that looks like "fill this in". */
const PLACEHOLDER = /REPLACE|CHANGE_?ME|TODO|XXXX|your-?(domain|account)/i;

/**
 * Strip JSONC comments so the config can be parsed as JSON.
 *
 * String-aware: a `//` inside a value (a URL) must survive, and an escaped quote
 * must not end the string early. A naive regex over the whole file eats both.
 */
export function stripJsonComments(text) {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Every placeholder string inside `value`, as `path → value` pairs.
 *
 * Walks the PARSED object rather than scanning lines: line scanning cannot tell
 * which environment a line belongs to, and a comment mentioning REPLACE_ME
 * (there are several, explaining what to do) would be a false positive.
 */
export function findPlaceholders(value, path = "") {
  if (typeof value === "string") {
    return PLACEHOLDER.test(value) ? [{ path, value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPlaceholders(item, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      findPlaceholders(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

/** The config for one environment: named envs inherit nothing, so no merging. */
export function configForEnv(config, envName) {
  if (!envName || envName === "top-level") {
    const { env: _env, ...base } = config;
    return base;
  }
  return config.env?.[envName];
}

/**
 * The CLI. Wrapped in a function and guarded below so this module can be
 * IMPORTED by its tests — top-level `process.exit` would otherwise kill the test
 * runner the moment it loaded the file, and the alternative is testing a copy of
 * the parser rather than the parser that actually runs.
 */
function main() {
  const envName = process.argv[2];
  if (!envName) {
    console.error(
      "usage: node scripts/check-placeholders.mjs <env>   (e.g. production)",
    );
    process.exit(2);
  }

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const raw = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");

  let config;
  try {
    config = JSON.parse(stripJsonComments(raw));
  } catch (error) {
    console.error(`wrangler.jsonc could not be parsed: ${error.message}`);
    process.exit(2);
  }

  const envConfig = configForEnv(config, envName);
  if (!envConfig) {
    console.error(
      `No "${envName}" environment in wrangler.jsonc. Known: ${Object.keys(config.env ?? {}).join(", ") || "(none)"}`,
    );
    process.exit(2);
  }

  const hits = findPlaceholders(envConfig);
  if (hits.length > 0) {
    console.error(
      `\nRefusing to deploy "${envName}": ${hits.length} placeholder value${hits.length === 1 ? "" : "s"} left in wrangler.jsonc\n`,
    );
    for (const hit of hits) console.error(`  ${hit.path} = ${JSON.stringify(hit.value)}`);
    console.error(
      "\nFill these in first:\n" +
        "  npx wrangler d1 create <name>\n" +
        "  npx wrangler kv namespace create <BINDING>\n" +
        "then re-run `npm run cf-typegen`.\n",
    );
    process.exit(1);
  }

  console.log(`wrangler.jsonc "${envName}": no placeholder values.`);
}

// Only when run directly, never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
