---
title: Button
description: >-
  The button component triggers actions or events, such as submitting forms,
  opening dialogs, or navigating to other pages. Use button to let users perform
  specific tasks or initiate interactions throughout the interface.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/actions/button'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/actions/button.md
api_name: app-home
---

# Button

The button component triggers actions or events, such as submitting forms, opening dialogs, or navigating to other pages. Use button to let users perform specific tasks or initiate interactions throughout the interface.

Buttons support various visual styles, tones, and interaction patterns to communicate intent and hierarchy. They can also function as links, guiding users to internal or external destinations. For navigation-focused interactions within text, use [link](https://shopify.dev/docs/api/app-home/latest/web-components/actions/link). For grouping multiple related buttons, use [button group](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group).

#### Use cases

* **Form submission:** Create submit buttons for forms that save product configurations or settings.
* **Primary actions:** Implement primary actions like "Save changes," "Create resource," or "Apply settings."
* **Secondary actions:** Provide supporting actions such as "Cancel," "Reset," or "View details."
* **Loading states:** Show loading indicators during API calls while preventing duplicate submissions.

***

## Properties

Configure the following properties on the button component.

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the button is disabled, preventing it from being clicked or receiving focus.

* **icon**

  **"" | "replace" | "search" | "split" | "link" | "edit" | "info" | "incomplete" | "complete" | "product" | "variant" | "collection" | "select" | "color" | "money" | "order" | "code" | ... 541 more ... | "x-circle-filled"**

  **required**

  An icon displayed inside the button, typically positioned before the button text. Use icons to help users quickly identify the button's action or to improve scannability. Accepts any icon name from the icon library or a custom string identifier.

* **loading**

  **boolean**

  **Default: false**

  **required**

  Whether to replace the button content with a loading indicator while a background action is being performed.

  This also disables the button component.

* **variant**

  **"auto" | "primary" | "secondary" | "tertiary"**

  **Default: 'auto'**

  **required**

  The visual appearance of the button component.

  * `auto`: The variant is automatically determined by the button component's context.
  * `primary`: High emphasis button for the primary action on the page. Should be used sparingly.
  * `secondary`: Medium emphasis button for secondary actions.
  * `tertiary`: Low emphasis button for less important actions.

* **tone**

  **"critical" | "auto" | "neutral"**

  **Default: 'auto'**

  **required**

  The semantic meaning and color treatment of the component.

  * `critical`: Urgent problems or destructive actions.
  * `auto`: Automatically determined based on context.
  * `neutral`: General information without specific intent.

* **target**

  **"auto" | AnyString | "\_blank" | "\_self" | "\_parent" | "\_top"**

  **Default: 'auto'**

  **required**

  The browsing context where the linked URL should be displayed.

  * `auto`: The target is automatically determined based on the origin of the URL.
  * `_blank`: Opens the URL in a new window or tab.
  * `_self`: Opens the URL in the same browsing context as the current one.
  * `_parent`: Opens the URL in the parent browsing context of the current one. If there is no parent, behaves as `_self`.
  * `_top`: Opens the URL in the topmost browsing context (the highest ancestor of the current one). If there is no ancestor, behaves as `_self`.

* **href**

  **string**

  **required**

  The URL to navigate to when clicked. The `click` event fires first, then navigation occurs. If `commandFor` is also set, the command executes instead of navigation.

* **download**

  **string**

  **required**

  Prompts the browser to download the linked URL rather than navigate to it. When set, the value specifies the suggested filename for the downloaded file.

  The filename suggestion is only respected for same-origin URLs, `blob:`, and `data:` schemes. Cross-origin URLs can still trigger downloads, but browsers might ignore the suggested filename.

  Learn more about the [download attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download).

* **type**

  **"button" | "reset" | "submit"**

  **Default: 'button'**

  **required**

  The behavior of the button component.

  * `button`: Used to indicate the component acts as a button, meaning it has no default action.
  * `reset`: Used to indicate the component acts as a reset button, meaning it resets the closest form (returning fields to their default values).
  * `submit`: Used to indicate the component acts as a submit button, meaning it submits the closest form.

  This property is ignored if the component supports `href` or `commandFor`/`command` and one of them is set.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **command**

  **'--auto' | '--show' | '--hide' | '--toggle'**

  **Default: '--auto'**

  **required**

  The action that [command](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#command) should take when this component is activated.

  * `--auto`: A default action for the target component.
  * `--show`: Shows the target component.
  * `--hide`: Hides the target component.
  * `--toggle`: Toggles the visibility of the target component.

* **command​For**

  **string**

  **required**

  The component that [commandFor](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#commandfor) should act on when this component is activated.

* **interest​For**

  **string**

  **required**

  The ID of the component to show when users hover over or focus on this component. Use this to connect interactive components to popovers or tooltips that provide additional context or information.

### AnyString

A utility type that enables autocomplete for specific string literals while still accepting any string value. By intersecting \`string\` with an empty object type, this prevents TypeScript from widening literal types, preserving IDE suggestions for known values while maintaining flexibility for custom strings.

```ts
string & {}
```

### Events

The button component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **blur**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the button loses focus.

  Learn more about the [blur event](https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event).

* **click**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the button is clicked.

  Learn more about the [click event](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event).

* **focus**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the button receives focus.

  Learn more about the [focus event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focus_event).

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

The button component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The label text or elements displayed inside the button component, describing the action that will be performed when clicked.

***

## Examples

### Add a basic button

Create a button with a text label to let merchants trigger an action. This example shows the basic button component with default styling.

## html

```html
<s-button>Save</s-button>
```

### Add primary and secondary buttons

Create buttons for actions like saving, creating, or navigating. This example shows primary and secondary buttons with clear, action-oriented labels.

## html

```html
<s-button variant="primary">Add Product</s-button>
<s-button variant="secondary">Save Theme</s-button>
```

### Set visual emphasis with variants

Use variants to establish a clear visual hierarchy between primary, secondary, and supplementary actions. This example shows all four variant options: primary, secondary, tertiary, and auto.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button variant="primary">Primary</s-button>
  <s-button variant="secondary">Secondary</s-button>
  <s-button variant="tertiary">Tertiary</s-button>
  <s-button variant="auto">Auto</s-button>
</s-stack>
```

### Communicate intent with tones

Apply tones to signal the purpose and potential impact of an action through color. This example shows critical tone for destructive actions, neutral tone for less prominent actions, and the default auto tone.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button tone="critical">Delete</s-button>
  <s-button tone="neutral">Save draft</s-button>
  <s-button>Continue</s-button>
</s-stack>
```

### Add an icon alongside a text label

Combine an icon with a text label to help merchants identify what a button does. This example shows a button with both a text label and an icon to reinforce the action.

## html

```html
<s-button icon="plus">Add product</s-button>
```

### Create compact icon-only buttons for toolbars

Create icon-only buttons to save space in dense interfaces like toolbars and action bars. This example shows multiple icon-only buttons with an `accessibilityLabel` for screen reader support.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button
    icon="duplicate"
    variant="tertiary"
    accessibilityLabel="Duplicate product"
  ></s-button>
  <s-button
    icon="view"
    variant="tertiary"
    accessibilityLabel="Preview product"
  ></s-button>
  <s-button
    icon="menu-horizontal"
    variant="tertiary"
    accessibilityLabel="More actions"
  ></s-button>
</s-stack>
```

### Show loading feedback during async operations

Add a loading state to prevent duplicate submissions and reassure merchants that an action is being processed. This example shows buttons with the loading prop across different variants.

## html

```html
<!-- Product save operation -->
<s-button loading variant="primary">Saving product...</s-button>


<!-- Bulk inventory update -->
<s-button loading variant="secondary">Updating 247 variants...</s-button>


<!-- Order fulfillment -->
<s-button loading tone="neutral">Processing shipment...</s-button>
```

### Disable buttons and submit forms

Disable buttons to prevent interaction when prerequisites are not met, and set type to submit to integrate with HTML forms. This example shows a disabled button alongside a submit button.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button disabled>Save draft</s-button>
  <s-button type="submit" variant="primary">Save product</s-button>
</s-stack>
```

### Use buttons for navigation and downloads

Set the `href` property to make buttons navigate like links while maintaining button styling. This example shows internal navigation, opening external URLs in new tabs, and triggering file downloads.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button href="javascript:void(0)">View products</s-button>
  <s-button href="javascript:void(0)" target="_blank">Help docs</s-button>
  <s-button href="javascript:void(0)" download="sales-report.csv">
    Export data
  </s-button>
</s-stack>
```

### Confirm destructive actions with critical tone

Pair a cancel button with a critical-toned action button to help merchants avoid accidental destructive operations. This example shows a confirmation pattern for deleting a resource.

## html

```html
<s-stack direction="inline" gap="base">
  <s-button variant="secondary">Cancel</s-button>
  <s-button variant="primary" tone="critical">Delete variant</s-button>
</s-stack>
```

### Trigger actions on other components

Use `commandFor` to connect a button to another component by ID, triggering built-in actions like toggling a popover or showing a modal. This example shows a button that opens a popover with a list of additional actions.

## html

```html
<s-button commandFor="actions-popover">More actions</s-button>


<s-popover id="actions-popover">
  <s-stack direction="block">
    <s-button variant="tertiary">Export products</s-button>
    <s-button variant="tertiary">Import products</s-button>
    <s-button variant="tertiary">Print labels</s-button>
  </s-stack>
</s-popover>
```

***

## Best practices

* **Label buttons clearly:** Use strong, actionable verbs that clearly and accurately describe the action (like **Save**, **Edit**, or **Add tags**). Write labels in sentence case and avoid unnecessary words and articles (like **a**, **an**, **the**). Don't use punctuation.
* **Use appropriate button tones:** Apply established button tones appropriately. Use critical tone only for destructive actions that are difficult or impossible to undo. Match the tone to the action's impact and importance.
* **Establish clear hierarchy:** Prioritize the most important actions to avoid confusion. Use primary buttons for main actions, secondary buttons for supporting actions, and tertiary buttons for supplementary actions.
* **Position consistently:** Place buttons in consistent locations throughout the interface to create predictable interaction patterns.
* **Icon-only buttons:** For icon-only buttons, always use `accessibilityLabel` to describe the action for screen reader users.

***

## Limitations

* When using `href` for navigation, external URLs (domains outside Shopify admin) might be blocked or show security warnings depending on the extension context and merchant's browser security settings.
* Setting `loading={true}` provides visual feedback and prevents form submission or multiple clicks. You must implement additional logic to debounce or disable the button action during async operations.
* Icon-only buttons have a minimum touch target size but don't expand to fill available space. They maintain a fixed size based on the icon and padding, which might create layout inconsistencies if mixed with text buttons in the same container.
* Disabled buttons (`disabled={true}`) are removed from the tab order and can't receive keyboard focus. If you disable a button temporarily (for example, while waiting for form validation), then provide visible text explaining why it's disabled. For async operations, use `loading` over `disabled` because `loading` communicates that an action is in progress.

***
