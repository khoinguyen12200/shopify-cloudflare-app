import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { buildMcpServer } from "./registry";
import type { McpActorContext } from "./helpers";

type AnyMessage = JSONRPCMessage & {
  id?: string | number | null;
  method?: string;
};

function isRequest(m: unknown): m is AnyMessage {
  return (
    m !== null &&
    typeof m === "object" &&
    "method" in m &&
    "id" in m &&
    (m as AnyMessage).id !== undefined &&
    (m as AnyMessage).id !== null
  );
}

const DISPATCH_TIMEOUT_MS = 60_000;

/**
 * Stateless Streamable-HTTP MCP dispatch over a Fetch-native request body.
 *
 * Runs an McpServer over an InMemoryTransport pair: pushes the incoming JSON-RPC
 * message(s) in and collects the matching responses out. Fully protocol-compliant
 * for JSON-RPC methods (initialize, tools/list, tools/call).
 */
export async function dispatchHttpMcp(
  body: unknown,
  ctx: McpActorContext,
): Promise<{ status: number; body?: unknown }> {
  const messages: unknown[] = Array.isArray(body) ? body : [body];
  const pendingIds = new Set(
    messages.filter(isRequest).map((m) => (m as AnyMessage).id),
  );

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(ctx);

  const responses: AnyMessage[] = [];
  const collected = new Promise<void>((resolve) => {
    if (pendingIds.size === 0) {
      resolve();
      return;
    }
    clientSide.onmessage = (msg: AnyMessage) => {
      if (msg && msg.id !== undefined && msg.id !== null && pendingIds.has(msg.id)) {
        responses.push(msg);
        pendingIds.delete(msg.id);
        if (pendingIds.size === 0) resolve();
      }
    };
  });

  try {
    await server.connect(serverSide);
    await clientSide.start();

    for (const m of messages) {
      await clientSide.send(m as JSONRPCMessage);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("MCP dispatch timed out")),
        DISPATCH_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([collected, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } finally {
    await server.close().catch(() => {});
    await clientSide.close().catch(() => {});
  }

  if (responses.length === 0) return { status: 202 };
  return { status: 200, body: Array.isArray(body) ? responses : responses[0] };
}
