---
title: Box
description: >-
  The box component provides a generic, flexible container for custom designs
  and layouts. Use box to apply styling like backgrounds, padding, borders, or
  border radius when existing components don't meet your needs, or to nest and
  group other components.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box.md
api_name: app-home
---

# Box

The box component provides a generic, flexible container for custom designs and layouts. Use box to apply styling like backgrounds, padding, borders, or border radius when existing components don't meet your needs, or to nest and group other components.

Box contents maintain their natural size, making it especially useful within layout components that would otherwise stretch their children. For structured layouts, use [stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack) or [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid).

#### Use cases

* **Spacing control:** Add consistent padding and margins around content groups.
* **Visual containers:** Create visual boundaries around related UI elements.
* **Layout building:** Build complex layouts by nesting Box components with different spacing.
* **Responsive sizing:** Apply responsive sizing that adapts to container width.

***

## Properties

Configure the following properties on the box component.

* **accessibility​Role**

  **AccessibilityRole**

  **Default: 'generic'**

  **required**

  The semantic meaning of the component’s content. When set, the role will be used by assistive technologies to help users navigate the page.

* **background**

  **BackgroundColorKeyword**

  **Default: 'transparent'**

  **required**

  The background color of the component.

* **block​Size**

  **SizeUnitsOrAuto**

  **Default: 'auto'**

  **required**

  The vertical size of the element in standard layouts (height in left-to-right or right-to-left writing modes).

  Block size adjusts based on the writing direction: in horizontal layouts, it controls the height; in vertical layouts, it controls the width. This ensures consistent behavior across different text directions.

  Learn more about [block-size](https://developer.mozilla.org/en-US/docs/Web/CSS/block-size).

* **min​Block​Size**

  **SizeUnits**

  **Default: '0'**

  **required**

  The minimum height in horizontal writing modes, or minimum width in vertical writing modes. Prevents the element from shrinking below this size.

  Learn more about [min-block-size](https://developer.mozilla.org/en-US/docs/Web/CSS/min-block-size).

* **max​Block​Size**

  **SizeUnitsOrNone**

  **Default: 'none'**

  **required**

  The maximum height in horizontal writing modes, or maximum width in vertical writing modes. Prevents the element from growing beyond this size.

  Learn more about [max-block-size](https://developer.mozilla.org/en-US/docs/Web/CSS/max-block-size).

* **inline​Size**

  **SizeUnitsOrAuto**

  **Default: 'auto'**

  **required**

  The width in horizontal writing modes, or height in vertical writing modes. Use this for flow-relative sizing that adapts to text direction. Learn more about [inline-size](https://developer.mozilla.org/en-US/docs/Web/CSS/inline-size).

* **min​Inline​Size**

  **SizeUnits**

  **Default: '0'**

  **required**

  The minimum width in horizontal writing modes, or minimum height in vertical writing modes. Prevents the element from shrinking below this size.

  Learn more about [min-inline-size](https://developer.mozilla.org/en-US/docs/Web/CSS/min-inline-size).

* **max​Inline​Size**

  **SizeUnitsOrNone**

  **Default: 'none'**

  **required**

  The maximum width in horizontal writing modes, or maximum height in vertical writing modes. Prevents the element from growing beyond this size.

  Learn more about [max-inline-size](https://developer.mozilla.org/en-US/docs/Web/CSS/max-inline-size).

* **overflow**

  **"visible" | "hidden"**

  **Default: 'visible'**

  **required**

  The overflow behavior of the element.

  * `visible`: the content that extends beyond the element’s container is visible.
  * `hidden`: clips the content when it is larger than the element’s container. The element will not be scrollable and the users will not be able to access the clipped content by dragging or using a scroll wheel on a mouse.

* **padding**

  **MaybeResponsive\<MaybeAllValuesShorthandProperty\<PaddingKeyword>>**

  **Default: 'none'**

  **required**

  The padding applied to all edges of the component.

  Supports [1-to-4-value syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties#edges_of_a_box) using flow-relative values:

  * 1 value applies to all sides
  * 2 values apply to block (top/bottom) and inline (left/right)
  * 3 values apply to block-start (top), inline (left/right), and block-end (bottom)
  * 4 values apply to block-start (top), inline-end (right), block-end (bottom), and inline-start (left)

  **Examples:** `base`, `large none`, `base large-100 base small`

  Use `auto` to inherit padding from the nearest container with removed padding. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Block**

  **MaybeResponsive<"" | MaybeTwoValuesShorthandProperty\<PaddingKeyword>>**

  **Default: '' - meaning no override**

  **required**

  The block-direction padding (top and bottom in horizontal writing modes).

  Accepts a single value for both sides or two space-separated values for block-start and block-end.

  **Example:** `large none` applies `large` to the top and `none` to the bottom.

  Overrides the block value from `padding`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Block​Start**

  **MaybeResponsive<"" | PaddingKeyword>**

  **Default: '' - meaning no override**

  **required**

  The block-start padding (top in horizontal writing modes).

  Overrides the block-start value from `paddingBlock`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Block​End**

  **MaybeResponsive<"" | PaddingKeyword>**

  **Default: '' - meaning no override**

  **required**

  The block-end padding (bottom in horizontal writing modes).

  Overrides the block-end value from `paddingBlock`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Inline**

  **MaybeResponsive<"" | MaybeTwoValuesShorthandProperty\<PaddingKeyword>>**

  **Default: '' - meaning no override**

  **required**

  The inline-direction padding (left and right in horizontal writing modes).

  Accepts a single value for both sides or two space-separated values for inline-start and inline-end.

  **Example:** `large none` applies `large` to the left and `none` to the right.

  Overrides the inline value from `padding`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Inline​Start**

  **MaybeResponsive<"" | PaddingKeyword>**

  **Default: '' - meaning no override**

  **required**

  The inline-start padding (left in LTR writing modes, right in RTL).

  Overrides the inline-start value from `paddingInline`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **padding​Inline​End**

  **MaybeResponsive<"" | PaddingKeyword>**

  **Default: '' - meaning no override**

  **required**

  The inline-end padding (right in LTR writing modes, left in RTL).

  Overrides the inline-end value from `paddingInline`. Also accepts a [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported `PaddingKeyword` as a query value.

* **border**

  **BorderShorthand**

  **Default: 'none' - equivalent to \`none base auto\`.**

  **required**

  A border applied using shorthand syntax to specify width, color, and style in a single property.

* **border​Width**

  **"" | MaybeAllValuesShorthandProperty<"small" | "small-100" | "base" | "large" | "large-100" | "none">**

  **Default: '' - meaning no override**

  **required**

  The thickness of the border on all sides. When set, this overrides the width value specified in the `border` property.

* **border​Style**

  **"" | MaybeAllValuesShorthandProperty\<BoxBorderStyles>**

  **Default: '' - meaning no override**

  **required**

  The visual style of the border on all sides, such as solid, dashed, or dotted. When set, this overrides the style value specified in the `border` property.

* **border​Color**

  **"" | ColorKeyword**

  **Default: '' - meaning no override**

  **required**

  The color of the border using the design system's color scale. When set, this overrides the color value specified in the `border` property.

* **border​Radius**

  **MaybeAllValuesShorthandProperty\<BoxBorderRadii>**

  **Default: 'none'**

  **required**

  The roundedness of the element's corners using the design system's radius scale.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **accessibility​Visibility**

  **"visible" | "hidden" | "exclusive"**

  **Default: 'visible'**

  **required**

  The visibility mode of the element for both visual and assistive technology users.

  * `visible`: The element is visible to all users (both sighted users and screen readers).
  * `hidden`: The element is visually visible but hidden from screen readers. Use this for decorative elements that don't provide meaningful information.
  * `exclusive`: The element is visually hidden but announced by screen readers. Use this for screen-reader-only content like skip links or additional context.

* **display**

  **MaybeResponsive<"auto" | "none">**

  **Default: 'auto'**

  **required**

  The outer [display](https://developer.mozilla.org/en-US/docs/Web/CSS/display) type of the component. The outer type sets a component's participation in [flow layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flow_layout).

  * `auto` the component's initial value. The actual value depends on the component and context.
  * `none` hides the component from display and removes it from the accessibility tree, making it invisible to screen readers.

### AccessibilityRole

Defines the semantic role of a component for assistive technologies like screen readers. Accessibility roles help users with disabilities understand the purpose and structure of content. These roles map to HTML elements and ARIA roles, providing semantic meaning beyond visual presentation. Use these roles to: - Improve navigation for screen reader users - Provide semantic structure to your UI - Ensure proper interpretation by assistive technologies Learn more about \[ARIA roles]\(https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles) in the MDN web docs. - \`main\`: Indicates the primary content area of the page. - \`header\`: Marks a component as a header containing introductory content or navigation. - \`footer\`: Designates content containing information like copyright, navigation links, or privacy statements. - \`section\`: Defines a generic thematic grouping of content that should have a heading or accessible label. - \`aside\`: Marks supporting content that relates to but is separate from the main content. - \`navigation\`: Identifies major groups of navigation links for moving around the site or page. - \`ordered-list\`: Represents a list where the order of items is meaningful. - \`list-item\`: Identifies an individual item within a list. - \`list-item-separator\`: Acts as a visual and semantic divider between items in a list. - \`unordered-list\`: Represents a list where the order of items is not meaningful. - \`separator\`: Creates a divider that separates and distinguishes sections of content. - \`status\`: Defines a live region for advisory information that is not urgent enough to be an alert. - \`alert\`: Marks important, time-sensitive information that requires the user's immediate attention. - \`generic\`: Creates a semantically neutral container element with no inherent meaning. - \`presentation\`: Removes semantic meaning from an element while preserving its visual appearance. - \`none\`: Synonym for \`presentation\`, removes semantic meaning while keeping visual styling.

```ts
'main' | 'header' | 'footer' | 'section' | 'aside' | 'navigation' | 'ordered-list' | 'list-item' | 'list-item-separator' | 'unordered-list' | 'separator' | 'status' | 'alert' | 'generic' | 'presentation' | 'none'
```

### BackgroundColorKeyword

Defines the background color intensity or emphasis level for UI elements. - \`transparent\`: No background, allowing the underlying surface to show through. - \`ColorKeyword\`: Applies color intensity levels (subdued, base, strong) to create spatial emphasis and containment.

```ts
'transparent' | ColorKeyword
```

### ColorKeyword

Defines the color intensity or emphasis level for text and UI elements. - \`subdued\`: Deemphasized color for secondary text, supporting labels, and less critical interface elements. - \`base\`: Primary color for body text, standard UI elements, and general content with good readability. - \`strong\`: Emphasized color for headings, key labels, and interactive elements that need prominence.

```ts
'subdued' | 'base' | 'strong'
```

### SizeUnitsOrAuto

Represents size values that can also be set to \`auto\` for automatic sizing. - \`SizeUnits\`: Specific size values in pixels, percentages, or zero for precise control. - \`auto\`: Automatically sizes based on content and layout constraints.

```ts
SizeUnits | 'auto'
```

### SizeUnits

Represents size values in pixels, percentages, or zero. - \`${number}px\`: Absolute size in pixels for fixed dimensions (such as \`100px\`, \`24px\`). - \`${number}%\`: Relative size as a percentage of the parent container (such as \`50%\`, \`100%\`). - \`0\`: Zero size, equivalent to no dimension.

```ts
`${number}px` | `${number}%` | `0`
```

### SizeUnitsOrNone

Represents size values that can also be set to \`none\` to remove the size constraint. - \`SizeUnits\`: Specific size values in pixels, percentages, or zero for precise control. - \`none\`: No size constraint, allowing unlimited growth.

```ts
SizeUnits | 'none'
```

### MaybeResponsive

Makes a property responsive by allowing it to be set conditionally based on container query conditions. The value can be either a base value or a container query string. - \`T\`: Base value that applies in all conditions. - \`@container${string}\`: Container query string for conditional responsive styling based on container size.

```ts
T | `@container${string}`
```

### MaybeAllValuesShorthandProperty

Represents CSS shorthand properties that accept one to four values. Supports specifying values for all four sides: top, right, bottom, and left. - \`T\`: Single value that applies to all four sides. - \`${T} ${T}\`: Two values for block axis (top/bottom) and inline axis (left/right). - \`${T} ${T} ${T}\`: Three values for block-start (top), inline axis (left/right), and block-end (bottom). - \`${T} ${T} ${T} ${T}\`: Four values for block-start (top), inline-end (right), block-end (bottom), and inline-start (left).

```ts
T | `${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T} ${T} ${T}`
```

### PaddingKeyword

Defines the padding size for elements, using the standard size scale or \`none\` for no padding. - \`SizeKeyword\`: Standard padding sizes from the size scale for consistent spacing. - \`none\`: No padding.

```ts
SizeKeyword | 'none'
```

### SizeKeyword

Defines component sizes using a consistent scale from extra small to extra large. - \`small-500\` through \`small-100\`: Extra small to small sizes, progressively increasing. - \`small\`: Standard small size. - \`base\`: Default medium size that works well in most contexts. - \`large\`: Standard large size. - \`large-100\` through \`large-500\`: Large to extra large sizes, progressively increasing.

```ts
'small-500' | 'small-400' | 'small-300' | 'small-200' | 'small-100' | 'small' | 'base' | 'large' | 'large-100' | 'large-200' | 'large-300' | 'large-400' | 'large-500'
```

### MaybeTwoValuesShorthandProperty

Represents CSS shorthand properties that accept one or two values. Supports specifying the same value for both dimensions or different values. - \`T\`: Single value that applies to both dimensions. - \`${T} ${T}\`: Two values for block axis (vertical) and inline axis (horizontal).

```ts
T | `${T} ${T}`
```

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

### BorderStyleKeyword

Defines the visual style of borders. - \`none\`: No border is displayed. - \`solid\`: A single solid line. - \`dashed\`: A series of short dashes. - \`dotted\`: A series of dots. - \`auto\`: Automatically determined based on context.

```ts
'none' | 'solid' | 'dashed' | 'dotted' | 'auto'
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

### Slots

The box component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the box component, which serves as a flexible container for organizing and styling other components.

***

## Examples

### Add a content container

Create a container with padding and optional visual styling. This example shows a plain box and a styled box with background, border, and rounded corners.

## html

```html
<s-box padding="base">Available for iPad, iPhone, and Android.</s-box>


<s-box padding="base" background="subdued" border="base" borderRadius="base">
  Available for iPad, iPhone, and Android.
</s-box>
```

### Adapt spacing with responsive padding

Use responsive padding values with container queries to adapt spacing based on available width. This example shows a shipping notice that adjusts its padding depending on the container size.

## html

```html
<s-query-container>
  <s-box
    padding="@container (inline-size > 400px) base, large-200"
    background="base"
    borderWidth="base"
    borderColor="base"
  >
    <s-paragraph>Your order will be processed within 2-3 business days</s-paragraph>
  </s-box>
</s-query-container>
```

### Announce dynamic updates with a live region

Set the `accessibilityRole` property to `status` to create a live region. When your code updates the text inside this box , screen readers automatically announce the new content. Use this for any content that updates dynamically.

## html

```html
<s-box
  accessibilityRole="status"
  padding="base"
  background="strong"
  borderRadius="base"
>
  <s-paragraph>Syncing inventory: 3 of 10 products updated</s-paragraph>
</s-box>
```

### Add screen-reader-only content

Set the `accessibilityVisibility` property to `exclusive` to hide content visually while keeping it available to screen readers. This example shows a box with pricing context that only assistive technology users can access.

## html

```html
<s-box accessibilityVisibility="exclusive">
  <s-paragraph>Price includes tax and shipping</s-paragraph>
</s-box>
```

### Build nested card layouts

Nest boxes to create hierarchical layouts with distinct visual sections. This example shows an inventory status section and a product sales section organized as cards within a vertical stack.

## html

```html
<s-stack gap="base">
  <!-- Inventory status section -->
  <s-box
    padding="base"
    background="base"
    borderRadius="base"
    borderWidth="base"
    borderColor="base"
  >
    <s-stack gap="base">
      <s-box padding="small-100" background="subdued" borderRadius="small">
        <s-paragraph>In stock: 45 units</s-paragraph>
      </s-box>
      <s-box padding="small-100" background="subdued" borderRadius="small">
        <s-paragraph>Low stock alert: 5 units</s-paragraph>
      </s-box>
    </s-stack>
  </s-box>


  <!-- Product information section -->
  <s-box
    padding="base"
    background="base"
    borderRadius="base"
    borderWidth="base"
    borderColor="base"
  >
    <s-stack gap="base">
      <s-heading>Product sales</s-heading>
      <s-paragraph color="subdued">No recent sales of this product</s-paragraph>
      <s-link>View details</s-link>
    </s-stack>
  </s-box>
</s-stack>
```

***

## Best practices

* **Use for layout and grouping:** The component provides spacing, borders, and backgrounds for organizing content. When you need specific layout patterns like rows or columns, use [stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack) or [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) instead. The component works best as a general-purpose container.
* **Consider semantic alternatives first:** Before using the component, check whether a more specific component like [section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section) or [banner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner) better describes your content's purpose. Semantic components provide better accessibility and clearer intent.
* **Design for different screen sizes:** Layouts that work on desktop might not work on mobile. Use responsive properties to adjust spacing and layout based on available space rather than creating fixed layouts.
* **Make interactive containers accessible:** When boxes contain interactive content or represent distinct regions, provide appropriate ARIA roles and labels so screen reader users can navigate and understand the interface structure.
* **Avoid excessive nesting:** Deep nesting of boxes creates complex DOM structures and makes styling harder to manage. Look for opportunities to simplify your layout or use more appropriate layout components.

***
