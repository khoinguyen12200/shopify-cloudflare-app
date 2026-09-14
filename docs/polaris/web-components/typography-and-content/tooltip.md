---
title: Tooltip
description: >-
  The tooltip component displays helpful information in a small overlay when
  users hover over or focus on an element. Use tooltip to provide additional
  context, explain functionality, or clarify terms without cluttering the
  interface with permanent text.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip.md
api_name: app-home
---

# Tooltip

The tooltip component displays helpful information in a small overlay when users hover over or focus on an element. Use tooltip to provide additional context, explain functionality, or clarify terms without cluttering the interface with permanent text.

Tooltips support keyboard accessibility, positioning options, and activation on both hover and focus for inclusive interaction patterns.

#### Use cases

* **Contextual help:** Provide contextual help text on hover or focus.
* **Explanations:** Explain features, icons, or controls with tooltips.
* **Additional info:** Display additional information without cluttering the UI.
* **Accessibility:** Improve accessibility by providing text alternatives for icons.

***

## Properties

### Slots

The tooltip component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The informational text or elements displayed within the tooltip overlay, providing helpful context or explanations when users interact with the associated element.

  Only accepts text, paragraph components, and raw `textContent`.

***

## Examples

### Add a basic tooltip

Create a tooltip that provides supplementary information when a user hovers or focuses on a trigger element. This example shows a tooltip describing a toolbar button's action.

## html

```html
<s-tooltip id="bold-tooltip">Bold</s-tooltip>
<s-button interestFor="bold-tooltip" accessibilityLabel="Bold">B</s-button>
```

### Explain a term with a tooltip on text

Attach a tooltip to inline text to provide a definition or additional context on hover. This example shows a tooltip triggered by a text label that explains the shipping status.

## html

```html
<s-tooltip id="shipping-tooltip">This order has active shipping labels.</s-tooltip>
<s-text interestFor="shipping-tooltip">Shipping status</s-text>
```

### Describe an icon-only button with a tooltip

Add a tooltip to an icon-only button to clarify its action and provide an accessible description. This example shows an info button that displays a tooltip with product details on hover.

## html

```html
<s-tooltip id="info-tooltip">View product details and inventory status</s-tooltip>
<s-button interestFor="info-tooltip" accessibilityLabel="More information">
  <s-icon type="info"></s-icon>
</s-button>
```

### Show a keyboard shortcut in a tooltip

Include a keyboard shortcut in a tooltip to help merchants discover faster ways to perform actions. This example shows a Save button with a tooltip that displays the keyboard shortcut.

## html

```html
<s-tooltip id="save-shortcut">Save (⌘S)</s-tooltip>
<s-button interestFor="save-shortcut">Save</s-button>
```

***

## Best practices

* **Use tooltips for helpful but non-essential information:** The component works best for supplementary details that enhance understanding without being critical. Never hide essential information, errors, or required instructions in tooltips.
* **Perfect for icon-only buttons:** Icon buttons need tooltips to clarify what they do. Include the button's action and keyboard shortcut if available to help merchants work efficiently.
* **Keep tooltip content brief and clear:** Aim for a short sentence or phrase. Long tooltip content is hard to read and suggests the information might need a more prominent placement in the UI.
* **Recognize when tooltips indicate a design problem:** If you're adding many tooltips to explain your interface, the design itself might be unclear. Consider improving labels, layout, or information architecture instead.
* **Remember they're desktop-only:** Tooltips don't work on touch devices. If the information is important enough to need a tooltip, consider making it visible by default on mobile.

***

## Limitations

* Tooltips only appear on devices with a mouse or trackpad. They don't work on touch devices like phones and tablets, which limits their usefulness for mobile merchants.
* Tooltips can't contain interactive elements like links or buttons. They dismiss when the user moves away, making interaction impossible.
* The component doesn't provide built-in positioning controls. Tooltip placement is automatic and might not always appear in the ideal location for complex layouts.

***
