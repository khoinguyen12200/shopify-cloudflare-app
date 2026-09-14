---
title: Query container
description: >-
  The query container component establishes a container query context for
  responsive design. Use query container to define an element as a containment
  context, enabling child components or styles to adapt based on the container's
  size rather than viewport width.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/query-container
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/query-container.md
api_name: app-home
---

# Query container

The query container component establishes a container query context for responsive design. Use query container to define an element as a containment context, enabling child components or styles to adapt based on the container's size rather than viewport width.

Query containers support modern responsive patterns where components respond to their container dimensions, creating more flexible and reusable layouts.

#### Use cases

* **Responsive breakpoints:** Define container query contexts so child components adapt to available space.
* **Adaptive layouts:** Build layouts that change padding, columns, or visibility based on container width.
* **Named containers:** Target specific containers in responsive value strings using `containerName`.
* **Component-level responsiveness:** Enable responsive behavior scoped to a container rather than the viewport.

***

## Properties

Configure the following properties on the query container component.

* **container​Name**

  **string**

  **Default: ''**

  **required**

  An identifier for this container that you can reference in CSS container queries to apply styles based on this specific container's size.

  All query container components automatically receive a container name of `s-default`. You can omit the container name in your queries, so `@container (inline-size <= 300px)` is equivalent to `@container s-default (inline-size <= 300px)`.

  When you provide a custom `containerName`, it's added alongside `s-default`. For example, `containerName="product-card"` results in `s-default product-card` being set on the `container-name` CSS property, allowing you to target this container with `@container product-card (inline-size <= 300px)`.

  Learn more about the [container-name property](https://developer.mozilla.org/en-US/docs/Web/CSS/container-name).

### Slots

The query container component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the query container component, which enables container queries for responsive styling based on the container's size rather than the viewport.

***

## Examples

### Add a responsive container

Wrap content in a query container to enable responsive styling based on the container's width. This example shows a box whose padding changes when the container exceeds 500px.

## html

```html
<s-query-container>
  <s-box
    padding="@container (inline-size > 500px) large-500, none"
    background="strong"
  >
    Padding is applied when the inline-size '>' 500px
  </s-box>
</s-query-container>
```

### Target a named container for responsive queries

Use the `containerName` property to target a specific query container when multiple containers are present. This example shows the same named container at two different widths (375px and 450px) to demonstrate how the responsive padding changes at the 400px breakpoint.

## html

```html
<s-box inlineSize="375px">
  <s-query-container id="product-section" containerName="product">
    <s-box padding="@container product (inline-size > 400px) large-500, none">
      <s-text>Padding is different depending on the container size</s-text>
    </s-box>
  </s-query-container>
</s-box>


<s-box inlineSize="450px">
  <s-query-container id="product-section" containerName="product">
    <s-box padding="@container product (inline-size > 400px) large-500, none">
      <s-text>Padding is different depending on the container size</s-text>
    </s-box>
  </s-query-container>
</s-box>
```

***

## Best practices

* **Use for component-level responsiveness:** Query containers allow components to adapt based on their container size rather than viewport size. This is valuable for components that appear in different contexts with varying widths, like a product card that might appear in a sidebar or main content area.
* **Name containers when you have multiple:** When you have multiple query container components and need to target specific ones with different queries, provide descriptive container names. Without names, all containers respond to the same queries.
* **Set responsive values on properties, not in CSS:** The query container component establishes the containment context that Polaris components use to resolve responsive values, such as `padding="@container (inline-size > 500px) large-500, none"`. You don't write container query CSS yourself.
* **Consider performance impact:** Each query container adds browser work to track container dimensions and apply conditional styles. Use them where you need container-based responsiveness, not as a wrapper for every element.

***

## Limitations

* The query container component doesn't expose the container's current dimensions to JavaScript. It only enables responsive values on the components inside it. If you need to access container dimensions programmatically, you'll need to use the [Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) directly.

***
