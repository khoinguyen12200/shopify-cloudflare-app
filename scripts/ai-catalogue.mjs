#!/usr/bin/env node
/**
 * Regenerate app/ai/catalogue.ts from the LIVE Workers AI model list.
 *
 *   node scripts/ai-catalogue.mjs           # rewrite the file
 *   node scripts/ai-catalogue.mjs --check   # exit 1 if it is out of date
 *
 * The catalogue is a snapshot — every id, context window, capability flag and
 * price in it is Cloudflare's own metadata rather than a guess. Snapshots go
 * stale: Cloudflare adds models and retires others, and a retired id resolves to
 * nothing at call time, which reads as a broken feature rather than a bad
 * setting.
 *
 * `--check` is deliberately NOT part of `npm run verify`. It needs network and a
 * Cloudflare login, so wiring it into the suite would make an offline test run
 * fail for a reason that has nothing to do with the change being tested. Run it
 * when touching AI, or on a schedule in CI where the credentials exist.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "app/ai/catalogue.ts";

/** Not chat models: adapters needing config we do not send, a classifier, specialists. */
const EXCLUDE = /lora|llama-guard|coder|-code$|vision/i;

function liveModels() {
  const raw = execFileSync("npx", ["wrangler", "ai", "models", "list", "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(raw.slice(raw.indexOf("[")));
}

const prop = (model, id) =>
  (model.properties ?? []).find((entry) => entry.property_id === id)?.value;

/** Micro-USD per million tokens, as an exact integer — never a float. */
function price(model, unit) {
  const row = (prop(model, "price") ?? []).find((entry) => entry.unit === unit);
  return row ? Math.round(row.price * 1e6) : null;
}

function label(id) {
  return id
    .replace(/^@cf\//, "")
    .split("/")
    .pop()
    .replace(/-instruct|-it$/g, "")
    .replace(/-/g, " ")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function render(models) {
  const rows = models
    .filter((m) => m.task?.name === "Text Generation" && !EXCLUDE.test(m.name))
    .map((m) => ({
      id: m.name,
      label: label(m.name),
      toolCalling: prop(m, "function_calling") === "true",
      reasoning: prop(m, "reasoning") === "true",
      contextWindow: Number(prop(m, "context_window") ?? 0),
      input: price(m, "per M input tokens"),
      output: price(m, "per M output tokens"),
    }))
    .filter((r) => r.input !== null && r.output !== null)
    // Sorted by id so a regeneration produces a stable diff: a real change shows
    // as one added or removed model, not a reshuffle.
    .sort((a, b) => a.id.localeCompare(b.id));

  if (rows.length === 0) throw new Error("no text-generation models found — refusing to write an empty catalogue");

  const entries = rows
    .map(
      (r) => `  {
    id: "${r.id}",
    label: "${r.label}",
    toolCalling: ${r.toolCalling},
    reasoning: ${r.reasoning},
    contextWindow: ${r.contextWindow},
    inputMicroUsdPerMTokens: ${r.input},
    outputMicroUsdPerMTokens: ${r.output},
  },`,
    )
    .join("\n");

  const head = readFileSync(OUT, "utf8");
  const before = head.slice(0, head.indexOf("export const WORKERS_AI_MODELS"));
  const after = head.slice(head.indexOf("];"));

  return `${before}export const WORKERS_AI_MODELS: readonly CatalogueModel[] = [\n${entries}\n${after}`;
}

const next = render(liveModels());
const current = readFileSync(OUT, "utf8");

if (process.argv.includes("--check")) {
  if (next === current) {
    console.log(`✓ ${OUT} matches the live Workers AI catalogue`);
    process.exit(0);
  }
  console.error(
    `✗ ${OUT} is out of date.\n` +
      "  Cloudflare has added, retired or repriced a model.\n" +
      "  Run: npm run ai:catalogue   then review the diff.",
  );
  process.exit(1);
}

writeFileSync(OUT, next);
console.log(`✓ wrote ${OUT}`);
