---
title: Text area
description: >-
  The text area component captures multi-line text input. Use it to collect
  descriptions, notes, comments, or other extended text content.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area.md
api_name: app-home
---

# Text area

The text area component captures multi-line text input. Use it to collect descriptions, notes, comments, or other extended text content.

The component supports configurable height, character limits, and validation. For single-line text input, use [text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field).

#### Use cases

* **Product descriptions:** Collect detailed product descriptions or extended content.
* **Notes and comments:** Capture merchant notes, internal comments, or instructions.
* **Configuration text:** Input multi-line configuration values like custom code or templates.
* **Detailed input:** Collect any multi-line textual information from merchants.

***

## Properties

Configure the following properties on the text area component.

* **max​Length**

  **number**

  **Default: Infinity**

  **required**

  The maximum number of characters allowed in the field.

* **min​Length**

  **number**

  **Default: 0**

  **required**

  The minimum number of characters required in the field.

* **rows**

  **number**

  **Default: 2**

  **required**

  A number of visible text lines.

* **value**

  **string**

  **required**

  The current text value in the field as a string. When setting this property programmatically, it updates the field's display value. When reading it, you get the user's current input.

* **autocomplete**

  **"on" | "off" | TextAutocompleteField | \`section-${string} one-time-code\` | "shipping one-time-code" | "billing one-time-code" | \`section-${string} shipping one-time-code\` | \`section-${string} billing one-time-code\` | \`section-${string} language\` | \`section-${string} organization\` | \`section-${string} name\` | ... 141...**

  **Default: 'on' for everything else**

  **required**

  Controls browser autofill behavior for the field.

  Basic values:

  * `on` - Enables autofill without specifying content type (default)
  * `off` - Disables autofill for sensitive data or one-time codes

  Specific field values describe the expected data type. You can optionally prefix these with:

  * `section-${string}` - Scopes autofill to a specific form section (when multiple forms exist on the same page)
  * `shipping` or `billing` - Indicates whether the data is for shipping or billing purposes
  * Both section and group (for example, `section-primary shipping email`)

  Providing a specific autofill token helps browsers suggest more relevant saved data.

  Learn more about the set of [autocomplete values](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens) supported in browsers.

* **default​Value**

  **string**

  **required**

  The initial value of the field when it first loads. Unlike `placeholder`, this is a real value that the user can edit and that gets submitted with the form. Once the user starts typing, their input replaces it. Changing this property after the field has loaded has no effect. To update the field value at any time, use `value` instead.

* **details**

  **string**

  **required**

  Supplementary text displayed below the checkbox to provide additional context, instructions, or help. Use this to explain what checking the box means or provide guidance to users. This text is announced to screen readers.

* **error**

  **string**

  **required**

  An error message displayed below the checkbox to indicate validation problems. When set, the checkbox is styled with error indicators and the message is announced to screen readers.

* **label**

  **string**

  **required**

  The text displayed as the field label, which identifies the purpose of the field to users. This label is associated with the field for accessibility and helps users understand what information to provide.

* **label​Accessibility​Visibility**

  **"visible" | "exclusive"**

  **Default: 'visible'**

  **required**

  Controls whether the label is visible to all users or only to screen readers.

  * `visible`: The label is shown to everyone (default).
  * `exclusive`: The label is visually hidden but still announced by screen readers.

  Use `exclusive` when the surrounding context makes the label redundant visually, but screen reader users still need it for clarity.

* **placeholder**

  **string**

  **required**

  The placeholder text displayed in the field when it's empty, providing a hint about the expected input format or value.

* **read​Only**

  **boolean**

  **Default: false**

  **required**

  Whether the field is read-only and can't be edited. Read-only fields remain focusable and their content is announced by screen readers.

* **required**

  **boolean**

  **Default: false**

  **required**

  Whether the field requires a value before form submission. Displays a visual indicator and adds semantic meaning, but doesn't automatically validate or show errors. Use the `error` property to display validation messages.

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the field is disabled, preventing any user interaction.

* **id**

  **string**

  **required**

  A unique identifier for the element. Use this to reference the element in JavaScript, link labels to form controls, or target specific elements for styling or scripting.

* **name**

  **string**

  **required**

  The name attribute for the field, used to identify the field's value when the form is submitted. Must be unique within the nearest containing form.

### TextAutocompleteField

Represents autocomplete values that are valid for text input fields. This is a subset of \`AnyAutocompleteField\` containing only fields suitable for text-based inputs. Available values: - \`name\` - Full name - \`given-name\` - First name - \`additional-name\` - Middle name - \`family-name\` - Last name - \`nickname\` - Nickname or handle - \`username\` - Username for login - \`honorific-prefix\` - Name prefix (Mr., Mrs., Dr.) - \`honorific-suffix\` - Name suffix (Jr., Sr., III) - \`organization\` - Company or organization name - \`organization-title\` - Job title or position - \`address-line1\` - Street address (first line) - \`address-line2\` - Street address (second line) - \`address-line3\` - Street address (third line) - \`address-level1\` - State or province - \`address-level2\` - City or town - \`address-level3\` - District or locality - \`address-level4\` - Neighborhood or suburb - \`street-address\` - Complete street address (multi-line) - \`postal-code\` - Postal or ZIP code - \`country\` - Country code (US, CA, GB) - \`country-name\` - Country name (United States, Canada) - \`language\` - Preferred language - \`sex\` - Gender or sex - \`one-time-code\` - One-time codes for authentication - \`transaction-currency\` - Currency code (USD, EUR, GBP) - \`cc-name\` - Name on credit card - \`cc-given-name\` - First name on credit card - \`cc-additional-name\` - Middle name on credit card - \`cc-family-name\` - Last name on credit card - \`cc-type\` - Credit card type (Visa, Mastercard)

```ts
'language' | 'organization' | 'name' | 'additional-name' | 'address-level1' | 'address-level2' | 'address-level3' | 'address-level4' | 'address-line1' | 'address-line2' | 'address-line3' | 'country-name' | 'country' | 'family-name' | 'given-name' | 'honorific-prefix' | 'honorific-suffix' | 'nickname' | 'one-time-code' | 'organization-title' | 'postal-code' | 'sex' | 'street-address' | 'transaction-currency' | 'username' | 'cc-additional-name' | 'cc-family-name' | 'cc-given-name' | 'cc-name' | 'cc-type'
```

### Events

The text area component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text area loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text area value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text area receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the text area.

  Learn more about the [input event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event).

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

### Add a basic text area

Add a multi-line text input for collecting longer content from merchants. This example shows a text area with a pre-filled shipping address and a set number of visible rows.

## html

```html
<s-text-area
  label="Shipping address"
  value="1776 Barnes Street, Orlando, FL 32801"
  rows="3"
></s-text-area>
```

### Collect text with a placeholder

Collect longer text like product descriptions with a placeholder to guide input. This example shows an empty text area with placeholder text and autocomplete disabled.

## html

```html
<s-text-area
  label="Product description"
  placeholder="Enter a detailed description..."
  autocomplete="off"
></s-text-area>
```

### Limit input length with a character cap

Set a maximum character length to keep input concise, such as for SEO meta descriptions. This example shows a text area with a 160-character limit and help text explaining the constraint.

## html

```html
<s-text-area
  label="Meta description"
  max-length="160"
  details="Appears in search results. Keep under 160 characters for best visibility."
  placeholder="Write a compelling description that will appear in Google search results..."
  rows="3"
  autocomplete="off"
></s-text-area>
```

### Show a validation error

Display an error message when the entered text does not meet validation requirements. This example shows a text area with a minimum length constraint and an error explaining what is needed.

## html

```html
<s-text-area
  label="Reason for return"
  error="Please provide a detailed explanation for the return request. This helps us improve our products and process the refund faster."
  minLength="20"
  placeholder="Explain why the customer is returning this item..."
  rows="3"
  autocomplete="off"
></s-text-area>
```

### Disable or make a text area read-only

Prevent editing by making a text area read-only or fully disabled. This example shows a read-only field for viewing order notes and a disabled field for internal comments.

## html

```html
<s-stack gap="base">
  <s-text-area
    label="Order notes"
    value="Customer requested gift wrapping."
    readOnly
    rows="2"
  ></s-text-area>


  <s-text-area
    label="Internal comments"
    value="Pending review by fulfillment team."
    disabled
    rows="2"
  ></s-text-area>
</s-stack>
```

***

## Best practices

* **Set appropriate initial height:** The visible row count sets merchants' expectations for how much content to provide. A small textarea suggests brief input, while a larger one indicates more detailed content is expected.
* **Set realistic length constraints:** Define maximum and minimum character limits that reflect actual requirements. Communicate these limits clearly so merchants understand how much content they need to provide.
* **Provide helpful placeholder examples:** Show merchants what kind of content and level of detail you expect. Good placeholder text demonstrates format and tone rather than just stating the field's purpose.
* **Give real-time feedback on length limits:** When enforcing maximum length, show merchants how many characters they have remaining. This helps them craft their content within constraints without exceeding limits.

***

## Limitations

* The `maxLength` attribute prevents typing but doesn't reliably prevent pasting longer content. Browsers handle this differently. Always validate length server-side.
* The component only accepts plain text. If you need bold, italics, lists, or other formatting, you must implement a rich text editor or use plain text with Markdown syntax.

***
