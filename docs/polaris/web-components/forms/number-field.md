---
title: Number field
description: >-
  The number field component captures numeric input with built-in number
  validation. Use it to collect quantities, prices, or other numeric
  information.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field.md
api_name: app-home
---

# Number field

The number field component captures numeric input with built-in number validation. Use it to collect quantities, prices, or other numeric information.

The component supports min/max constraints and step increments for guided numeric entry. For monetary values with currency formatting, use [money field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field).

#### Use cases

* **Quantity input:** Collect product quantities, stock levels, or inventory thresholds.
* **Pricing:** Capture price values, discounts, or monetary amounts with validation.
* **Thresholds:** Set numeric thresholds for alerts, reorder points, or limits.
* **Measurements:** Input dimensions, weights, or other numeric product attributes.

***

## Properties

Configure the following properties on the number field component.

* **value**

  **string**

  **required**

  The current numeric value in the field as a string. When setting this property programmatically, it updates the field's display value. When reading it, you get the user's current input. The value should be a numeric string (decimal or integer).

* **input​Mode**

  **"decimal" | "numeric"**

  **Default: 'decimal'**

  **required**

  The type of virtual keyboard to display on mobile devices.

  * `decimal`: Shows a numeric keyboard with a decimal point, suitable for prices or measurements.
  * `numeric`: Shows a numeric keyboard without a decimal point, suitable for whole numbers like quantities.

  Learn more about the [inputmode attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode).

* **step**

  **number**

  **Default: 1**

  **required**

  The amount the value can increase or decrease by. This can be an integer or decimal. If a `max` or `min` is specified with `step` when increasing/decreasing the value via the buttons, the final value will always round to the `max` or `min` rather than the closest valid amount.

* **max**

  **number**

  **Default: Infinity**

  **required**

  The highest decimal or integer value accepted for the field. When used with `step`, the value rounds down to the maximum number.

  Users can still type values higher than the maximum using the keyboard. Implement validation to enforce this constraint.

* **min**

  **number**

  **Default: -Infinity**

  **required**

  The lowest decimal or integer value accepted for the field. When used with `step`, the value rounds up to the minimum number.

  Users can still type values lower than the minimum using the keyboard. Implement validation to enforce this constraint.

* **prefix**

  **string**

  **Default: ''**

  **required**

  A non-editable text value displayed immediately before the editable portion of the field. This is useful for displaying an implied part of the value, such as `https://` or `+353`.

  This text can't be edited by the user and is not included in the field's value. The prefix might not appear until the user interacts with the field. For example, an inline label might occupy the prefix position until the user focuses the field.

* **suffix**

  **string**

  **Default: ''**

  **required**

  A non-editable text value displayed immediately after the editable portion of the field. This is useful for displaying an implied part of the value, such as `@shopify.com` or `%`.

  This text can't be edited by the user and is not included in the field's value. The suffix might not appear until the user interacts with the field. For example, an inline label might occupy the suffix position until the user focuses the field.

* **autocomplete**

  **"on" | "off" | NumberAutocompleteField | \`section-${string} one-time-code\` | \`section-${string} cc-number\` | \`section-${string} cc-csc\` | "shipping one-time-code" | "shipping cc-number" | "shipping cc-csc" | "billing one-time-code" | ... 7 more ... | \`section-${string} billing cc-csc\`**

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

### NumberAutocompleteField

Represents autocomplete values that are valid for number input fields. This is a subset of \`AnyAutocompleteField\` containing only fields suitable for numeric inputs. Available values: - \`one-time-code\` - One-time codes for authentication (OTP, 2FA codes) - \`cc-number\` - Credit card number - \`cc-csc\` - Credit card security code (CVV/CVC)

```ts
'one-time-code' | 'cc-number' | 'cc-csc'
```

### Events

The number field component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the number field loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the number field value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the number field receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the number field.

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

### Add a basic number field

Collect a numeric value from merchants with step controls and a defined range. This example shows a number field with a label, placeholder, step increment, and min/max bounds.

## html

```html
<s-number-field
  label="Quantity"
  details="Number of items in stock"
  placeholder="0"
  step="5"
  min="0"
  max="100"
></s-number-field>
```

### Add a prefix and suffix for currency input

Add a prefix and suffix to provide context for the expected value, such as a currency symbol or unit. This example shows a price field with a dollar sign prefix, currency suffix, and decimal input mode.

## html

```html
<s-number-field
  label="Product price"
  value="29.99"
  prefix="$"
  suffix="CAD"
  inputMode="decimal"
  step="0.01"
  min="0"
></s-number-field>
```

### Show a validation error

Display an error message when a value is outside the accepted range or a required field is empty. This example shows a required number field with an error indicating the minimum allowed value.

## html

```html
<s-number-field
  label="Order quantity"
  value="0"
  min="1"
  max="999"
  step="1"
  required
  error="Quantity must be at least 1"
></s-number-field>
```

### Disable or make a number field read-only

Prevent editing by making a number field read-only or fully disabled. This example shows a read-only price field and a disabled tax rate field, both with pre-filled values.

## html

```html
<s-stack gap="base">
  <s-number-field
    label="Base price"
    value="49.99"
    prefix="$"
    readOnly
  ></s-number-field>


  <s-number-field
    label="Tax rate"
    value="13"
    suffix="%"
    disabled
  ></s-number-field>
</s-stack>
```

***

## Best practices

* **Use for numeric-only input:** Choose the component when you need strictly numeric values like quantities, measurements, or percentages. For values that might contain letters or symbols (like product codes or phone numbers), use [text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field) instead.
* **Provide context with units:** Display units of measurement using prefix or suffix to clarify what the number represents. Without context, merchants might not know if they're entering dollars, kilograms, or percentages.
* **Set realistic constraints:** Define minimum and maximum values that reflect actual business rules. This guides merchants toward valid inputs and prevents unrealistic values before form submission.
* **Validate and provide clear feedback:** Always validate numeric input and show specific error messages that explain what went wrong and how to fix it. Generic error messages don't help merchants understand what value to enter.

***

## Limitations

* Setting `inputMode` suggests a keyboard layout on mobile but doesn't prevent merchants from entering non-numeric characters. Always validate input values in your `change` event handler.

***
