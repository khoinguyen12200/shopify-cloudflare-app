/**
 * Font <link>s for the internal console. Loaded via each internal route's
 * `links()`, so they only ship while an internal route is matched.
 */
export const INTERNAL_FONT_LINKS = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous" as const,
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
];
