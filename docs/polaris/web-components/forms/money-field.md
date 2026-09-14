---
title: Money field
description: >-
  The money field component collects monetary values from users with built-in
  currency formatting and validation. Use money field for prices, costs, or
  financial amounts to provide proper currency symbols, decimal handling, and
  numeric validation.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field.md
api_name: app-home
---

# Money field

The money field component collects monetary values from users with built-in currency formatting and validation. Use money field for prices, costs, or financial amounts to provide proper currency symbols, decimal handling, and numeric validation.

Money fields support currency codes, automatic formatting, and min/max constraints to ensure users enter valid monetary values. For non-currency numeric input, use [number field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field).

#### Use cases

* **Price input:** Capture product prices, discounts, or fee amounts with currency formatting.
* **Financial thresholds:** Set monetary thresholds for promotions, shipping, or alerts.
* **Cost tracking:** Input costs, expenses, or budget amounts.
* **Refund amounts:** Collect refund or adjustment amounts in financial workflows.

***

## Properties

Configure the following properties on the money field component.

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

* **value**

  **string**

  **required**

  The current monetary value in the field as a string. When setting this property programmatically, it updates the field's display value. When reading it, you get the user's current input. The value should be a numeric string representing the amount in the store's currency.

* **autocomplete**

  **string**

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

### Events

The money field component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the money field loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the money field value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the money field receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the money field.

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

### Collect a currency value

Capture monetary values with automatic currency formatting. This example pairs a label with placeholder text and helper details.

## html

```html
<s-money-field
  label="Regional Price"
  placeholder="99.99"
  details="Recommended price for the European market"
></s-money-field>
```

### Add a label and constraints

Set input boundaries for valid amounts. This example configures min/max limits to constrain the accepted value range.

## html

```html
<s-money-field
  label="Price"
  value="19.99"
  min="0"
  max="1000"
></s-money-field>
```

### Handle validation errors

Communicate input problems clearly to users. This example displays an error message when the entered value is invalid.

## html

```html
<s-money-field
  label="Product cost"
  min="0.01"
  error="Product cost is required"
></s-money-field>
```

### Combine multiple fields in a form

Collect multiple monetary values in a single form. This example groups money fields for price, compare-at price, and cost with individual constraints.

## html

```html
<s-stack direction="block" gap="base">
  <s-money-field
    label="Price"
    value="0.00"
    min="0.01"
    max="99999.99"
    details="Customers will see this price"
  ></s-money-field>


  <s-money-field
    label="Compare at price"
    value=""
    min="0"
    max="99999.99"
    details="Show customers the original price when on sale"
  ></s-money-field>


  <s-money-field
    label="Cost per item"
    value=""
    min="0"
    max="99999.99"
    details="Customers won't see this"
  ></s-money-field>
</s-stack>
```

***

## Best practices

* **Set realistic min/max constraints:** For product prices, use `min={0.01}` to prevent zero prices. For discounts, use `min={0}` and `max={orderTotal}`. For refunds, use `max={amountPaid}`. Always validate against business logic limits.
* **Provide specific validation feedback:** Instead of **Invalid amount**, show **Price must be at least $0.01** or **Discount can't exceed $50.00 order total**. Explain the exact constraint violated.
* **Never add currency symbols to labels:** Don't add **$** or other currency symbols to the label or placeholder, as this can create confusion with any currency formatting the component provides.
* **Label by specific monetary purpose:** Use labels like **Product base price**, **Discount amount**, **Shipping rate per kg**, or **Subscription renewal fee** instead of vague **Amount** or **Price**.
* **Pre-fill when editing existing values:** Always populate the field with the current value when editing. For new entries, consider smart defaults like **0.00** or typical price points for your product category.

***

## Limitations

* The component outputs values as strings, but converting to JavaScript numbers for arithmetic can cause floating-point precision errors. Always perform critical financial calculations on the server using decimal-precise arithmetic or integer cents (multiply by 100).
* The component formats currency based on the merchant's store currency and locale. The same numeric value might display as **$1,234.56** (en-US) vs **1 234,56 $** (fr-FR). Test your UI with various currency/locale combinations if you operate internationally.
* Currencies like JPY (¥), KRW (₩), and VND (₫) don't use decimal places. The component might still allow decimal input but this will be invalid for these currencies. Validate the currency's decimal places on the backend.
* The component doesn't perform currency conversion. If you need to display amounts in multiple currencies, you must handle conversion rates and calculations separately.

***
