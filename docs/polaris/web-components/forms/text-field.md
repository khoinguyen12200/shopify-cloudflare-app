---
title: Text field
description: >-
  The text field component captures single-line text input. Use it to collect
  short, free-form information like names, titles, or identifiers.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field.md
api_name: app-home
---

# Text field

The text field component captures single-line text input. Use it to collect short, free-form information like names, titles, or identifiers.

The component supports various input configurations including placeholders, character limits, and validation. For multi-line text entry, use [text area](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area). For specialized input types, use [email field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field), [URL field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/url-field), [password field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/password-field), or [search field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/search-field).

#### Use cases

* **General input:** Collect titles, names, SKUs, or other short text values.
* **Product attributes:** Capture product properties like brand, model, or category.
* **Configuration values:** Input configuration settings requiring single-line text.
* **Search queries:** Provide search input fields for filtering or finding resources.

***

## Text​Field

Configure the following properties on the text field component.

* **icon**

  **"replace" | "search" | "split" | "link" | "edit" | "info" | "incomplete" | "complete" | "product" | "variant" | "collection" | "select" | "color" | "money" | "order" | "code" | ... 542 more ... | AnyString**

  **Default: ''**

  **required**

  An icon displayed inside the field to provide visual context about the expected input or field purpose. Commonly used for search fields, currency inputs, or to indicate field type. Accepts any icon name from the icon library or a custom string identifier.

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

### AnyString

A utility type that enables autocomplete for specific string literals while still accepting any string value. By intersecting \`string\` with an empty object type, this prevents TypeScript from widening literal types, preserving IDE suggestions for known values while maintaining flexibility for custom strings.

```ts
string & {}
```

### TextAutocompleteField

Represents autocomplete values that are valid for text input fields. This is a subset of \`AnyAutocompleteField\` containing only fields suitable for text-based inputs. Available values: - \`name\` - Full name - \`given-name\` - First name - \`additional-name\` - Middle name - \`family-name\` - Last name - \`nickname\` - Nickname or handle - \`username\` - Username for login - \`honorific-prefix\` - Name prefix (Mr., Mrs., Dr.) - \`honorific-suffix\` - Name suffix (Jr., Sr., III) - \`organization\` - Company or organization name - \`organization-title\` - Job title or position - \`address-line1\` - Street address (first line) - \`address-line2\` - Street address (second line) - \`address-line3\` - Street address (third line) - \`address-level1\` - State or province - \`address-level2\` - City or town - \`address-level3\` - District or locality - \`address-level4\` - Neighborhood or suburb - \`street-address\` - Complete street address (multi-line) - \`postal-code\` - Postal or ZIP code - \`country\` - Country code (US, CA, GB) - \`country-name\` - Country name (United States, Canada) - \`language\` - Preferred language - \`sex\` - Gender or sex - \`one-time-code\` - One-time codes for authentication - \`transaction-currency\` - Currency code (USD, EUR, GBP) - \`cc-name\` - Name on credit card - \`cc-given-name\` - First name on credit card - \`cc-additional-name\` - Middle name on credit card - \`cc-family-name\` - Last name on credit card - \`cc-type\` - Credit card type (Visa, Mastercard)

```ts
'language' | 'organization' | 'name' | 'additional-name' | 'address-level1' | 'address-level2' | 'address-level3' | 'address-level4' | 'address-line1' | 'address-line2' | 'address-line3' | 'country-name' | 'country' | 'family-name' | 'given-name' | 'honorific-prefix' | 'honorific-suffix' | 'nickname' | 'one-time-code' | 'organization-title' | 'postal-code' | 'sex' | 'street-address' | 'transaction-currency' | 'username' | 'cc-additional-name' | 'cc-family-name' | 'cc-given-name' | 'cc-name' | 'cc-type'
```

### Slots

The text field component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **accessory**

  **HTMLElement**

  Additional interactive content displayed within the text field.

  Accepts button and clickable components with text content only. Other component types or complex layouts are not supported.

### Events

The text field component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text field loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text field value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the text field receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the text field.

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

### Add a basic text field

Add a single-line text input for collecting short-form information from merchants. This example shows a text field with a label, pre-filled value, and placeholder.

## html

```html
<s-text-field
  label="Store name"
  value="Jaded Pixel"
  placeholder="Become a merchant"
></s-text-field>
```

### Add an icon to a text field

Add an icon to a text field to help merchants quickly identify its purpose. This example shows a text field with a search icon and placeholder text.

## html

```html
<s-text-field
  label="Search"
  icon="search"
  placeholder="Search products..."
></s-text-field>
```

### Provide specific error messages for merchant context

Provide specific error messages to tell merchants what went wrong and what correction is needed. This example shows three text fields contrasting a vague error, a specific validation error, and a business rule error.

## html

```html
<s-stack gap="base">
  <!-- Generic error (avoid) -->
  <s-text-field label="Product weight" error="Invalid value"></s-text-field>


  <!-- Specific error (preferred) -->
  <s-text-field
    label="Product weight"
    error="Weight must be greater than 0 and less than 500 pounds for shipping calculations"
  ></s-text-field>


  <!-- Business rule error -->
  <s-text-field
    label="SKU"
    error="SKU 'TSHIRT-001' already exists. SKUs must be unique across all products."
  ></s-text-field>
</s-stack>
```

### Add a prefix and suffix

Add a prefix or suffix to provide context for the expected value, such as a country code or card type. This example shows a phone number field with a prefix and a credit card field with a suffix.

## html

```html
<s-stack gap="small">
  <s-text-field label="Phone number" prefix="+03" />
  <s-text-field
    label="Credit Card Number"
    value="1234 5678 9012 3456"
    suffix="VISA"
  />
</s-stack>
```

### Add an accessory to a text field

Place an interactive element like an icon or button inside a text field using the accessory slot. This example shows a text field with an info icon that triggers a tooltip.

## html

```html
<s-tooltip id="info-tooltip">This is info tooltip</s-tooltip>
<s-text-field label="Discount code">
  <s-icon slot="accessory" interestFor="info-tooltip" type="info" />
</s-text-field>
```

### Disable or make a text field read-only

Prevent editing by making a text field read-only or fully disabled. This example shows a read-only store URL that merchants can copy and a disabled account ID.

## html

```html
<s-stack gap="base">
  <s-text-field
    label="Store URL"
    value="my-store.myshopify.com"
    readOnly
  ></s-text-field>


  <s-text-field
    label="Account ID"
    value="acct_12345"
    disabled
  ></s-text-field>
</s-stack>
```

***

## Best practices

* **Make expected input clear:** Merchants should immediately understand what to enter and in what format. Ambiguous labels and placeholders force merchants to guess, leading to validation errors and frustration.
* **Provide visual context:** Prefixes and suffixes help merchants understand the type of value expected and its format. Without context, merchants might not know whether they're entering a complete URL or just a subdomain, a full price or just the amount.
* **Set constraints that match requirements:** Define character limits and validation rules based on actual business needs, not arbitrary numbers. Communicate these constraints clearly so merchants know what's expected.
* **Give helpful feedback:** Show merchants whether their input is valid as they type, not just after they submit. When input is invalid, explain specifically what's wrong and how to fix it rather than showing generic error messages.

***

## Limitations

* The `maxLength` attribute prevents typing beyond the limit, but in some edge cases, pasted or programmatically set content might exceed `maxLength`. Always validate length server-side.
* The `accessory` slot renders content at the end of the field. For best results, use [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) or [clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable) components with text content.

***
