---
title: Avatar
description: >-
  The avatar component displays profile images or initials for users, customers,
  and businesses in a compact visual format. Use avatar to represent people or
  entities throughout the interface, with automatic fallback to initials when
  images aren't available.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar.md
api_name: app-home
---

# Avatar

The avatar component displays profile images or initials for users, customers, and businesses in a compact visual format. Use avatar to represent people or entities throughout the interface, with automatic fallback to initials when images aren't available.

Avatars support multiple sizes for different contexts and provide consistent color assignment for initials based on the name provided. For product or content preview images, use [thumbnail](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail). For full-size images, use [image](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image).

#### Use cases

* **User representation:** Display user avatars with initials or images.
* **Staff identification:** Show staff member avatars in admin interfaces.
* **Visual recognition:** Help identify users or customers with avatar imagery.
* **Compact displays:** Represent users in space-constrained interfaces.

***

## Properties

Configure the following properties on the avatar component.

* **initials**

  **string**

  **required**

  The initials to display in the avatar when no image is provided or fails to load. Typically one or two characters representing a person's first and last name initials, such as "JD" for John Doe.

* **src**

  **string**

  **required**

  The URL or path to the avatar image. When provided, the image takes priority over `initials`. If the image fails to load or loads slowly, `initials` will be rendered as a fallback.

* **size**

  **"small" | "small-200" | "base" | "large" | "large-200"**

  **Default: 'base'**

  **required**

  The size of the avatar image.

  * `small-200`: Extra small avatar, suitable for compact displays or lists with many items.
  * `small`: Small avatar, good for secondary contexts or tight layouts.
  * `base`: Default size that works well in most contexts.
  * `large`: Large avatar for emphasis or when the avatar is a focal point.
  * `large-200`: Extra large avatar for prominent display.

* **alt**

  **string**

  **required**

  Alternative text that describes the avatar for accessibility.

  Provides a text description of the avatar for users with assistive technology and serves as a fallback when the avatar fails to load. A well-written description enables people with visual impairments to understand non-text content.

  When a screen reader encounters an avatar, it reads this description aloud. When an avatar fails to load, this text displays on screen, helping all users understand what content was intended.

  Learn more about [writing effective alt text](https://www.shopify.com/ca/blog/image-alt-text#4) and the [alt attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt).

### Events

The avatar component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **error**

  **OnErrorEventHandler**

  **required**

  A callback fired when the avatar image fails to load.

  Learn more about the [error event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event).

* **load**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the avatar image successfully loads.

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

### Display initials

Identify users visually when no profile image is available. This example displays an avatar with initials derived from a name.

## html

```html
<s-avatar alt="John Doe" initials="JD"></s-avatar>
```

### Show a placeholder avatar

Represent unknown users with a generic icon. This example displays a placeholder avatar when no initials or image are provided.

## html

```html
<s-avatar alt="Customer"></s-avatar>
```

### Load an image with fallback

Display profile photos with graceful error handling. This example presents an avatar with a source image that falls back to initials if the image fails to load.

## html

```html
<s-avatar
  src="/customers/profile-123.jpg"
  initials="MR"
  alt="Maria Rodriguez"
  size="base"
></s-avatar>
```

### Adjust the size

Adapt avatar prominence to different UI contexts. This example demonstrates all five available sizes from `small-200` to `large-200`.

## html

```html
<s-stack direction="inline" gap="base">
  <s-avatar initials="SC" alt="Store customer" size="small-200"></s-avatar>
  <s-avatar initials="MR" alt="Merchant representative" size="small"></s-avatar>
  <s-avatar initials="SM" alt="Store manager" size="base"></s-avatar>
  <s-avatar initials="SF" alt="Staff member" size="large"></s-avatar>
  <s-avatar initials="SO" alt="Store owner" size="large-200"></s-avatar>
</s-stack>
```

### Handle long names

Display initials of varying lengths consistently. This example presents avatars with two, three, and four character initials.

## html

```html
<s-stack direction="inline" gap="base">
  <s-avatar initials="TC" alt="Tech customer" size="base"></s-avatar>
  <s-avatar initials="VIP" alt="VIP customer store" size="base"></s-avatar>
  <s-avatar initials="SHOP" alt="Shopify partner store" size="base"></s-avatar>
</s-stack>
```

### Maintain color consistency

Ensure visual consistency across the interface. This example demonstrates that avatars with identical initials always display the same background color.

## html

```html
<s-stack direction="inline" gap="base">
  <s-avatar initials="AB" alt="Apparel boutique" size="base"></s-avatar>
  <s-avatar initials="CD" alt="Coffee direct" size="base"></s-avatar>
  <s-avatar initials="EF" alt="Electronics franchise" size="base"></s-avatar>
  <s-avatar initials="AB" alt="Art books store" size="base"></s-avatar>
  <!-- Note: Both AB avatars will have the same color -->
</s-stack>
```

### Display in a customer list

Show customer identities in list views. This example pairs avatars with customer names in a vertical stack layout.

## html

```html
<s-stack gap="base">
  <s-stack direction="inline" gap="small">
    <s-avatar
      src="/customers/merchant-alice.jpg"
      initials="AJ"
      alt="Alice's jewelry store"
      size="small"
    ></s-avatar>
    <s-text>Alice's jewelry store</s-text>
  </s-stack>
  <s-stack direction="inline" gap="small">
    <s-avatar initials="BP" alt="Bob's pet supplies" size="small"></s-avatar>
    <s-text>Bob's pet supplies</s-text>
  </s-stack>
  <s-stack direction="inline" gap="small">
    <s-avatar
      src="/customers/charlie-cafe.jpg"
      initials="CC"
      alt="Charlie's coffee corner"
      size="small"
    ></s-avatar>
    <s-text>Charlie's coffee corner</s-text>
  </s-stack>
</s-stack>
```

### Build a merchant profile card

Create a profile layout with multiple components. This example combines an avatar with [section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section), [heading](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading), and [text](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text) components.

## html

```html
<s-section>
  <s-stack gap="base">
    <s-stack direction="inline" gap="small">
      <s-avatar
        src="/merchants/premium-store.jpg"
        initials="PS"
        alt="Premium store"
        size="base"
      ></s-avatar>
      <s-stack gap="small-400">
        <s-heading>Premium store</s-heading>
        <s-text color="subdued">Shopify Plus merchant</s-text>
      </s-stack>
    </s-stack>
    <s-text>Monthly revenue: $45,000</s-text>
  </s-stack>
</s-section>
```

***

## Best practices

* **Choose appropriate sizes**: Use smaller sizes for compact contexts like tables and lists, and larger sizes for profile pages where the person is the primary focus.
* **Provide meaningful alt text**: Describe the avatar content like **Sarah Chen** or **Acme Corporation**, or use empty alt text if the name appears next to the avatar as text.
* **Position near related content**: Place avatars adjacent to the names or entities they represent for clear associations in lists, tables, or cards.

***

## Limitations

* Avatar images must be served from URLs accessible by the merchant's browser. If the image is hosted on a different domain, the server must include appropriate `Access-Control-Allow-Origin` headers or the image might fail to load.
* Only standard web image formats (JPEG, PNG, GIF, WebP, SVG) are supported. Unsupported formats will fall back to initials.
* The `initials` prop accepts a string that displays when no image is available. Characters beyond the first two might be truncated. Special characters, emojis, or non-Latin scripts might not render as expected.

***
