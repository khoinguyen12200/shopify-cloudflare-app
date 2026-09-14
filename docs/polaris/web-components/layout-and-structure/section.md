---
title: Section
description: >-
  The section component groups related content into clearly-defined thematic
  areas with consistent styling and structure. Use section to organize page
  content into logical blocks, each with its own heading and visual container.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section.md
api_name: app-home
---

# Section

The section component groups related content into clearly-defined thematic areas with consistent styling and structure. Use section to organize page content into logical blocks, each with its own heading and visual container.

Sections automatically adapt their styling based on nesting depth and adjust heading levels to maintain meaningful, accessible page hierarchies. For simple visual separation without headings, use [divider](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider).

#### Use cases

* **Content grouping:** Group related content with automatic semantic heading levels.
* **Form organization:** Organize complex forms into logical, visually distinct sections.
* **Nested structure:** Create nested sections for hierarchical content organization.
* **Contextual styling:** Benefit from context-aware section styling controlled by Shopify.

***

## Properties

Configure the following properties on the section component.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **heading**

  **string**

  **required**

  The heading text displayed at the top of the section. This heading provides a title for the section's content and automatically uses the appropriate semantic heading level (h2, h3, h4) based on nesting depth to maintain proper document structure.

* **padding**

  **"base" | "none"**

  **Default: 'base'**

  **required**

  The padding applied to all edges of the element.

  * `base`: applies padding that is appropriate for the element. Note that it might result in no padding if this is the right design decision in a particular context.
  * `none`: removes all padding from the element. This can be useful when elements inside the section need to span to the edge of the section. For example, a full-width image. In this case, rely on `s-box` with a padding of 'base' to bring back the desired padding for the rest of the content.

### Slots

The section component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the section component, which groups related elements together in a logical unit with an optional heading.

***

## Examples

### Add a content section with a heading

Create a section with a heading to group related content. This example shows a basic section with a title and description text.

## html

```html
<s-section heading="Online store dashboard">
  <s-paragraph>View a summary of your online store’s performance.</s-paragraph>
</s-section>
```

### Group form fields in a section

Use a section with a heading and form fields to group related inputs. This example shows a customer information form with text and email fields inside a top-level section.

## html

```html
<!-- Level 1 section - elevated with shadow on desktop -->
<s-section heading="Customer information">
  <s-text-field label="First name" value="John"></s-text-field>
  <s-text-field label="Last name" value="Doe"></s-text-field>
  <s-email-field label="Email" value="john@example.com"></s-email-field>
</s-section>
```

### Create nested sections with automatic visual hierarchy

Nest sections to create visual and semantic hierarchy that automatically adjusts heading levels and styling. This example shows three levels of nesting for order details, customer information, and a billing address.

## html

```html
<s-stack gap="base">
  <!-- Level 1 section -->
  <s-section heading="Order details">
    <s-paragraph>Order #1234 placed on January 15, 2024</s-paragraph>


    <!-- Level 2 section - nested with different visual treatment -->
    <s-section heading="Customer">
      <s-text-field label="Name" value="Jane Smith"></s-text-field>
      <s-text-field label="Email" value="jane@example.com"></s-text-field>


      <!-- Level 3 section - further nested -->
      <s-section heading="Billing address">
        <s-text-field label="Street" value="123 Main St"></s-text-field>
        <s-text-field label="City" value="Toronto"></s-text-field>
      </s-section>
    </s-section>


    <!-- Another Level 2 section -->
    <s-section heading="Items">
      <s-paragraph>2 items totaling $49.99</s-paragraph>
    </s-section>
  </s-section>
</s-stack>
```

### Add an accessibility label for screen readers

Use the `accessibilityLabel` property to provide screen readers with additional context beyond the visible heading. This example shows a payment summary section and a label describing the contents of the section.

## html

```html
<s-section
  heading="Payment summary"
  accessibilityLabel="Order payment breakdown and totals"
>
  <s-stack gap="base">
    <s-paragraph>Subtotal: $42.99</s-paragraph>
    <s-paragraph>Tax: $5.59</s-paragraph>
    <s-paragraph>Shipping: $1.41</s-paragraph>
    <s-paragraph>
      <s-text type="strong">Total: $49.99</s-text>
    </s-paragraph>
  </s-stack>
</s-section>
```

### Remove padding for full-width content

Set the `padding` property to `none` so that content like tables can extend to the section edges. This example shows a product table rendered full-width within a section.

## html

```html
<s-section padding="none">
  <s-table>
    <s-table-header-row>
      <s-table-header listSlot="primary">Product</s-table-header>
      <s-table-header listSlot="labeled">Price</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>Cotton t-shirt</s-table-cell>
        <s-table-cell>$29.99</s-table-cell>
        <s-table-cell><s-badge tone="success">Active</s-badge></s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

***

## Best practices

* **Use to group related content:** The component provides semantic structure and visual hierarchy for grouping related content. Each section should contain a cohesive set of information or controls that belong together.
* **Provide meaningful headings:** Section headings help merchants scan and navigate content. Write headings that clearly describe what's in the section rather than using vague labels.
* **Nest thoughtfully:** Nested sections create visual and semantic hierarchy, but excessive nesting creates overly complex structures. Limit nesting to 2-3 levels where the hierarchy is meaningful and helps merchants understand the content organization.
* **Consider when to remove padding:** Full-width content like tables or images might need to extend to section edges. Remove padding when the content design requires it, but ensure nested content within has appropriate spacing.
* **Use accessibility labels when needed:** When the visible heading doesn't fully convey the section's purpose to screen reader users, provide an accessibility label with additional context.

***

## Limitations

* The component doesn't include expand/collapse functionality. If you need collapsible sections, you'll need to implement this using additional state management and accessibility attributes.
* Section headings automatically increment their semantic level based on nesting depth, but they stop at h4 for deeply nested sections. Content nested beyond three levels might have less clear document structure.

***
