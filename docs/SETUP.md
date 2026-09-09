# New App Setup

Use this checklist after creating a repository from the template. The template
provides the runtime, authentication, persistence, webhooks, billing seams,
i18n, tests, and deployment pipeline. Only app-specific values and account
resources remain.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run config:link:dev
npm run db:migrate:local
npm run db:seed
npm run dev
```

Fill local secrets in `.dev.vars`; never commit that file. Add feature code under
`app/domain`, `app/services`, and `app/routes`, following the existing ports and
models boundaries.

## App identity

Update `app/identity.ts`, locale files, `app/billing/plans.ts`, and both Shopify
TOML files. Keep dev and production apps separate and review the diff after
`config:link` because Shopify CLI may rewrite configuration.

## Production

Create production D1, KV, R2, Queue/DLQ, and rate-limit resources; copy their
bindings into `wrangler.jsonc`; set production secrets with `wrangler secret
put`; then run:

```bash
npm run cf-typegen
npm run verify
npm run check:placeholders
npm run cf:deploy
```

`check:placeholders` is expected to fail on a fresh clone and is the final gate
that confirms app-specific values have been replaced.

For legal, privacy, compliance, and operational review, see `LEGAL_TEMPLATE.md`
and `OPERATIONS.md`.
