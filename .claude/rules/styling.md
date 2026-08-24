---
description: How the PUBLIC pages are styled — SCSS only, every value from a token, mobile-first, dark mode and reduced motion honoured. Does not apply to the embedded Shopify admin, which is Polaris. Apply when writing or editing any stylesheet or public page markup.
globs:
  - "app/styles/**"
  - "app/routes/public/**"
  - "**/*.scss"
  - "**/*.css"
alwaysApply: true
---

# Styling the public pages

## Three surfaces, three systems — never mix them

| Surface | Styled with | Loaded by |
|---|---|---|
| **Public** — landing, pricing, legal, support, errors | **SCSS** in `app/styles/public/` | `app/routes/public/_layout.tsx` `links()` |
| **Embedded Shopify admin** (`/app/**`) | **Polaris web components** + App Bridge | `AppProvider` |
| **Internal staff console** (`/internal/**`) | **Tailwind v4 + ngk-dashboard** | `app/routes/internal/_layout.tsx` and `login.tsx` `links()` |

`@rules/shopify-and-ui.md` bans hand-rolled CSS in the *merchant admin*, and that
still holds: never style the embedded app yourself. This file governs the other
two, which are not embedded and have no Polaris.

Why three and not one: the merchant admin must look like Shopify, the public
pages must be fast and brandable with no framework, and the staff console wants a
component library so internal tooling is cheap to build. Mixing them would ship a
CSS reset into the Polaris iframe.

**Tailwind is confined to `/internal`.** It only affects CSS that
`@import "tailwindcss"`, which is only
`app/styles/internal/internal.tailwind.css`. Never add that import anywhere else,
and never use a Tailwind utility class in a public or admin route. The internal
stylesheet also uses `source(none)` with explicit `@source` globs — without them
Tailwind resolves its scan base inconsistently for a `?url` import and silently
generates no utilities.

**A stylesheet is loaded by exactly one layout's `links()`, never by `root.tsx`.**
That is what keeps the public reset out of the admin iframe. A global import
would ship a CSS reset into Polaris and quietly break it.

## SCSS, not CSS

`.scss` everywhere. Plain `.css` files and CSS modules are not used on the public
surface — one system, so a value is defined once.

- **`@use`, never `@import`.** Sass's `@import` is deprecated and leaks
  everything into one namespace. Namespace it: `@use "mixins" as m;`.
- Partials are `_name.scss`; only `public.scss` is a real entry point.
- Nesting stops at **three levels**, and `&`-concatenation to invent class names
  (`&__title`) is fine — grepping for the literal class must still find it.

## Every value comes from a token

`app/styles/public/_tokens.scss` is the single source of colour, spacing, type,
radius, shadow, breakpoint and motion.

**A literal colour, spacing value, font size, or breakpoint written inside a page
is a defect.** It drifts from every other page and cannot be themed. Add or reuse
a token.

- **Colours are CSS custom properties** (`var(--color-text-muted)`), because
  light/dark swap them at runtime. Never a hex code outside `_tokens.scss`.
- **Sizes and breakpoints are Sass variables/maps**, because media queries and
  arithmetic need them at compile time. Reach them through `m.space()`,
  `m.text()` and `m.mq()` — those *fail the build* on a typo, where a raw
  `map.get` silently emits nothing.
- Semantic names only: `--color-text-muted`, not `--color-grey-500`. If you
  cannot name a token semantically, you are describing a one-off, not a token.

## Mobile-first and responsive by default

- **Every query is `min-width`, via `@include m.mq("md")`.** No raw
  `@media`, no `max-width`, no breakpoint outside the map.
- Prefer layouts that need no breakpoint at all: `m.auto-grid()`,
  `flex-wrap`, `clamp()` for fluid type. A breakpoint is a last resort.
- **The page body never scrolls horizontally.** Wide content — tables, code,
  diagrams — scrolls inside its own `overflow-x: auto` container.
- Use logical properties (`padding-inline`, `margin-block`,
  `inset-inline-start`) so the layout survives a right-to-left locale.
- Interactive targets are at least **2.75rem** tall.

## Dark mode is not optional

Every public page works in both themes. `_tokens.scss` defines it in three
layers, and all three are required:

1. `:root` — the **complete** light palette, so every token has a value with no
   media query and no attribute in play.
2. `@media (prefers-color-scheme: dark)` guarded by
   `:root:not([data-theme="light"])` — the OS preference, which an explicit light
   choice overrides.
3. `:root[data-theme="dark"]` — an explicit choice, which wins in both
   directions.

**Never give a colour its only definition inside a media query or attribute
block.** Redefine tokens there; never introduce them.

## Accessibility is part of the style, not a pass afterwards

- **`:focus-visible`, never `:focus`**, and never `outline: none` without a
  replacement. One treatment for the whole site: `@include m.focus-ring`.
- Every public page has the skip link (the layout provides it).
- Wrap transitions and animations in `@include m.motion-safe`, and keep the
  `prefers-reduced-motion: reduce` block in `_reset.scss` intact.
- Content is hidden from sight with `@include m.visually-hidden`, never
  `display: none`, when a screen reader still needs it.

## Where a style lives

- Shared across pages → `_layout.scss` (containers, sections, shell) or
  `_components.scss` (buttons, fields, notices, badges).
- **Used by one page → that page's own `*.module.scss` beside the route.** Do not
  grow the shared files with one-offs.
- Bare element defaults → `_base.scss`. Normalisation → `_reset.scss`. Nothing
  else touches bare selectors.

Inline `style={{…}}` is for a genuinely dynamic value only (a computed width, a
progress percentage). A static value inline is a missing class.
