/**
 * The conversation itself: one bubble per message, merchant on one side and
 * support on the other.
 *
 * Hand-styled rather than assembled from Polaris boxes, for the same reason the
 * billing plan cards are: Polaris web components expose no font-size control
 * and no way to align a subtree to one edge, and a support thread that does not
 * visually separate "you" from "us" is materially harder to read than one that
 * does. Colours are declared in both schemes rather than hardcoded once.
 */
export interface ThreadMessage {
  id: string;
  author: "merchant" | "staff";
  authorName: string;
  body: string;
  createdAt: number;
  attachments: {
    id: string;
    filename: string;
    contentType: string;
    url: string;
    isVideo: boolean;
  }[];
}

export const THREAD_CSS = `
.sup-thread { display: flex; flex-direction: column; gap: 1rem;
  --sup-mine: #eef3ff;
  --sup-mine-border: #cddcff;
  --sup-theirs: #f5f5f5;
  --sup-theirs-border: #e3e3e3;
  --sup-meta: #616161;
}
@media (prefers-color-scheme: dark) {
  .sup-thread {
    --sup-mine: rgba(120,160,255,0.13);
    --sup-mine-border: rgba(120,160,255,0.32);
    --sup-theirs: rgba(255,255,255,0.06);
    --sup-theirs-border: rgba(255,255,255,0.14);
    --sup-meta: #a5a5a5;
  }
}
.sup-msg { display: flex; }
.sup-msg--mine { justify-content: flex-end; }
.sup-msg__bubble {
  max-inline-size: min(82%, 34rem);
  padding: 0.75rem 0.875rem;
  border-radius: 14px;
  border: 1px solid var(--sup-theirs-border);
  background: var(--sup-theirs);
}
.sup-msg--mine .sup-msg__bubble {
  border-color: var(--sup-mine-border);
  background: var(--sup-mine);
}
.sup-msg__head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-block-end: 0.25rem;
  font-size: 0.75rem;
  color: var(--sup-meta);
}
.sup-msg__who { font-weight: 650; }
/* pre-wrap, so a merchant's line breaks and pasted log output survive. */
.sup-msg__body { font-size: 0.875rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.sup-msg__files { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block-start: 0.5rem; }
.sup-msg__file { display: block; border-radius: 10px; overflow: hidden; max-inline-size: 12rem; }
.sup-msg__file img, .sup-msg__file video { display: block; inline-size: 100%; block-size: auto; }
`;

export function Thread({
  messages,
  youLabel,
  formatWhen,
}: {
  messages: readonly ThreadMessage[];
  /** What to call the merchant's own messages — "You", translated. */
  youLabel: string;
  formatWhen: (at: number) => string;
}) {
  return (
    <div className="sup-thread">
      {messages.map((message) => {
        const mine = message.author === "merchant";
        return (
          <div
            key={message.id}
            className={mine ? "sup-msg sup-msg--mine" : "sup-msg"}
          >
            <div className="sup-msg__bubble">
              <div className="sup-msg__head">
                <span className="sup-msg__who">
                  {mine ? youLabel : message.authorName}
                </span>
                <span>{formatWhen(message.createdAt)}</span>
              </div>

              {message.body && <div className="sup-msg__body">{message.body}</div>}

              {message.attachments.length > 0 && (
                <div className="sup-msg__files">
                  {message.attachments.map((file) =>
                    file.isVideo ? (
                      // Playable in place: making someone download a screen
                      // recording to see it defeats the point of attaching one.
                      <video
                        key={file.id}
                        className="sup-msg__file"
                        src={file.url}
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <a
                        key={file.id}
                        className="sup-msg__file"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={file.url} alt={file.filename} loading="lazy" />
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
