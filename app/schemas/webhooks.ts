import { z } from "zod";

/**
 * `app/scopes_update` payload — https://shopify.dev/changelog/new-webhook-topic-app-scopes_update
 * Only `current` is used; `previous`/`id`/`updated_at` are not needed here.
 */
export const scopesUpdatePayloadSchema = z.object({
  current: z.array(z.string()),
});
