---
title: Switch
description: >-
  The switch component provides a clear way for users to toggle options or
  settings on and off. Use switch for binary controls that take effect
  immediately, like enabling features, activating settings, or controlling
  visibility.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch'
  md: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch.md'
api_name: app-home
---

# Switch

The switch component provides a clear way for users to toggle options or settings on and off. Use switch for binary controls that take effect immediately, like enabling features, activating settings, or controlling visibility.

Switches provide instant visual feedback and are ideal for settings that don't require a save action to apply changes. For selections that require explicit submission, use [checkbox](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox) instead.

#### Use cases

* **Binary settings:** Toggle binary settings like enable/disable or on/off states.
* **Feature flags:** Control feature availability with clear on/off indicators.
* **Quick toggles:** Provide quick toggle controls for frequently changed settings.
* **Status changes:** Toggle resource states like active/inactive or published/unpublished.

***

## Properties

Configure the following properties on the switch component.

* **label​Accessibility​Visibility**

  **"visible" | "exclusive"**

  **Default: 'visible'**

  **required**

  Controls whether the label is visible to all users or only to screen readers.

  * `visible`: The label is shown to everyone (default).
  * `exclusive`: The label is visually hidden but still announced by screen readers.

  Use `exclusive` when the surrounding context makes the label redundant visually, but screen reader users still need it for clarity.

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

The switch component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **change**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the switch value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **input**

  **CallbackEventListener<'input'>**

  **required**

  A callback fired when the user inputs data into the switch.

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

### Toggle a setting

Give users a clear way to turn a feature on or off. This example pairs a label with a toggle switch.

## html

```html
<s-switch
  label="Enable feature"
  details="Ensure all criteria are met before enabling"
></s-switch>
```

### Show a disabled switch

Indicate when a feature isn't available. This example locks a switch to prevent interaction while displaying its current state.

## html

```html
<s-switch
  id="disabled-switch"
  label="Feature locked (Premium plan required)"
  checked
  disabled
></s-switch>
```

### Submit multiple settings in a form

Collect multiple settings that save together. This example groups switches in a form for batch submission.

## html

```html
<form>
  <s-stack gap="base">
    <s-switch
      id="email-notifications"
      label="Email notifications"
      name="emailNotifications"
      value="enabled"
    ></s-switch>
    <s-switch
      id="sms-notifications"
      label="SMS notifications"
      name="smsNotifications"
      value="enabled"
    ></s-switch>
    <s-button type="submit">Save preferences</s-button>
  </s-stack>
</form>
```

### Apply multiple settings immediately

Organize settings in a panel layout. This example arranges switches in a stack to display related preferences together.

## html

```html
<s-stack gap="base">
  <s-switch id="notifications-setting" label="Push notifications"></s-switch>
  <s-switch id="autosave-setting" label="Auto-save drafts"></s-switch>
  <s-switch
    id="analytics-setting"
    label="Usage analytics"
    checked
  ></s-switch>
</s-stack>
```

### Hide the label visually

Keep switches accessible when labels aren't visually needed. This example uses a visually hidden label that screen readers can still announce.

## html

```html
<s-switch
  id="hidden-label-switch"
  labelAccessibilityVisibility="exclusive"
  label="Toggle feature"
  checked
></s-switch>
```

### Show validation errors

Communicate switch-related problems clearly. This example displays helper text with an error message when a required switch isn't enabled.

## html

```html
<s-switch
  id="terms-switch"
  label="Agree to terms and conditions"
  details="You must agree to continue with the purchase"
  error="Agreement is required"
  name="termsAgreement"
  required
  value="agreed"
></s-switch>
```

### Add an accessibility label

Provide extra context for screen reader users. This example adds an accessibility label that gives more detail than the visible label alone.

## html

```html
<s-switch
  id="event-switch"
  label="Feature toggle"
  accessibilityLabel="Toggle feature on or off"
></s-switch>
```

***

## Best practices

* **Don't combine with save buttons:** Switches apply changes instantly when toggled, so combining them with save buttons creates confusion about when changes take effect.
* **Make the controlled setting clear:** Merchants should immediately understand what setting the switch controls and what each state means. Ambiguous labels force merchants to toggle the switch just to figure out what it does.
* **Explain the impact:** Merchants need to understand the consequences of toggling a switch, especially for settings that affect important functionality or data. Without context, merchants might hesitate to change settings or make uninformed decisions.
* **Organize related settings thoughtfully:** When presenting multiple switches, group related settings together and order them logically. A well-organized settings interface helps merchants find and configure options efficiently.
* **Make unavailable options understandable:** When a switch is disabled due to permissions, dependencies, or plan limitations, explain why. Users should know whether the limitation is temporary or permanent and what they need to do to access the setting.

***
