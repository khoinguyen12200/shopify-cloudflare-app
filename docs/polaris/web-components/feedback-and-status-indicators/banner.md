---
title: Banner
description: >-
  The banner component highlights important information or required actions
  prominently within the interface. Use banner to communicate statuses, provide
  feedback, draw attention to critical updates, or guide users toward necessary
  actions.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner.md
api_name: app-home
---

# Banner

The banner component highlights important information or required actions prominently within the interface. Use banner to communicate statuses, provide feedback, draw attention to critical updates, or guide users toward necessary actions.

Banners support multiple tones to convey urgency levels, optional actions for next steps, and can be positioned contextually within sections or page-wide at the top. For inline status indicators on individual items, use [badge](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge).

#### Use cases

* **Important announcements:** Communicate critical information about app features or requirements.
* **Error messages:** Display prominent error messages that require merchant attention.
* **Success confirmations:** Show success messages for important operations like saves or sync.
* **Warnings:** Alert merchants to potential issues like missing configuration or deprecated features.

***

## Properties

Configure the following properties on the banner component.

* **heading**

  **string**

  **Default: ''**

  **required**

  The heading text displayed at the top of the banner.

* **tone**

  **"info" | "success" | "warning" | "critical" | "auto"**

  **Default: 'auto'**

  **required**

  The semantic meaning and color treatment of the component.

  * `info`: Informational content or helpful tips.
  * `success`: Positive outcomes or successful states.
  * `warning`: Important warnings about potential issues.
  * `critical`: Urgent problems or destructive actions.
  * `auto`: Automatically determined based on context.

* **hidden**

  **boolean**

  **Default: false**

  **required**

  Controls whether the banner is visible or hidden.

  When using a controlled component pattern and the banner is `dismissible`, update this property to `true` when the `dismiss` event fires.

  You can hide the banner programmatically by setting this to `true` even if it's not `dismissible`.

* **dismissible**

  **boolean**

  **Default: false**

  **required**

  Whether the banner displays a close button that allows users to dismiss it.

  When the close button is pressed, the `dismiss` event fires, then `hidden` is set to `true`, any animation completes, and the `afterhide` event fires.

### Events

The banner component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **afterhide**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired after the banner is hidden.

* **dismiss**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the banner is dismissed.

### CallbackEventListener

A function that handles events from UI components. This type represents an event listener callback that receives a \`CallbackEvent\` with a strongly-typed \`currentTarget\`. Use this for component event handlers like \`click\`, \`focus\`, \`blur\`, and other DOM events.

```ts
(EventListener & {
      (event: CallbackEvent<T>): void;
    }) | null
```

### CallbackEvent

An event object with a strongly-typed \`currentTarget\` property that references the specific HTML element that triggered the event. This type extends the standard DOM \`Event\` interface and ensures type safety when accessing the element that fired the event.

```ts
Event & {
  currentTarget: HTMLElementTagNameMap[T];
}
```

### Slots

The banner component supports slots for additional content placement within the banner. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The main message content displayed within the banner component, providing important information or guidance to users.

* **secondary-actions**

  **HTMLElement**

  Action buttons displayed at the bottom of the banner that let users respond to the message. Accepts up to two button components with `variant="secondary"` or `variant="auto"`.

***

## Examples

### Add a dismissible info banner

Create an informational banner with a heading and body text. This example shows a basic banner communicating a status update that merchants can dismiss.

## html

```html
<s-banner heading="Order archived" tone="info" dismissible>
  This order was archived on March 7, 2017 at 3:12pm EDT.
</s-banner>
```

### Create a warning banner with buttons for next steps

Use a warning-toned banner with secondary action [buttons](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) to highlight a problem and give merchants clear next steps. This example shows a shipping weight issue with links to review products and access a setup guide.

## html

```html
<s-banner heading="127 products missing shipping weights" tone="warning">
  Products without weights may show inaccurate shipping rates, leading to
  checkout abandonment.
  <s-button
    slot="secondary-actions"
    variant="secondary"
    href="/admin/products?filter=missing-weights"
  >
    Review products
  </s-button>
  <s-button
    slot="secondary-actions"
    variant="secondary"
    href="javascript:void(0)"
  >
    Setup guide
  </s-button>
</s-banner>
```

### Alert merchants to critical issues requiring action

Use a critical-toned banner to signal an urgent issue that requires immediate merchant action. This example shows a fraud review alert with [buttons](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) to review order details and adjust settings.

## html

```html
<s-banner heading="Order #1024 flagged for fraud review" tone="critical">
  This order shows multiple risk indicators and cannot be auto-fulfilled. Review
  required within 24 hours to prevent automatic cancellation.
  <s-button
    slot="secondary-actions"
    variant="secondary"
    href="/admin/orders/1024/risk"
  >
    Review order details
  </s-button>
  <s-button
    slot="secondary-actions"
    variant="secondary"
    href="/admin/settings/payments/fraud"
  >
    Adjust fraud settings
  </s-button>
</s-banner>
```

### Confirm a completed action with a dismissible banner

Use a success-toned banner with the `dismissible` property to confirm a completed operation. This example shows a product import confirmation that merchants can dismiss once acknowledged.

## html

```html
<s-banner heading="Products imported" tone="success" dismissible="true">
  Successfully imported 50 products to your store.
</s-banner>
```

***

## Best practices

* **Focus on single actions:** Present one piece of information or required action per banner to maintain clarity and prevent confusion.
* **Keep messages concise:** Write scannable content that merchants can quickly understand without spending time deciphering meaning or next steps.
* **Provide clear actions:** Info, warning, and critical banners should include a call to action with specific next steps so merchants know how to proceed.
* **Make dismissible when appropriate:** Allow merchants to dismiss banners unless immediate action's required. Avoid persistent banners that can't be closed.
* **Position contextually:** Place banners outside sections for page-wide messages or inside sections for contextual messages relevant to specific content.

***

## Limitations

* The dismissed state doesn't persist across page loads or sessions. You must implement your own persistence logic using local storage, cookies, or server-side state.
* Multiple banners stack vertically without built-in prioritization or queueing. If you show multiple banners at once, all appear simultaneously. You must implement banner queueing logic yourself to show one at a time.
* Banners can't be fixed or sticky at the top of the viewport. They scroll with page content.
* Banners don't have built-in truncation or "read more" functionality. Very long banner messages will wrap to multiple lines, creating tall banners that dominate the screen.

***
