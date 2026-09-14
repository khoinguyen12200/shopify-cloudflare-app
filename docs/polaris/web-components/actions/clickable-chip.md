---
title: Clickable chip
description: >-
  The clickable chip component displays interactive labels or categories that
  users can click or remove. Use clickable chip to show filter tags, selected
  options, or merchant-created labels that users need to interact with or
  dismiss.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable-chip
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable-chip.md
api_name: app-home
---

# Clickable chip

The clickable chip component displays interactive labels or categories that users can click or remove. Use clickable chip to show filter tags, selected options, or merchant-created labels that users need to interact with or dismiss.

Clickable chips support multiple visual variants, optional icons, and can function as both clickable buttons and removable tags for flexible interaction patterns. For non-interactive labels, use [chip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip).

#### Use cases

* **Removable tags:** Display removable tags or labels that perform actions when clicked.
* **Interactive filters:** Show active filters as clickable chips that can be modified or removed.
* **Action chips:** Create chips that trigger actions or open dialogs when clicked.
* **Selection management:** Display selected items as chips with click handlers for modification.

***

## Properties

Configure the following properties on the clickable chip component.

* **color**

  **ColorKeyword**

  **Default: 'base'**

  **required**

  The color emphasis level that controls visual intensity.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **removable**

  **boolean**

  **Default: false**

  **required**

  Whether the chip displays a remove button for dismissal. When clicked, the `remove` callback fires.

* **hidden**

  **boolean**

  **Default: false**

  **required**

  Whether the chip is hidden from view. When using controlled component pattern with `removable` chips, update this property when the `remove` event fires. For non-removable chips, manually toggle this property to show or hide the chip.

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the chip is disabled, preventing any user interaction.

* **href**

  **string**

  **required**

  The URL to navigate to when clicked. The `click` event fires first, then navigation occurs. If `commandFor` is also set, the command executes instead of navigation.

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

### ColorKeyword

Defines the color intensity or emphasis level for text and UI elements. - \`subdued\`: Deemphasized color for secondary text, supporting labels, and less critical interface elements. - \`base\`: Primary color for body text, standard UI elements, and general content with good readability. - \`strong\`: Emphasized color for headings, key labels, and interactive elements that need prominence.

```ts
'subdued' | 'base' | 'strong'
```

### Events

The clickable chip component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **afterhide**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired after the chip is hidden.

* **click**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the chip is clicked.

  Learn more about the [click event](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event).

* **remove**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the chip is removed.

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

The clickable chip component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The text label displayed within the chip, which represents an interactive filter, tag, or selectable item.

* **graphic**

  **HTMLElement**

  An optional icon to display at the start of the chip. Accepts only icon components.

***

## Examples

### Add a clickable chip with default styling

Create an interactive chip that merchants can click to trigger an action. This example shows a clickable chip component with default styling.

## html

```html
<s-clickable-chip>Clickable chip</s-clickable-chip>
```

### Apply color variants to chips

Use the `color` property to visually distinguish chips by importance or category. This example shows three chips with `base`, `subdued`, and `strong` color variants.

## html

```html
<s-stack direction="inline" gap="base">
  <s-clickable-chip color="base" accessibilityLabel="Filter by active products">
    Active
  </s-clickable-chip>
  <s-clickable-chip
    color="subdued"
    accessibilityLabel="Filter by draft products"
  >
    Draft
  </s-clickable-chip>
  <s-clickable-chip
    color="strong"
    accessibilityLabel="Filter by archived products"
  >
    Archived
  </s-clickable-chip>
</s-stack>
```

### Add an icon and a remove button to a chip

Add an icon and a remove button so merchants can see the status and dismiss the chip. This example shows a removable chip with a check circle icon in the graphic slot.

## html

```html
<s-clickable-chip
  color="strong"
  accessibilityLabel="Remove status filter"
  removable
>
  <s-icon slot="graphic" type="check-circle"></s-icon>
  In progress
</s-clickable-chip>
```

### Use a chip as a link

Set the `href` property to make a chip link to another page when clicked. This example shows a subdued chip with a product icon that acts as a link.

## html

```html
<s-clickable-chip
  color="subdued"
  href="javascript:void(0)"
  accessibilityLabel="View T-shirt product"
>
  <s-icon slot="graphic" type="product"></s-icon>
  T-shirt
</s-clickable-chip>
```

### Disable a clickable chip

Disable a chip to prevent interaction while keeping it visible. This example shows a disabled chip with an accessibility label explaining the inactive state.

## html

```html
<s-clickable-chip
  color="base"
  disabled
  accessibilityLabel="Status filter (disabled)"
>
  Inactive
</s-clickable-chip>
```

***

## Best practices

* **Keep labels to 1-3 words:** Aim for labels like **Electronics**, **Summer sale**, or **Clearance items**.
* **Choose color variants by importance:** Use `subdued` for less important or secondary chips, `base` (default) for standard selections, and `strong` to emphasize primary or active selections.
* **Make remove action clear:** When chips are removable, ensure the remove button's visible and has clear hover/focus states.
* **Group related chips together:** Use an inline [stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack) to arrange multiple chips horizontally with consistent spacing.

***
