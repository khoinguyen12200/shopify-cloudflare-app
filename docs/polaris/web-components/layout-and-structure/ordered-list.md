---
title: Ordered list
description: >-
  The ordered list component displays a numbered list of related items in a
  specific sequence. Use ordered list to present step-by-step instructions,
  ranked items, procedures, or any content where order and sequence matter to
  understanding.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list.md
api_name: app-home
---

# Ordered list

The ordered list component displays a numbered list of related items in a specific sequence. Use ordered list to present step-by-step instructions, ranked items, procedures, or any content where order and sequence matter to understanding.

Ordered lists automatically number items and support nested lists for hierarchical content organization. For items where order doesn't matter, use [unordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list).

#### Use cases

* **Numbered lists:** Display content in numbered list format.
* **Sequential steps:** Present sequential steps or instructions.
* **Ranked items:** Show ranked or prioritized items in order.
* **Structured content:** Organize content with semantic ordered lists.

### Slots

The ordered list component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The list entries displayed within the ordered list, where each item is numbered sequentially. Only accepts list item components as children. Each list item represents a single numbered entry in the sequence.

***

## List item

The list item component represents a single entry within an ordered list or unordered list. Use list item to structure individual points, steps, or items within a list, with each item automatically receiving appropriate list markers (bullets or numbers) from its parent list.

List item must be used as a direct child of ordered list or unordered list components. Each list item can contain text, inline formatting, or other components to create rich list content.

* **declare class ListItem extends PreactCustomElement implements ListItemProps { constructor(); }**

### Slots

The list item component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the list item, which represents a single entry in an ordered or unordered list.

***

## Examples

### Add a numbered step list

Create a numbered list of sequential steps. This example shows a basic ordered list with three setup instructions.

## html

```html
<s-ordered-list>
  <s-list-item>Add products to your catalog</s-list-item>
  <s-list-item>Set up payment methods</s-list-item>
  <s-list-item>Configure shipping zones</s-list-item>
</s-ordered-list>
```

### Create nested steps with sub-instructions

Nest ordered lists inside list items to break down complex steps into sub-steps. This example shows a product setup workflow where the first step has nested instructions.

## html

```html
<s-ordered-list>
  <s-list-item>
    Create product listing with title and description
    <s-ordered-list>
      <s-list-item>Add high-quality product images</s-list-item>
      <s-list-item>Set SEO title and meta description</s-list-item>
    </s-ordered-list>
  </s-list-item>
  <s-list-item>Configure pricing and inventory tracking</s-list-item>
  <s-list-item>Set up product variants (size, color, material)</s-list-item>
  <s-list-item>Enable inventory tracking and set stock levels</s-list-item>
  <s-list-item>Review and publish product to storefront</s-list-item>
</s-ordered-list>
```

***

## Best practices

* **Use when order matters:** Ordered lists communicate sequence, priority, or ranking. Use them for step-by-step instructions, prioritized recommendations, or any content where the numbering provides meaningful information. When order doesn't matter, use [unordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list) instead.
* **Keep items parallel in structure:** Consistent grammar and structure across list items makes content easier to scan and understand. Mixing different writing styles within a list creates cognitive friction for readers.
* **Write concise items:** List items work best as brief, scannable content. When items become long or complex, they lose the clarity and efficiency that makes lists valuable. Consider restructuring long items into separate sections.
* **Limit nesting depth:** Nested lists help organize hierarchical content, but deep nesting becomes difficult to follow. When you find yourself nesting beyond two levels, the content structure might be too complex for a list format.

***

## Limitations

* The component doesn't support custom numbering styles (like Roman numerals, letters, or custom start numbers). All ordered lists use standard decimal numbering (1, 2, 3). If you need alternative numbering schemes, you'll need to create custom list styling.

***
