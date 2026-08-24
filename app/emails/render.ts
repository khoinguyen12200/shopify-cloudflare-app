import { render } from "@react-email/render";
import type { ReactElement } from "react";

/** A fully rendered email: HTML for real clients, plain text as the alternative. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render one JSX template into BOTH parts — the only way an email is built here.
 *
 * The text part comes from the same element as the HTML, so the two cannot drift.
 * The alternative, converting the HTML back to text with a regex, guesses at
 * structure it has already lost. And a message with no text part is penalised by
 * essentially every spam filter, so this is deliverability, not tidiness.
 */
export async function renderEmail(
  subject: string,
  element: ReactElement,
): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject, html, text };
}
