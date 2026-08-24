// ─────────────────────────────────────────────────────────────────────────────
// Design tokens for EMAIL.
//
// WHY THIS IS NOT SCSS. Email clients strip `<style>` blocks and ignore external
// stylesheets, so every rule has to be an inline `style` attribute on the element
// itself. There is no stylesheet for SCSS to compile into — which is why React
// Email works in style objects, and why this file holds literal values rather
// than `var(--color-accent)` (custom properties are equally unsupported).
//
// It therefore MIRRORS the public site's light palette in
// `app/styles/public/_tokens.scss`, so an email looks like the site it came
// from. That mirroring is enforced by `tokens.test.ts`, which reads the SCSS and
// fails the build if the two drift — the alternative is two palettes that agree
// on the day they are written and never again.
//
// Light values only: no email client implements `prefers-color-scheme` reliably,
// and a half-applied dark palette is worse than a light one everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  /** --color-bg-subtle: the page behind the card. */
  page: "#f7f7f8",
  /** --color-surface */
  card: "#ffffff",
  /** --color-text */
  text: "#18181b",
  /** --color-text-muted */
  muted: "#5b5b66",
  /** --color-border */
  line: "#e4e4e7",
  /** --color-accent */
  accent: "#4f46e5",
  /** --color-accent-text */
  accentText: "#ffffff",
} as const;

/**
 * A web-safe stack. No @font-face and no Google Fonts link: most clients block
 * remote fonts, and the fallback is what most recipients would see anyway.
 */
export const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared style objects, so no template writes a raw hex or spacing value. */
export const styles = {
  body: {
    backgroundColor: palette.page,
    fontFamily: fontStack,
    margin: 0,
    padding: "24px 12px",
  },
  card: {
    backgroundColor: palette.card,
    border: `1px solid ${palette.line}`,
    borderRadius: "12px",
    maxWidth: "520px",
    margin: "0 auto",
    padding: "32px",
  },
  brand: {
    color: palette.accent,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 12px",
  },
  heading: {
    color: palette.text,
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "1.25",
    margin: "0 0 12px",
  },
  text: {
    color: palette.text,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 12px",
  },
  muted: {
    color: palette.muted,
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "0 0 12px",
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: "8px",
    color: palette.accentText,
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 22px",
    textDecoration: "none",
  },
  buttonSection: { margin: "20px 0" },
  fallback: {
    color: palette.muted,
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0 0 12px",
    wordBreak: "break-all" as const,
  },
  hr: { borderColor: palette.line, margin: "24px 0 16px" },
  footer: { color: palette.muted, fontSize: "12px", margin: 0 },
  logo: {
    display: "block",
    height: "32px",
    width: "auto",
    margin: "0 0 12px",
  },
} as const;
