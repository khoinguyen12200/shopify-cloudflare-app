# Shopify App Home reference

Full Markdown reference mirrored from Shopify's official App Home `latest` documentation for fast local agent search.

- Source: https://shopify.dev/docs/api/app-home/latest
- Synced: 2026-09-14T14:58:19.941Z
- Pages: 70
- Refresh: `npm run docs:polaris:sync`

## Agent lookup workflow

1. Search by task, element, prop, or slot with `rg`.
2. Open the matching page template and composition before choosing markup.
3. Open the exact reference page for every web component used; check properties, slots, events, methods, examples, and accessibility guidance.
4. Use `manifest.json` to confirm the canonical source URL and sync metadata.
5. Run the Shopify App Home skill's live lookup and validator before shipping code.

Search examples:

```bash
rg -n "gridTemplateColumns|Slots|Examples" docs/polaris/web-components
rg -n "resource picker|save bar" docs/polaris
```

## Overview

- [App Home](./overview.md)

## web components

- [Button group](./web-components/actions/button-group.md)
- [Button](./web-components/actions/button.md)
- [Clickable chip](./web-components/actions/clickable-chip.md)
- [Clickable](./web-components/actions/clickable.md)
- [Link](./web-components/actions/link.md)
- [Menu](./web-components/actions/menu.md)
- [Badge](./web-components/feedback-and-status-indicators/badge.md)
- [Banner](./web-components/feedback-and-status-indicators/banner.md)
- [Spinner](./web-components/feedback-and-status-indicators/spinner.md)
- [Checkbox](./web-components/forms/checkbox.md)
- [Choice list](./web-components/forms/choice-list.md)
- [Color field](./web-components/forms/color-field.md)
- [Color picker](./web-components/forms/color-picker.md)
- [Date field](./web-components/forms/date-field.md)
- [Date picker](./web-components/forms/date-picker.md)
- [Drop zone](./web-components/forms/drop-zone.md)
- [Email field](./web-components/forms/email-field.md)
- [Money field](./web-components/forms/money-field.md)
- [Number field](./web-components/forms/number-field.md)
- [Password field](./web-components/forms/password-field.md)
- [Search field](./web-components/forms/search-field.md)
- [Select](./web-components/forms/select.md)
- [Switch](./web-components/forms/switch.md)
- [Text area](./web-components/forms/text-area.md)
- [Text field](./web-components/forms/text-field.md)
- [URL field](./web-components/forms/url-field.md)
- [Box](./web-components/layout-and-structure/box.md)
- [Divider](./web-components/layout-and-structure/divider.md)
- [Grid](./web-components/layout-and-structure/grid.md)
- [Ordered list](./web-components/layout-and-structure/ordered-list.md)
- [Page](./web-components/layout-and-structure/page.md)
- [Query container](./web-components/layout-and-structure/query-container.md)
- [Section](./web-components/layout-and-structure/section.md)
- [Stack](./web-components/layout-and-structure/stack.md)
- [Table](./web-components/layout-and-structure/table.md)
- [Unordered list](./web-components/layout-and-structure/unordered-list.md)
- [Avatar](./web-components/media-and-visuals/avatar.md)
- [Icon](./web-components/media-and-visuals/icon.md)
- [Image](./web-components/media-and-visuals/image.md)
- [Thumbnail](./web-components/media-and-visuals/thumbnail.md)
- [Modal](./web-components/overlays/modal.md)
- [Popover](./web-components/overlays/popover.md)
- [Web components](./web-components/README.md)
- [Chip](./web-components/typography-and-content/chip.md)
- [Heading](./web-components/typography-and-content/heading.md)
- [Paragraph](./web-components/typography-and-content/paragraph.md)
- [Text](./web-components/typography-and-content/text.md)
- [Tooltip](./web-components/typography-and-content/tooltip.md)

## app bridge web components

- [App nav](./app-bridge-web-components/app-nav.md)
- [App window](./app-bridge-web-components/app-window.md)
- [App Bridge web components](./app-bridge-web-components/README.md)
- [Save bar](./app-bridge-web-components/save-bar.md)
- [Title bar](./app-bridge-web-components/title-bar.md)

## patterns

- [Account connection](./patterns/compositions/account-connection.md)
- [App card](./patterns/compositions/app-card.md)
- [Callout card](./patterns/compositions/callout-card.md)
- [Empty state](./patterns/compositions/empty-state.md)
- [Footer help](./patterns/compositions/footer-help.md)
- [Index table](./patterns/compositions/index-table.md)
- [Interstitial nav](./patterns/compositions/interstitial-nav.md)
- [Media card](./patterns/compositions/media-card.md)
- [Metrics card](./patterns/compositions/metrics-card.md)
- [Resource list](./patterns/compositions/resource-list.md)
- [Setup guide](./patterns/compositions/setup-guide.md)
- [Patterns](./patterns/README.md)
- [Details](./patterns/templates/details.md)
- [Homepage](./patterns/templates/homepage.md)
- [Index](./patterns/templates/resource-index.md)
- [Settings](./patterns/templates/settings.md)

