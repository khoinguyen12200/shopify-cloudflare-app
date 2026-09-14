---
title: Page
description: >-
  The page component provides a styled page layout within your app, including
  breadcrumbs, page actions, and content areas with automatic spacing. Use page
  when you need a complete page layout with Polaris styling.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page.md
api_name: app-home
---

# Page

The page component provides a styled page layout within your app, including breadcrumbs, page actions, and content areas with automatic spacing.

Use page when you need a complete page layout with Polaris styling. For apps that need to set the Shopify admin's native title bar (title, breadcrumbs, actions) without a styled page layout, use the [title bar](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar) App Bridge component instead.

#### Use cases

* **App layouts:** Use as the main container for your app's primary interface with automatic spacing and preset layouts.
* **Resource management:** Create resource management pages with headings, primary actions, and secondary navigation.
* **Settings pages:** Build settings or configuration pages with structured content and aside panels.
* **Detail views:** Display resource detail pages with breadcrumb navigation and contextual actions.

***

## Properties

Use as the outer wrapper of a page.

* **inline​Size**

  **"small" | "base" | "large"**

  **Default: 'base'**

  **required**

  The inline size of the page

  * `base` corresponds to a set default inline size
  * `large` full width with whitespace

* **heading**

  **string**

  **required**

  The main page heading

### Slots

The page component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **aside**

  **HTMLElement**

  The content to display in the aside section of the page.

  This slot is only rendered when `inlineSize` is "base".

* **breadcrumb-actions**

  **HTMLElement**

  The navigation back actions for the page.

  Only accepts link components.

* **children**

  **HTMLElement**

  The main page content displayed within the page component, which serves as the primary container for the page's information and interface elements.

* **primary-action**

  **HTMLElement**

  The primary action for the page.

  Only accepts a single button component with a `variant` of `primary`.

* **secondary-actions**

  **HTMLElement**

  The secondary actions for the page.

  Only accepts button group and button components with a `variant` of `secondary` or `auto`.

***

## Examples

### Organize content with sections

Create a consistent page structure with automatic spacing. This example combines a heading with organized content sections.

## html

```html
<s-page heading="Products">
  <s-section>
    <s-text>Hello World</s-text>
  </s-section>
</s-page>
```

### Use small width for forms

Create a focused layout for forms and simple workflows. This example uses the `inlineSize="small"` setting for narrower content.

## html

```html
<s-page heading="Store settings" inline-size="small">
  <s-section>
    <s-stack gap="base">
      <s-text>Configure your basic store preferences.</s-text>
      <s-text-field label="Store name"></s-text-field>
      <s-button variant="primary">Save</s-button>
    </s-stack>
  </s-section>
</s-page>
```

### Use large width for dashboards

Display data-rich content like dashboards or analytics. This example uses the `inlineSize="large"` setting for wider layouts.

## html

```html
<s-page heading="Store analytics" inline-size="large">
  <s-section>
    <s-stack gap="base">
      <s-text>Monitor your store performance across all channels.</s-text>
      <s-grid>
        <s-grid-item>
          <s-box
            padding="base"
            background="base"
            borderWidth="base"
            borderColor="base"
            borderRadius="base"
          >
            <s-heading>Sales</s-heading>
            <s-text type="strong">$12,456</s-text>
          </s-box>
        </s-grid-item>
        <s-grid-item>
          <s-box
            padding="base"
            background="base"
            borderWidth="base"
            borderColor="base"
            borderRadius="base"
          >
            <s-heading>Orders</s-heading>
            <s-text type="strong">145</s-text>
          </s-box>
        </s-grid-item>
      </s-grid>
    </s-stack>
  </s-section>
</s-page>
```

### Add breadcrumb navigation

Help merchants understand where they are in your app. This example adds a breadcrumb link back to a parent page.

## html

```html
<s-page heading="Edit Product" inline-size="base">
  <s-link slot="breadcrumb-actions" href="/products">Products</s-link>
  <s-link slot="breadcrumb-actions" href="/products/123">Acme Widget</s-link>
  <s-section>
    <s-text>Update your product information and settings.</s-text>
  </s-section>
</s-page>
```

### Add page actions

Provide quick access to common operations from the page header. This example adds primary and secondary action buttons.

## html

```html
<s-page heading="Products" inline-size="base">
  <s-button slot="secondary-actions">Preview</s-button>
  <s-button slot="secondary-actions">Duplicate</s-button>
  <s-button slot="primary-action" variant="primary">Save</s-button>
  <s-section>
    <s-text>Manage your products and organize your catalog.</s-text>
  </s-section>
</s-page>
```

### Edit page with all slots

Combine all page features for complex editing workflows. This example integrates breadcrumbs, actions, form content, and an aside panel.

## html

```html
<s-page heading="Edit product" inlineSize="base">
  <s-link slot="breadcrumb-actions" href="/products">Products</s-link>


  <s-button slot="primary-action" variant="primary" id="save-btn" disabled>Save</s-button>
  <s-button slot="secondary-actions">Preview</s-button>
  <s-button slot="secondary-actions" tone="critical">Delete</s-button>


  <s-section>
    <s-stack direction="block" gap="base">
      <s-text-field label="Title" name="title" value="Blue T-Shirt" required></s-text-field>
      <s-text-area label="Description" name="description" rows="4"></s-text-area>
      <s-number-field label="Price" name="price"></s-number-field>
    </s-stack>
  </s-section>


  <s-box slot="aside">
    <s-section>
      <s-stack direction="block" gap="base">
        <s-heading>Status</s-heading>
        <s-select label="Status" name="status">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </s-select>
      </s-stack>
    </s-section>
  </s-box>
</s-page>


<script>
  const form = document.querySelector('s-section');
  const saveBtn = document.getElementById('save-btn');


  form.addEventListener('input', () => {
    saveBtn.disabled = false;
  });
</script>
```

***

## Best practices

* Always provide a title that describes the current page.
* Include breadcrumbs when the page is part of a flow.
* Include page actions in the header only if they are relevant to the entire page.
* Include no more than one primary action and 3 secondary actions per page.
* Don't include any actions at the bottom of the page.

***

## Limitations

* The `inlineSize` property only accepts `small`, `base` (default), or `large` values.
* Breadcrumb actions only support link and button components.
* The `aside` slot is only visible when `inlineSize` is set to `base`.

***
