---
title: Metrics card
description: >-
  Merchants want to see how they're doing at a glance. The metrics card
  composition highlights important numbers, statistics, or trends so merchants
  can quickly understand their activity and performance.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card.md
api_name: app-home
---

# Metrics card

Merchants want to see how they're doing at a glance. The metrics card composition highlights important numbers, statistics, or trends so merchants can quickly understand their activity and performance.

Use metrics cards on your homepage or dashboard to surface the data merchants care about most. Include trend indicators when historical comparison adds context. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (8) APIs (1) Templates (1)

### Supported components

* [Badge](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/badge)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)

### Available APIs

* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)

### Recommended templates

* [Index](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/resource-index)

#### Use cases

* Displaying app-specific metrics like open rates or subscribers
* Showing engagement data like followers or clicks
* Visualizing trends with comparative indicators

***

## Examples

### Display metrics in a responsive grid with trend indicators

Merchants want to see key numbers and trends at a glance. This pattern displays metrics in a responsive grid with trend indicators. The [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) uses responsive column templates for side-by-side layout on large screens and stacked layout on small screens. The [badge](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge) component shows trend indicators.

##### jsx

```tsx
<s-section padding="base">
  <s-grid
    gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
    gap="small"
  >
    <s-clickable
      href=""
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Total Designs</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>156</s-text>
          <s-badge tone="success" icon="arrow-up">
            {" "}
            12%{" "}
          </s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block" />
    <s-clickable
      href=""
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Units Sold</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>2,847</s-text>
          <s-badge tone="warning">0%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block" />
    <s-clickable
      href=""
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Return Rate</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>3.2%</s-text>
          <s-badge tone="critical" icon="arrow-down">
            {" "}
            0.8%{" "}
          </s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
  </s-grid>
</s-section>
```

##### html

```html
<s-section padding="base">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
      gap="small"
    >
      <s-clickable
        href=""
        paddingBlock="small-400"
        paddingInline="small-100"
        borderRadius="base"
      >
        <s-grid gap="small-300">
          <s-heading>Total Designs</s-heading>
          <s-stack direction="inline" gap="small-200">
            <s-text>156</s-text>
            <s-badge tone="success" icon="arrow-up"> 12% </s-badge>
          </s-stack>
        </s-grid>
      </s-clickable>
      <s-divider direction="block"></s-divider>
      <s-clickable
        href=""
        paddingBlock="small-400"
        paddingInline="small-100"
        borderRadius="base"
      >
        <s-grid gap="small-300">
          <s-heading>Units Sold</s-heading>
          <s-stack direction="inline" gap="small-200">
            <s-text>2,847</s-text>
            <s-badge tone="warning">0%</s-badge>
          </s-stack>
        </s-grid>
      </s-clickable>
      <s-divider direction="block"></s-divider>
      <s-clickable
        href=""
        paddingBlock="small-400"
        paddingInline="small-100"
        borderRadius="base"
      >
        <s-grid gap="small-300">
          <s-heading>Return Rate</s-heading>
          <s-stack direction="inline" gap="small-200">
            <s-text>3.2%</s-text>
            <s-badge tone="critical" icon="arrow-down"> 0.8% </s-badge>
          </s-stack>
        </s-grid>
      </s-clickable>
    </s-grid>
</s-section>
```

### Navigate to analytics detail

Use `href` attributes on clickable metrics to navigate merchants to detailed analytics pages.

##### jsx

```tsx
<s-section padding="base">
  <s-grid
    gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
    gap="small"
  >
    <s-clickable
      href="/app/analytics/designs"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Total Designs</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>156</s-text>
          <s-badge tone="success" icon="arrow-up">12%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block" />
    <s-clickable
      href="/app/analytics/sales"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Units Sold</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>2,847</s-text>
          <s-badge tone="warning">0%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block" />
    <s-clickable
      href="/app/analytics/returns"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Return Rate</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>3.2%</s-text>
          <s-badge tone="critical" icon="arrow-down">0.8%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
  </s-grid>
</s-section>
```

##### html

```html
<s-section padding="base">
  <s-grid
    gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
    gap="small"
  >
    <s-clickable
      href="/app/analytics/designs"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Total Designs</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>156</s-text>
          <s-badge tone="success" icon="arrow-up">12%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block"></s-divider>
    <s-clickable
      href="/app/analytics/sales"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Units Sold</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>2,847</s-text>
          <s-badge tone="warning">0%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
    <s-divider direction="block"></s-divider>
    <s-clickable
      href="/app/analytics/returns"
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>Return Rate</s-heading>
        <s-stack direction="inline" gap="small-200">
          <s-text>3.2%</s-text>
          <s-badge tone="critical" icon="arrow-down">0.8%</s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
  </s-grid>
</s-section>
```

***
