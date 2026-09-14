---
title: Unordered list
description: >-
  The unordered list component displays a bulleted list of related items where
  sequence isn't critical. Use unordered list to present collections of
  features, options, requirements, or any group of items where order doesn't
  affect meaning.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list.md
api_name: app-home
---

# Unordered list

The unordered list component displays a bulleted list of related items where sequence isn't critical. Use unordered list to present collections of features, options, requirements, or any group of items where order doesn't affect meaning.

Unordered lists automatically add bullet points and support nested lists for hierarchical content organization. For sequential items where order is important, use [ordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list).

#### Use cases

* **Bulleted lists:** Display content in bulleted list format.
* **Non-sequential items:** Present items that don't have a specific order.
* **Feature lists:** List features, benefits, or attributes.
* **Structured content:** Organize content with semantic unordered lists.

### Slots

The unordered list component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The list entries displayed within the unordered list, where each item is marked with a bullet point. Only accepts list item components as children. Each list item represents a single bulleted entry in the list.

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

### Add a bulleted list

Create a bulleted list of related items. This example shows a simple list of product color options.

## html

```html
<s-unordered-list>
  <s-list-item>Red shirt</s-list-item>
  <s-list-item>Green shirt</s-list-item>
  <s-list-item>Blue shirt</s-list-item>
</s-unordered-list>
```

### Create nested lists with sub-items

Nest unordered lists inside list items to organize hierarchical content with sub-items. This example shows a store setup checklist with nested shipping options under a parent item.

## html

```html
<s-stack gap="base">
  <s-box borderWidth="small-100" borderRadius="base" padding="base">
    <s-unordered-list>
      <s-list-item>Configure payment settings</s-list-item>
      <s-list-item>
        Set up shipping options
        <s-unordered-list>
          <s-list-item>Domestic shipping rates</s-list-item>
          <s-list-item>International shipping zones</s-list-item>
        </s-unordered-list>
      </s-list-item>
      <s-list-item>Add product descriptions</s-list-item>
    </s-unordered-list>
  </s-box>


  <s-box borderWidth="small-100" borderRadius="base" padding="base">
    <s-unordered-list>
      <s-list-item>Enable online payments</s-list-item>
      <s-list-item>Set up shipping rates</s-list-item>
      <s-list-item>Configure tax settings</s-list-item>
      <s-list-item>Add product descriptions</s-list-item>
    </s-unordered-list>
  </s-box>
</s-stack>
```

***

## Best practices

* **Use when order doesn't matter:** Unordered lists communicate a collection of related items without sequence or ranking. Use them for features, options, or benefits where the order isn't meaningful. When sequence matters, use [ordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list) instead.
* **Keep items parallel in structure:** Consistent grammar and structure across list items makes content easier to scan and understand. Mixing different writing styles within a list creates cognitive friction for readers.
* **Write concise items:** List items work best as brief, scannable content. When items become long or complex, they lose the clarity and efficiency that makes lists valuable. Consider restructuring long items into separate sections.
* **Limit nesting depth:** Nested lists help organize hierarchical content, but deep nesting becomes difficult to follow. When you find yourself nesting beyond two levels, the content structure might be too complex for a list format.

***

## Limitations

* The component doesn't support custom bullet styles (like checkmarks, arrows, or custom icons). All unordered lists use standard bullet markers. If you need alternative markers, you'll need to create custom list styling.

***
