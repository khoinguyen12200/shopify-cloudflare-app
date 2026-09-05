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

const BINDING_SECTIONS = [
  ["ai", "binding"],
  ["analytics_engine_datasets", "binding"],
  ["browser", "binding"],
  ["d1_databases", "binding"],
  ["durable_objects", "bindings", "name"],
  ["hyperdrive", "binding"],
  ["images", "binding"],
  ["kv_namespaces", "binding"],
  ["queues", "producers", "binding"],
  ["r2_buckets", "binding"],
  ["ratelimits", "name"],
  ["send_email", "name"],
  ["services", "binding"],
  ["vectorize", "binding"],
  ["workflows", "binding"],
];

function bindingKeys(config) {
  return new Set(BINDING_SECTIONS.flatMap(([section, nested, key]) => {
    const entries = key ? config[section]?.[nested] : config[section];
    if (Array.isArray(entries)) return entries.map((entry) => entry[key ?? nested]).filter(Boolean);
    if (entries && typeof entries === "object") return [entries[key ?? nested]].filter(Boolean);
    return [];
  }));
}

function parityIssues(base, production) {
  const issues = [];
  for (const key of bindingKeys(base)) {
    if (!bindingKeys(production).has(key)) issues.push(`production binding ${key} is missing`);
  }
  for (const key of Object.keys(base.vars ?? {})) {
    if (!(key in (production.vars ?? {}))) issues.push(`production var ${key} is missing`);
  }
  for (const key of base.secrets?.required ?? []) {
    if (!production.secrets?.required?.includes(key)) issues.push(`production secret ${key} is missing`);
  }
  const baseConsumers = new Set((base.queues?.consumers ?? []).map((entry) => entry.queue).filter(Boolean));
  const productionConsumers = new Set((production.queues?.consumers ?? []).map((entry) => entry.queue).filter(Boolean));
  for (const queue of baseConsumers) {
    if (!productionConsumers.has(queue)) issues.push(`production queue consumer ${queue} is missing`);
  }
  return issues;
}

function tomlString(text, key) {
  return text.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? "";
}

function tomlStrings(text, key) {
  const value = text.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m"))?.[1] ?? "";
  return [...value.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

function tomlSectionString(text, section, key) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`^\\[${escaped}\\]\\s*$`, "m").exec(text);
  if (!header || header.index === undefined) return "";
  const rest = text.slice(header.index + header[0].length);
  const nextSection = rest.search(/^\[/m);
  const body = nextSection < 0 ? rest : rest.slice(0, nextSection);
  return tomlString(body, key);
}

export function validateLaunchContract(files) {
  const issues = [];
  const production = configForEnv(files.wrangler, "production");
  if (!production) return ['No "production" environment in wrangler.jsonc'];
  issues.push(...parityIssues(configForEnv(files.wrangler, "top-level"), production));
  if (findPlaceholders(production).length > 0) issues.push("Cloudflare production binding contains placeholder values");

  const vars = production.vars ?? {};
  for (const key of ["SHOPIFY_API_KEY", "SHOPIFY_APP_URL", "SHOPIFY_PARTNER_APP_ID", "SHOPIFY_PARTNER_ORGANIZATION_ID", "SHOPIFY_PARTNER_API_VERSION"]) {
    if (!vars[key] || PLACEHOLDER.test(vars[key]) || vars[key] === "https://example.com") {
      issues.push(`${key} is missing or placeholder`);
    }
  }
  if (!(production.secrets?.required ?? []).includes("SHOPIFY_PARTNER_API_TOKEN")) {
    issues.push("SHOPIFY_PARTNER_API_TOKEN secret is not declared");
  }
  if (!(production.secrets?.required ?? []).includes("ATTACHMENT_TOKEN_SECRET")) {
    issues.push("ATTACHMENT_TOKEN_SECRET secret is not declared");
  }

  const requiredBindings = [
    ["SESSION", "kv_namespaces"], ["DB", "d1_databases"], ["UPLOADS", "r2_buckets"],
    ["EMAIL", "send_email"], ["AI", "ai"], ["WEBHOOK_QUEUE", "queues"],
    ["SUPPORT_LIMITER", "ratelimits"], ["LOGIN_LIMITER", "ratelimits"], ["RESET_LIMITER", "ratelimits"],
  ];
  for (const [binding, section] of requiredBindings) {
    const configured = section === "ai"
      ? production.ai?.binding === binding
      : section === "queues"
        ? production.queues?.producers?.some((entry) => entry.binding === binding)
        : section === "ratelimits"
          ? production.ratelimits?.some((entry) => entry.name === binding)
          : production[section]?.some((entry) => entry.binding === binding || entry.name === binding);
    if (!configured) issues.push(`production binding ${binding} is missing`);
  }
  const webhookQueue = production.queues?.producers?.find((entry) => entry.binding === "WEBHOOK_QUEUE")?.queue;
  if (!webhookQueue || !production.queues?.consumers?.some((entry) => entry.queue === webhookQueue)) {
    issues.push("production WEBHOOK_QUEUE consumer is missing");
  }
  if (!("AI_GATEWAY_ID" in vars)) issues.push("AI_GATEWAY_ID production var is missing");

  const clientId = tomlString(files.productionToml, "client_id");
  const appUrl = tomlString(files.productionToml, "application_url");
  const redirects = tomlStrings(files.productionToml, "redirect_urls");
  if (!clientId || PLACEHOLDER.test(clientId)) issues.push("shopify.app.toml client_id is missing or placeholder");
  if (!appUrl || PLACEHOLDER.test(appUrl) || appUrl === "https://example.com") issues.push("shopify.app.toml application_url is placeholder");
  if (redirects.length !== 1 || redirects[0] !== `${appUrl}/auth/callback`) issues.push("shopify.app.toml redirect_urls drift from application_url");
  if (vars.SHOPIFY_APP_URL && appUrl && vars.SHOPIFY_APP_URL !== appUrl) issues.push("SHOPIFY_APP_URL drifts from shopify.app.toml application_url");
  if (vars.SHOPIFY_API_KEY && clientId && vars.SHOPIFY_API_KEY !== clientId) issues.push("SHOPIFY_API_KEY drifts from shopify.app.toml client_id");

  const productionScopes = tomlString(files.productionToml, "scopes");
  const developmentScopes = tomlString(files.developmentToml, "scopes");
  if (productionScopes !== developmentScopes) issues.push("scope drift between production and development configs");
  for (const scope of productionScopes.split(",").map((scope) => scope.trim()).filter(Boolean)) {
    issues.push(`unused scope ${scope}; base template must start with no scopes`);
  }
  const productionWebhookVersion = tomlSectionString(files.productionToml, "webhooks", "api_version");
  const developmentWebhookVersion = tomlSectionString(files.developmentToml, "webhooks", "api_version");
  const supportedShopifyVersion = "2026-07";
  if (productionWebhookVersion !== supportedShopifyVersion || developmentWebhookVersion !== supportedShopifyVersion) {
    issues.push(`webhook API version must be ${supportedShopifyVersion} in both Shopify app configs`);
  }
  if (vars.SHOPIFY_PARTNER_API_VERSION !== supportedShopifyVersion) {
    issues.push(`SHOPIFY_PARTNER_API_VERSION must be ${supportedShopifyVersion}`);
  }
  if (PLACEHOLDER.test(files.legal) || !/LAST_UPDATED\s*=\s*"\d{4}-\d{2}-\d{2}"/.test(files.legal)) {
    issues.push("legal identity/contact/date contains TODO or invalid effective date");
  }
  if (PLACEHOLDER.test(files.plans)) issues.push("Managed Pricing plan handle contains placeholder");
  if (PLACEHOLDER.test(files.publicCopy)) issues.push("public pricing/support/privacy copy contains TODO");
  return issues;
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

  const files = {
    wrangler: config,
    productionToml: readFileSync(join(repoRoot, "shopify.app.toml"), "utf8"),
    developmentToml: readFileSync(join(repoRoot, "shopify.app.dev.toml"), "utf8"),
    legal: readFileSync(join(repoRoot, "app/legal/content.ts"), "utf8"),
    plans: readFileSync(join(repoRoot, "app/billing/plans.ts"), "utf8"),
    publicCopy: readFileSync(join(repoRoot, "app/i18n/locales/en/public.json"), "utf8"),
  };
  const issues = validateLaunchContract(files);
  if (issues.length > 0) {
    console.error(
      `\nRefusing to deploy "${envName}": ${issues.length} launch contract issue${issues.length === 1 ? "" : "s"}\n`,
    );
    for (const issue of issues) console.error(`  ${issue}`);
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
