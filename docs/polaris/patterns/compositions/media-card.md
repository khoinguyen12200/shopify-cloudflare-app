---
title: Media card
description: >-
  The media card composition pattern pairs visual content (images, videos,
  illustrations) with actionable text to help merchants understand features or
  follow tutorials. Use media cards on your homepage to introduce features, in
  settings to explain options, or anywhere visual context helps merchants make
  decisions.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card.md
api_name: app-home
---

# Media card

The media card composition pattern pairs visual content (images, videos, illustrations) with actionable text to help merchants understand features or follow tutorials.

Use media cards on your homepage to introduce features, in settings to explain options, or anywhere visual context helps merchants make decisions. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (7) APIs (4) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)

### Available APIs

* [Intents API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/intents-api)
* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Share API](https://shopify.dev/docs/api/app-home/v1.0/apis/device-and-platform-integration/share-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Homepage](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/homepage)

#### Use cases

* Showcasing templates, themes, or presets with visual previews
* Displaying product or collection thumbnails with quick actions
* Presenting tutorials or guides with video or image previews

***

## Examples

### Display a media card with tappable image and footer

Merchants can see visual content (images, illustrations) paired with actions, like tutorials or feature highlights. This pattern displays a media card with a tappable image and footer layout. The [box](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box) uses `border` and `borderRadius` for the container, the [clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable) component makes the image tappable, and the [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) lays out the footer with title and action button.

##### jsx

```tsx
<s-grid justifyItems="center" alignItems="center" minBlockSize="300px">
  <s-box
    border="base"
    borderRadius="base"
    overflow="hidden"
    maxInlineSize="216px"
  >
    <s-clickable href="">
      <s-image
        aspectRatio="1/1"
        objectFit="cover"
        alt="Illustration of characters with a 4-piece puzzle"
        src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
       />
    </s-clickable>
    <s-divider />
    <s-grid
      gridTemplateColumns="1fr auto"
      background="base"
      padding="small"
      gap="small"
      alignItems="center"
    >
      <s-heading>4-Pieces</s-heading>
      <s-button href="" accessibilityLabel="View 4-pieces puzzle template">
        View
      </s-button>
    </s-grid>
  </s-box>
</s-grid>
```

##### html

```html
<s-grid justifyItems="center" alignItems="center" minBlockSize="300px">
  <s-box border="base" borderRadius="base" overflow="hidden" maxInlineSize="216px">
    <s-clickable href="">
      <s-image
        aspectRatio="1/1"
        objectFit="cover"
        alt="Illustration of characters with a 4-piece puzzle"
        src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
      ></s-image>
    </s-clickable>
    <s-divider></s-divider>
    <s-grid
      gridTemplateColumns="1fr auto"
      background="base"
      padding="small"
      gap="small"
      alignItems="center"
    >
      <s-heading>4-Pieces</s-heading>
      <s-button href="" accessibilityLabel="View 4-pieces puzzle template">
        View
      </s-button>
    </s-grid>
  </s-box>
</s-grid>
```

### Confirm delete with Modal API

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm deletion before removing a media card item.

##### jsx

```tsx
<s-grid justifyItems="center" alignItems="center" minBlockSize="300px">
  <s-box
    border="base"
    borderRadius="base"
    overflow="hidden"
    maxInlineSize="216px"
  >
    <s-clickable href="">
      <s-image
        aspectRatio="1/1"
        objectFit="cover"
        alt="Illustration of characters with a 4-piece puzzle"
        src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
      />
    </s-clickable>
    <s-divider />
    <s-grid
      gridTemplateColumns="1fr auto auto"
      background="base"
      padding="small"
      gap="small"
      alignItems="center"
    >
      <s-heading>4-Pieces</s-heading>
      <s-button href="" accessibilityLabel="View 4-pieces puzzle template">
        View
      </s-button>
      <s-button
        tone="critical"
        variant="tertiary"
        icon="delete"
        accessibilityLabel="Delete 4-pieces puzzle"
        commandFor="delete-modal"
        command="--show"
      />
    </s-grid>

    <s-modal id="delete-modal" heading="Delete template?">
      <s-stack direction="block" gap="base">
        <s-text>
          Are you sure you want to delete the 4-Pieces template? This action cannot be undone.
        </s-text>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        commandFor="delete-modal"
        command="--hide"
      >
        Delete
      </s-button>
      <s-button
        slot="secondary-actions"
        commandFor="delete-modal"
        command="--hide"
      >
        Cancel
      </s-button>
    </s-modal>
  </s-box>
</s-grid>
```

##### html

```html
<s-grid justifyItems="center" alignItems="center" minBlockSize="300px">
  <s-box
    border="base"
    borderRadius="base"
    overflow="hidden"
    maxInlineSize="216px"
  >
    <s-clickable href="">
      <s-image
        aspectRatio="1/1"
        objectFit="cover"
        alt="Illustration of characters with a 4-piece puzzle"
        src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
      ></s-image>
    </s-clickable>
    <s-divider></s-divider>
    <s-grid
      gridTemplateColumns="1fr auto auto"
      background="base"
      padding="small"
      gap="small"
      alignItems="center"
    >
      <s-heading>4-Pieces</s-heading>
      <s-button href="" accessibilityLabel="View 4-pieces puzzle template">View</s-button>
      <s-button
        tone="critical"
        variant="tertiary"
        icon="delete"
        accessibilityLabel="Delete 4-pieces puzzle"
        commandFor="delete-modal"
        command="--show"
      ></s-button>
    </s-grid>

    <s-modal id="delete-modal" heading="Delete template?">
      <s-stack direction="block" gap="base">
        <s-text>
          Are you sure you want to delete the 4-Pieces template? This action cannot be undone.
        </s-text>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        commandFor="delete-modal"
        command="--hide"
      >Delete</s-button>
      <s-button
        slot="secondary-actions"
        commandFor="delete-modal"
        command="--hide"
      >Cancel</s-button>
    </s-modal>
  </s-box>
</s-grid>
```

### Copy link with Toast API

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when a link is copied to the clipboard.

##### jsx

```tsx
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    />
  </s-clickable>
  <s-divider />
  <s-grid
    gridTemplateColumns="1fr auto auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button href="" accessibilityLabel="View 4-pieces puzzle template">
      View
    </s-button>
    <s-button
      variant="tertiary"
      icon="link"
      accessibilityLabel="Copy link to 4-pieces puzzle template"
      onClick={() => {
        shopify.toast.show('Link copied to clipboard');
      }}
    />
  </s-grid>
</s-box>
```

##### html

```html
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    ></s-image>
  </s-clickable>
  <s-divider></s-divider>
  <s-grid
    gridTemplateColumns="1fr auto auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button href="" accessibilityLabel="View 4-pieces puzzle template">View</s-button>
    <s-button
      variant="tertiary"
      icon="link"
      accessibilityLabel="Copy link to 4-pieces puzzle template"
    ></s-button>
  </s-grid>
</s-box>

<!-- 
Copy link handler:
shopify.toast.show('Link copied to clipboard');
-->
```

### Edit resources with Intents API

Use the [Intents API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/intents-api) to open Shopify's resource editor when merchants click the edit button.

##### jsx

```tsx
{/* @validate-ignore: Cannot invoke an object which is possibly 'undefined' */}
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    />
  </s-clickable>
  <s-divider />
  <s-grid
    gridTemplateColumns="1fr auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button
      accessibilityLabel="Edit 4-pieces puzzle in Shopify"
      onClick={async () => {
        await shopify.intents.invoke('edit:shopify/Product,gid://shopify/Product/123');
      }}
    >
      Edit
    </s-button>
  </s-grid>
</s-box>
```

##### html

```html
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    ></s-image>
  </s-clickable>
  <s-divider></s-divider>
  <s-grid
    gridTemplateColumns="1fr auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button accessibilityLabel="Edit 4-pieces puzzle in Shopify">Edit</s-button>
  </s-grid>
</s-box>

<!-- 
Edit handler:
await shopify.intents.invoke('edit:shopify/Product,gid://shopify/Product/123');
-->
```

### Share template with Share API

Use the [Share API](https://shopify.dev/docs/api/app-home/latest/apis/device-and-platform-integration/share-api) to let merchants share templates via the native share sheet on mobile devices.

##### jsx

```tsx
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    />
  </s-clickable>
  <s-divider />
  <s-grid
    gridTemplateColumns="1fr auto auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button href="" accessibilityLabel="View 4-pieces puzzle template">
      View
    </s-button>
    <s-button
      variant="tertiary"
      icon="share"
      accessibilityLabel="Share 4-pieces puzzle template"
      onClick={async () => {
        try {
          await navigator.share({
            text: 'Check out this puzzle template!',
            url: 'https://example.com/puzzles/4-pieces',
          });
        } catch (err) {
          console.log('Share cancelled or failed');
        }
      }}
    />
  </s-grid>
</s-box>
```

##### html

```html
<s-box
  border="base"
  borderRadius="base"
  overflow="hidden"
  maxInlineSize="216px"
>
  <s-clickable href="">
    <s-image
      aspectRatio="1/1"
      objectFit="cover"
      alt="Illustration of characters with a 4-piece puzzle"
      src="https://cdn.shopify.com/static/images/polaris/patterns/4-pieces.png"
    ></s-image>
  </s-clickable>
  <s-divider></s-divider>
  <s-grid
    gridTemplateColumns="1fr auto auto"
    background="base"
    padding="small"
    gap="small"
    alignItems="center"
  >
    <s-heading>4-Pieces</s-heading>
    <s-button href="" accessibilityLabel="View 4-pieces puzzle template">View</s-button>
    <s-button
      variant="tertiary"
      icon="share"
      accessibilityLabel="Share 4-pieces puzzle template"
    ></s-button>
  </s-grid>
</s-box>

<!-- 
Share handler:
try {
  await navigator.share({
    text: 'Check out this puzzle template!',
    url: 'https://example.com/puzzles/4-pieces',
  });
} catch (err) {
  console.log('Share cancelled or failed');
}
-->
```

***
