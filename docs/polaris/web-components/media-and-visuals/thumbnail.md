---
title: Thumbnail
description: >-
  The thumbnail component displays small preview images representing content,
  products, or media items. Use thumbnail to provide visual identification in
  lists, tables, or cards where space is constrained and quick recognition is
  important.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail.md
api_name: app-home
---

# Thumbnail

The thumbnail component displays small preview images representing content, products, or media items. Use thumbnail to provide visual identification in lists, tables, or cards where space is constrained and quick recognition is important.

Thumbnails support multiple sizes, alt text for accessibility, and fallback states for missing images. For full-size images, use [image](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image). For user profile images, use [avatar](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar).

#### Use cases

* **Image previews:** Display small product image previews in lists or forms.
* **Visual identification:** Help merchants quickly identify resources with thumbnail images.
* **Compact displays:** Show images in space-constrained interfaces like resource items.
* **Gallery previews:** Create preview galleries of product images or media.

***

## Properties

Configure the following properties on the thumbnail component.

* **src**

  **string**

  **required**

  The image source (either a remote URL or a local file resource).

  When the image is loading or no `src` is provided, a placeholder is rendered.

* **alt**

  **string**

  **Default: \`\`**

  **required**

  Alternative text that describes the image for accessibility.

  Provides a text description of the image for users with assistive technology and serves as a fallback when the image fails to load. A well-written description enables people with visual impairments to understand non-text content.

  When a screen reader encounters an image, it reads this description aloud. When an image fails to load, this text displays on screen, helping all users understand what content was intended.

  Learn more about [writing effective alt text](https://www.shopify.com/ca/blog/image-alt-text#4) and the [alt attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt).

* **size**

  **"small" | "small-200" | "small-100" | "base" | "large" | "large-100"**

  **Default: 'base'**

  **required**

  The size of the product thumbnail image.

  * `small-200`: Smallest thumbnail size, ideal for compact product lists or tables.
  * `small-100`: Very small thumbnail, suitable for dense layouts.
  * `small`: Small thumbnail for space-constrained contexts.
  * `base`: Default size that balances visibility and space efficiency.
  * `large`: Larger thumbnail for featured products or detailed views.
  * `large-100`: Extra large thumbnail for prominent product display.

### Events

The thumbnail component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **error**

  **OnErrorEventHandler**

  **required**

  A callback fired when the thumbnail image fails to load.

  Learn more about the [error event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event).

* **load**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the thumbnail image successfully loads.

  Learn more about the [load event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event).

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

***

## Examples

### Display a thumbnail

Display small preview images for products or items. This example presents a basic thumbnail with source URL and alt text for accessibility.

## html

```html
<s-thumbnail
  alt="Image of white sneakers"
  src="https://cdn.shopify.com/static/images/polaris/thumbnail-wc_src.jpg"
></s-thumbnail>
```

### Show an empty state

Show a placeholder when no image is available. This example displays a thumbnail without a source that renders a default icon.

## html

```html
<s-thumbnail alt="No image available" size="base"></s-thumbnail>
```

### Adjust the size

Adapt thumbnail prominence to different contexts. This example displays `small-200`, `base`, and `large` sizes in a vertical stack.

## html

```html
<s-stack gap="large-100">
  <s-thumbnail
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Image of indoor plant"
    size="small-200"
  ></s-thumbnail>
  <s-thumbnail
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Image of indoor plant"
    size="base"
  ></s-thumbnail>
  <s-thumbnail
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Image of indoor plant"
    size="large"
  ></s-thumbnail>
</s-stack>
```

### Handle load events

Respond to image loading success or failure. This example uses `load` and `error` event listeners to update the UI based on the loading result.

## html

```html
<s-stack direction="inline" gap="base" alignItems="center">
  <s-thumbnail
    id="product-thumbnail"
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Image of indoor plant"
    size="small-200"
  />
  <s-text id="status-text">Loading...</s-text>
</s-stack>


<script>
  const thumbnail = document.getElementById('product-thumbnail');
  const statusText = document.getElementById('status-text');


  thumbnail.addEventListener('load', () => {
    statusText.textContent = 'Image loaded';
  });


  thumbnail.addEventListener('error', () => {
    statusText.textContent = 'Failed to load image';
  });
</script>
```

***

## Useful for

* Identifying items visually in lists, tables, or cards.
* Seeing a preview of images before uploading or publishing.
* Distinguishing between similar items by their appearance.
* Confirming the correct item is selected.

***

## Best practices

* `small-200`: use in very small areas.
* `small`: use in small areas.
* `base`: use as the default size.
* `large`: use when thumbnail is a focal point.

***

## Content guidelines

Alternative text should be accurate, concise, and descriptive:

* Use "Image of", "Photo of" prefix.
* Be primary visual content: "Image of a woman with curly brown hair smiling".
* Include relevant emotions: "Image of a woman laughing with her hand on her face".

***
