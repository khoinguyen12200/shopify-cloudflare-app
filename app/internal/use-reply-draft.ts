import { useCallback, useRef, useState } from "react";

/**
 * Streams a drafted reply into a textarea, token by token.
 *
 * A `fetch` and a reader rather than `useCompletion` from `@ai-sdk/react`: the
 * target is an existing uncontrolled `<textarea>` that a staff member is about
 * to edit and submit through a plain form. Handing that textarea's value to a
 * hook would make the form controlled, and the draft is a starting point, not
 * state the app owns.
 *
 * The draft is APPENDED to whatever is already typed, never a replacement — a
 * staff member who wrote two sentences and then asked for help should not lose
 * them.
 */
export type DraftState = "idle" | "drafting" | "error";

export function useReplyDraft(textareaId: string) {
  const [state, setState] = useState<DraftState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const draft = useCallback(
    async (ticketId: string) => {
      const target = document.getElementById(textareaId);
      if (!(target instanceof HTMLTextAreaElement)) return;

      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      setState("drafting");
      setError(null);

      const body = new FormData();
      body.set("ticketId", ticketId);

      try {
        const response = await fetch("/internal/ai/draft", {
          method: "POST",
          body,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setError(messageFor(await response.text().catch(() => "")));
          setState("error");
          return;
        }

        // Separated from anything already typed, so an appended draft never
        // runs into the end of a half-written sentence.
        if (target.value.trim() !== "") target.value += "\n\n";

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          target.value += value;
          // Keep the newest text in view while it arrives.
          target.scrollTop = target.scrollHeight;
        }

        setState("idle");
      } catch (cause) {
        // An abort is the staff member pressing the button again, not a failure.
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "The draft could not be written.");
        setState("error");
      }
    },
    [textareaId],
  );

  return { state, error, draft };
}

/** The endpoint answers with an `AiFailureReason`; turn it into one sentence. */
function messageFor(reason: string): string {
  switch (reason.trim()) {
    case "no_model":
      return "No model is set for writing yet — choose one under AI.";
    case "not_configured":
      return "Workers AI is not available in this environment.";
    case "rate_limited":
      return "Too many drafts just now. Try again in a moment.";
    case "timeout":
      return "The model took too long. Try again.";
    default:
      return "The draft could not be written. Write the reply yourself, or try again.";
  }
}
