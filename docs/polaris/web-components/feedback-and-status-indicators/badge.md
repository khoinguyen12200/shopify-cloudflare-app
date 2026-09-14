---
title: Badge
description: >-
  The badge component displays status information or indicates completed actions
  through compact visual indicators. Use badge to communicate object states,
  order statuses, or system-generated classifications that help users quickly
  understand item conditions.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge.md
api_name: app-home
---

# Badge

The badge component displays status information or indicates completed actions through compact visual indicators. Use badge to communicate object states, order statuses, or system-generated classifications that help users quickly understand item conditions.

Badges support multiple tones and sizes, with optional icons to reinforce status meaning and improve scannability in lists and tables. For user-created labels, categories, or tags, use [chip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip) instead.

#### Use cases

* **Status indicators:** Display order status like "Fulfilled," "Pending," or "Cancelled" for quick visibility.
* **Inventory states:** Show product availability like "In Stock," "Low Stock," or "Out of Stock."
* **Processing status:** Indicate processing states like "Syncing," "Complete," or "Failed."
* **Labels and tags:** Categorize items with labels like "Featured," "New," or "Sale."

***

## Properties

Configure the following properties on the badge component.

* **color**

  **"base" | "strong"**

  **Default: 'base'**

  **required**

  Controls the visual weight and emphasis of the badge.

  * `base`: Standard weight with moderate emphasis, suitable for most use cases.
  * `strong`: Increased visual weight for higher emphasis and prominence.

* **icon**

  **"" | "replace" | "search" | "split" | "link" | "edit" | "info" | "incomplete" | "complete" | "product" | "variant" | "collection" | "select" | "color" | "money" | "order" | "code" | "adjust" | "affiliate" | "airplane" | "alert-bubble" | "alert-circle" | "alert-diamond" | "alert-location" | "alert-octagon" | "alert-octagon-filled" | "alert-triangle" | "alert-triangle-filled" | "app-extension" | "apps" | "archive" | "arrow-down" | "arrow-down-circle" | "arrow-down-right" | "arrow-left" | "arrow-left-circle" | "arrow-right" | "arrow-right-circle" | "arrow-up" | "arrow-up-circle" | "arrow-up-right" | "arrows-in-horizontal" | "arrows-out-horizontal" | "asterisk" | "attachment" | "automation" | "backspace" | "bag" | "bank" | "barcode" | "battery-low" | "bill" | "blank" | "blog" | "bolt" | "bolt-filled" | "book" | "book-open" | "bug" | "bullet" | "business-entity" | "button" | "button-press" | "calculator" | "calendar" | "calendar-check" | "calendar-compare" | "calendar-list" | "calendar-time" | "camera" | "camera-flip" | "caret-down" | "caret-left" | "caret-right" | "caret-up" | "cart" | "cart-abandoned" | "cart-discount" | "cart-down" | "cart-filled" | "cart-sale" | "cart-send" | "cart-up" | "cash-dollar" | "cash-euro" | "cash-pound" | "cash-rupee" | "cash-yen" | "catalog-product" | "categories" | "channels" | "chart-cohort" | "chart-donut" | "chart-funnel" | "chart-histogram-first" | "chart-histogram-first-last" | "chart-histogram-flat" | "chart-histogram-full" | "chart-histogram-growth" | "chart-histogram-last" | "chart-histogram-second-last" | "chart-horizontal" | "chart-line" | "chart-popular" | "chart-stacked" | "chart-vertical" | "chat" | "chat-new" | "chat-referral" | "check" | "check-circle" | "check-circle-filled" | "checkbox" | "chevron-down" | "chevron-down-circle" | "chevron-left" | "chevron-left-circle" | "chevron-right" | "chevron-right-circle" | "chevron-up" | "chevron-up-circle" | "circle" | "circle-dashed" | "clipboard" | "clipboard-check" | "clipboard-checklist" | "clock" | "clock-list" | "clock-revert" | "code-add" | "collection-featured" | "collection-list" | "collection-reference" | "color-none" | "compass" | "compose" | "confetti" | "connect" | "content" | "contract" | "corner-pill" | "corner-round" | "corner-square" | "credit-card" | "credit-card-cancel" | "credit-card-percent" | "credit-card-reader" | "credit-card-reader-chip" | "credit-card-reader-tap" | "credit-card-secure" | "credit-card-tap-chip" | "crop" | "currency-convert" | "cursor" | "cursor-banner" | "cursor-option" | "data-presentation" | "data-table" | "database" | "database-add" | "database-connect" | "delete" | "delivered" | "delivery" | "desktop" | "disabled" | "disabled-filled" | "discount" | "discount-add" | "discount-automatic" | "discount-code" | "discount-remove" | "dns-settings" | "dock-floating" | "dock-side" | "domain" | "domain-landing-page" | "domain-new" | "domain-redirect" | "download" | "drag-drop" | "drag-handle" | "drawer" | "duplicate" | "email" | "email-follow-up" | "email-newsletter" | "empty" | "enabled" | "enter" | "envelope" | "envelope-soft-pack" | "eraser" | "exchange" | "exit" | "export" | "external" | "eye-check-mark" | "eye-dropper" | "eye-dropper-list" | "eye-first" | "eyeglasses" | "fav" | "favicon" | "file" | "file-list" | "filter" | "filter-active" | "flag" | "flip-horizontal" | "flip-vertical" | "flower" | "folder" | "folder-add" | "folder-down" | "folder-remove" | "folder-up" | "food" | "foreground" | "forklift" | "forms" | "games" | "gauge" | "geolocation" | "gift" | "gift-card" | "git-branch" | "git-commit" | "git-repository" | "globe" | "globe-asia" | "globe-europe" | "globe-lines" | "globe-list" | "graduation-hat" | "grid" | "hashtag" | "hashtag-decimal" | "hashtag-list" | "heart" | "hide" | "hide-filled" | "home" | "home-filled" | "icons" | "identity-card" | "image" | "image-add" | "image-alt" | "image-explore" | "image-magic" | "image-none" | "image-with-text-overlay" | "images" | "import" | "in-progress" | "incentive" | "incoming" | "info-filled" | "inheritance" | "inventory" | "inventory-edit" | "inventory-list" | "inventory-transfer" | "inventory-updated" | "iq" | "key" | "keyboard" | "keyboard-filled" | "keyboard-hide" | "keypad" | "label-printer" | "language" | "language-translate" | "layout-block" | "layout-buy-button" | "layout-buy-button-horizontal" | "layout-buy-button-vertical" | "layout-column-1" | "layout-columns-2" | "layout-columns-3" | "layout-footer" | "layout-header" | "layout-logo-block" | "layout-popup" | "layout-rows-2" | "layout-section" | "layout-sidebar-left" | "layout-sidebar-right" | "lightbulb" | "link-list" | "list-bulleted" | "list-bulleted-filled" | "list-numbered" | "live" | "live-critical" | "live-none" | "location" | "location-none" | "lock" | "map" | "markets" | "markets-euro" | "markets-rupee" | "markets-yen" | "maximize" | "measurement-size" | "measurement-size-list" | "measurement-volume" | "measurement-volume-list" | "measurement-weight" | "measurement-weight-list" | "media-receiver" | "megaphone" | "mention" | "menu" | "menu-filled" | "menu-horizontal" | "menu-vertical" | "merge" | "metafields" | "metaobject" | "metaobject-list" | "metaobject-reference" | "microphone" | "microphone-muted" | "minimize" | "minus" | "minus-circle" | "mobile" | "money-none" | "money-split" | "moon" | "nature" | "note" | "note-add" | "notification" | "number-one" | "order-batches" | "order-draft" | "order-filled" | "order-first" | "order-fulfilled" | "order-repeat" | "order-unfulfilled" | "orders-status" | "organization" | "outdent" | "outgoing" | "package" | "package-cancel" | "package-fulfilled" | "package-on-hold" | "package-reassign" | "package-returned" | "page" | "page-add" | "page-attachment" | "page-clock" | "page-down" | "page-heart" | "page-list" | "page-reference" | "page-remove" | "page-report" | "page-up" | "pagination-end" | "pagination-start" | "paint-brush-flat" | "paint-brush-round" | "paper-check" | "partially-complete" | "passkey" | "paste" | "pause-circle" | "payment" | "payment-capture" | "payout" | "payout-dollar" | "payout-euro" | "payout-pound" | "payout-rupee" | "payout-yen" | "person" | "person-add" | "person-exit" | "person-filled" | "person-list" | "person-lock" | "person-remove" | "person-segment" | "personalized-text" | "phablet" | "phone" | "phone-down" | "phone-down-filled" | "phone-in" | "phone-out" | "pin" | "pin-remove" | "plan" | "play" | "play-circle" | "plus" | "plus-circle" | "plus-circle-down" | "plus-circle-filled" | "plus-circle-up" | "point-of-sale" | "point-of-sale-register" | "price-list" | "print" | "product-add" | "product-cost" | "product-filled" | "product-list" | "product-reference" | "product-remove" | "product-return" | "product-unavailable" | "profile" | "profile-filled" | "question-circle" | "question-circle-filled" | "radio-control" | "receipt" | "receipt-dollar" | "receipt-euro" | "receipt-folded" | "receipt-paid" | "receipt-pound" | "receipt-refund" | "receipt-rupee" | "receipt-yen" | "receivables" | "redo" | "referral-code" | "refresh" | "remove-background" | "reorder" | "replay" | "reset" | "return" | "reward" | "rocket" | "rotate-left" | "rotate-right" | "sandbox" | "save" | "savings" | "scan-qr-code" | "search-add" | "search-list" | "search-recent" | "search-resource" | "send" | "settings" | "share" | "shield-check-mark" | "shield-none" | "shield-pending" | "shield-person" | "shipping-label" | "shipping-label-cancel" | "shopcodes" | "slideshow" | "smiley-happy" | "smiley-joy" | "smiley-neutral" | "smiley-sad" | "social-ad" | "social-post" | "sort" | "sort-ascending" | "sort-descending" | "sound" | "sports" | "star" | "star-circle" | "star-filled" | "star-half" | "star-list" | "status" | "status-active" | "stop-circle" | "store" | "store-import" | "store-managed" | "store-online" | "sun" | "table" | "table-masonry" | "tablet" | "target" | "tax" | "team" | "text" | "text-align-center" | "text-align-left" | "text-align-right" | "text-block" | "text-bold" | "text-color" | "text-font" | "text-font-list" | "text-grammar" | "text-in-columns" | "text-in-rows" | "text-indent" | "text-indent-remove" | "text-italic" | "text-quote" | "text-title" | "text-underline" | "text-with-image" | "theme" | "theme-edit" | "theme-store" | "theme-template" | "three-d-environment" | "thumbs-down" | "thumbs-up" | "tip-jar" | "toggle-off" | "toggle-on" | "transaction" | "transaction-fee-add" | "transaction-fee-dollar" | "transaction-fee-euro" | "transaction-fee-pound" | "transaction-fee-rupee" | "transaction-fee-yen" | "transfer" | "transfer-in" | "transfer-internal" | "transfer-out" | "truck" | "undo" | "unknown-device" | "unlock" | "upload" | "variant-list" | "video" | "video-list" | "view" | "viewport-narrow" | "viewport-short" | "viewport-tall" | "viewport-wide" | "wallet" | "wand" | "watch" | "wifi" | "work" | "work-list" | "wrench" | "x" | "x-circle" | "x-circle-filled"**

  **required**

  An icon displayed inside the badge to provide additional visual context or reinforce the badge's meaning. Accepts any icon name from the icon library or a custom string identifier.

* **size**

  **"base" | "large" | "large-100"**

  **Default: 'base'**

  **required**

  The size of the badge.

  * `base`: Default size suitable for most badge use cases.
  * `large`: Larger badge for increased visibility and prominence.
  * `large-100`: Extra large badge for maximum visibility in emphasized contexts.

* **tone**

  **"info" | "success" | "warning" | "critical" | "auto" | "neutral" | "caution"**

  **Default: 'auto'**

  **required**

  The semantic meaning and color treatment of the component.

  * `info`: Informational content or helpful tips.
  * `success`: Positive outcomes or successful states.
  * `warning`: Important warnings about potential issues.
  * `critical`: Urgent problems or destructive actions.
  * `auto`: Automatically determined based on context.
  * `neutral`: General information without specific intent.
  * `caution`: Advisory notices that need attention.

### Slots

The badge component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The text label displayed within the badge component, typically a short status indicator or category label.

***

## Examples

### Add status badges with tones

Create badges with different tones to represent statuses. This example shows the tones `auto` (implicit default), `info`, `success`, `caution`, `warning`, and `critical`.

## html

```html
<s-badge>Fulfilled</s-badge>
<s-badge tone="info">Draft</s-badge>
<s-badge tone="success">Active</s-badge>
<s-badge tone="caution">Open</s-badge>
<s-badge tone="warning">On hold</s-badge>
<s-badge tone="critical">Action required</s-badge>
```

### Add icons to status badges

Combine tones with icons to provide stronger visual cues. This example shows product and inventory status badges with icons that reinforce meaning.

## html

```html
<s-stack gap="base">
  <!-- Product status -->
  <s-stack direction="inline" gap="base">
    <s-badge tone="success" icon="view">Active</s-badge>
    <s-badge tone="warning" icon="clock">Scheduled</s-badge>
    <s-badge tone="critical">Archived</s-badge>
  </s-stack>


  <!-- Inventory status -->
  <s-stack direction="inline" gap="base">
    <s-badge tone="success">In stock</s-badge>
    <s-badge tone="warning" icon="alert-triangle">Low stock</s-badge>
    <s-badge tone="critical">Out of stock</s-badge>
  </s-stack>
</s-stack>
```

### Display badges in a table

Place badges inside [table cells](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table) to give merchants a scannable overview of status information. This example shows fulfillment and payment badges in an order table.

## html

```html
<s-table>
  <s-table-header-row>
    <s-table-header>Order</s-table-header>
    <s-table-header>Fulfillment</s-table-header>
    <s-table-header>Payment</s-table-header>
  </s-table-header-row>
  <s-table-body>
    <s-table-row>
      <s-table-cell>#1001</s-table-cell>
      <s-table-cell>
        <s-badge tone="success">Fulfilled</s-badge>
      </s-table-cell>
      <s-table-cell>
        <s-badge tone="success">Paid</s-badge>
      </s-table-cell>
    </s-table-row>
  </s-table-body>
</s-table>
```

### Control badge size for emphasis

Use the `size` property to create visual hierarchy between badges. This example shows the base size for standard usage and the large size for badges that need more prominence.

## html

```html
<s-stack direction="inline" gap="base">
  <s-badge size="base">New</s-badge>
  <s-badge size="large">Attention needed</s-badge>
</s-stack>
```

***

## Best practices

* **Choose the right size:** Use `base` size in table cells, list items, or when showing multiple badges together. Use `large` size for standalone badges that need emphasis, like a primary status indicator at the top of a page.
* **Keep labels to 1-2 words:** Use concise labels like **Fulfilled**, **Partially refunded**, or **Out of stock**. Always use past tense for status labels: **Refunded** not **Refund**.
* **Use appropriate tones:** Apply `critical` for errors or urgent issues needing action, `warning` for problems requiring attention, `success` for positive confirmations, and `info` for neutral statuses. Use consistent tones for the same status across your app.
* **Position in content flow:** Place badges adjacent to the items they describe. In list items, position them near the title. In tables, place them in their own column for scannability.
* **Know when not to use badges:** Badges are static, system-generated indicators. Don't use badges for merchant-created tags or removable items.

***

## Limitations

* Badge text truncates with an ellipsis when it exceeds the available width. Truncated text isn't accessible via tooltip, so keep labels concise.
* Badge text never wraps to multiple lines. Long labels will truncate rather than expand the badge height.
* Only specific predefined icons from the admin icon set are supported. Custom icons or images can't be used. The icon always appears to the left of the text and can't be repositioned.

***
