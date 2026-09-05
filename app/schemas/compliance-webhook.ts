import { z } from "zod";

/** Shopify compliance webhook payloads are JSON objects, never primitives. */
export const compliancePayloadSchema: z.ZodType<Record<string, unknown>> =
  z.record(z.string(), z.unknown());
