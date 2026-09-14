---
title: Text
description: >-
  The text component displays inline text with specific visual styles or tones.
  Use text to emphasize or differentiate words or phrases within paragraphs or
  other block-level components, applying weight, color, or semantic styling.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text.md
api_name: app-home
---

# Text

The text component displays inline text with specific visual styles or tones. Use text to emphasize or differentiate words or phrases within paragraphs or other block-level components, applying weight, color, or semantic styling.

Text supports multiple visual variants, alignment options, and line clamping for flexible inline typography control. For block-level text content, use [paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph).

#### Use cases

* **Labels and descriptions:** Display descriptive text for form fields or sections.
* **Instructions:** Provide usage instructions or help text for complex features.
* **Status messages:** Show status messages, confirmations, or informational text.
* **Content display:** Present product descriptions, order notes, or customer information.

***

## Properties

Configure the following properties on the text component.

* **font​Variant​Numeric**

  **"auto" | "normal" | "tabular-nums"**

  **Default: 'auto'**

  **required**

  The rendering style for numbers in the font.

  * `auto`: Inherits the setting from the parent element.
  * `normal`: Uses the font's default numeric glyphs.
  * `tabular-nums`: Uses fixed-width numeric glyphs, ensuring numbers align vertically in tables or lists.

  Learn more about the [font-variant-numeric property](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric).

* **color**

  **"base" | "subdued"**

  **Default: 'base'**

  **required**

  The color emphasis level that controls visual intensity.

  * `base`: Primary color for body text, standard UI elements, and general content with good readability.
  * `subdued`: Deemphasized color for secondary text, supporting labels, and less critical interface elements.

* **tone**

  **"info" | "success" | "warning" | "critical" | "auto" | "neutral" | "caution"**

  **Default: 'auto'**

  **required**

  The semantic tone that's applied to the text, which changes its color to convey meaning.

  * `info`: Informational content or helpful tips (blue).
  * `success`: Positive outcomes or successful states (green).
  * `warning`: Important warnings about potential issues (orange).
  * `critical`: Urgent problems or destructive actions (red).
  * `auto`: Automatically determined based on context.
  * `neutral`: General information without specific intent (gray).
  * `caution`: Advisory notices that need attention (yellow).

* **type**

  **"strong" | "generic" | "address" | "redundant"**

  **Default: 'generic'**

  **required**

  The semantic type and styling treatment for the text content.

  * `strong`: Emphasizes the text with strong importance, typically displayed in bold.
  * `generic`: Standard text with no special semantic meaning or styling.
  * `address`: Marks the text as contact information, such as a physical or email address.
  * `redundant`: Indicates the text is redundant or duplicated information for screen reader context.

* **dir**

  **"" | "auto" | "ltr" | "rtl"**

  **Default: ''**

  **required**

  Indicates the directionality of the element’s text.

  * `""`: The direction is inherited from parent elements (equivalent to not setting the attribute).
  * `auto`: The user agent determines the direction based on the content.
  * `ltr`: Text direction runs from left to right (for languages like English).
  * `rtl`: Text direction runs from right to left (for languages like Arabic).

  Learn more about the [dir attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/dir).

* **accessibility​Visibility**

  **"visible" | "hidden" | "exclusive"**

  **Default: 'visible'**

  **required**

  The visibility mode of the element for both visual and assistive technology users.

  * `visible`: The element is visible to all users (both sighted users and screen readers).
  * `hidden`: The element is visually visible but hidden from screen readers. Use this for decorative elements that don't provide meaningful information.
  * `exclusive`: The element is visually hidden but announced by screen readers. Use this for screen-reader-only content like skip links or additional context.

* **interest​For**

  **string**

  **required**

  The ID of the component to show when users hover over or focus on this component. Use this to connect interactive components to popovers or tooltips that provide additional context or information.

### Slots

The text component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The text content displayed within the text component, which applies semantic meaning and styling appropriate to the specified text type.

***

## Examples

### Add inline text with emphasis

Create inline text elements with semantic types to add structure and meaning. This example shows strong text for a label paired with regular text for the value.

## html

```html
<s-paragraph>
  <s-text type="strong">Name: </s-text>
  <s-text>Jane Doe</s-text>
</s-paragraph>
```

### Communicate status with tones

Apply semantic tones to signal different statuses inline. This example shows `success`, `critical`, and `warning` tones for common order and inventory states.

## html

```html
<s-stack gap="small">
  <s-text tone="success">Order fulfilled</s-text>
  <s-text tone="critical">Payment failed</s-text>
  <s-text tone="warning">Low inventory</s-text>
</s-stack>
```

### Display a semantic address

Set the `type` property to `address` to render contact information with proper semantic meaning. This example shows a formatted address that screen readers identify as address content.

## html

```html
<s-text type="address">
  123 Commerce Street, Toronto, ON M5V 2H1
</s-text>
```

### De-emphasize secondary information

Set the `color` property to `subdued` for secondary metadata like timestamps and supplementary details. This example shows a subdued text element for a last-updated indicator.

## html

```html
<s-text color="subdued">
  Last updated 2 hours ago
</s-text>
```

### Align numbers with tabular formatting

Set the `fontVariantNumeric` property to `tabular-nums` to render numbers with consistent widths for even alignment in data displays. This example shows tabular number formatting for a price.

## html

```html
<s-text fontVariantNumeric="tabular-nums">
  $1,234.56
</s-text>
```

### Add screen-reader-only text

Use the `accessibilityVisibility` property to provide additional context for screen readers without affecting the visual layout. This example shows hidden text that communicates pricing context to assistive technologies.

## html

```html
<s-text accessibilityVisibility="exclusive">
  Product prices include tax
</s-text>
```

### Associate text with a tooltip

Use the `interestFor` property to connect text to a tooltip, displaying additional context on hover or focus. This example shows explanatory text that triggers a tooltip with SKU details.

## html

```html
<s-tooltip id="sku-tooltip">
  SKU must be unique across all products and cannot be changed after creation
</s-tooltip>
<s-text color="subdued" interestFor="sku-tooltip">
  What is a product SKU?
</s-text>
```

### Render right-to-left text

Set the `dir` property to `rtl` for right-to-left languages like Arabic and Hebrew. This example shows text rendered in Arabic with right-to-left direction.

## html

```html
<s-text dir="rtl">
  محتوى النص باللغة العربية
</s-text>
```

***

## Best practices

* **Apply semantic types to improve meaning:** Use `strong` for key words or phrases that need emphasis, `address` for contact information like physical or email addresses, and `redundant` for screen reader context when content is visually duplicated. Semantic types help screen readers convey the correct meaning to merchants.
* **Emphasize sparingly and strategically:** Use strong to emphasize key words or numbers within sentences, not entire sentences. Too much emphasis dilutes its effectiveness and makes content harder to scan.
* **Choose appropriate tones for status:** Apply tones like critical, success, or caution to communicate status inline. Tones draw attention to important information but work best when paired with clear language, not used alone.
* **Consider contrast for subdued text:** Subdued text works well for timestamps and metadata, but avoid using it for critical information that merchants must read.

***

## Limitations

* Text renders inline by default and flows with surrounding content. For block-level text with spacing, use the [paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph) component or wrap in layout components.
* The component doesn't include text truncation or ellipsis. Long text will wrap or overflow depending on the container. Use other components like [heading](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading) with line clamping if truncation is needed.
* Tone colors are optimized for light backgrounds. Using tones on dark or colored backgrounds might not meet accessibility contrast requirements.

***
