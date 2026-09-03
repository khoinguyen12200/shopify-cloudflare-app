import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLaunchContract } from "./check-placeholders.mjs";

function validFiles() {
  return {
    wrangler: {
      env: { production: {
        kv_namespaces: [{ binding: "SESSION", id: "0123456789abcdef0123456789abcdef" }],
        d1_databases: [{ binding: "DB", database_id: "11111111-2222-3333-4444-555555555555" }],
        vars: {
          SHOPIFY_API_KEY: "client-key",
          SHOPIFY_APP_URL: "https://app.example.org",
          SHOPIFY_PARTNER_APP_ID: "gid://partners/App/1",
          SHOPIFY_PARTNER_ORGANIZATION_ID: "1234567",
          SHOPIFY_PARTNER_API_VERSION: "2026-07",
        },
        secrets: { required: ["SHOPIFY_PARTNER_API_TOKEN"] },
      } },
    },
    productionToml: 'client_id = "client-key"\napplication_url = "https://app.example.org"\n[webhooks]\napi_version = "2026-07"\n[access_scopes]\nscopes = ""\n[auth]\nredirect_urls = [ "https://app.example.org/auth/callback" ]',
    developmentToml: 'client_id = "dev-key"\napplication_url = "https://dev.example.org"\n[webhooks]\napi_version = "2026-07"\n[access_scopes]\nscopes = ""\n[auth]\nredirect_urls = [ "https://dev.example.org/auth/callback" ]',
    legal: 'export const APP_NAME = "Useful App";\nexport const COMPANY_NAME = "Example LLC";\nexport const CONTACT_EMAIL = "privacy@example.org";\nexport const COMPANY_ADDRESS = "1 Main Street";\nexport const LAST_UPDATED = "2026-09-01";',
    plans: 'handle: "free"\nhandle: "pro"',
    publicCopy: '{"pricing":"Clear pricing","support":"Email support@example.org","privacy":"We process merchant data."}',
  };
}

test("accepts populated production config while allowing local fixture values", () => {
  assert.deepEqual(validateLaunchContract(validFiles()), []);
});

test("rejects a webhook API version that is not the template release", () => {
  const files = validFiles();
  files.productionToml = files.productionToml.replace('api_version = "2026-07"', 'api_version = "2026-10"');
  const issues = validateLaunchContract(files).join("\n");
  assert.match(issues, /webhook API version/i);
});

test("rejects missing Partner organization and API version", () => {
  const files = validFiles();
  delete files.wrangler.env.production.vars.SHOPIFY_PARTNER_ORGANIZATION_ID;
  files.wrangler.env.production.vars.SHOPIFY_PARTNER_API_VERSION = "";
  const issues = validateLaunchContract(files).join("\n");
  assert.match(issues, /SHOPIFY_PARTNER_ORGANIZATION_ID/);
  assert.match(issues, /SHOPIFY_PARTNER_API_VERSION/);
});

test("rejects every launch placeholder and redirect drift", () => {
  const files = validFiles();
  files.wrangler.env.production.kv_namespaces[0].id = "REPLACE_ME";
  files.wrangler.env.production.vars.SHOPIFY_API_KEY = "";
  files.wrangler.env.production.vars.SHOPIFY_APP_URL = "https://example.com";
  files.wrangler.env.production.vars.SHOPIFY_PARTNER_APP_ID = "";
  files.productionToml = 'client_id = ""\napplication_url = "https://different.example.com"\nscopes = "write_products"\nredirect_urls = [ "https://wrong.example.com/auth/callback" ]';
  files.developmentToml = files.developmentToml.replace('scopes = ""', 'scopes = "read_products"');
  files.legal = 'export const APP_NAME = "TODO: App";';
  files.plans = 'handle: "todo-pro"';
  files.publicCopy = '{"pricing":"TODO","support":"TODO","privacy":"TODO"}';

  const issues = validateLaunchContract(files).join("\n");
  for (const expected of [
    "Cloudflare production binding",
    "SHOPIFY_API_KEY",
    "SHOPIFY_APP_URL",
    "SHOPIFY_PARTNER_APP_ID",
    "shopify.app.toml client_id",
    "redirect_urls",
    "scope drift",
    "unused scope write_products",
    "legal identity/contact/date",
    "Managed Pricing plan handle",
    "public pricing/support/privacy copy",
  ]) assert.match(issues, new RegExp(expected));
});
