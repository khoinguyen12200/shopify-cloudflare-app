---
title: Empty state
description: >-
  Every app has moments when there's nothing to show yet and some action is
  required of the merchant before they can manage resources. The empty state
  composition turns these blank screens into opportunities by guiding merchants
  toward their first action.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/empty-state
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/empty-state.md
api_name: app-home
---

# Empty state

Every app has moments when there's nothing to show yet and some action is required of the merchant before they can manage resources. The empty state composition turns these blank screens into opportunities by guiding merchants toward their first action.

Include a clear explanation of what will appear here and a prominent call-to-action to help merchants get started. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (9) APIs (2) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Button group](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button-group)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)

### Available APIs

* [Intents API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/intents-api)
* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)

### Recommended templates

* [Index](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/resource-index)

#### Use cases

* Onboarding merchants to create their first item in a collection
* Guiding merchants when search or filters return no results
* Prompting feature activation or configuration

***

## Examples

### Display an empty state with centered content and actions

Merchants need guidance and a clear next step when a list or page is empty. This pattern displays an empty state with centered content and primary and secondary actions. The [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) centers content vertically and horizontally. Use the [button group](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group) with `slot="primary-action"` and `slot="secondary-actions"` for clear next steps.

##### jsx

```tsx
<s-section accessibilityLabel="Empty state section">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      {/* aspectRatio should match the actual image dimensions (width/height) */}
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="A stylized graphic of four characters, each holding a puzzle piece"
      />
    </s-box>
    <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
      <s-stack alignItems="center">
        <s-heading>Start creating puzzles</s-heading>
        <s-paragraph>
          Create and manage your collection of puzzles for players to enjoy.
        </s-paragraph>
      </s-stack>
      <s-button-group>
        <s-button
          slot="secondary-actions"
          aria-label="Learn more about creating puzzles"
        >
          {" "}
          Learn more{" "}
        </s-button>
        <s-button slot="primary-action" aria-label="Add a new puzzle">
          {" "}
          Create puzzle{" "}
        </s-button>
      </s-button-group>
    </s-grid>
  </s-grid>
</s-section>
```

##### html

```html
<s-section accessibilityLabel="Empty state section">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      <!-- aspectRatio should match the actual image dimensions (width/height) -->
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="A stylized graphic of four characters, each holding a puzzle piece"
      />
    </s-box>
    <s-grid
      justifyItems="center"
      maxInlineSize="450px"
      gap="base"
    >
    <s-stack alignItems="center">
      <s-heading>Start creating puzzles</s-heading>
      <s-paragraph>
        Create and manage your collection of puzzles for players to enjoy.
      </s-paragraph>
    </s-stack>
    <s-button-group>
      <s-button slot="secondary-actions" aria-label="Learn more about creating puzzles"> Learn more </s-button>
      <s-button slot="primary-action" aria-label="Add a new puzzle"> Create puzzle </s-button>
    </s-button-group>
    </s-grid>
  </s-grid>
</s-section>
```

### Navigate to create page

Use `href` attributes to navigate merchants to a create page when they click the primary action button.

##### jsx

```tsx
<s-section>
  <s-stack alignItems="center" padding="large-500">
    <s-box maxInlineSize="200px">
      <s-image
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="No puzzles illustration"
        aspectRatio="1/0.5"
      />
    </s-box>
    <s-heading>Create your first puzzle</s-heading>
    <s-paragraph>
      Get started by creating a puzzle template. You can customize the number of pieces, shape, and difficulty level.
    </s-paragraph>
    <s-button href="/app/puzzles/new">Create puzzle</s-button>
  </s-stack>
</s-section>
```

##### html

```html
<s-section>
  <s-stack alignItems="center" padding="large-500">
    <s-box maxInlineSize="200px">
      <s-image
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="No puzzles illustration"
        aspectRatio="1/0.5"
      ></s-image>
    </s-box>
    <s-heading>Create your first puzzle</s-heading>
    <s-paragraph>
      Get started by creating a puzzle template. You can customize the number of pieces, shape, and difficulty level.
    </s-paragraph>
    <s-button href="/app/puzzles/new">Create puzzle</s-button>
  </s-stack>
</s-section>
```

### Open Shopify interfaces with Intents

Use the [Intents API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/intents-api) to make empty state actions open native Shopify interfaces, allowing merchants to browse existing resources or create new ones without leaving your app.

##### jsx

```tsx
{/* @validate-ignore: possibly 'undefined', Cannot invoke an object */}
<s-section accessibilityLabel="Empty state with intents">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="Illustration showing product creation"
      />
    </s-box>
    <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
      <s-stack alignItems="center">
        <s-heading>No products yet</s-heading>
        <s-paragraph>
          Add products from your Shopify catalog to get started with quality auditing.
        </s-paragraph>
      </s-stack>
      <s-button-group>
        <s-button
          slot="secondary-actions"
          onClick={() => {
            shopify.intents.invoke('browse:shopify/Product');
          }}
        >
          Browse products
        </s-button>
        <s-button
          slot="primary-action"
          onClick={async () => {
            const activity = await shopify.intents.invoke('create:shopify/Product');
            const response = await activity.complete;
            if (response.code === 'ok') {
              shopify.toast.show('Product created');
            }
          }}
        >
          Create product
        </s-button>
      </s-button-group>
    </s-grid>
  </s-grid>
</s-section>
```

##### html

```html
<!-- Empty state with Intents API actions -->
<!-- Note: Intents require JavaScript to invoke. This HTML shows the UI structure. -->
<s-section accessibilityLabel="Empty state with intents">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="Illustration showing product creation"
      ></s-image>
    </s-box>
    <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
      <s-stack alignItems="center">
        <s-heading>No products yet</s-heading>
        <s-paragraph>
          Add products from your Shopify catalog to get started with quality auditing.
        </s-paragraph>
      </s-stack>
      <s-button-group>
        <s-button slot="secondary-actions">Browse products</s-button>
        <s-button slot="primary-action">Create product</s-button>
      </s-button-group>
    </s-grid>
  </s-grid>
</s-section>

<!-- 
JavaScript usage for the buttons:

// Browse products
shopify.intents.invoke('browse:shopify/Product');

// Create product
const activity = await shopify.intents.invoke('create:shopify/Product');
const response = await activity.complete;
if (response.code === 'ok') {
  shopify.toast.show('Product created');
}
-->
```

***
