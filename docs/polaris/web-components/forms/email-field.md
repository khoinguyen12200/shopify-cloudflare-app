---
title: Email field
description: >-
  The email field component captures email address input. Use it to collect
  email information in forms, customer profiles, or contact workflows.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field.md
api_name: app-home
---

# Email field

The email field component captures email address input. Use it to collect email information in forms, customer profiles, or contact workflows.

Email field doesn't perform automatic email validation. Implement your own validation logic, and use the `error` property to display validation results. For general text input, use [text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field).

#### Use cases

* **Contact information:** Collect merchant or customer email addresses for notifications.
* **User management:** Capture email addresses when adding team members or collaborators.
* **Communication settings:** Configure email preferences for order updates or shipping notifications.
* **Form validation:** Provide email-specific validation with appropriate keyboard on mobile.

***

## Properties

Configure the following properties on the email field component.

* **autocomplete**

  **"on" | "off" | EmailAutocompleteField | \`section-${string} email\` | \`section-${string} home email\` | \`section-${string} mobile email\` | \`section-${string} fax email\` | \`section-${string} pager email\` | "shipping email" | "shipping home email" | "shipping mobile email" | ... 16 more ... | \`section-${string} billing p...**

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

* **value**

  **string**

  **required**

  The current email address value in the field. When setting this property programmatically, it updates the field's display value. When reading it, you get the user's current input. The field validates this value as an email address format when the user finishes editing.

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

### EmailAutocompleteField

Represents autocomplete values that are valid for email input fields. This is a subset of \`AnyAutocompleteField\` containing only fields suitable for email inputs. Available values: - \`email\` - Primary email address - \`home email\` - Home email address - \`mobile email\` - Mobile device email address - \`fax email\` - Fax machine email address - \`pager email\` - Pager device email address

```ts
'email' | 'home email' | 'mobile email' | 'fax email' | 'pager email'
```

### Events

The email field component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the email field loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the email field value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the email field receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the email field.

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

### Add a basic email field

Collect an email address from merchants with a labeled input and helper text. This example shows a basic email field with a placeholder and details text.

## html

```html
<s-email-field
  label="Email"
  placeholder="bernadette.lapresse@jadedpixel.com"
  details="Used for sending notifications"
></s-email-field>
```

### Show an error with help text

Display an error message and help text to guide merchants toward entering a valid email. This example shows a required email field with both a details hint and an error message.

## html

```html
<s-stack gap="base">
  <s-email-field
    label="Contact email"
    details="We'll send your order confirmation here"
    error="Please enter a valid email address"
    required
  ></s-email-field>
</s-stack>
```

### Make an email field read-only

Display an existing email address that merchants can see but not edit. This example shows a read-only email field with a pre-filled value.

## html

```html
<s-stack gap="base">
  <s-email-field
    label="Account email"
    value="user@example.com"
    readOnly
  ></s-email-field>
</s-stack>
```

### Disable an email field

Disable an email field to prevent all interaction while keeping the value visible. This example shows a disabled field with a pre-filled email address.

## html

```html
<s-email-field
  label="Account email"
  value="admin@example.com"
  disabled
></s-email-field>
```

### Set character length constraints

Set minimum and maximum character lengths to add validation beyond the standard email format check. This example shows a required email field with minLength and maxLength constraints.

## html

```html
<s-stack gap="base">
  <s-email-field
    label="Business email"
    minLength="5"
    maxLength="100"
    required
  ></s-email-field>
</s-stack>
```

***

## Best practices

* **Write descriptive labels:** Use specific labels like **Customer Email**, **Receipt Email Address**, or **Order Notification Email** rather than generic **Email** or **Email Address**.
* **Provide context in details:** Use `details` for additional context like "Required for digital receipts" or "We'll send order updates to this address."
* **Show format examples in placeholders:** Use placeholders like **<you@example.com>** or **<support@yourstore.com>** to demonstrate expected format, but don't repeat the label text.
* **Write actionable error messages:** Provide clear validation messages like "Please enter a valid email address" or "Email must include @ symbol" that help merchants correct their input.

***

## Limitations

* Email addresses can't exceed 254 characters total per RFC 5321. Setting `maxLength` higher than 254 allows values that will fail during email delivery.
* Different browsers implement email validation differently. Always validate email format server-side for critical functionality.

***
