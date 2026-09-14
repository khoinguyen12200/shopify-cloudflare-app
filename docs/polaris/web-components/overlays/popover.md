---
title: Popover
description: >-
  The popover component displays contextual content in an overlay triggered by a
  button using the commandFor attribute. Use for secondary actions, settings, or
  information that doesn't require a full modal.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover.md
api_name: app-home
---

# Popover

The popover component displays contextual content in an overlay triggered by a button using the [`commandFor`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#commandfor) attribute. Use for secondary actions, settings, or information that doesn't require a full modal.

For interactions that need more space or user focus, such as confirmations or complex forms, use [modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal) instead.

#### Use cases

* **Contextual menus:** Display additional options or actions in an overlay triggered by a button.
* **Filter controls:** Present filter options in a popover to save screen space while keeping controls accessible.
* **Extended help:** Show detailed help content or explanations in a popover triggered by an info button.
* **Quick actions:** Provide quick action panels that appear on demand without navigating away from the current view.

***

## Properties

Configure the following properties on the popover component.

* **block​Size**

  **SizeUnitsOrAuto**

  **Default: 'auto'**

  **required**

  The vertical size of the element in standard layouts (height in left-to-right or right-to-left writing modes).

  Block size adjusts based on the writing direction: in horizontal layouts, it controls the height; in vertical layouts, it controls the width. This ensures consistent behavior across different text directions.

  Learn more about the [block-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/block-size).

  * `SizeUnits`: Specific size values in pixels, percentages, or zero for precise control.
  * `auto`: Automatically sizes based on content and layout constraints.

* **min​Block​Size**

  **SizeUnits**

  **Default: '0'**

  **required**

  The minimum vertical size of the element in standard layouts (min-height in left-to-right or right-to-left writing modes).

  Prevents the element from becoming smaller than this size along the block axis.

  Learn more about the [min-block-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/min-block-size).

* **max​Block​Size**

  **SizeUnitsOrNone**

  **Default: 'none'**

  **required**

  The maximum vertical size of the element in standard layouts (max-height in left-to-right or right-to-left writing modes).

  Prevents the element from becoming larger than this size along the block axis.

  Learn more about the [max-block-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/max-block-size).

* **inline​Size**

  **SizeUnitsOrAuto**

  **Default: 'auto'**

  **required**

  The horizontal size of the element in standard layouts (width in left-to-right or right-to-left writing modes).

  Inline size adjusts based on the writing direction: in horizontal layouts, it controls the width; in vertical layouts, it controls the height. This ensures consistent behavior across different text directions.

  Learn more about the [inline-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/inline-size).

  * `SizeUnits`: Specific size values in pixels, percentages, or zero for precise control.
  * `auto`: Automatically sizes based on content and layout constraints.

* **min​Inline​Size**

  **SizeUnits**

  **Default: '0'**

  **required**

  The minimum horizontal size of the element in standard layouts (min-width in left-to-right or right-to-left writing modes).

  Prevents the element from becoming smaller than this size along the inline axis.

  Learn more about the [min-inline-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/min-inline-size).

* **max​Inline​Size**

  **SizeUnitsOrNone**

  **Default: 'none'**

  **required**

  The maximum horizontal size of the element in standard layouts (max-width in left-to-right or right-to-left writing modes).

  Prevents the element from becoming larger than this size along the inline axis.

  Learn more about the [max-inline-size property](https://developer.mozilla.org/en-US/docs/Web/CSS/max-inline-size).

### SizeUnitsOrAuto

Represents size values that can also be set to \`auto\` for automatic sizing. - \`SizeUnits\`: Specific size values in pixels, percentages, or zero for precise control. - \`auto\`: Automatically sizes based on content and layout constraints.

```ts
SizeUnits | 'auto'
```

### SizeUnits

Represents size values in pixels, percentages, or zero. - \`${number}px\`: Absolute size in pixels for fixed dimensions (such as \`100px\`, \`24px\`). - \`${number}%\`: Relative size as a percentage of the parent container (such as \`50%\`, \`100%\`). - \`0\`: Zero size, equivalent to no dimension.

```ts
`${number}px` | `${number}%` | `0`
```

### SizeUnitsOrNone

Represents size values that can also be set to \`none\` to remove the size constraint. - \`SizeUnits\`: Specific size values in pixels, percentages, or zero for precise control. - \`none\`: No size constraint, allowing unlimited growth.

```ts
SizeUnits | 'none'
```

### Events

The popover component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **afterhide**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired after the popover is hidden.

* **aftershow**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired after the popover is shown.

* **aftertoggle**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired after the popover is toggled.

* **hide**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired when the popover is hidden.

* **show**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired when the popover is shown.

* **toggle**

  **CallbackEventListener\<TTagName> | null**

  **required**

  A callback fired when the popover is toggled.

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

The popover component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the popover component, which appears in an overlay positioned relative to its trigger element.

***

## Examples

### Show a menu of actions

Show contextual options without navigating away from the current page. This example presents an action menu with edit and delete options.

## html

```html
<s-button commandFor="product-options-popover">Product options</s-button>


<s-popover id="product-options-popover">
  <s-stack direction="block">
    <s-button variant="tertiary">Import</s-button>
    <s-button variant="tertiary">Export</s-button>
  </s-stack>
</s-popover>
```

### Display notification list

Surface time-sensitive information on demand. This example displays a notification list with order, inventory, and payment alerts.

## html

```html
<s-button commandFor="notifications-popover" icon="notification">
  Notifications
</s-button>


<s-popover id="notifications-popover">
  <s-box padding="base">
    <s-stack gap="small-200">
      <s-stack gap="small">
        <s-heading>New order received</s-heading>
        <s-paragraph color="subdued">
          Order #1234 was placed 5 minutes ago
        </s-paragraph>
      </s-stack>


      <s-divider />


      <s-stack gap="small">
        <s-heading>Low inventory alert</s-heading>
        <s-paragraph color="subdued">
          3 products are running low on stock
        </s-paragraph>
      </s-stack>


      <s-divider />


      <s-stack gap="small">
        <s-heading>Payment processed</s-heading>
        <s-paragraph color="subdued">
          $250.00 payment confirmed for order #1230
        </s-paragraph>
      </s-stack>
    </s-stack>
  </s-box>
</s-popover>
```

### Configure table display options

Let merchants customize their view without leaving the page. This example presents a column visibility picker with an apply button.

## html

```html
<s-button commandFor="table-settings-popover" icon="settings">
  Columns
</s-button>


<s-popover id="table-settings-popover">
  <s-box padding="base">
    <s-stack gap="small-200">
      <s-stack gap="small">
        <s-heading>Choose columns to display</s-heading>
        <s-choice-list label="Select columns to display" name="columns" multiple>
          <s-choice value="sku" selected>Sku</s-choice>
          <s-choice value="inventory" selected>Inventory</s-choice>
          <s-choice value="price" selected>Price</s-choice>
          <s-choice value="vendor">Vendor</s-choice>
          <s-choice value="type">Product type</s-choice>
        </s-choice-list>
      </s-stack>
      <s-button variant="primary" commandFor="table-settings-popover" command="--hide">Apply changes</s-button>
    </s-stack>
  </s-box>
</s-popover>
```

### Show inventory details

Show supplementary information without cluttering the main view. This example displays stock levels across multiple warehouse locations.

## html

```html
<s-button commandFor="stock-popover" icon="info">
  Stock details
</s-button>


<s-popover id="stock-popover">
  <s-box padding="base">
    <s-stack gap="small">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">Available</s-text>
          <s-text>127 units</s-text>
        </s-stack>


        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">Reserved</s-text>
          <s-text>15 units</s-text>
        </s-stack>


        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">In transit</s-text>
          <s-text>50 units</s-text>
        </s-stack>
      </s-stack>


      <s-divider />


      <s-stack direction="inline" justifyContent="space-between">
        <s-text>Total stock</s-text>
        <s-text>192 units</s-text>
      </s-stack>


      <s-button variant="secondary">View full inventory report</s-button>
    </s-stack>
  </s-box>
</s-popover>
```

### Filter with apply and clear

Build inline filtering without navigating to a separate page. This example combines a choice list with apply and clear buttons, plus dynamic trigger text.

## html

```html
<s-button commandFor="filter-popover" id="filter-btn">Filter</s-button>


<s-popover id="filter-popover" inlineSize="250px">
  <s-box padding="base">
    <s-stack direction="block" gap="base">
      <s-heading>Filter by status</s-heading>


      <s-choice-list id="status-filter" name="status" label="Filter by status" labelAccessibilityVisibility="exclusive">
        <s-choice value="all" selected>All products</s-choice>
        <s-choice value="active">Active</s-choice>
        <s-choice value="draft">Draft</s-choice>
      </s-choice-list>


      <s-stack direction="inline" gap="base">
        <s-button variant="primary" id="apply-filter" commandFor="filter-popover" command="--hide">Apply</s-button>
        <s-button id="clear-filter" commandFor="filter-popover" command="--hide">Clear</s-button>
      </s-stack>
    </s-stack>
  </s-box>
</s-popover>


<script>
  const filterBtn = document.getElementById('filter-btn');
  const choiceList = document.getElementById('status-filter');


  document.getElementById('apply-filter').addEventListener('click', () => {
    const selected = choiceList.values[0];
    filterBtn.textContent = selected !== 'all' ? `Filter: ${selected}` : 'Filter';
  });


  document.getElementById('clear-filter').addEventListener('click', () => {
    choiceList.values = ['all'];
    filterBtn.textContent = 'Filter';
  });
</script>
```

***

## Best practices

* Use for secondary or less important information and actions since they're hidden until triggered.
* Contain actions that share a relationship to each other.
* Be triggered by a clearly labeled default or tertiary button.

***

## Limitations

* Popovers can only be opened by user interaction, not programmatically on page load.
* The popover position is determined by the trigger button and cannot be manually overridden.
* Content within the popover does not scroll automatically; use box or section for internal scrolling if needed.

***
