---
title: Divider
description: >-
  The divider component creates clear visual separation between elements in the
  interface. Use divider to separate distinct content groups in forms, settings
  panels, lists, or page sections, helping users scan and understand content
  organization.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider.md
api_name: app-home
---

# Divider

The divider component creates clear visual separation between elements in the interface. Use divider to separate distinct content groups in forms, settings panels, lists, or page sections, helping users scan and understand content organization.

Dividers support both horizontal and vertical orientations, along with different visual strengths for varying levels of emphasis. For more structured content grouping with headings, use [section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section).

#### Use cases

* **Section separation:** Separate distinct sections in forms or settings panels.
* **Visual breaks:** Create visual breaks between groups of related content.
* **Content organization:** Improve readability by dividing long forms into digestible sections.
* **Hierarchy:** Establish clear hierarchy in complex interfaces with multiple content groups.

***

## Properties

Configure the following properties on the divider component.

* **direction**

  **"inline" | "block"**

  **Default: 'inline'**

  **required**

  The orientation of the divider line, using [logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

  * `inline`: Horizontal divider for separating vertically stacked content
  * `block`: Vertical divider for separating horizontally arranged content

* **color**

  **"base" | "strong"**

  **Default: 'base'**

  **required**

  The visual prominence of the divider line.

  * `base`: Standard divider for most separations (default)
  * `strong`: More prominent divider for major section breaks

***

## Examples

### Add a horizontal divider

Create a horizontal divider to visually separate content sections. This example shows the default divider with base color and inline direction.

## html

```html
<s-divider></s-divider>
```

### Increase visual emphasis with a strong divider

Use the `color` property to display a more prominent divider that marks a major section break. This example shows a strong-colored divider for increased visual emphasis.

## html

```html
<s-divider color="strong"></s-divider>
```

### Create a vertical divider between inline items

Use the `direction` property to create a vertical divider between horizontally arranged items. This example shows a vertical divider separating text items in an inline stack.

## html

```html
<s-stack direction="inline" gap="base">
  <s-text>Item 1</s-text>
  <s-divider direction="block"></s-divider>
  <s-text>Item 2</s-text>
</s-stack>
```

### Separate form sections with a divider

Place a divider between groups of form fields to visually distinguish related sections. This example shows a divider separating store details from contact information fields.

## html

```html
<s-stack gap="base">
  <s-text-field label="Store name"></s-text-field>
  <s-text-field label="Description"></s-text-field>
  <s-divider></s-divider>
  <s-text-field label="Email address"></s-text-field>
  <s-text-field label="Phone number"></s-text-field>
</s-stack>
```

***

## Best practices

* **Use for truly distinct boundaries:** Dividers work best when separating fundamentally different content sections. Overusing dividers creates visual clutter and makes interfaces feel fragmented. Consider whether whitespace alone could achieve the same grouping.
* **Match visual weight to hierarchy:** The divider's prominence should reflect the importance of the separation. Major section breaks can support stronger visual dividers, while minor groupings need subtler separation or just whitespace.
* **Align with layout direction:** The divider's orientation should match your content flow. A horizontal divider between vertically stacked items or a vertical divider between horizontally arranged items creates clear, predictable separation.
* **Prefer whitespace for subtle grouping:** Whitespace often provides cleaner visual grouping than dividers. Before adding a divider, try using spacing properties on your layout components. Dividers should enhance clarity, not replace thoughtful spacing.

***
