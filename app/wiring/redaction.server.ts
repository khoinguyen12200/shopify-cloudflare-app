import { shopHasher } from "~/adapters/shop-hasher";
import { RedactedShopRepo } from "~/models/redacted-shops.server";
import { createRedactionGuard, type RedactionGuard } from "~/services/redaction-guard";

/** The one binding of the tombstone repository and hasher to the guard that every intake path consults. */
export function redactionGuard(): RedactionGuard {
  return createRedactionGuard({ hasher: shopHasher, tombstones: new RedactedShopRepo() });
}
