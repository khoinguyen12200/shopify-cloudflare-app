/**
 * Unified Facade for Internal Operations.
 *
 * Exposes cohesive high-level domain operations to all consumer surfaces:
 * - Internal Admin UI (/internal/*)
 * - Automation & MCP Server (/api/mcp)
 * - Public & Internal REST APIs (/api/v1/*)
 *
 * Implements the Facade Pattern (Clean Architecture: entry -> adapters -> use cases -> ports -> core).
 * Splitting operations across modular files (support-ops, shop-ops, metrics-ops) satisfies the
 * line limit caps while preserving a single import entry point for the rest of the application.
 */

export * from "./support-ops.server";
export * from "./shop-ops.server";
export * from "./metrics-ops.server";
