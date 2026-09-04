import { afterEach, describe, expect, it, vi } from "vitest";
import { writeDraftStream } from "./ai-draft";

interface ControllerCall {
  readonly chunks: string[];
  readonly closed: boolean;
}

function controller(): ControllerCall & {
  readonly target: {
    enqueue(chunk: Uint8Array): void;
    close(): void;
  };
} {
  const state: { chunks: string[]; closed: boolean } = { chunks: [], closed: false };
  const target = {
    enqueue(chunk: Uint8Array) {
      state.chunks.push(new TextDecoder().decode(chunk));
    },
    close() {
      state.closed = true;
    },
  };
  return Object.assign(state, { target });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeDraftStream", () => {
  it("keeps the partial draft and reports a stream cancellation failure", async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    const output = controller();

    async function* interruptedStream(): AsyncIterable<string> {
      yield "partial";
      throw new Error("provider stream closed");
    }

    await writeDraftStream(interruptedStream(), output.target, "ticket-42");

    expect(output.chunks).toEqual(["partial"]);
    expect(output.closed).toBe(true);
    expect(errors).toEqual([[JSON.stringify({
      event: "ai.draft_cancel_failed",
      ticketId: "ticket-42",
      error: "provider stream closed",
    })]]);
  });
});
