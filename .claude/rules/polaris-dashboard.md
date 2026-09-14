---
description: Rules for merchant-facing dashboard pages in the embedded Shopify admin. Use the checked-in docs/polaris templates and compositions as the source for layout and component choices.
globs:
  - "app/routes/app/**"
alwaysApply: true
---

# Polaris dashboard pages

Before changing a dashboard, read the matching template and composition examples
in `docs/polaris/patterns/templates/homepage.md` and
`docs/polaris/patterns/compositions/`: use the Homepage template for a merchant
landing screen, Metrics card for the first summary row, and Index table for a
manageable collection. Search the component reference under
`docs/polaris/web-components/` for every element used. The live Shopify lookup and the installed
`@shopify/polaris-types` manifest remain authoritative when the checked-in guide
and the package differ.

Use `<s-page inlineSize="large">` for dashboards and keep each
`<s-section>` as a direct child of the page. Put responsive columns in
`<s-grid>` with an explicit `gridTemplateColumns`, and use `<s-stack>` for
vertical or inline groups whose children size to their content. Cards are
`<s-box border="base" borderRadius="base" padding="base">`; do not add CSS or
inline spacing to imitate Polaris.

Dashboard metrics must have a translated label, a locale-formatted value, and
comparison context only when the comparison is meaningful. Money is passed to
`formatMoney` as integer minor units plus its currency, and counts go through
`formatNumber`. All visible copy, including table headings, activity labels, and
placeholder names, belongs in the `admin` translation namespace for every
supported locale.

Keep the page useful when data is empty: use the documented empty-state
composition with one clear next action instead of rendering an empty table.
Page-level actions belong in `primary-action` or `secondary-actions` slots;
record edits use the save bar. Validate every new Polaris element and prop with
the App Home skill validator before considering the route complete. A checklist
may use `s-checkbox` for merchant actions; keep expansion controls separate so
checking a step never accidentally opens or closes its details.
