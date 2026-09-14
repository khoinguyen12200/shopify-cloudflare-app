---
title: App card
description: >-
  Some tasks are better handled by specialized apps. The app card composition
  provides a consistent way to recommend complementary apps that extend your
  functionality or help merchants accomplish related tasks.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card.md
api_name: app-home
---

# App card

Some tasks are better handled by specialized apps. The app card composition provides a consistent way to recommend complementary apps that extend your functionality or help merchants accomplish related tasks.

Use app cards to suggest integrations, recommend partners, or highlight apps that work well alongside yours. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (8) APIs (1) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Thumbnail](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/thumbnail)

### Available APIs

* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)

### Recommended templates

* [Homepage](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/homepage)

#### Use cases

* Suggesting complementary apps to extend functionality
* Promoting integrations with related services
* Guiding merchants to explore analytics or marketing tools

***

## Examples

### Display a tappable app card with thumbnail and content

Merchants can discover and install complementary apps that extend your app's functionality. This pattern displays a tappable app card with thumbnail and content layout. The [clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable) component wraps the card, the [thumbnail](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail) shows the app icon, and the [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) aligns the content.

##### jsx

```tsx
<s-clickable
  href="https://apps.shopify.com/planet"
  border="base"
  borderRadius="base"
  padding="base"
  inlineSize="100%"
>
  <s-grid gridTemplateColumns="auto 1fr auto" alignItems="stretch" gap="base">
    <s-thumbnail
      size="small"
      src="https://cdn.shopify.com/app-store/listing_images/87176a11f3714753fdc2e1fc8bbf0415/icon/CIqiqqXsiIADEAE=.png"
      alt="Shopify Planet icon"
     />
    <s-box>
      <s-heading>Shopify Planet</s-heading>
      <s-paragraph>Free</s-paragraph>
      <s-paragraph>
        Offer carbon-neutral shipping and showcase your commitment.
      </s-paragraph>
    </s-box>
    <s-stack justifyContent="start">
      <s-button
        href="https://apps.shopify.com/planet"
        icon="download"
        accessibilityLabel="Download Shopify Planet"
       />
    </s-stack>
  </s-grid>
</s-clickable>
```

##### html

```html
<s-clickable
  href="https://apps.shopify.com/planet"
  border="base"
  borderRadius="base"
  padding="base"
  inlineSize="100%"
>
  <s-grid gridTemplateColumns="auto 1fr auto" alignItems="stretch" gap="base">
      <s-thumbnail
        size="small"
        src="https://cdn.shopify.com/app-store/listing_images/87176a11f3714753fdc2e1fc8bbf0415/icon/CIqiqqXsiIADEAE=.png"
        alt="Shopify Planet icon"
      ></s-thumbnail>
    <s-box>
      <s-heading>Shopify Planet</s-heading>
      <s-paragraph>Free</s-paragraph>
      <s-paragraph>
        Offer carbon-neutral shipping and showcase your commitment.
      </s-paragraph>
    </s-box>
    <s-stack justifyContent="start">
      <s-button
        href="https://apps.shopify.com/planet"
        icon="download"
        accessibilityLabel="Download Shopify Planet"
      ></s-button>
    </s-stack>
  </s-grid>
</s-clickable>
```

### Navigate to App Store

Use `href` attributes to navigate merchants to the App Store when they click the card or install button.

##### jsx

```tsx
<s-clickable
  href="https://apps.shopify.com/planet"
  border="base"
  borderRadius="base"
  padding="base"
  inlineSize="100%"
>
  <s-grid gridTemplateColumns="auto 1fr auto" alignItems="stretch" gap="base">
    <s-thumbnail
      size="small"
      src="https://cdn.shopify.com/app-store/listing_images/87176a11f3714753fdc2e1fc8bbf0415/icon/CIqiqqXsiIADEAE=.png"
      alt="Shopify Planet icon"
    />
    <s-box>
      <s-heading>Shopify Planet</s-heading>
      <s-paragraph>Free</s-paragraph>
      <s-paragraph>
        Offer carbon-neutral shipping and showcase your commitment.
      </s-paragraph>
    </s-box>
    <s-stack justifyContent="start">
      <s-button
        href="https://apps.shopify.com/planet"
        icon="download"
        accessibilityLabel="Install Shopify Planet"
      />
    </s-stack>
  </s-grid>
</s-clickable>
```

##### html

```html
<s-clickable
  href="https://apps.shopify.com/planet"
  border="base"
  borderRadius="base"
  padding="base"
  inlineSize="100%"
>
  <s-grid gridTemplateColumns="auto 1fr auto" alignItems="stretch" gap="base">
    <s-thumbnail
      size="small"
      src="https://cdn.shopify.com/app-store/listing_images/87176a11f3714753fdc2e1fc8bbf0415/icon/CIqiqqXsiIADEAE=.png"
      alt="Shopify Planet icon"
    ></s-thumbnail>
    <s-box>
      <s-heading>Shopify Planet</s-heading>
      <s-paragraph>Free</s-paragraph>
      <s-paragraph>
        Offer carbon-neutral shipping and showcase your commitment.
      </s-paragraph>
    </s-box>
    <s-stack justifyContent="start">
      <s-button
        href="https://apps.shopify.com/planet"
        icon="download"
        accessibilityLabel="Install Shopify Planet"
      ></s-button>
    </s-stack>
  </s-grid>
</s-clickable>
```

***
