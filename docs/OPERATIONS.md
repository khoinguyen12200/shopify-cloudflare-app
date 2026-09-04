# Operations runbook

This guide is for the operator of a derived application, after its production
resources and credentials have been provisioned. It does not provide a deploy
workflow for a particular CI provider: choose an organization-specific identity,
approval, audit-log, and rollback policy before automating any of these steps.

Commands use the repository-pinned Wrangler through `npx wrangler`. They were
checked against Wrangler 4.125.0. Commands marked **operator-run** require the
right Cloudflare account and can change remote state; review the target names
and current release before running them.

## Deploy a release

1. Review `wrangler.jsonc`'s `production` environment, `shopify.app.toml`, and
   the production resource names. Named environments do not inherit bindings.
2. Set every required secret using an interactive prompt. Never put a value in
   a command argument, shell history, a repository file, or build log.
3. Run the release gate and deploy from the same commit. The package command
   runs verification, a production build, D1 migrations, and then deploys the
   built Worker; do not replace it with a bare `wrangler deploy`.

```bash
# operator-run: prompts for the secret value
npx wrangler secret put ATTACHMENT_TOKEN_SECRET --env production
npx wrangler secret list --env production

# operator-run: validates the populated production release contract
npm run check:placeholders

# operator-run: applies D1 migrations before Worker deployment
npm run cf:deploy
```

The public Shopify client ID (`SHOPIFY_API_KEY`) is configuration, not a secret.
`SHOPIFY_API_SECRET`, `ATTACHMENT_TOKEN_SECRET`, `INTERNAL_SESSION_SECRET`,
`SHOP_CUSTOM_DOMAIN`, and `SHOPIFY_PARTNER_API_TOKEN` are secrets. Keep the
latter only in the secret store and local `.dev.vars`; their *names* belong in
`wrangler.jsonc` so `Env` can be generated on a clean checkout.

## Roll back safely

A Worker rollback does not roll back a D1 schema or data change. First stop and
identify whether the incident is code-only or needs a data recovery plan.

```bash
# operator-run: inspect available releases, then choose a known-good version ID
npx wrangler deployments list --env production
npx wrangler rollback <known-good-version-id> --env production \
  --message "Rollback: <incident reference>"

# operator-run: observe the recovered release; filter to known failure events
npx wrangler tail --env production --format json --status error
```

If the failed release includes a migration, keep the old Worker compatible with
the newer schema or ship a forward corrective migration. Do not attempt to
apply an old migration file in reverse without an approved, tested recovery
plan.

## D1 backup and recovery

Before a data-affecting operation, take an export and record its checksum and
the release SHA in the incident or change record.

```bash
# operator-run: creates a SQL export of the remote production database
npx wrangler d1 export app-db-prod --remote --output /tmp/app-db-prod.sql

# operator-run: inspect a point available for Cloudflare D1 Time Travel
npx wrangler d1 time-travel info app-db-prod

# operator-run, destructive: restore the named remote database to an approved timestamp
npx wrangler d1 time-travel restore app-db-prod --timestamp <RFC3339-timestamp>
```

Test an export in an isolated database before relying on it. `wrangler d1
execute <database> --remote --file <sql-file>` can ingest SQL, but restoring an
export into production is a data migration and needs a reviewed plan, a
maintenance window, and explicit owner approval. Time Travel is the preferred
whole-database recovery mechanism when its retention window covers the event.

## Scheduled cleanup and R2

The daily production cron runs expired-upload cleanup. It deletes R2 objects
before deleting their D1 rows, so a failed object deletion remains retryable on
the next cron. Investigate `cron.sweep_failed` and the event-specific failure
logs before manually deleting anything.

```bash
# operator-run: stream structured cron failures from the deployed Worker
npx wrangler tail --env production --format json --search cron.sweep_failed

# operator-run: inspect an expired pending-upload row before remediation
npx wrangler d1 execute app-db-prod --remote --command \
  "SELECT id, r2_key, expires_at FROM pending_uploads WHERE expires_at <= <unix-milliseconds>;"

# operator-run: verify one expected object exists without exposing it publicly
npx wrangler r2 object get app-support-uploads-prod/<object-key> --remote \
  --file /tmp/upload-verification.bin
```

Do not run a broad R2 deletion to "clean up" failed uploads. Use the row and
object key from the investigation, preserve incident evidence, and let the
scheduled sweep retry whenever possible.

## Secrets and credential rotation

Rotation is a deploy operation: replace the remote secret, deploy compatible
code if needed, then validate the affected flow. `ATTACHMENT_TOKEN_SECRET`
rotation intentionally invalidates existing attachment tokens; communicate that
impact before rotation. Rotate the Shopify app secret in the Shopify Dev
Dashboard as a coordinated change, then update the Worker secret immediately.

```bash
# operator-run: interactive replacement; repeat for every affected secret
npx wrangler secret put SHOPIFY_API_SECRET --env production
npx wrangler secret put ATTACHMENT_TOKEN_SECRET --env production
npx wrangler secret put INTERNAL_SESSION_SECRET --env production

# operator-run: verifies names only, never values
npx wrangler secret list --env production
```

Revoking or rotating `SHOPIFY_PARTNER_API_TOKEN` also requires updating the
Partner-side credential. Never log a secret to prove that rotation succeeded;
use the application flow and secret-name listing instead.

## Webhook DLQ investigation and replay

The deployment declares `shopify-webhooks-prod` with
`shopify-webhooks-dlq-prod` as its dead-letter queue. Wrangler can report queue
metadata and attach or remove a consumer, but it does not offer a generic
command to inspect individual messages or replay selected messages. Treat the
payload as potentially sensitive and use the Cloudflare dashboard, approved log
access, and the webhook delivery record for diagnosis.

```bash
# operator-run: inspect backlog and consumer configuration
npx wrangler queues info shopify-webhooks-dlq-prod
npx wrangler queues consumer list shopify-webhooks-dlq-prod

# operator-run, changes delivery: attach an approved replay Worker temporarily
npx wrangler queues consumer add shopify-webhooks-dlq-prod <replay-worker-name> \
  --batch-size 1 --max-concurrency 1

# operator-run, changes delivery: remove that temporary consumer after the replay window
npx wrangler queues consumer remove shopify-webhooks-dlq-prod <replay-worker-name>
```

Do not attach the production Worker as a replay consumer until an engineer has
verified that the deployed handler accepts the stored message shape and that
the webhook delivery state machine will make replay idempotent. Record the
delivery IDs, operator, start/end time, and outcome. Never purge the DLQ as an
incident response step; that discards the evidence and work to recover.

## Routine checks

Run the release checks before every deployment and retain their output with the
release record. Alert on Worker errors, `cron.sweep_failed`, webhook dead-letter
growth, queue backlog, and backup/export failures. Thresholds, paging routes,
and dashboard ownership are organization-specific decisions that must be set by
the adopting team.

```bash
npm run cf-typegen
npm run verify
CLOUDFLARE_ENV=production npm run build
npm run check:placeholders
```
