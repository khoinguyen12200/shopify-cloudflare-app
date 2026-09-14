---
title: Menu
description: >-
  The menu component displays a list of actions that can be performed on a
  resource or within a specific context. Use menu to present multiple related
  actions in a compact dropdown format, reducing visual clutter while
  maintaining discoverability.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu'
  md: 'https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu.md'
api_name: app-home
---

# Menu

The menu component displays a list of actions that can be performed on a resource or within a specific context. Use menu to present multiple related actions in a compact dropdown format, reducing visual clutter while maintaining discoverability.

Menus support action grouping, icons for visual clarity, and keyboard navigation for efficient interaction.

#### Use cases

* **Dropdown menus:** Create dropdown menus with selectable options.
* **Action menus:** Provide menus of actions for resources or contexts.
* **Navigation menus:** Build navigation interfaces with menu components.
* **Contextual options:** Display contextual options in menu format.

***

## Properties

Configure the following properties on the menu component.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

### Slots

The menu component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The items displayed within the menu. Only accepts button and section components. Use button for individual menu actions and section to group related items.

***

## Examples

### Add a basic actions menu

Add a dropdown menu of actions triggered by a button. This example shows a menu with three icon buttons including a critical delete action.

## html

```html
<s-button commandFor="customer-menu">Edit customer</s-button>


<s-menu id="customer-menu" accessibilityLabel="Customer actions">
  <s-button icon="merge">Merge customer</s-button>
  <s-button icon="incoming">Request customer data</s-button>
  <s-button icon="delete" tone="critical">Delete customer</s-button>
</s-menu>
```

### Organize items into sections

Organize menu items into labeled groups so merchants can find related actions. This example shows two sections with headings separating product actions from export options.

## html

```html
<s-button commandFor="organized-menu">Bulk actions</s-button>


<s-menu id="organized-menu" accessibilityLabel="Organized menu">
  <s-section heading="Product actions">
    <s-button icon="edit">Edit selected</s-button>
    <s-button icon="duplicate">Duplicate selected</s-button>
    <s-button icon="archive">Archive selected</s-button>
  </s-section>
  <s-section heading="Export options">
    <s-button icon="export">Export as CSV</s-button>
    <s-button icon="print">Print barcodes</s-button>
  </s-section>
</s-menu>
```

### Add links and disabled items to a menu

Mix link-based, standard, and disabled buttons in a single menu. This example shows a menu with a link that opens in a new tab, a disabled action, and a download link.

## html

```html
<s-button commandFor="mixed-menu">Options</s-button>


<s-menu id="mixed-menu" accessibilityLabel="Mixed menu options">
  <s-button href="javascript:void(0)" target="_blank">
    View product page
  </s-button>
  <s-button disabled>Unavailable action</s-button>
  <s-button download href="javascript:void(0)">Download report</s-button>
</s-menu>
```

### Mix sections with root-level actions

Combine sections with root-level items to separate grouped actions from standalone ones like a destructive action. This example shows two sections for customer management alongside a root-level delete button.

## html

```html
<s-button commandFor="customer-menu">Edit customer</s-button>


<s-menu id="customer-menu" accessibilityLabel="Customer actions">
  <s-section heading="Customer management">
    <s-button icon="edit">Edit customer</s-button>
    <s-button icon="email">Send email</s-button>
    <s-button icon="order">View orders</s-button>
  </s-section>
  <s-section heading="Account actions">
    <s-button icon="reset">Reset password</s-button>
    <s-button icon="lock">Disable account</s-button>
  </s-section>
  <s-button tone="critical" icon="delete">Delete customer</s-button>
</s-menu>
```

### Build a settings menu with sections

Build a settings-style menu with multiple sections and a standalone action at the bottom. This example shows account and store settings sections with a root-level sign-out link.

## html

```html
<s-button icon="settings" commandFor="admin-settings">Settings</s-button>


<s-menu id="admin-settings" accessibilityLabel="Settings menu">
  <s-section heading="Account">
    <s-button icon="profile">Profile settings</s-button>
    <s-button icon="lock">Security</s-button>
    <s-button>Billing information</s-button>
  </s-section>
  <s-section heading="Store">
    <s-button icon="store">Store settings</s-button>
    <s-button>Payment providers</s-button>
    <s-button icon="delivery">Shipping rates</s-button>
  </s-section>
  <s-button href="javascript:void(0)" icon="person-exit">Sign out</s-button>
</s-menu>
```

### Trigger a menu from an icon-only button

Use an icon-only button as the menu trigger for a compact "more actions" pattern. This example shows a three-dot icon button that opens a menu with common product actions.

## html

```html
<s-button
  icon="menu-horizontal"
  variant="tertiary"
  accessibilityLabel="More actions"
  commandFor="more-actions-menu"
></s-button>


<s-menu id="more-actions-menu" accessibilityLabel="More actions">
  <s-button icon="edit">Edit product</s-button>
  <s-button icon="duplicate">Duplicate product</s-button>
  <s-button icon="archive">Archive product</s-button>
  <s-button icon="delete" tone="critical">Delete product</s-button>
</s-menu>
```

***

## Best practices

* **Reserve for secondary actions:** Place primary actions directly in the UI (like **Save** in the page header). Use menus for less frequent or destructive actions (like **Archive**, **Duplicate**, or **Export data**) that shouldn't take up permanent space.
* **Write action-oriented labels:** Use the `{verb}+{noun}` format: **Edit details**, **Export as CSV**, **Duplicate product**, **Archive order**. Never use vague labels like **Options**, **More**, or **Settings**.
* **Group related actions with sections:** When you have 4+ menu items, organize into sections with headings: group **Edit details**, **Duplicate product** under **Manage**, and **Archive product**, **Delete product** under **Danger zone**.
* **Use icons to reinforce meaning:** Add icons to menu items to provide visual recognition: use an edit icon for **Edit**, trash icon for **Delete**, or download icon for **Export**. Icons should clarify, not replace, text labels.
* **Only disable temporarily unavailable actions:** Use disabled items when an action's contextually unavailable (like **Refund order** when already refunded). If an action's never available, remove it from the menu entirely.

***

## Limitations

* Menus automatically reposition to stay within the viewport boundaries, but in extremely constrained spaces (like narrow mobile screens or small modals), the menu might partially overflow or be cut off.
* While there's no hard technical limit on menu items, menus with more than 10-12 items become difficult to scan. Performance remains acceptable up to \~50 items, but beyond this, consider pagination, search, or alternative UI patterns.
* The component doesn't support nested submenus (like cascading dropdowns). All menu items must be at a single level, organized into sections if needed.
* When navigating with arrow keys, focus moves sequentially through all items regardless of section boundaries. Section headings aren't focusable and serve only as visual separators.
* The menu renders in a popover layer with a specific z-index. If placed within containers that have their own stacking contexts (like modals, sticky headers, or elements with transforms), the menu might appear behind other elements or clip unexpectedly.

***
