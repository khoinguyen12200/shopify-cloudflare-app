---
title: Image
description: >-
  The image component embeds images within the interface with control over
  presentation and loading behavior. Use image to visually illustrate concepts,
  showcase products, display user content, or support tasks and interactions
  with visual context.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image.md
api_name: app-home
---

# Image

The image component embeds images within the interface with control over presentation and loading behavior. Use image to visually illustrate concepts, showcase products, display user content, or support tasks and interactions with visual context.

Images support responsive sizing, alt text for accessibility, aspect ratio control, and loading states for progressive enhancement. For small preview images in lists or tables, use [thumbnail](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail). For profile images, use [avatar](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar).

#### Use cases

* **Product visuals:** Display product images in configuration interfaces or recommendations.
* **Branding:** Show app logos or brand imagery in action modals.
* **Visual guides:** Provide visual instructions or examples for complex configurations.
* **Marketing content:** Display promotional banners or feature announcements.

***

## Properties

Configure the following properties on the image component.

* **src**

  **string**

  **required**

  The image source (either a remote URL or a local file resource).

  When the image is loading or no `src` is provided, a placeholder is rendered.

* **src​Set**

  **string**

  **required**

  A set of image sources and their width or pixel density descriptors. This overrides the `src` property.

  Learn more about the [srcset attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#srcset).

* **sizes**

  **string**

  **required**

  A set of media conditions and their corresponding sizes.

  Learn more about the [sizes attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#sizes).

* **alt**

  **string**

  **Default: \`\`**

  **required**

  Alternative text that describes the image for accessibility.

  Provides a text description of the image for users with assistive technology and serves as a fallback when the image fails to load. A well-written description enables people with visual impairments to understand non-text content.

  When a screen reader encounters an image, it reads this description aloud. When an image fails to load, this text displays on screen, helping all users understand what content was intended.

  Learn more about [writing effective alt text](https://www.shopify.com/ca/blog/image-alt-text#4) and the [alt attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt).

* **aspect​Ratio**

  **\`${number}\` | \`${number}/${number}\` | \`${number}/ ${number}\` | \`${number} /${number}\` | \`${number} / ${number}\`**

  **Default: '1/1'**

  **required**

  The aspect ratio of the image.

  The rendering of the image will depend on the `inlineSize` value:

  * `inlineSize="fill"`: the aspect ratio will be respected and the image will take the necessary space.
  * `inlineSize="auto"`: the image will not render until it has loaded and the aspect ratio will be ignored.

  For example, if the value is set as `50 / 100`, the getter returns `50 / 100`. If the value is set as `0.5`, the getter returns `0.5 / 1`.

  Learn more about the [aspect-ratio property](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio).

* **object​Fit**

  **"contain" | "cover"**

  **Default: 'contain'**

  **required**

  The image resizing behavior to fit within its container.

  * `contain`: Scales the image to fit within the container while maintaining its aspect ratio. The entire image is visible, but might leave empty space.
  * `cover`: Scales the image to fill the entire container while maintaining its aspect ratio. The image might be cropped to fit.

  The image is always positioned in the center of the container.

  Learn more about the [object-fit property](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit).

* **loading**

  **"eager" | "lazy"**

  **Default: 'eager'**

  **required**

  The loading strategy for the image.

  * `eager`: Immediately loads the image, irrespective of its position within the visible viewport.
  * `lazy`: Delays loading the image until it approaches a specified distance from the viewport.

  Learn more about the [loading attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#loading).

* **accessibility​Role**

  **"none" | "presentation" | "img"**

  **Default: 'img'**

  **required**

  The semantic meaning of the component’s content. When set, the role will be used by assistive technologies to help users navigate the page.

  * `none`: Completely hides the element and its content from assistive technologies
  * `presentation`: Removes semantic meaning, making the image purely decorative and ignored by screen readers.
  * `img`: Identifies the element as an image that conveys meaningful information to users.

* **inline​Size**

  **"auto" | "fill"**

  **Default: 'fill'**

  **required**

  The displayed inline width of the image.

  * `fill`: the image will takes up 100% of the available inline size.
  * `auto`: the image will be displayed at its natural size.

  Learn more about the [width attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#width).

* **border**

  **BorderShorthand**

  **Default: 'none' - equivalent to \`none base auto\`.**

  **required**

  A border applied around the image using shorthand syntax to specify width, color, and style in a single property.

* **border​Width**

  **"" | MaybeAllValuesShorthandProperty<"small" | "small-100" | "base" | "large" | "large-100" | "none">**

  **Default: '' - meaning no override**

  **required**

  The thickness of the border around the image. When set, this overrides the width value specified in the `border` property.

* **border​Style**

  **"" | MaybeAllValuesShorthandProperty\<BoxBorderStyles>**

  **Default: '' - meaning no override**

  **required**

  The visual style of the border around the image, such as solid, dashed, or dotted. When set, this overrides the style value specified in the `border` property.

* **border​Color**

  **"" | ColorKeyword**

  **Default: '' - meaning no override**

  **required**

  The color of the border around the image using the design system's color scale. When set, this overrides the color value specified in the `border` property.

* **border​Radius**

  **MaybeAllValuesShorthandProperty\<BoxBorderRadii>**

  **Default: 'none'**

  **required**

  The roundedness of the image's corners using the design system's radius scale.

### BorderShorthand

Represents a shorthand for defining a border. It can be a combination of size, optionally followed by color, optionally followed by style.

```ts
BorderSizeKeyword | `${BorderSizeKeyword} ${ColorKeyword}` | `${BorderSizeKeyword} ${ColorKeyword} ${BorderStyleKeyword}`
```

### BorderSizeKeyword

Defines the width of borders, using the standard size scale or \`none\` for no border. - \`SizeKeyword\`: Standard border widths from the size scale for consistent thickness. - \`none\`: No border width (removes the border).

```ts
SizeKeyword | 'none'
```

### SizeKeyword

Defines component sizes using a consistent scale from extra small to extra large. - \`small-500\` through \`small-100\`: Extra small to small sizes, progressively increasing. - \`small\`: Standard small size. - \`base\`: Default medium size that works well in most contexts. - \`large\`: Standard large size. - \`large-100\` through \`large-500\`: Large to extra large sizes, progressively increasing.

```ts
'small-500' | 'small-400' | 'small-300' | 'small-200' | 'small-100' | 'small' | 'base' | 'large' | 'large-100' | 'large-200' | 'large-300' | 'large-400' | 'large-500'
```

### ColorKeyword

Defines the color intensity or emphasis level for text and UI elements. - \`subdued\`: Deemphasized color for secondary text, supporting labels, and less critical interface elements. - \`base\`: Primary color for body text, standard UI elements, and general content with good readability. - \`strong\`: Emphasized color for headings, key labels, and interactive elements that need prominence.

```ts
'subdued' | 'base' | 'strong'
```

### BorderStyleKeyword

Defines the visual style of borders. - \`none\`: No border is displayed. - \`solid\`: A single solid line. - \`dashed\`: A series of short dashes. - \`dotted\`: A series of dots. - \`auto\`: Automatically determined based on context.

```ts
'none' | 'solid' | 'dashed' | 'dotted' | 'auto'
```

### MaybeAllValuesShorthandProperty

Represents CSS shorthand properties that accept one to four values. Supports specifying values for all four sides: top, right, bottom, and left. - \`T\`: Single value that applies to all four sides. - \`${T} ${T}\`: Two values for block axis (top/bottom) and inline axis (left/right). - \`${T} ${T} ${T}\`: Three values for block-start (top), inline axis (left/right), and block-end (bottom). - \`${T} ${T} ${T} ${T}\`: Four values for block-start (top), inline-end (right), block-end (bottom), and inline-start (left).

```ts
T | `${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T} ${T} ${T}`
```

### BoxBorderStyles

Represents the subset of border style values supported by the box component. - \`auto\`: Default border style determined by the system. - \`none\`: No border style (removes the border). - \`solid\`: Continuous line border. - \`dashed\`: Border made up of dashes.

```ts
'auto' | 'none' | 'solid' | 'dashed'
```

### BoxBorderRadii

Represents the subset of border radius values supported by the component. - \`small-200\`: Extra small radius for subtle rounding. - \`small-100\`: Small radius for minimal corner rounding. - \`small\`: Standard small radius. - \`base\`: Medium radius for moderate corner rounding. - \`large\`: Standard large radius for pronounced rounding. - \`large-100\`: Large radius for more prominent corner rounding. - \`large-200\`: Extra large radius for maximum rounding. - \`none\`: No border radius (sharp corners).

```ts
'small' | 'small-200' | 'small-100' | 'base' | 'large' | 'large-100' | 'large-200' | 'none'
```

### Events

The image component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **error**

  **OnErrorEventHandler**

  **required**

  A callback fired when the image fails to load.

  Learn more about the [error event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event).

* **load**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the image successfully loads.

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

### Display a product thumbnail

Display a product thumbnail with metadata in a grid layout. This example demonstrates how to control image sizing with `aspectRatio`, `objectFit`, and `inlineSize`, and round corners with `borderRadius`.

## html

```html
<s-grid gridTemplateColumns="80px 1fr" gap="base" alignItems="center">
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Indoor plant"
    aspectRatio="1/1"
    objectFit="cover"
    borderRadius="base"
    inlineSize="fill"
  />
  <s-stack gap="small">
    <s-text type="strong">Indoor Plant</s-text>
    <s-text color="subdued">SKU: PLT-001</s-text>
    <s-text tone="success">In stock</s-text>
  </s-stack>
</s-grid>
```

### Set an aspect ratio

Control image proportions with a fixed aspect ratio. This example displays a 16:9 image that scales to fill its container using `objectFit="cover"`, with lazy loading for performance.

## html

```html
<s-image
  src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
  alt="Featured product"
  aspectRatio="16/9"
  objectFit="cover"
  loading="lazy"
></s-image>
```

### Use responsive images

Set up responsive image sources using `srcSet` and `sizes`. This example demonstrates how to configure the browser to select appropriate image sources based on viewport width.

## html

```html
<s-image
  src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
  srcSet="https://cdn.shopify.com/static/sample-product/House-Plant1.png 400w,
          https://cdn.shopify.com/static/sample-product/House-Plant1.png 800w"
  sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 400px"
  alt="Product detail"
  aspectRatio="16/9"
  objectFit="cover"
></s-image>
```

### Add border styling

Add visual emphasis with border styling. This example displays an image with border width, color, and rounded corners.

## html

```html
<s-box inlineSize="300px">
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Product thumbnail"
    borderWidth="large"
    borderStyle="solid"
    borderColor="strong"
    borderRadius="large"
    objectFit="cover"
    aspectRatio="1/1"
  ></s-image>
</s-box>
```

### Mark as decorative

Hide images from screen readers when purely decorative. This example presents an image with empty `alt` text and `presentation` role for accessibility.

## html

```html
<s-image
  src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
  alt=""
  accessibilityRole="presentation"
  objectFit="cover"
></s-image>
```

### Use in a grid layout

Build a product image gallery with consistent sizing using [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid). This example arranges three product photos in a row, each constrained to a square with rounded corners so they line up evenly.

## html

```html
<s-grid gridTemplateColumns="repeat(3, 150px)" gap="base" alignItems="center">
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Main view"
    aspectRatio="1/1"
    objectFit="cover"
    borderRadius="base"
    inlineSize="fill"
  ></s-image>
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Side view"
    aspectRatio="1/1"
    objectFit="cover"
    borderRadius="base"
    inlineSize="fill"
  ></s-image>
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="Detail view"
    aspectRatio="1/1"
    objectFit="cover"
    borderRadius="base"
    inlineSize="fill"
  ></s-image>
</s-grid>
```

***

## Useful for

* Adding illustrations and photos.

***

## Best practices

* Use high-resolution, optimized images.
* Use intentionally to add clarity and guide users.

***

## Content guidelines

Alt text should be accurate, concise, and descriptive:

* Indicate it's an image: "Image of", "Photo of".
* Focus on description: "Image of a woman with curly brown hair smiling".

***
