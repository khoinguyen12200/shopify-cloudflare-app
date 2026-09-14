---
title: Button group
description: >-
  The button group component displays multiple related buttons in a structured
  layout. Use button group to organize action buttons together, creating clear
  visual hierarchies and helping users understand available options.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group.md
api_name: app-home
---

# Button group

The button group component displays multiple related buttons in a structured layout. Use button group to organize action buttons together, creating clear visual hierarchies and helping users understand available options.

Button groups support various layouts including segmented appearances for tightly related options like view switching or filter controls. For individual actions, use [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button).

#### Use cases

* **Action groups:** Group related buttons together with consistent spacing and alignment.
* **Primary and secondary:** Combine primary and secondary actions in organized groups.
* **Responsive layouts:** Create button groups that adapt to different screen sizes.
* **Horizontal arrangement:** Arrange multiple buttons horizontally with proper spacing.

***

## Properties

Configure the following properties on the button group component.

* **gap**

  **"base" | "none"**

  **Default: 'base'**

  **required**

  The spacing between buttons in the group.

  * `base`: Standard spacing that provides clear visual separation between buttons.
  * `none`: No spacing, creating a connected button group.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

### Slots

The button group component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The buttons displayed within the button group component, which are arranged together as a cohesive set of related actions.

* **primary-action**

  **HTMLElement**

  The main action for this group, displayed with high visual emphasis. Accepts a single button with `variant="primary"`.

  Use this for the primary action you want users to take. This can't be used when `gap="none"`.

* **secondary-actions**

  **HTMLElement**

  Supporting actions displayed with less emphasis than the primary action. Accepts one or more button components with `variant="secondary"` or `variant="auto"`.

  Use these for alternative or less critical actions.

***

## Examples

### Group a primary and secondary action

Group related buttons together with a primary action and secondary options. This example shows a button group with a save button and a cancel button.

## html

```html
<s-button-group>
  <s-button slot="primary-action">Save</s-button>
  <s-button slot="secondary-actions">Cancel</s-button>
</s-button-group>
```

### Add bulk action buttons

Present multiple secondary actions for operating on selected items. This example shows archive, export, and delete buttons grouped together for bulk operations.

## html

```html
<s-button-group>
  <s-button slot="secondary-actions">Archive</s-button>
  <s-button slot="secondary-actions">Export</s-button>
  <s-button slot="secondary-actions" tone="critical">Delete</s-button>
</s-button-group>
```

### Add icons to grouped buttons

Add icons to grouped buttons to help merchants identify each action. This example shows duplicate, archive, and delete buttons with icons.

## html

```html
<s-button-group>
  <s-button slot="secondary-actions" icon="duplicate">Duplicate</s-button>
  <s-button slot="secondary-actions" icon="archive">Archive</s-button>
  <s-button slot="secondary-actions" icon="delete" tone="critical">
    Delete
  </s-button>
</s-button-group>
```

### Create a segmented button group

Remove the gap between buttons to create a segmented control for toggling between views or options. This example shows day, week, and month buttons joined together with no spacing.

## html

```html
<s-button-group gap="none">
  <s-button slot="secondary-actions">Day</s-button>
  <s-button slot="secondary-actions">Week</s-button>
  <s-button slot="secondary-actions">Month</s-button>
</s-button-group>
```

### Confirm a destructive action

Pair a cancel button with a critical action for destructive confirmation flows. This example shows a cancel and delete button grouped together for a confirmation dialog.

## html

```html
<s-button-group>
  <s-button slot="secondary-actions">Cancel</s-button>
  <s-button slot="secondary-actions" tone="critical">Delete product</s-button>
</s-button-group>
```

***

## Best practices

* **Group related actions:** Organize related calls to action together to create clear action hierarchies and help merchants understand available options.
* **Maintain visual hierarchy:** Use primary variants for main actions and secondary or tertiary variants for supporting actions to guide merchant attention.
* **Limit action count:** Avoid including too many buttons, which can overwhelm merchants and create decision paralysis.
* **Use segmented appearance for toggles:** Apply the segmented appearance for tightly related options like view switching or filter controls.
* **Separate destructive actions:** Position destructive actions appropriately and use critical tone to prevent accidental activation.

***
