---
title: Heading
description: >-
  The heading component renders hierarchical titles to communicate the structure
  and organization of page content. Use heading to create section titles and
  content headers that help users understand information hierarchy and navigate
  content.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading.md
api_name: app-home
---

# Heading

The heading component renders hierarchical titles to communicate the structure and organization of page content. Use heading to create section titles and content headers that help users understand information hierarchy and navigate content.

Heading levels adjust automatically based on nesting within parent [section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section) components, ensuring meaningful and accessible page outlines without manual level management.

#### Use cases

* **Section titles:** Create clear section titles that establish content hierarchy.
* **Page headers:** Provide descriptive headers for modal actions or block extensions.
* **Content organization:** Organize complex forms or interfaces with logical heading structures.
* **Visual hierarchy:** Establish visual hierarchy using different heading levels.

***

## Properties

Configure the following properties on the heading component.

* **accessibility​Role**

  **"none" | "presentation" | "heading"**

  **Default: 'heading'**

  **required**

  The semantic meaning of the component’s content. When set, the role will be used by assistive technologies to help users navigate the page.

  * `none`: Completely hides the element and its content from assistive technologies
  * `presentation`: Removes semantic meaning, making the image purely decorative and ignored by screen readers.
  * `img`: Identifies the element as an image that conveys meaningful information to users.

* **line​Clamp**

  **number**

  **Default: Infinity - no truncation is applied**

  **required**

  The maximum number of lines to display before truncating the text content.

  Learn more about the [-webkit-line-clamp property](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp).

* **accessibility​Visibility**

  **"visible" | "hidden" | "exclusive"**

  **Default: 'visible'**

  **required**

  The visibility mode of the element for both visual and assistive technology users.

  * `visible`: The element is visible to all users (both sighted users and screen readers).
  * `hidden`: The element is visually visible but hidden from screen readers. Use this for decorative elements that don't provide meaningful information.
  * `exclusive`: The element is visually hidden but announced by screen readers. Use this for screen-reader-only content like skip links or additional context.

### Slots

The heading component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The heading text displayed within the heading component, which provides a title or section header for content.

***

## Examples

### Add a basic heading

Create a heading for a content section. This example shows the basic heading component with default styling and automatic heading level assignment.

## html

```html
<s-heading>Online store dashboard</s-heading>
```

### Truncate long headings with line clamping

Limit the number of visible lines in a heading using the `lineClamp` property. This example shows a heading truncated to two lines with an ellipsis, useful for long product names in constrained layouts.

## html

```html
<s-box inlineSize="200px">
  <s-heading lineClamp="2">
    Premium organic cotton t-shirt with sustainable manufacturing practices
  </s-heading>
</s-box>
```

### Customize accessibility roles and visibility

Configure the heading's ARIA role and visibility for assistive technologies. This example shows a heading with `accessibilityRole` set to presentation and `accessibilityVisibility` set to hidden, removing it from the document outline.

## html

```html
<s-heading accessibilityRole="presentation" accessibilityVisibility="hidden">
  Sale badge
</s-heading>
```

### Create a heading hierarchy with nested sections

Nest headings inside section components to automatically assign appropriate heading levels (h2, h3, h4). This example shows how the heading level increments with each nested section, creating proper document structure for screen readers.

## html

```html
<s-section>
  <s-heading>Order information</s-heading>
  <!-- Renders as h2 -->
  <s-section>
    <s-heading>Shipping details</s-heading>
    <!-- Renders as h3 -->
    <s-section>
      <s-heading>Tracking updates</s-heading>
      <!-- Renders as h4 -->
    </s-section>
  </s-section>
</s-section>
```

***

## Best practices

* **Use headings to structure content hierarchy:** The component creates a clear outline of your interface that helps merchants navigate and understand content organization. Every major section should have a heading.
* **Let the component handle semantic levels:** The component automatically assigns appropriate HTML heading levels (h2, h3, h4) based on nesting depth. This ensures proper document structure for screen readers without manual management.
* **Write clear, descriptive headings:** Headings should clearly describe the section they introduce. Avoid vague headings like "Details" when "Product details" or "Customer details" would be clearer.
* **Use line clamping sparingly:** Line clamping helps manage long headings in constrained spaces like cards, but truncated headings can hide important information. Only clamp when it's absolutely necessary.
* **Maintain consistent styling within contexts:** Use similar heading styles for similar content types. For example, all card headings in a list should look the same.

***

## Limitations

* Heading levels (h2, h3, h4) are determined automatically based on nesting depth. You can't set a specific heading level, but you can remove heading semantics entirely by setting `accessibilityRole` to `"presentation"` or `"none"`.
* Line clamping truncates text visually but doesn't provide a way to show the full heading text on hover or through other interactions. Truncated content might not be fully accessible to screen readers.

***
