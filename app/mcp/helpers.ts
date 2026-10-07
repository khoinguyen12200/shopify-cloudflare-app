import { hasRequiredScope } from "~/domain/mcp/scopes";
import { recordAuditLog } from "~/services/mcp/audit.server";

export interface McpActorContext {
  readonly actorEmail: string;
  readonly actorType: "staff_pat" | "oauth_agent";
  readonly transport: "http" | "stdio";
  readonly tokenId?: string | null;
  readonly clientId?: string | null;
  readonly scopes: readonly string[];
}

export const READ_ONLY = {
  readOnlyHint: true,
} as const;

export const MUTATION = {
  readOnlyHint: false,
} as const;

/** Wrap a read-only tool handler with permission checking and audit logging. */
export function mcpRead<TInput extends Record<string, unknown>, TOutput>(
  toolName: string,
  requiredScope: string,
  ctx: McpActorContext,
  handler: (args: TInput) => Promise<TOutput>,
) {
  return async (args: TInput) => {
    if (!hasRequiredScope(ctx.scopes, requiredScope)) {
      throw new Error(`Forbidden: missing required scope '${requiredScope}'`);
    }

    const start = Date.now();
    let ok = true;
    let errorMessage: string | null = null;
    let shop: string | null = null;

    if ("shop" in args && typeof args.shop === "string") {
      shop = args.shop;
    }

    try {
      const result = await handler(args);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      ok = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      recordAuditLog({
        tokenId: ctx.tokenId,
        clientId: ctx.clientId,
        actorEmail: ctx.actorEmail,
        actorType: ctx.actorType,
        toolName,
        shop,
        isMutation: false,
        ok,
        latencyMs,
        errorMessage,
      }).catch(() => {});
    }
  };
}

/** Wrap a mutating tool handler with permission checking and audit logging. */
export function mcpMutation<TInput extends Record<string, unknown>, TOutput>(
  toolName: string,
  requiredScope: string,
  ctx: McpActorContext,
  handler: (args: TInput) => Promise<TOutput>,
) {
  return async (args: TInput) => {
    if (!hasRequiredScope(ctx.scopes, requiredScope)) {
      throw new Error(`Forbidden: missing required scope '${requiredScope}'`);
    }

    const start = Date.now();
    let ok = true;
    let errorMessage: string | null = null;
    let shop: string | null = null;

    if ("shop" in args && typeof args.shop === "string") {
      shop = args.shop;
    }

    try {
      const result = await handler(args);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      ok = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      recordAuditLog({
        tokenId: ctx.tokenId,
        clientId: ctx.clientId,
        actorEmail: ctx.actorEmail,
        actorType: ctx.actorType,
        toolName,
        shop,
        isMutation: true,
        ok,
        latencyMs,
        errorMessage,
      }).catch(() => {});
    }
  };
}
