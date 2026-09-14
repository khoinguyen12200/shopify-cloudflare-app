---
title: Callout card
description: >-
  When you release a new feature or want to highlight an opportunity, the
  callout card composition draws attention without being intrusive. It
  encourages merchants to take action with a clear message and prominent button.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card.md
api_name: app-home
---

# Callout card

When you release a new feature or want to highlight an opportunity, the callout card composition draws attention without being intrusive. It encourages merchants to take action with a clear message and prominent button.

Use callout cards sparingly to announce features, promote functionality, or guide merchants through common first actions. Remove them once merchants have engaged. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (8) APIs (2) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)

### Available APIs

* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Homepage](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/homepage)

#### Use cases

* Announcing new features or integrations
* Driving adoption of app functionality
* Prompting common first actions after install

***

## Examples

### Display a callout card with illustration and call-to-action

Merchants can take action on new features or opportunities you highlight. This pattern presents a callout card that stacks content on smaller screens with a prominent illustration and call-to-action. The [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) uses responsive column templates. The illustration and button draw attention to important actions or promotions.

##### jsx

```tsx
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>Ready to create your custom puzzle?</s-heading>
        <s-paragraph>
          Start by uploading an image to your gallery or choose from one of our
          templates.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button> Upload image </s-button>
          <s-button tone="neutral" variant="tertiary">
            {" "}
            Browse templates{" "}
          </s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="Customize checkout illustration"
            aspectRatio="1/0.5"
           />
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
     />
  </s-grid>
</s-section>
```

##### html

```html
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>Ready to create your custom puzzle?</s-heading>
        <s-paragraph>
          Start by uploading an image to your gallery or choose from one of our templates.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button> Upload image </s-button>
          <s-button tone="neutral" variant="tertiary"> Browse templates </s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="Customize checkout illustration"
            aspectRatio="1/0.5"
          ></s-image>
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
    ></s-button>
  </s-grid>
</s-section>
```

### Navigate to feature pages

Use `href` attributes on buttons to navigate merchants to feature pages when they click CTA buttons.

##### jsx

```tsx
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>New: AI-powered puzzle suggestions</s-heading>
        <s-paragraph>
          Let our AI analyze your images and suggest the perfect puzzle configurations for maximum engagement.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button href="/app/ai-suggestions">Try it now</s-button>
          <s-button tone="neutral" variant="tertiary" href="/app/settings/ai">
            Learn more
          </s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="AI suggestions illustration"
            aspectRatio="1/0.5"
          />
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
    />
  </s-grid>
</s-section>
```

##### html

```html
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>New: AI-powered puzzle suggestions</s-heading>
        <s-paragraph>
          Let our AI analyze your images and suggest the perfect puzzle configurations for maximum engagement.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button href="/app/ai-suggestions">Try it now</s-button>
          <s-button tone="neutral" variant="tertiary" href="/app/settings/ai">Learn more</s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="AI suggestions illustration"
            aspectRatio="1/0.5"
          ></s-image>
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
    ></s-button>
  </s-grid>
</s-section>
```

### Show dismiss feedback with Toast

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when the callout card is dismissed.

##### jsx

```tsx
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>Ready to create your custom puzzle?</s-heading>
        <s-paragraph>
          Start by uploading an image to your gallery or choose from one of our
          templates.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button>Upload image</s-button>
          <s-button tone="neutral" variant="tertiary">
            Browse templates
          </s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="Customize checkout illustration"
            aspectRatio="1/0.5"
          />
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
      onClick={() => {
        shopify.toast.show('Card dismissed');
      }}
    />
  </s-grid>
</s-section>
```

##### html

```html
<s-section>
  <s-grid gridTemplateColumns="1fr auto" gap="small-400" alignItems="start">
    <s-grid
      gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
      gap="base"
      alignItems="center"
    >
      <s-grid gap="small-200">
        <s-heading>Ready to create your custom puzzle?</s-heading>
        <s-paragraph>
          Start by uploading an image to your gallery or choose from one of our
          templates.
        </s-paragraph>
        <s-stack direction="inline" gap="small-200">
          <s-button>Upload image</s-button>
          <s-button tone="neutral" variant="tertiary">Browse templates</s-button>
        </s-stack>
      </s-grid>
      <s-stack alignItems="center">
        <s-box maxInlineSize="200px" borderRadius="base" overflow="hidden">
          <s-image
            src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
            alt="Customize checkout illustration"
            aspectRatio="1/0.5"
          ></s-image>
        </s-box>
      </s-stack>
    </s-grid>
    <s-button
      icon="x"
      tone="neutral"
      variant="tertiary"
      accessibilityLabel="Dismiss card"
    ></s-button>
  </s-grid>
</s-section>

<!-- 
Dismiss handler:
shopify.toast.show('Card dismissed');
-->
```

***
