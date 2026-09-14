---
title: Checkbox
description: >-
  The checkbox component provides a clear way for users to make selections, such
  as agreeing to terms, enabling settings, or choosing multiple items from a
  list. Use checkbox to create binary on/off controls or multi-select interfaces
  where users can select any combination of options.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox.md
api_name: app-home
---

# Checkbox

The checkbox component provides a clear way for users to make selections, such as agreeing to terms, enabling settings, or choosing multiple items from a list. Use checkbox to create binary on/off controls or multi-select interfaces where users can select any combination of options.

Checkboxes support labels, help text, error states, and an indeterminate state for "select all" functionality when working with grouped selections. For settings that take effect immediately, use [switch](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch) instead.

#### Use cases

* **Feature toggles:** Enable or disable features in product or store configuration interfaces.
* **Multi-select options:** Allow merchants to select multiple options from a list of settings.
* **Agreement confirmation:** Collect agreement for terms, policies, or destructive actions.
* **Bulk selection:** Enable selection of multiple items for batch operations.

***

## Properties

Configure the following properties on the checkbox component.

* **indeterminate**

  **boolean**

  **required**

  Whether the checkbox displays in an indeterminate state (neither checked nor unchecked), typically used to indicate partial selection in hierarchical lists.

  This visual state takes priority over the `checked` prop in appearance only. The form submission value is still determined by the `checked` prop.

  If `indeterminate` has not been explicitly set and hasn't been modified by user interaction, it returns the value of `defaultIndeterminate`.

* **default​Indeterminate**

  **boolean**

  **Default: false**

  **required**

  The initial indeterminate state for uncontrolled components. Use this when you want the checkbox to start in an indeterminate state but don't need to control it afterward.

  This value applies until `indeterminate` is explicitly set or the user changes the checkbox state by clicking.

* **checked**

  **boolean**

  **Default: false**

  **required**

  Whether the control is currently checked. Use this for controlled components where you manage the checked state.

* **value**

  **string**

  **required**

  The value used in form data when the checkbox is checked.

* **default​Checked**

  **boolean**

  **Default: false**

  **required**

  The initial checked state for uncontrolled components. Use this when you want the control to start checked but don't need to control its state afterward.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

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

  The text label displayed next to the checkbox that describes what the checkbox controls. Clicking the label will also toggle the checkbox state.

* **required**

  **boolean**

  **Default: false**

  **required**

  Whether the field needs a value. This requirement adds semantic value to the field, but it will not cause an error to appear automatically. If you want to present an error when this field is empty, you can do so with the `error` property.

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

The checkbox component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the checkbox value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the checkbox.

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

### Select an option

Let users toggle a single option on or off. This example displays a checkbox with a label and helper text providing additional context.

## html

```html
<s-checkbox
  label="Require a confirmation step"
  details="Ensure all criteria are met before proceeding"
></s-checkbox>
```

### Show an indeterminate state

Indicate partial selection in bulk actions. This example displays a "select all" checkbox in an indeterminate state when some items are checked.

## html

```html
<s-stack gap="small">
  <s-checkbox
    label="Select all items"
    indeterminate
  ></s-checkbox>
  <s-divider></s-divider>
  <s-checkbox label="Item 1" checked></s-checkbox>
  <s-checkbox label="Item 2"></s-checkbox>
  <s-checkbox label="Item 3"></s-checkbox>
</s-stack>
```

### Show a validation error

Communicate when a required selection is missing. This example displays an error message when the terms checkbox isn't checked.

## html

```html
<s-checkbox
  label="I agree to the terms"
  error="You must accept the terms to continue"
></s-checkbox>
```

### Show a disabled checkbox

Indicate when an option isn't available. This example presents a disabled checkbox with helper text explaining how to enable it.

## html

```html
<s-checkbox
  label="Advanced settings"
  disabled
  details="Contact your administrator to enable advanced settings"
></s-checkbox>
```

### Group multiple checkboxes

Organize related options together. This example groups multiple checkboxes in a settings panel with individual helper text.

## html

```html
<s-stack gap="base">
  <s-checkbox label="Show only published products" checked></s-checkbox>
  <s-checkbox
    label="Enable inventory tracking"
    details="Track inventory levels and receive low stock alerts"
    checked
  ></s-checkbox>
  <s-checkbox
    label="View customer data"
    details="Allow staff to access customer contact information and order history"
  ></s-checkbox>
</s-stack>
```

### Validate in real time

Provide immediate feedback on required selections. This example demonstrates validation with an error message when the checkbox is unchecked.

## html

```html
<s-section>
  <s-stack gap="base" justifyContent="start">
    <s-text-field label="Name"></s-text-field>
    <s-checkbox
      label="I agree to the terms"
      error="You must accept the terms to continue"
    ></s-checkbox>
  </s-stack>
</s-section>
```

***

## Best practices

* **Ensure independence**: Each checkbox should work independently from others, allowing merchants to select any combination of options.
* **Always include labels**: Provide descriptive labels when checkboxes activate or deactivate settings to ensure clarity.
* **Order logically**: List checkboxes in a logical sequence like alphabetical, numerical, or time-based to help merchants find options easily.
* **Use indeterminate state appropriately**: Apply the indeterminate state for "select all" functionality when only some items in a group are selected.
* **Provide help text**: Include descriptive details text to give additional context about checkbox options when needed.

***
