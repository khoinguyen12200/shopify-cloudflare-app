---
title: Grid
description: >-
  The grid component organizes content in a matrix of rows and columns to create
  responsive page layouts. Use grid to build complex, multi-column layouts that
  adapt to different screen sizes and maintain consistent alignment.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid.md
api_name: app-home
---

# Grid

The grid component organizes content in a matrix of rows and columns to create responsive page layouts. Use grid to build complex, multi-column layouts that adapt to different screen sizes and maintain consistent alignment.

Grid follows the CSS grid layout pattern and supports flexible column configurations, gap spacing, and alignment properties for precise layout control. For simpler linear layouts (horizontal or vertical), use [stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack).

#### Use cases

* **Grid layouts:** Create responsive grid layouts with configurable columns.
* **Card arrangements:** Arrange cards or content in grid patterns.
* **Responsive design:** Build layouts that adapt column counts based on screen size.
* **Equal spacing:** Maintain equal spacing between grid items.

***

## Properties

Configure the following properties on the grid component.

* **grid​Template​Columns**

  **string**

  **Default: 'none'**

  **required**

  The columns in the grid and their sizes.

  Accepts:

  * [Track sizing values](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout#fixed_and_flexible_track_sizes), such as `1fr auto`
  * A [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported track sizing values as a query value

* **grid​Template​Rows**

  **string**

  **Default: 'none'**

  **required**

  The rows in the grid and their sizes.

  Accepts:

  * [Track sizing values](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout#fixed_and_flexible_track_sizes), such as `1fr auto`
  * A [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported track sizing values as a query value

* **justify​Items**

  **"" | JustifyItemsKeyword**

  **Default: '' - meaning no override**

  **required**

  Aligns the grid items along the inline axis.

* **align​Items**

  **"" | AlignItemsKeyword**

  **Default: '' - meaning no override**

  **required**

  Aligns the grid items along the block axis.

* **place​Items**

  **AlignItemsKeyword | "normal normal" | "normal stretch" | "normal baseline" | "normal first baseline" | "normal last baseline" | "normal start" | "normal end" | ... 188 more ... | "safe center safe center"**

  **Default: 'normal normal'**

  **required**

  A shorthand property for `justify-items` and `align-items`.

* **justify​Content**

  **"" | JustifyContentKeyword**

  **Default: '' - meaning no override**

  **required**

  Aligns the grid along the inline axis. This overrides the inline value of `placeContent`.

* **align​Content**

  **"" | AlignContentKeyword**

  **Default: '' - meaning no override**

  **required**

  Aligns the grid along the block axis. This overrides the block value of `placeContent`.

* **place​Content**

  **"normal normal" | "normal stretch" | "normal start" | "normal end" | "normal center" | "normal unsafe start" | "normal unsafe end" | "normal unsafe center" | "normal safe start" | ... 229 more ... | "space-evenly space-evenly"**

  **Default: 'normal normal'**

  **required**

  A shorthand property for `justify-content` and `align-content`.

* **gap**

  **MaybeResponsive\<MaybeTwoValuesShorthandProperty\<SpacingKeyword>>**

  **Default: 'none'**

  **required**

  Adjusts spacing between elements.

  Accepts:

  * A single [`SpacingKeyword`](https://shopify.dev/docs/api/polaris/using-polaris-web-components#scale) value applied to both axes, such as `large-100`
  * A pair of values, such as `large-100 large-500`, to set the inline and block axes respectively
  * A [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported SpacingKeyword as a query value

* **row​Gap**

  **MaybeResponsive<"" | SpacingKeyword>**

  **Default: '' - meaning no override**

  **required**

  s spacing between elements in the block axis. This overrides the row value of `gap`.

  Accepts:

  * A single [`SpacingKeyword`](https://shopify.dev/docs/api/polaris/using-polaris-web-components#scale) value, such as `large-100`
  * A [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported SpacingKeyword as a query value

* **column​Gap**

  **MaybeResponsive<"" | SpacingKeyword>**

  **Default: '' - meaning no override**

  **required**

  Adjusts spacing between elements in the inline axis. This overrides the column value of `gap`.

  Accepts:

  * A single [`SpacingKeyword`](https://shopify.dev/docs/api/polaris/using-polaris-web-components#scale) value, such as `large-100`
  * A [responsive value](https://shopify.dev/docs/api/polaris/using-polaris-web-components#responsive-values) string with the supported SpacingKeyword as a query value

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

### JustifyItemsKeyword

Justify items defines the default justify-self for all items of the box, giving them all a default way of justifying each box along the appropriate axis. Learn more about the \[justify-items property]\(https://developer.mozilla.org/en-US/docs/Web/CSS/justify-items).

```ts
'normal' | 'stretch' | BaselinePosition | OverflowPosition | ContentPosition
```

### BaselinePosition

Represents baseline alignment positions used to align items relative to their baselines. - \`baseline\`: Aligns to the baseline of the parent. - \`first baseline\`: Aligns to the first baseline of the parent. - \`last baseline\`: Aligns to the last baseline of the parent.

```ts
'baseline' | 'first baseline' | 'last baseline'
```

### OverflowPosition

Represents content positioning with overflow behavior control. Use \`safe\` to prevent content from becoming inaccessible when it overflows, or \`unsafe\` to allow overflow regardless of accessibility.

```ts
`unsafe ${ContentPosition}` | `safe ${ContentPosition}`
```

### ContentPosition

Defines the position of content along an axis. - \`center\`: Centers the content. - \`start\`: Aligns content to the start. - \`end\`: Aligns content to the end.

```ts
'center' | 'start' | 'end'
```

### AlignItemsKeyword

Align items sets the align-self value on all direct children as a group. Learn more about the \[align-items property]\(https://developer.mozilla.org/en-US/docs/Web/CSS/align-items).

```ts
'normal' | 'stretch' | BaselinePosition | OverflowPosition | ContentPosition
```

### JustifyContentKeyword

Justify content defines how the browser distributes space between and around content items along the main-axis of a flex container, and the inline axis of a grid container. Learn more about the \[justify-content property]\(https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content).

```ts
'normal' | ContentDistribution | OverflowPosition | ContentPosition
```

### ContentDistribution

Defines how space is distributed between and around content items in flex and grid layouts. - \`space-between\`: Distributes items evenly with the first item at the start and last at the end. - \`space-around\`: Distributes items evenly with equal space around each item. - \`space-evenly\`: Distributes items evenly with equal space between them. - \`stretch\`: Stretches items to fill the container.

```ts
'space-between' | 'space-around' | 'space-evenly' | 'stretch'
```

### AlignContentKeyword

Align content sets the distribution of space between and around content items along a flexbox's cross axis, or a grid or block-level element's block axis. Learn more about the \[align-content property]\(https://developer.mozilla.org/en-US/docs/Web/CSS/align-content).

```ts
'normal' | BaselinePosition | ContentDistribution | OverflowPosition | ContentPosition
```

### MaybeResponsive

Makes a property responsive by allowing it to be set conditionally based on container query conditions. The value can be either a base value or a container query string. - \`T\`: Base value that applies in all conditions. - \`@container${string}\`: Container query string for conditional responsive styling based on container size.

```ts
T | `@container${string}`
```

### MaybeTwoValuesShorthandProperty

Represents CSS shorthand properties that accept one or two values. Supports specifying the same value for both dimensions or different values. - \`T\`: Single value that applies to both dimensions. - \`${T} ${T}\`: Two values for block axis (vertical) and inline axis (horizontal).

```ts
T | `${T} ${T}`
```

### SpacingKeyword

Defines the spacing size between elements, using the standard size scale or \`none\` for no spacing.

```ts
SizeKeyword | 'none'
```

### SizeKeyword

Defines component sizes using a consistent scale from extra small to extra large. - \`small-500\` through \`small-100\`: Extra small to small sizes, progressively increasing. - \`small\`: Standard small size. - \`base\`: Default medium size that works well in most contexts. - \`large\`: Standard large size. - \`large-100\` through \`large-500\`: Large to extra large sizes, progressively increasing.

```ts
'small-500' | 'small-400' | 'small-300' | 'small-200' | 'small-100' | 'small' | 'base' | 'large' | 'large-100' | 'large-200' | 'large-300' | 'large-400' | 'large-500'
```

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

The grid component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The child elements displayed within the grid component, which are arranged in a flexible grid layout with configurable columns, rows, and spacing.

***

## Grid item

The grid item component represents a single cell within a grid layout, allowing you to control how content is positioned and sized within the grid. Use grid item as a child of grid to specify column span, row span, and positioning for individual content areas.

Grid item supports precise placement control through column and row properties, enabling you to create complex layouts where different items occupy varying amounts of space or appear in specific grid positions.

* **grid​Column**

  **"auto" | \`span ${number}\`**

  **Default: 'auto'**

  **required**

  The number of columns the item will span across.

  Learn more about the [grid-column property](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column).

* **grid​Row**

  **"auto" | \`span ${number}\`**

  **Default: 'auto'**

  **required**

  The number of rows the item will span across.

  Learn more about the [grid-row property](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-row).

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

### Slots

The grid item component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the grid item component, which represents a single cell in the grid layout and can span multiple columns or rows.

***

## Examples

### Add a grid layout with column spans

Create a grid layout with columns and grid items that span them. This example shows a two-column grid with a full-width header row and two equal columns below.

## html

```html
<s-grid
  gridTemplateColumns="repeat(2, 1fr)"
  gap="small"
  justifyContent="center"
>
  <s-grid-item gridColumn="span 2" border="base" borderStyle="dashed">
    Summary of sales
  </s-grid-item>
  <s-grid-item gridColumn="span 1" border="base" borderStyle="dashed">
    Orders
  </s-grid-item>
  <s-grid-item gridColumn="auto" border="base" borderStyle="dashed">
    Customers
  </s-grid-item>
</s-grid>
```

### Create a two-column layout

Create a simple two-column layout. This example uses a 12-column grid system with equal-width columns.

## html

```html
<s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
  <s-grid-item gridColumn="span 6" gridRow="span 1">
    <s-section>
      <s-text>Left column</s-text>
    </s-section>
  </s-grid-item>
  <s-grid-item gridColumn="span 6" gridRow="span 1">
    <s-section>
      <s-text>Right column</s-text>
    </s-section>
  </s-grid-item>
</s-grid>
```

### Build layouts with column spans

Use a 12-column grid system with spans to create full-width, half-width, and third-width column arrangements. This example shows multiple rows with progressively narrower columns.

## html

```html
<s-stack gap="base">
  <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
    <s-grid-item gridColumn="span 12" gridRow="span 1">
      <s-section>
        <s-text>Full width field</s-text>
      </s-section>
    </s-grid-item>
    <s-grid-item gridColumn="span 6" gridRow="span 2">
      <s-section>
        <s-text>Half width field</s-text>
      </s-section>
    </s-grid-item>
    <s-grid-item gridColumn="span 6" gridRow="span 2">
      <s-section>
        <s-text>Half width field</s-text>
      </s-section>
    </s-grid-item>
    <s-grid-item gridColumn="span 4" gridRow="span 3">
      <s-section>
        <s-text>Third width field</s-text>
      </s-section>
    </s-grid-item>
    <s-grid-item gridColumn="span 4" gridRow="span 3">
      <s-section>
        <s-text>Third width field</s-text>
      </s-section>
    </s-grid-item>
    <s-grid-item gridColumn="span 4" gridRow="span 3">
      <s-section>
        <s-text>Third width field</s-text>
      </s-section>
    </s-grid-item>
  </s-grid>
</s-stack>
```

### Create a responsive grid with container queries

Use the `gridTemplateColumns` property with container queries to automatically adjust the column count based on available width. This example shows a grid that switches from a single column in narrow containers to three columns in wider ones.

## html

```html
<s-stack gap="base">
  <s-text type="strong">Narrow container (375px)</s-text>
  <s-box inlineSize="375px">
    <s-query-container>
      <s-grid
        gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr 1fr, 1fr"
        gap="base"
      >
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 1</s-text>
          </s-box>
        </s-grid-item>
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 2</s-text>
          </s-box>
        </s-grid-item>
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 3</s-text>
          </s-box>
        </s-grid-item>
      </s-grid>
    </s-query-container>
  </s-box>


  <s-text type="strong">Wide container (450px)</s-text>
  <s-box inlineSize="450px">
    <s-query-container>
      <s-grid
        gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr 1fr, 1fr"
        gap="base"
      >
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 1</s-text>
          </s-box>
        </s-grid-item>
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 2</s-text>
          </s-box>
        </s-grid-item>
        <s-grid-item>
          <s-box padding="small" background="subdued">
            <s-text>Item 3</s-text>
          </s-box>
        </s-grid-item>
      </s-grid>
    </s-query-container>
  </s-box>
</s-stack>
```

***

## Best practices

* **Design for different screen sizes:** Layouts that work well on desktop often fail on mobile. Plan how your grid should reflow or reconfigure for smaller screens rather than creating a fixed layout that doesn't adapt.
* **Keep spacing consistent:** Consistent spacing between grid items creates visual rhythm and makes layouts easier to scan. Avoid mixing different spacing approaches within the same grid.
* **Consider content overflow:** Grid cells have fixed dimensions, but content length varies. Plan how your layout handles content that's too long or too wide, whether through wrapping, truncation, or scrolling.
* **Use semantic alternatives when appropriate:** Before using the component, consider whether simpler layout components would work. Grid's power comes with complexity, so use it when you need its specific capabilities.

***

## Limitations

* The component doesn't support CSS subgrid for aligning nested grid tracks with parent grids. If you need nested grids to align with parent grid lines, you'll need to manually coordinate the sizing or use a different layout approach.

***
