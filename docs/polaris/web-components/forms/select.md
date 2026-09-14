---
title: Select
description: >-
  The select component allows users to choose one option from a dropdown menu.
  Use select when presenting four or more choices to keep interfaces uncluttered
  and scannable, or when space is limited.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/select'
  md: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/select.md'
api_name: app-home
---

# Select

The select component allows users to choose one option from a dropdown menu. Use select when presenting four or more choices to keep interfaces uncluttered and scannable, or when space is limited.

Select components support option grouping, placeholder text, help text, and validation states to create clear selection interfaces. For more visual selection layouts with radio buttons or checkboxes, use [choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list).

#### Use cases

* **Dropdown options:** Provide dropdown menus for status selection, category choice, or option selection.
* **Configuration settings:** Offer predefined configuration options in settings panels.
* **Grouped options:** Present options in logical groups for better organization.
* **Single selection:** Enable selection of one option from a predefined list.

***

## Properties

Configure the following properties on the select component.

* **icon**

  **"" | "replace" | "search" | "split" | "link" | "edit" | "info" | "incomplete" | "complete" | "product" | "variant" | "collection" | "select" | "color" | "money" | "order" | "code" | ... 541 more ... | "x-circle-filled"**

  **required**

  An icon displayed inside the field to provide visual context about the expected input or field purpose. Commonly used for search fields, currency inputs, or to indicate field type. Accepts any icon name from the icon library or a custom string identifier.

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

* **placeholder**

  **string**

  **required**

  The placeholder text displayed in the field when it's empty, providing a hint about the expected input format or value.

* **required**

  **boolean**

  **Default: false**

  **required**

  Whether the field requires a value before form submission. Displays a visual indicator and adds semantic meaning, but doesn't automatically validate or show errors. Use the `error` property to display validation messages.

* **label​Accessibility​Visibility**

  **"visible" | "exclusive"**

  **Default: 'visible'**

  **required**

  Controls whether the label is visible to all users or only to screen readers.

  * `visible`: The label is shown to everyone (default).
  * `exclusive`: The label is visually hidden but still announced by screen readers.

  Use `exclusive` when the surrounding context makes the label redundant visually, but screen reader users still need it for clarity.

* **value**

  **string**

  **required**

  The value of the currently selected option. When setting this property programmatically, it updates which option appears selected in the dropdown. When reading it, you get the `value` attribute of the currently selected option component.

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

The select component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the select value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the select.

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

### Slots

The select component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The selectable options displayed in the dropdown list. Accepts option components for individual selectable items, and option group components to organize related options into logical groups with labels.

***

## Option

Represents a single option within a select component. Use only as a child of s-select components.

* **selected**

  **boolean**

  **Default: false**

  **required**

  Whether the option is currently selected. Use this for controlled components where you manage the selection state.

* **default​Selected**

  **boolean**

  **Default: false**

  **required**

  The initial selected state for uncontrolled components. Use this when you want the option to start selected but don't need to control its state afterward.

* **value**

  **string**

  **required**

  The value submitted with the form when this checkbox is checked. If not specified, the default value is "on".

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the checkbox is disabled, preventing user interaction. Disabled checkboxes appear dimmed and their values aren't submitted with forms.

### Slots

The option component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The text or elements displayed as the option label, which identifies the selectable choice to users in a dropdown or selection list.

***

## Option​Group

Represents a group of options within a select component. Use only as a child of `s-select` components.

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the options within this group can be selected or not.

* **label**

  **string**

  **required**

  The user-facing label for this group of options.

### Slots

The option group component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The selectable options displayed in the dropdown list. Accepts option components for individual selectable items within this group.

***

## Examples

### Create a dropdown menu

Let users pick one option from a predefined list. This example pairs a label with selectable options.

## html

```html
<s-select label="Date range">
  <s-option value="1">Today</s-option>
  <s-option value="2">Yesterday</s-option>
  <s-option value="3">Last 7 days</s-option>
  <s-option-group label="Custom ranges">
    <s-option value="4">Last 30 days</s-option>
    <s-option value="5">Last 90 days</s-option>
  </s-option-group>
</s-select>
```

### Add sorting options

Provide sorting controls for lists or tables. This example configures sort options with a pre-selected default value.

## html

```html
<s-select label="Sort products by" value="newest">
  <s-option value="newest">Newest first</s-option>
  <s-option value="oldest">Oldest first</s-option>
  <s-option value="title">Title A–Z</s-option>
  <s-option value="price-low">Price: low to high</s-option>
  <s-option value="price-high">Price: high to low</s-option>
</s-select>
```

### Add placeholder text

Show instructional text before a selection is made. This example uses placeholder text to describe what the user should choose.

## html

```html
<s-select
  label="Product category"
  placeholder="Choose category for better organization"
>
  <s-option value="clothing">Clothing & apparel</s-option>
  <s-option value="accessories">Accessories & jewelry</s-option>
  <s-option value="home-garden">Home & garden</s-option>
  <s-option value="electronics">Electronics & tech</s-option>
  <s-option value="books">Books & media</s-option>
</s-select>
```

### Show validation errors

Communicate selection problems clearly to users. This example displays an error message when a required selection is missing.

## html

```html
<s-select
  label="Shipping origin"
  error="Select your primary shipping location to calculate accurate rates for customers"
  required
>
  <s-option value="ca">Canada</s-option>
  <s-option value="us">United States</s-option>
  <s-option value="mx">Mexico</s-option>
  <s-option value="uk">United Kingdom</s-option>
</s-select>
```

### Group options by category

Make long option lists easier to scan. This example organizes options into logical groups like geographical regions.

## html

```html
<s-select label="Shipping destination">
  <s-option-group label="North America">
    <s-option value="ca">Canada</s-option>
    <s-option value="us">United States</s-option>
    <s-option value="mx">Mexico</s-option>
  </s-option-group>
  <s-option-group label="Europe">
    <s-option value="uk">United Kingdom</s-option>
    <s-option value="fr">France</s-option>
    <s-option value="de">Germany</s-option>
    <s-option value="it">Italy</s-option>
  </s-option-group>
  <s-option-group label="Asia Pacific">
    <s-option value="au">Australia</s-option>
    <s-option value="jp">Japan</s-option>
    <s-option value="sg">Singapore</s-option>
  </s-option-group>
</s-select>
```

### Add an icon

Visually indicate the purpose of a select field. This example adds a sort icon that signals filtering functionality.

## html

```html
<s-select label="Filter orders by" icon="sort">
  <s-option value="date">Order date</s-option>
  <s-option value="status">Fulfillment status</s-option>
  <s-option value="total">Order total</s-option>
  <s-option value="customer">Customer name</s-option>
</s-select>
```

### Disable the select

Lock a selection when changes aren't allowed. This example disables a dropdown while preserving its selected value.

## html

```html
<s-select label="Product type" disabled value="physical">
  <s-option value="physical">Physical product</s-option>
  <s-option value="digital">Digital product</s-option>
  <s-option value="service">Service</s-option>
  <s-option value="gift-card">Gift card</s-option>
</s-select>
```

***

## Best practices

* **Use for choosing from predefined options:** Select works best when merchants pick from a known list of options. When merchants need to enter custom values or search through many options, consider [text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field) with autocomplete or a searchable dropdown pattern instead.
* **Organize options thoughtfully:** The order of options affects how quickly merchants find what they need. Group related options together, put common choices first, or use alphabetical order when no natural hierarchy exists.
* **Make options scannable:** Merchants should be able to quickly distinguish between options. Include enough context in each option label so merchants don't need to open and read multiple options to find the right one.
* **Handle default selections appropriately:** Pre-select an option when there's a clear default choice, but use a placeholder when merchants should make an intentional selection. Avoid confusing merchants with unclear initial states.
* **Provide clear validation feedback:** When selection is required or invalid, explain what the merchant needs to do. Context-specific error messages help merchants complete forms faster than generic validation messages.

***

## Limitations

* The component doesn't include search or filtering functionality. For option lists where merchants need to search (like country selection with 200+ countries), implement a custom autocomplete or searchable dropdown pattern.
* The component only supports selecting one option at a time. For multi-select scenarios, use a [choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list) with checkboxes or build a custom multi-select component.
* Rendering 500+ options can cause performance issues, especially on mobile devices. The browser must render all options in the DOM even though only one's visible.
* Browser native select dropdowns have limited styling capabilities. Dropdown appearance varies by browser and OS, and can't be fully customized with CSS. For custom-styled dropdowns, you must build a custom component using [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) and [menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu).
* Options only support plain text. You can't include icons, images, badges, or formatted text within option labels. For rich option content, build a custom dropdown using [menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu) components.

***
