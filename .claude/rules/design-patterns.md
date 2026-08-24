---
description: Situation → required pattern. Mandatory at these seams, forbidden as speculative ceremony anywhere else. Apply when designing any module, use case, or extension point.
globs:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "workers/**/*.ts"
alwaysApply: true
---

# Design patterns

Same kind of problem, same solution, every time — that is what makes this
codebase extendable instead of merely working. Meet one of these situations and
you use the named pattern; "I'll just add an `if`" is not an option.

The counterweight: **do not apply a pattern to a seam not listed here.** No
abstract base class for one implementation, no interface with one caller, no
factory returning one thing, no event bus for a direct call. Invented ceremony is
as much a violation as a missing pattern.

| Situation | Required pattern |
|---|---|
| Reading or writing D1 | **Repository** — `app/models/*.server.ts`, shop-scoped |
| Behavior varies by a stored type string (webhook topics, form intents, rule kinds, plan tiers) | **Strategy + Registry** — see below |
| Calling Shopify, email, queue, clock, id generation | **Port & Adapter** — narrow interface in `app/ports/`, adapter in `app/adapters/`, fake in `app/test/` |
| Wiring adapters to ports | **Composition root** — `app/wiring.server.ts` only, called from ring 5 |
| Expected, non-exceptional failure | **Result** — `{ ok: false, reason }`, never a throw as flow control |
| A route action with multiple intents | **Command dispatch** — `Record<Intent, Handler>`, action is a thin `dispatch()` |
| A webhook or queue consumer | **Idempotency guard** — stable key, claim it, return early, *before* any side effect |
| A record with a lifecycle (anything with a `status` column) | **State machine** — transitions declared as data, one `transition()` funnel, illegal transitions rejected |
| Any business decision | **Functional core** — pure function; the shell only awaits I/O and calls it |
| A cached read | **KV under a shop-scoped key**, with explicit invalidation at the write site |
| Test setup | **Factory** — `app/test/factories.ts` |

## The registry, concretely

Webhook topics, form intents, and any "kind" column stored in D1 all use this.

```ts
// Each handler is pure, in its own file.
export const productsUpdate: TopicHandler = (payload, ctx) => { … }

// One static literal map, keyed by a union type.
export const handlers: Record<WebhookTopic, TopicHandler> = {
  "products/update": productsUpdate,
  "app/uninstalled": appUninstalled,
}

const handler = handlers[topic]
if (!handler) return unknownTopic(topic)   // never throw, never crash
```

- Keyed by a **union type**, so TypeScript fails the build when a variant is
  added without a handler. Never `Record<string, …>`.
- **Unknown keys are handled explicitly.** Stored data outlives code; a row with
  a retired type must degrade predictably.
- Registration is a **static literal map** — no runtime `register()` calls, which
  do not survive tree-shaking or the isolate model.
- **Acceptance test: adding a variant touches one new file, one map entry, one
  test.** If your change also edits the dispatcher, you applied it wrong.

## Before you finish

Answer out loud: **where does the next variant go?** If the answer is "edit this
function", restructure it into a registry now. Extensibility that requires
editing existing logic is not extensibility.
