# Phase 4 report

## Status

Completed legacy billing reader removal and projection migration.

## Changes

- Internal dashboard, shops, subscriptions, and support views now read normalized `shops`, `shop_subscriptions`, `shop_subscription_items`, and `shopify_*` history projections.
- Dashboard MRR preserves integer minor-unit money, annual normalization, multi-currency separation, and multiple current pricing items.
- Removed legacy parser, repository, tests, and billing schema export.
- Added forward migration `drizzle/0012_petite_legion.sql` to copy safe legacy rows then drop `subscription_events`.
- Legacy rows migrate only when shop has authoritative `shopify_shop_id` and recognized status; malformed or unverifiable rows are skipped.

## Verification

- `npm run db:migrate:local` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Focused projection/render tests: 4 files, 20 tests passed.
- Full test suite: 86 files, 817 tests passed.

## Concerns

- Migration intentionally skips legacy rows without authoritative Shopify shop IDs or supported statuses; no entitlement is fabricated.
- Normalized runtime table `shopify_subscription_events` remains by design. Legacy `subscription_events` exists only in migration history.
