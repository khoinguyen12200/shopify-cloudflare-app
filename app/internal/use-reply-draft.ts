import { useCallback, useRef, useState } from "react";
import type { ReplyTone } from "~/ai/tones";

/**
 * Rewrites what is in the reply box, in a chosen tone, streaming as it goes.
 *
 * The draft REPLACES the text rather than appending to it, because that is what
 * the feature is: the staff member decided what to say, and the model is
 * choosing better words for the same thing. Appending would leave them holding
 * both versions and deleting one.
 *
 * The box is written by ASSIGNMENT from a locally accumulated string rather than
 * `+=` on the live value, so the field always holds exactly what arrived and
 * nothing can interleave into it.
 *
 * A second run cannot start while one is in flight. The guard is a ref, not
 * state, so it is set synchronously on the click rather than on the next
 * render, which is the window a double-fire would otherwise slip through.
 */
export type DraftState = "idle" | "drafting" | "error";

export function useReplyDraft(textareaId: string) {
  const [state, setState] = useState<DraftState>("idle");
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const draft = useCallback(
    async (input: { ticketId: string; tone: ReplyTone; instruction: string }) => {
      const target = document.getElementById(textareaId);
      if (!(target instanceof HTMLTextAreaElement)) return;
      // Synchronous, so a second click in the same tick cannot get past it.
      if (running.current) return;
      running.current = true;

      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      setState("drafting");
      setError(null);

      // The text being rewritten is read BEFORE the box is cleared.
      const currentText = target.value;

      const body = new FormData();
      body.set("ticketId", input.ticketId);
      body.set("currentText", currentText);
      body.set("instruction", input.instruction);
      body.set("tone", input.tone);

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

        let draft = "";
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          draft += value;
          // Assignment, never `+=` on the element — see the note above.
          target.value = draft;
          target.scrollTop = target.scrollHeight;
        }

        // A model that returned nothing must not wipe what they wrote.
        if (draft.trim() === "") {
          target.value = currentText;
          setError("The model returned nothing. Your text is unchanged.");
          setState("error");
          return;
        }

        setState("idle");
      } catch (cause) {
        // Restore rather than leave them with a half-written rewrite.
        target.value = currentText;
        if (controller.signal.aborted) {
          setState("idle");
          return;
        }
        setError(cause instanceof Error ? cause.message : "The rewrite could not be written.");
        setState("error");
      } finally {
        running.current = false;
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
    case "forbidden":
      return "This shop's plan does not include AI.";
    case "not_configured":
      return "Workers AI is not available in this environment.";
    case "rate_limited":
      return "Too many rewrites just now. Try again in a moment.";
    case "timeout":
      return "The model took too long. Try again.";
    default:
      return "The rewrite could not be written. Your text is unchanged.";
  }
}
