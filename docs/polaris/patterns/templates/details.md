---
title: Details
description: >-
  From the index, merchants need to edit and view individual resources. For
  React Router-based Shopify apps, a resource type's details route file will use
  the pattern app.[resource].$id.jsx.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/patterns/templates/details'
  md: 'https://shopify.dev/docs/api/app-home/latest/patterns/templates/details.md'
api_name: app-home
---

# Details

From the index, merchants need to edit and view individual resources. For React Router-based Shopify apps, a resource type's details route file will use the pattern `app.[resource].$id.jsx`. For example, `app.product.$id.jsx` for managing a single product through your app.

The details template provides an efficient dual-column layout that puts editable content front and center while keeping supporting information visible in the sidebar. Use the primary column for information that defines the resource. Use the secondary column for supporting information such as status, metadata, and summaries. Provide breadcrumb navigation so merchants can return to the previous page without using the browser back button.

The details pattern follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (25) APIs (2) Compositions (2)

### Supported components

* [Badge](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/badge)
* [Banner](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/banner)
* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Icon](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/icon)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Modal](https://shopify.dev/docs/api/app-home/v1.0/web-components/overlays/modal)
* [Money field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/money-field)
* [Number field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/number-field)
* [Search field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/search-field)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Select](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/select)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Switch](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/switch)
* [Table](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/table)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)
* [Text area](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/text-area)
* [Text field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/text-field)
* [Thumbnail](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/thumbnail)
* [Unordered list](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/unordered-list)
* [Urlfield](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/url-field)

### Available APIs

* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Save Bar API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/save-bar-api)

### Recommended compositions

* [Footer help](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/footer-help)
* [Resource list](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/resource-list)

#### Use cases

* Creating, viewing, or editing individual resource objects
* Any form-heavy page where merchants need to see status or context while editing
* Pages that require a save/discard workflow

***

## Examples

### Present a product details view with editable fields and sidebar

Merchants need to edit and view a single resource with supporting info in the sidebar. This example presents a product details view for a Product Quality Auditor app with editable quality score fields in the main column and image and score in the sidebar.

##### jsx

```tsx
<form>
  <s-page heading="Mountain view">
    <s-link slot="breadcrumb-actions" href="/app/puzzles">
      Puzzles
    </s-link>
    <s-button slot="secondary-actions">Duplicate</s-button>
    <s-button slot="secondary-actions" tone="critical">Delete</s-button>
    {/* === */}
    {/* Puzzle information */}
    {/* === */}
    <s-section heading="Puzzle information">
      <s-grid gap="base">
        <s-text-field
          label="Puzzle name"
          name="name"
          labelAccessibilityVisibility="visible"
          placeholder="Enter puzzle name"
          value="Mountain view"
          details="Players will see this name when browsing puzzles."
        />
        <s-text-area
          label="Description"
          name="description"
          labelAccessibilityVisibility="visible"
          placeholder="Brief description of your puzzle"
          value="A beautiful mountain landscape puzzle"
          details="Help players understand what your puzzle features"
        />
        <s-money-field
          label="Price"
          name="price"
          labelAccessibilityVisibility="visible"
          placeholder="0.00"
          value="9.99"
          details="Set the price for this puzzle"
        />
        <s-url-field
          label="Reference image URL"
          name="reference-image-url"
          labelAccessibilityVisibility="visible"
          placeholder="https://example.com/image.jpg"
          details="Optional link to original image"
        />
      </s-grid>
    </s-section>

    {/* === */}
    {/* Puzzle templates */}
    {/* === */}
    <s-section heading="Puzzle templates">
      <s-grid gap="base">
        <s-grid
          gridTemplateColumns="1fr auto"
          gap="base"
          alignItems="center"
        >
          <s-grid-item>
            <s-search-field
              label="Search templates"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search templates"
            />
          </s-grid-item>
          <s-grid-item>
            <s-button>Browse</s-button>
          </s-grid-item>
        </s-grid>
        <s-box
          background="strong"
          border="base"
          borderRadius="base"
          borderStyle="solid"
          overflow="hidden"
        >
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Template</s-table-header>
              <s-table-header>
                <s-stack alignItems="end">Actions</s-stack>
              </s-table-header>
              <s-table-header listSlot="secondary">
                <s-stack direction="inline" alignItems="end" />
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              <s-table-row>
                <s-table-cell>
                  <s-stack
                    direction="inline"
                    gap="base"
                    alignItems="center"
                  >
                    <s-box
                      border="base"
                      borderRadius="base"
                      overflow="hidden"
                      maxInlineSize="40px"
                      maxBlockSize="40px"
                    >
                      <s-image
                        alt="16-pieces puzzle template"
                        src="https://cdn.shopify.com/static/images/polaris/patterns/16-pieces.png"
                      />
                    </s-box>
                    16-pieces puzzle
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <s-stack alignItems="end">
                    <s-link>Preview</s-link>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <s-stack alignItems="end">
                    <s-button
                      icon="x"
                      tone="neutral"
                      variant="tertiary"
                      accessibilityLabel="Remove 16-Pieces Puzzle template"
                    />
                  </s-stack>
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>
                  <s-stack
                    direction="inline"
                    gap="base"
                    alignItems="center"
                  >
                    <s-box
                      border="base"
                      borderRadius="base"
                      overflow="hidden"
                      maxInlineSize="40px"
                      maxBlockSize="40px"
                    >
                      <s-image
                        alt="9-pieces puzzle template"
                        src="https://cdn.shopify.com/static/images/polaris/patterns/9-pieces.png"
                      />
                    </s-box>
                    9-pieces puzzle
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <s-stack
                    direction="inline"
                    gap="base"
                    justifyContent="end"
                  >
                    <s-link>Preview</s-link>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>
                  <s-stack alignItems="end">
                    <s-button
                      icon="x"
                      tone="neutral"
                      variant="tertiary"
                      accessibilityLabel="Remove 9-Pieces Puzzle template"
                    />
                  </s-stack>
                </s-table-cell>
              </s-table-row>
              {/* Add more rows as needed here */}
              {/* If more than 10 rows are needed, details page tables should use the paginate, hasPreviousPage, hasNextPage, onPreviousPage, and onNextPage attributes to display and handle pagination) */}
            </s-table-body>
          </s-table>
        </s-box>
      </s-grid>
    </s-section>

    {/* === */}
    {/* Settings */}
    {/* === */}
    <s-section heading="Settings">
      <s-grid gap="base">
        <s-select label="Puzzle size" name="puzzle-size">
          <s-option value="small">Small (9" x 9")</s-option>
          <s-option value="medium" selected>
            Medium (18" x 24")
          </s-option>
          <s-option value="large">Large (24" x 36")</s-option>
        </s-select>
        <s-select label="Piece count" name="piece-count">
          <s-option value="250">250 pieces (Easy)</s-option>
          <s-option value="500" selected>
            500 pieces (Medium)
          </s-option>
          <s-option value="1000">1000 pieces (Hard)</s-option>
          <s-option value="2000">2000 pieces (Expert)</s-option>
        </s-select>
        <s-select label="Material" name="material">
          <s-option value="standard" selected>
            Standard cardboard
          </s-option>
          <s-option value="premium">Premium cardboard</s-option>
          <s-option value="wooden">Wooden pieces</s-option>
        </s-select>
        <s-number-field
          label="Quantity in stock"
          name="quantity-in-stock"
          labelAccessibilityVisibility="visible"
          value="50"
          min={0}
          placeholder="0"
          details="Current inventory quantity"
        />
        <s-switch
          label="Include reference image"
          name="include-reference-image"
          details="Ship a reference image with the puzzle"
        />
      </s-grid>
    </s-section>
    {/* Use the aside slot for sidebar content */}
    <s-box slot="aside">
      {/* === */}
      {/* Puzzle summary */}
      {/* === */}
      <s-section heading="Puzzle summary">
        <s-heading>Mountain view</s-heading>
        <s-unordered-list>
          <s-list-item>16-piece puzzle with medium difficulty</s-list-item>
          <s-list-item>Pieces can be rotated</s-list-item>
          <s-list-item>No time limit</s-list-item>
          <s-list-item>
            <s-stack direction="inline" gap="small">
              <s-text>Current status:</s-text>
              <s-badge color="base" tone="success">
                Active
              </s-badge>
            </s-stack>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-box>

    {/* Footer help */}
    <s-stack alignItems="center" paddingBlock="large">
      <s-text color="subdued">
        Learn more about <s-link href="https://help.shopify.com" target="_blank">puzzle best practices</s-link>.
      </s-text>
    </s-stack>
  </s-page>
</form>
```

##### html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
    <title>Pattern</title>
  </head>
  <body>
    <!-- === -->
    <!-- Details page pattern -->
    <!-- === -->
    <form>
      <s-page heading="Mountain view">
        <s-link slot="breadcrumb-actions" href="/app/puzzles">Puzzles</s-link>
        <s-button slot="secondary-actions">Duplicate</s-button>
        <s-button slot="secondary-actions" tone="critical">Delete</s-button>
        <!-- === -->
        <!-- Puzzle information -->
        <!-- === -->
        <s-section heading="Puzzle information">
          <s-grid gap="base">
            <s-text-field
              label="Puzzle name"
              name="name"
              labelAccessibilityVisibility="visible"
              placeholder="Enter puzzle name"
              value="Mountain view"
              details="Players will see this name when browsing puzzles."
            ></s-text-field>
            <s-text-area
              label="Description"
              name="description"
              labelAccessibilityVisibility="visible"
              placeholder="Brief description of your puzzle"
              value="A beautiful mountain landscape puzzle"
              details="Help players understand what your puzzle features"
            ></s-text-area>
            <s-money-field
              label="Price"
              name="price"
              labelAccessibilityVisibility="visible"
              placeholder="0.00"
              value="9.99"
              details="Set the price for this puzzle"
            ></s-money-field>
            <s-url-field
              label="Reference image URL"
              name="reference-image-url"
              labelAccessibilityVisibility="visible"
              placeholder="https://example.com/image.jpg"
              details="Optional link to original image"
            ></s-url-field>
          </s-grid>
        </s-section>
        <!-- === -->
        <!-- Puzzle templates -->
        <!-- === -->
        <s-section heading="Puzzle templates">
          <s-grid gap="base">
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
              <s-grid-item>
                <s-search-field
                  label="Search templates"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search templates"
                ></s-search-field>
              </s-grid-item>
              <s-grid-item>
                <s-button>Browse</s-button>
              </s-grid-item>
            </s-grid>
            <s-box
              background="strong"
              border="base"
              borderRadius="base"
              borderStyle="solid"
              overflow="hidden"
            >
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Template</s-table-header>
                  <s-table-header>
                    <s-stack alignItems="end">Actions</s-stack>
                  </s-table-header>
                  <s-table-header listSlot="secondary">
                    <s-stack direction="inline" alignItems="end"></s-stack>
                  </s-table-header>
                </s-table-header-row>
                <s-table-body>
                  <s-table-row>
                    <s-table-cell>
                      <s-stack direction="inline" gap="base" alignItems="center">
                        <s-box
                          border="base"
                          borderRadius="base"
                          overflow="hidden"
                          maxInlineSize="40px"
                          maxBlockSize="40px"
                        >
                          <s-image
                            alt="16-pieces puzzle template"
                            src="https://cdn.shopify.com/static/images/polaris/patterns/16-pieces.png"
                          ></s-image>
                        </s-box>
                        16-pieces puzzle
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack alignItems="end">
                        <s-link>Preview</s-link>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack alignItems="end">
                        <s-button
                          icon="x"
                          tone="neutral"
                          variant="tertiary"
                          accessibilityLabel="Remove 16-Pieces Puzzle template"
                        ></s-button>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                  <s-table-row>
                    <s-table-cell>
                      <s-stack direction="inline" gap="base" alignItems="center">
                        <s-box
                          border="base"
                          borderRadius="base"
                          overflow="hidden"
                          maxInlineSize="40px"
                          maxBlockSize="40px"
                        >
                          <s-image
                            alt="9-pieces puzzle template"
                            src="https://cdn.shopify.com/static/images/polaris/patterns/9-pieces.png"
                          ></s-image>
                        </s-box>
                        9-pieces puzzle
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="base" justifyContent="end">
                        <s-link>Preview</s-link>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack alignItems="end">
                        <s-button
                          icon="x"
                          tone="neutral"
                          variant="tertiary"
                          accessibilityLabel="Remove 9-Pieces Puzzle template"
                        ></s-button>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                  <!-- Add more rows as needed here -->
                  <!-- If more than 10 rows are needed, details page tables should use the paginate, hasPreviousPage, hasNextPage, onPreviousPage, and onNextPage attributes to display and handle pagination) -->
                </s-table-body>
              </s-table>
            </s-box>
          </s-grid>
        </s-section>
        <!-- === -->
        <!-- Settings -->
        <!-- === -->
        <s-section heading="Settings">
          <s-grid gap="base">
            <s-select label="Puzzle size" name="puzzle-size">
              <s-option value="small">Small (9" x 9")</s-option>
              <s-option value="medium" selected> Medium (18" x 24") </s-option>
              <s-option value="large">Large (24" x 36")</s-option>
            </s-select>
            <s-select label="Piece count" name="piece-count">
              <s-option value="250">250 pieces (Easy)</s-option>
              <s-option value="500" selected> 500 pieces (Medium) </s-option>
              <s-option value="1000">1000 pieces (Hard)</s-option>
              <s-option value="2000">2000 pieces (Expert)</s-option>
            </s-select>
            <s-select label="Material" name="material">
              <s-option value="standard" selected> Standard cardboard </s-option>
              <s-option value="premium">Premium cardboard</s-option>
              <s-option value="wooden">Wooden pieces</s-option>
            </s-select>
            <s-number-field
              label="Quantity in stock"
              name="quantity-in-stock"
              labelAccessibilityVisibility="visible"
              value="50"
              min="0"
              placeholder="0"
              details="Current inventory quantity"
            ></s-number-field>
            <s-switch
              label="Include reference image"
              name="include-reference-image"
              details="Ship a reference image with the puzzle"
            ></s-switch>
          </s-grid>
        </s-section>
        <!-- Use the aside slot for sidebar content -->
        <s-box slot="aside">
          <!-- === -->
          <!-- Puzzle summary -->
          <!-- === -->
          <s-section heading="Puzzle summary">
            <s-heading>Mountain view</s-heading>
            <s-unordered-list>
              <s-list-item>16-piece puzzle with medium difficulty</s-list-item>
              <s-list-item>Pieces can be rotated</s-list-item>
              <s-list-item>No time limit</s-list-item>
              <s-list-item>
                <s-stack direction="inline" gap="small">
                  <s-text>Current status:</s-text>
                  <s-badge color="base" tone="success">
                    Active
                  </s-badge>
                </s-stack>
              </s-list-item>
            </s-unordered-list>
          </s-section>
        </s-box>
      
      <!-- Footer help -->
      <s-stack alignItems="center" paddingBlock="large">
        <s-text color="subdued">Learn more about <s-link href="https://help.shopify.com" target="_blank">puzzle best practices</s-link>.</s-text>
      </s-stack>
  </s-page>
    </form>
  </body>
</html>
```

### Confirm destructive actions with Modal API

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm destructive actions like deleting a resource. The modal prevents accidental data loss by requiring explicit confirmation.

##### jsx

```tsx
<s-grid justifyItems="center" alignItems="center" minBlockSize="200px">
  <s-button
    tone="critical"
    commandFor="delete-modal"
    command="--show"
  >
    Delete
  </s-button>

  <s-modal id="delete-modal" heading="Delete product?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to delete this product? This action cannot be undone.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          This will permanently remove the product and all associated data.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      onClick={() => {
        console.log("Product deleted");
      }}
    >
      Delete
    </s-button>
    <s-button
      slot="secondary-actions"
      commandFor="delete-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-grid>
```

##### html

```html
<s-grid justifyItems="center" alignItems="center" minBlockSize="200px">
  <s-button
    tone="critical"
    commandFor="delete-modal"
    command="--show"
  >
    Delete
  </s-button>

  <s-modal id="delete-modal" heading="Delete product?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to delete this product? This action cannot be undone.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          This will permanently remove the product and all associated data.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
    >
      Delete
    </s-button>
    <s-button
      slot="secondary-actions"
      commandFor="delete-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-grid>
```

### Retain unsaved changes with Save Bar

Add `data-save-bar` to your form element to enable the [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api), which displays save/discard controls when the form has unsaved changes.

##### jsx

```tsx
// @validate-ignore: Argument of type 'EventTarget | null' is not assignable to parameter of type 'HTMLFormElement | undefined', Type 'null' is not assignable to type 'HTMLFormElement | undefined', Argument of type 'FormData' is not assignable to parameter of type 'Iterable'
<form
  data-save-bar
  onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const formEntries = Object.fromEntries(formData);
    console.log("Form submitted", formEntries);
  }}
  onReset={(event) => {
    console.log("Changes discarded");
  }}
>
  <s-section heading="Basic information">
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="base">
        <s-text-field
          label="Title"
          name="title"
          value="Premium Cotton T-Shirt"
          details="Minimum 10 characters recommended"
        />
        <s-text-area
          label="Description"
          name="description"
          value="Our premium cotton t-shirt is made from 100% organic cotton."
          rows={4}
        />
      </s-stack>
    </s-box>
  </s-section>
</form>
```

##### html

```html
<!-- Save Bar integration - wrap forms with data-save-bar attribute -->
<form data-save-bar>
  <s-section heading="Basic information">
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="base">
        <s-text-field
          label="Title"
          name="title"
          value="Premium Cotton T-Shirt"
          details="Minimum 10 characters recommended"
        ></s-text-field>
        <s-text-area
          label="Description"
          name="description"
          value="Our premium cotton t-shirt is made from 100% organic cotton."
          rows="4"
        ></s-text-area>
      </s-stack>
    </s-box>
  </s-section>
</form>
```

***
