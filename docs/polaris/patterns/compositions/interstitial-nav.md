---
title: Interstitial nav
description: >-
  As your app grows, merchants need clear paths to deeper pages without
  cluttering your main navigation. The interstitial nav composition provides a
  clean way to link to settings, features, or resources within a section.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav.md
api_name: app-home
---

# Interstitial nav

As your app grows, merchants need clear paths to deeper pages without cluttering your main navigation. The interstitial nav composition provides a clean way to link to settings, features, or resources within a section.

Use this pattern on pages that serve as hubs for related functionality, like a settings overview that links to individual settings pages. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details.

### Related Components (8) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Icon](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/icon)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)

### Recommended templates

* [Settings](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/settings)

#### Use cases

* Linking to individual settings or configuration pages
* Connecting merchants to feature-specific sections
* Guiding to help documentation or integration resources

***

## Examples

### Display a navigation menu with drill-down rows

Merchants need clear paths to deeper pages (e.g. settings, features) without cluttering main navigation. This pattern displays a navigation menu with drill-down rows. [Clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable) rows sit in a bordered [box](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box). Each row uses the [icon](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon) with `name="chevron-right"` to indicate navigation.

##### jsx

```tsx
<s-section heading="Preferences">
  <s-box border="base" borderRadius="base">
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Manage customer support settings and help resources"
    >
      <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
        <s-box>
          <s-heading>Customer support</s-heading>
          <s-paragraph color="subdued">
            Support settings, help resources, and customer service tools.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right" />
      </s-grid>
    </s-clickable>
    <s-box paddingInline="small-100">
      <s-divider />
    </s-box>
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Configure product defaults, customer experience, and catalog settings"
    >
      <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
        <s-box>
          <s-heading>Products & catalog</s-heading>
          <s-paragraph color="subdued">
            Product defaults, customer experience, and catalog display options.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right" />
      </s-grid>
    </s-clickable>
    <s-box paddingInline="small-100">
      <s-divider />
    </s-box>
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Configure shipping methods, rates, and fulfillment options"
    >
      <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
        <s-box>
          <s-heading>Shipping & fulfillment</s-heading>
          <s-paragraph color="subdued">
            Shipping methods, rates, zones, and fulfillment preferences.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right" />
      </s-grid>
    </s-clickable>
  </s-box>
</s-section>
```

##### html

```html
<s-section heading="Preferences">
  <s-box
    border="base"
    borderRadius="base"
  >
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Manage customer support settings and help resources"
    >
      <s-grid
        gridTemplateColumns="1fr auto"
        alignItems="center"
        gap="base"
      >
        <s-box>
          <s-heading>Customer support</s-heading>
          <s-paragraph color="subdued">
            Support settings, help resources, and customer service
            tools.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right"></s-icon>
      </s-grid>
    </s-clickable>
    <s-box paddingInline="small-100">
      <s-divider></s-divider>
    </s-box>
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Configure product defaults, customer experience, and catalog settings"
    >
      <s-grid
        gridTemplateColumns="1fr auto"
        alignItems="center"
        gap="base"
      >
        <s-box>
          <s-heading>Products & catalog</s-heading>
          <s-paragraph color="subdued">
            Product defaults, customer experience, and catalog display
            options.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right"></s-icon>
      </s-grid>
    </s-clickable>
    <s-box paddingInline="small-100">
      <s-divider></s-divider>
    </s-box>
    <s-clickable
      padding="small-100"
      href="#"
      accessibilityLabel="Configure shipping methods, rates, and fulfillment options"
    >
      <s-grid
        gridTemplateColumns="1fr auto"
        alignItems="center"
        gap="base"
      >
        <s-box>
          <s-heading>Shipping & fulfillment</s-heading>
          <s-paragraph color="subdued">
            Shipping methods, rates, zones, and fulfillment preferences.
          </s-paragraph>
        </s-box>
        <s-icon type="chevron-right"></s-icon>
      </s-grid>
    </s-clickable>
  </s-box>
</s-section>
```

***
