---
title: Date field
description: >-
  The date field component captures date input with a consistent interface for
  date selection and proper validation. Use it to collect date information in
  forms, scheduling interfaces, or data entry workflows.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-field'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-field.md
api_name: app-home
---

# Date field

The date field component captures date input with a consistent interface for date selection and proper validation. Use it to collect date information in forms, scheduling interfaces, or data entry workflows.

The component supports manual text entry. For visual calendar-based selection, consider using [date picker](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-picker).

#### Use cases

* **Date selection:** Collect single dates for scheduling, deadlines, or effective dates.
* **Date ranges:** Pair two date fields for start and end dates in reporting or scheduling workflows.
* **Date restrictions:** Limit selectable dates to valid ranges or business days using `allow`, `disallow`, and `allowDays` props.
* **Scheduling workflows:** Set launch dates, promotion start dates, or deadline dates in configuration forms.

***

## Properties

Configure the following properties on the date field component.

* **allow**

  **string**

  **Default: ""**

  **required**

  Specifies which dates can be selected as a comma-separated list. An empty string (default) allows all dates.

  **Formats:**

  * `YYYY-MM-DD`: Single date
  * `YYYY-MM`: Whole month
  * `YYYY`: Whole year
  * `start--end`: Date range (inclusive, unbounded if start/end omitted)

  **Examples:**

  * `2024-02--2025`: February 2024 through end of 2025
  * `2024-05-09, 2024-05-11`: Only May 9th and 11th, 2024

* **disallow**

  **string**

  **Default: ""**

  **required**

  Specifies which dates can't be selected as a comma-separated list. These dates are excluded from those specified in `allow`. An empty string (default) has no effect.

  **Formats:**

  * `YYYY-MM-DD`: Single date
  * `YYYY-MM`: Whole month
  * `YYYY`: Whole year
  * `start--end`: Date range (inclusive, unbounded if start/end omitted)

  **Examples:**

  * `--2024-02`: All dates before February 2024
  * `2024-05-09, 2024-05-11`: May 9th and 11th, 2024

* **allow​Days**

  **string**

  **Default: ""**

  **required**

  Specifies which days of the week can be selected as a comma-separated list. Further restricts dates from `allow` and `disallow`. An empty string (default) has no effect.

  **Valid days**: `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`

  **Example:** `saturday, sunday` (only weekends)

* **disallow​Days**

  **string**

  **Default: ""**

  **required**

  Specifies which days of the week can't be selected as a comma-separated list. Excludes days from `allowDays` and intersects with `allow` and `disallow`. An empty string (default) has no effect.

  **Valid days**: `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`

  **Example:** `saturday, sunday` (no weekends)

* **view**

  **string**

  **required**

  The currently displayed month in `YYYY-MM` format. When changed, the `viewchange` callback is triggered. Defaults to `defaultView`.

* **default​View**

  **string**

  **required**

  The default month to display in `YYYY-MM` format. Used until the `view` callback is set by user interaction or programmatically. Defaults to the current month in the user's locale.

* **autocomplete**

  **DateAutocompleteField**

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

  **Default: ""**

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

* **value**

  **string**

  **Default: ""**

  **required**

  The currently selected date in `YYYY-MM-DD` format. An empty string means no date is selected.

### DateAutocompleteField

Represents autocomplete values that are valid for date input fields. This is a subset of \`AnyAutocompleteField\` containing only fields suitable for date-based inputs. Available values: - \`bday\` - Complete birthday date - \`bday-day\` - Day component of a birthday (1-31) - \`bday-month\` - Month component of a birthday (1-12) - \`bday-year\` - Year component of a birthday (1990) - \`cc-expiry\` - Complete credit card expiration date - \`cc-expiry-month\` - Month component of a credit card expiration date (1-12) - \`cc-expiry-year\` - Year component of a credit card expiration date (2025)

```ts
'bday-day' | 'bday-month' | 'bday-year' | 'bday' | 'cc-expiry-month' | 'cc-expiry-year' | 'cc-expiry'
```

### Events

The date field component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the date field loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the date field value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **focus**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the date field receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the date field.

  Learn more about the [input event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event).

* **invalid**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the date field value is invalid.

  Learn more about the [invalid event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/invalid_event).

* **viewchange**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the calendar view changes (such as when navigating between months).

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

### Add a basic date field

Add a date field to let merchants select a date using a built-in calendar picker. This example shows a basic date field with a default view and pre-selected value.

## html

```html
<s-date-field defaultView="2025-09" defaultValue="2025-09-01"></s-date-field>
```

### Collect a date with a label and placeholder

Collect a date from merchants with a labeled input and placeholder text. This example shows a date field configured with a label, name, and placeholder.

## html

```html
<s-date-field
  label="Order date"
  name="orderDate"
  placeholder="Select date"
></s-date-field>
```

### Pre-populate with an existing date

Pre-populate a date field so merchants can review or edit a provided date. This example shows a date field with a value already set.

## html

```html
<s-date-field
  label="Shipping date"
  name="shippingDate"
  value="2024-03-15"
></s-date-field>
```

### Restrict selectable days of the week

Restrict which days of the week merchants can select, such as excluding weekends. This example shows a date field that only allows weekday selections.

## html

```html
<s-date-field
  label="Delivery date"
  name="deliveryDate"
  disallowDays="[0, 6]"
  details="Delivery available Monday through Friday only"
></s-date-field>
```

### Allow only specific dates

Limit selection to a specific set of dates, such as available appointment slots. This example shows a date field that only allows dates from a predefined list.

## html

```html
<s-date-field
  label="Available appointment dates"
  name="appointmentDate"
  allow='["2024-03-20", "2024-03-22", "2024-03-25", "2024-03-27"]'
  details="Select from available time slots"
></s-date-field>
```

### Show a validation error

Display an error message when a required date is missing or an invalid date is entered. This example shows a date field with a static error and the required attribute.

## html

```html
<s-date-field
  label="Event date"
  name="eventDate"
  required
  error="Select a valid event date"
></s-date-field>
```

### Disable or make a date field read-only

Prevent editing by making a date field read-only or fully disabled. This example shows a read-only field for viewing a creation date and a disabled field for an archived date.

## html

```html
<s-stack gap="base">
  <s-date-field
    label="Creation date"
    name="createdDate"
    value="2024-01-01"
    readOnly
  ></s-date-field>


  <s-date-field
    label="Archived date"
    name="archivedDate"
    value="2024-02-15"
    disabled
  ></s-date-field>
</s-stack>
```

### Use date fields in a form

Combine date fields with other form elements like text fields and buttons. This example shows a complete order form with a required date, a weekday-restricted delivery date, and a submit button.

## html

```html
<form>
  <s-stack gap="base">
    <s-text-field
      label="Customer name"
      name="customerName"
      required
    ></s-text-field>


    <s-date-field
      label="Order date"
      name="orderDate"
      value="2024-03-15"
      required
    ></s-date-field>


    <s-date-field
      label="Requested delivery date"
      name="deliveryDate"
      disallowDays="[0, 6]"
      details="Weekdays only"
    ></s-date-field>


    <s-button type="submit" variant="primary">Process order</s-button>
  </s-stack>
</form>
```

### Select a date range with two fields

Pair two date fields to let merchants define a start and end date for a range. This example shows side-by-side date fields for selecting a report period.

## html

```html
<s-stack gap="base">
  <s-heading>Sales report period</s-heading>


  <s-stack direction="inline" gap="base">
    <s-date-field
      label="Start date"
      name="startDate"
      id="report-start"
    ></s-date-field>


    <s-date-field
      label="End date"
      name="endDate"
      id="report-end"
    ></s-date-field>
  </s-stack>


  <s-button variant="primary">Generate report</s-button>
</s-stack>
```

### Validate a date field dynamically

Validate a date field in real time and update the error message as the merchant interacts. This example shows a required date field that clears its error once a valid date is selected.

## html

```html
<s-date-field
  label="Event date"
  name="eventDate"
  required
  error="Select a valid event date"
></s-date-field>
```

***

## Best practices

* **Use smart defaults:** Pre-populate fields with sensible dates when editing existing data or suggesting common selections.
* **Restrict dates appropriately:** Use the `allow` and `disallow` properties to restrict selectable dates for your use case (like only future dates for scheduling or only weekdays for business operations).
* **Explain date constraints:** Use the `details` property to clarify requirements like "Select a date within the next 30 days" or "Must be a future date."
* **Write actionable error messages:** Provide clear validation messages for invalid dates that help merchants correct their input.

***
