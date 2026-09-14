---
title: Paragraph
description: >-
  The paragraph component displays blocks of text content and can contain inline
  elements like buttons, links, or emphasized text. Use paragraph to present
  standalone blocks of readable content, descriptions, or explanatory text.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph.md
api_name: app-home
---

# Paragraph

The paragraph component displays blocks of text content and can contain inline elements like buttons, links, or emphasized text. Use paragraph to present standalone blocks of readable content, descriptions, or explanatory text.

Paragraphs support alignment options and can wrap inline components to create rich, formatted content blocks. For inline text styling, use [text](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text).

#### Use cases

* **Long descriptions:** Display longer text content with proper paragraph formatting.
* **Help documentation:** Provide detailed explanations or instructions for features.
* **Informational text:** Present multi-line information, guidelines, or policies.
* **Content blocks:** Create readable content blocks with proper typography.

***

## Properties

Configure the following properties on the paragraph component.

* **font​Variant​Numeric**

  **"auto" | "normal" | "tabular-nums"**

  **Default: 'auto'**

  **required**

  The rendering style for numbers in the font.

  * `auto`: Inherits the setting from the parent element.
  * `normal`: Uses the font's default numeric glyphs.
  * `tabular-nums`: Uses fixed-width numeric glyphs, ensuring numbers align vertically in tables or lists.

  Learn more about the [font-variant-numeric property](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric).

* **line​Clamp**

  **number**

  **Default: Infinity - no truncation is applied**

  **required**

  The maximum number of lines to display before truncating the text content.

  Learn more about the [-webkit-line-clamp property](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp).

* **tone**

  **"info" | "success" | "warning" | "critical" | "caution"**

  **Default: 'auto'**

  **required**

  The semantic tone that's applied to the paragraph text, which changes its color to convey meaning.

  * `info`: Informational content or helpful tips (blue).
  * `success`: Positive outcomes or successful states (green).
  * `warning`: Important warnings about potential issues (orange).
  * `critical`: Urgent problems or destructive actions (red).
  * `caution`: Advisory notices that need attention (yellow).

* **color**

  **"base" | "subdued"**

  **Default: 'base'**

  **required**

  The color emphasis level that controls visual intensity.

  * `base`: Primary color for body text, standard UI elements, and general content with good readability.
  * `subdued`: Deemphasized color for secondary text, supporting labels, and less critical interface elements.

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

### Slots

The paragraph component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The paragraph text content displayed within the paragraph component, which presents a block of related text with appropriate styling.

***

## Examples

### Add a basic paragraph

Create a paragraph for body text content. This example shows the basic paragraph component using default styling.

## html

```html
<s-paragraph>
  Shopify POS is the easiest way to sell your products in person. Available for
  iPad, iPhone, and Android.
</s-paragraph>
```

### Communicate status with tones

Apply semantic tones to convey different types of information through color. This example shows all five tones—`info`, `success`, `caution`, `warning`, and `critical`—for common merchant-facing messages.

## html

```html
<s-section>
  <s-paragraph tone="info" color="base">
    Your order will be processed within 2-3 business days.
  </s-paragraph>


  <s-paragraph tone="success" color="base">
    Payment successfully processed.
  </s-paragraph>


  <s-paragraph tone="caution" color="base">
    Review shipping address before processing.
  </s-paragraph>


  <s-paragraph tone="warning" color="base">
    Inventory levels are running low for this product.
  </s-paragraph>


  <s-paragraph tone="critical" color="base">
    This order requires immediate attention due to shipping delays.
  </s-paragraph>
</s-section>
```

### Truncate long text with line clamping

Limit the number of visible lines in a paragraph using the `lineClamp` property. This example shows a product description truncated to a single line with an ellipsis in a constrained container.

## html

```html
<s-box inlineSize="300px">
  <s-paragraph lineClamp="1">
    Premium organic cotton t-shirt featuring sustainable manufacturing
    processes, ethically sourced materials, and carbon-neutral shipping.
    Available in multiple colors and sizes with customization options for your
    brand.
  </s-paragraph>
</s-box>
```

### Align numbers with tabular formatting

Use `fontVariantNumeric` set to tabular-nums to render numbers with consistent widths for even alignment. This example shows tabular number formatting for financial data.

## html

```html
<s-paragraph fontVariantNumeric="tabular-nums">
  Orders: 1,234 Revenue: $45,678.90 Customers: 890
</s-paragraph>
```

### Add screen-reader-only text

Use the `accessibilityVisibility` property to create text that is only available to screen readers. This example shows a paragraph providing sort context for a table that assistive technologies can read.

## html

```html
<s-paragraph accessibilityVisibility="exclusive">
  Table sorted by date, newest first.
</s-paragraph>
```

### De-emphasize secondary text with subdued color

Set the `color` property to `subdued` for secondary information like helper text, disclaimers, and supplementary descriptions. This example shows a subdued paragraph providing guidance below a form action.

## html

```html
<s-paragraph color="subdued">
  Changes will take effect the next time the customer visits your store.
</s-paragraph>
```

### Render right-to-left text

Set the `dir` property to rtl for right-to-left languages like Arabic and Hebrew. This example shows a paragraph rendered in Arabic with right-to-left text direction.

## html

```html
<s-paragraph dir="rtl">
  محتوى النص باللغة العربية
</s-paragraph>
```

***

## Best practices

* **Write in short, scannable blocks:** Keep paragraphs to 2-4 sentences to improve readability. Merchants scan more than they read, so break long content into digestible chunks. Use plain language and avoid jargon.
* **Apply tones to communicate intent:** Use semantic tones like critical for errors, caution for warnings, and success for confirmations. Tones help merchants quickly understand the nature of information, but don't rely on color alone—pair with clear language.
* **Consider accessibility in all contexts:** Use screen-reader-only text to provide context that sighted merchants get from layout or icons. Make sure tone colors have sufficient contrast for readability.
* **Use line clamping strategically:** Line clamping helps manage space in constrained layouts like cards or previews, but truncated content should never hide critical information.

***

## Limitations

* Paragraphs render as block-level elements with spacing above and below. This spacing is designed for body content and might create unwanted gaps in tightly packed layouts.
* Line clamping truncates text visually but doesn't provide tooltips or expandable content. Truncated information isn't fully accessible unless you provide an alternative way to view the complete text.
* Tone colors are optimized for light backgrounds. Using toned paragraphs on dark or colored backgrounds might result in insufficient contrast for accessibility.

***
