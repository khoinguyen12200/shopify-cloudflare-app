import { z } from "zod";

/**
 * `app/scopes_update` payload — https://shopify.dev/changelog/new-webhook-topic-app-scopes_update
 * Only `current` is used; `previous`/`id`/`updated_at` are not needed here.
 */
export const scopesUpdatePayloadSchema = z.object({
  current: z.array(z.string()),
});

/**
 * `app_subscriptions/update` payload — shape confirmed against the current
 * webhooks reference. `plan_handle`/`interval`/`capped_amount` are absent for a
 * plain recurring charge with no usage pricing or Managed Pricing plan yet.
 */
export const appSubscriptionUpdatePayloadSchema = z.object({
  app_subscription: z.object({
    admin_graphql_api_id: z.string(),
    name: z.string(),
    status: z.enum([
      "ACTIVE",
      "CANCELLED",
      "PENDING",
      "DECLINED",
      "EXPIRED",
      "FROZEN",
      "ACCEPTED",
    ]),
    currency: z.string(),
    price: z.string(),
    capped_amount: z.string().optional(),
    interval: z.string().optional(),
    plan_handle: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});
