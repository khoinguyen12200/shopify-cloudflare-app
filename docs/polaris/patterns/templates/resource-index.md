---
title: Index
description: >-
  Most apps need a way for merchants to manage collections of resources and
  perform actions on them. For React Router-based Shopify apps, that index route
  file (app.[resources].jsx) should use a plural noun for the resource type.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index.md
api_name: app-home
---

# Index

Most apps need a way for merchants to manage collections of resources and perform actions on them. For React Router-based Shopify apps, that index route file (`app.[resources].jsx`) should use a plural noun for the resource type. For example, `app.products.jsx` for managing products through your app.

The index pattern provides this foundation while following proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (20) APIs (4) Compositions (3)

### Supported components

* [Badge](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/badge)
* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Button group](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button-group)
* [Checkbox](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/checkbox)
* [Choice list](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/choice-list)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Icon](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/icon)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Popover](https://shopify.dev/docs/api/app-home/v1.0/web-components/overlays/popover)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Table](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/table)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)
* [Text field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/text-field)
* [Thumbnail](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/thumbnail)
* [Tooltip](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/tooltip)

### Available APIs

* [Intents API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/intents-api)
* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended compositions

* [Empty state](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/empty-state)
* [Footer help](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/footer-help)
* [Metrics card](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/metrics-card)

#### Use cases

* Displaying searchable, filterable tables of resources
* Enabling bulk operations on multiple items
* Providing quick access to individual resource details

***

## Examples

### Display an index table with filters, search, and bulk actions

Merchants need to manage a collection of resources and perform actions on them. This example displays an index table for a Product Quality Auditor app with filter tabs, search, sortable columns, bulk selection, and bulk actions. The table shows product thumbnails, quality scores, issue counts, and status badges.

##### jsx

```tsx
<s-page heading="Puzzles">
      <s-button slot="primary-action" variant="primary">
        Create puzzle
      </s-button>
      <s-button slot="secondary-actions" variant="secondary">
        Export puzzles
      </s-button>
      <s-button slot="secondary-actions" variant="secondary">
        Import puzzles
      </s-button>
      {/* === */}
      {/* Empty state */}
      {/* This should only be visible if the merchant has not created any puzzles yet. */}
      {/* === */}
      <s-section accessibilityLabel="Empty state section">
        <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
          <s-box maxInlineSize="200px" maxBlockSize="200px">
            {/* aspectRatio should match the actual image dimensions (width/height) */}
            <s-image
              aspectRatio="1/0.5"
              src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
              alt="A stylized graphic of four characters, each holding a puzzle piece"
            />
          </s-box>
          <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
            <s-stack alignItems="center">
              <s-heading>Start creating puzzles</s-heading>
              <s-paragraph>
                Create and manage your collection of puzzles for players to
                enjoy.
              </s-paragraph>
            </s-stack>
            <s-button-group>
              <s-button
                slot="secondary-actions"
                accessibilityLabel="Learn more about creating puzzles"
              >
                {" "}
                Learn more{" "}
              </s-button>
              <s-button slot="primary-action" accessibilityLabel="Add a new puzzle">
                {" "}
                Create puzzle{" "}
              </s-button>
            </s-button-group>
          </s-grid>
        </s-grid>
      </s-section>

      {/* === */}
      {/* Table */}
      {/* This should only be visible if the merchant has created one or more puzzles. */}
      {/* === */}
      <s-section padding="none" accessibilityLabel="Puzzles table section">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Puzzle</s-table-header>
            <s-table-header format="numeric">Pieces</s-table-header>
            <s-table-header>Created</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Mountain View puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image
                      objectFit="cover"
                      alt="Mountain View puzzle thumbnail"
                      src="https://picsum.photos/id/29/80/80"
                     />
                  </s-clickable>
                  <s-link href="#">Mountain View</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>16</s-table-cell>
              <s-table-cell>Today</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="success">
                  Active
                </s-badge>
              </s-table-cell>
            </s-table-row>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Ocean Sunset puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image
                      objectFit="cover"
                      alt="Ocean Sunset puzzle thumbnail"
                      src="https://picsum.photos/id/12/80/80"
                     />
                  </s-clickable>
                  <s-link href="#">Ocean Sunset</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>9</s-table-cell>
              <s-table-cell>Yesterday</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="success">
                  Active
                </s-badge>
              </s-table-cell>
            </s-table-row>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Forest Animals puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image
                      objectFit="cover"
                      alt="Forest Animals puzzle thumbnail"
                      src="https://picsum.photos/id/324/80/80"
                     />
                  </s-clickable>
                  <s-link href="#">Forest Animals</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>25</s-table-cell>
              <s-table-cell>Last week</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="neutral">
                  Draft
                </s-badge>
              </s-table-cell>
            </s-table-row>
            {/* Add more rows as needed here */}
            {/* If more than 100 rows are needed, index page tables should use the paginate, hasPreviousPage, hasNextPage, onPreviousPage, and onNextPage attributes to display and handle pagination) */}
          </s-table-body>
      </s-table>
    </s-section>

    {/* Footer help */}
    <s-stack alignItems="center" paddingBlock="large">
      <s-text color="subdued">
        Learn more about <s-link href="https://help.shopify.com" target="_blank">improving product quality</s-link>.
      </s-text>
    </s-stack>
</s-page>
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
    <!-- Index page pattern -->
    <!-- === -->
    <s-page heading="Puzzles">
      <s-button slot="primary-action" variant="primary">Create puzzle</s-button>
      <s-button slot="secondary-actions" variant="secondary">Export puzzles</s-button>
      <s-button slot="secondary-actions" variant="secondary">Import puzzles</s-button>
      <!-- === -->
      <!-- Empty state -->
      <!-- This should only be visible if the merchant has not created any puzzles yet. -->
      <!-- === -->
      <s-section accessibilityLabel="Empty state section">
        <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
          <s-box maxInlineSize="200px" maxBlockSize="200px">
            <!-- aspectRatio should match the actual image dimensions (width/height) -->
            <s-image
              aspectRatio="1/0.5"
              src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
              alt="A stylized graphic of four characters, each holding a puzzle piece"
            />
          </s-box>
          <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
            <s-stack alignItems="center">
              <s-heading>Start creating puzzles</s-heading>
              <s-paragraph>
                Create and manage your collection of puzzles for players to enjoy.
              </s-paragraph>
            </s-stack>
            <s-button-group>
              <s-button slot="secondary-actions" aria-label="Learn more about creating puzzles"> Learn more </s-button>
              <s-button slot="primary-action" aria-label="Add a new puzzle"> Create puzzle </s-button>
            </s-button-group>
          </s-grid>
        </s-grid>
      </s-section>
      <!-- === -->
      <!-- Table -->
      <!-- This should only be visible if the merchant has created one or more puzzles. -->
      <!-- === -->
      <s-section padding="none" accessibilityLabel="Puzzles table section">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Puzzle</s-table-header>
            <s-table-header format="numeric">Pieces</s-table-header>
            <s-table-header>Created</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Mountain View puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image objectFit="cover" alt="Mountain View puzzle thumbnail" src="https://picsum.photos/id/29/80/80"></s-image>
                  </s-clickable>
                  <s-link href="#">Mountain View</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>16</s-table-cell>
              <s-table-cell>Today</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="success"> Active </s-badge>
              </s-table-cell>
            </s-table-row>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Ocean Sunset puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image objectFit="cover" alt="Ocean Sunset puzzle thumbnail" src="https://picsum.photos/id/12/80/80"></s-image>
                  </s-clickable>
                  <s-link href="#">Ocean Sunset</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>9</s-table-cell>
              <s-table-cell>Yesterday</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="success"> Active </s-badge>
              </s-table-cell>
            </s-table-row>
            <s-table-row>
              <s-table-cell>
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-clickable
                    href="#"
                    accessibilityLabel="Forest Animals puzzle thumbnail"
                    border="base"
                    borderRadius="base"
                    overflow="hidden"
                    inlineSize="40px"
                    blockSize="40px"
                  >
                    <s-image objectFit="cover" alt="Forest Animals puzzle thumbnail" src="https://picsum.photos/id/324/80/80"></s-image>
                  </s-clickable>
                  <s-link href="#">Forest Animals</s-link>
                </s-stack>
              </s-table-cell>
              <s-table-cell>25</s-table-cell>
              <s-table-cell>Last week</s-table-cell>
              <s-table-cell>
                <s-badge color="base" tone="neutral"> Draft </s-badge>
              </s-table-cell>
            </s-table-row>
            <!-- Add more rows as needed here -->
            <!-- If more than 100 rows are needed, index page tables should use the paginate, hasPreviousPage, hasNextPage, onPreviousPage, and onNextPage attributes to display and handle pagination) -->
          </s-table-body>
        </s-table>
      </s-section>

    <!-- Footer help -->
    <s-stack alignItems="center" paddingBlock="large">
      <s-text color="subdued">Learn more about <s-link href="https://help.shopify.com" target="_blank">improving product quality</s-link>.</s-text>
    </s-stack>
</s-page>
  </body>
</html>
```

### Make empty states actionable using Intents

Use the [Intents API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/intents-api) to open native Shopify interfaces for creating products directly from an empty state.

##### jsx

```tsx
{/* @validate-ignore: possibly 'undefined', Cannot invoke an object */}
<s-section accessibilityLabel="Empty state with intents">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="Illustration showing product creation"
      />
    </s-box>
    <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
      <s-stack alignItems="center">
        <s-heading>No products yet</s-heading>
        <s-paragraph>
          Add products from your Shopify catalog to get started with quality auditing.
        </s-paragraph>
      </s-stack>
      <s-button-group>
        <s-button
          slot="secondary-actions"
          onClick={() => {
            shopify.intents.invoke('browse:shopify/Product');
          }}
        >
          Browse products
        </s-button>
        <s-button
          slot="primary-action"
          onClick={async () => {
            const activity = await shopify.intents.invoke('create:shopify/Product');
            const response = await activity.complete;
            if (response.code === 'ok') {
              shopify.toast.show('Product created');
            }
          }}
        >
          Create product
        </s-button>
      </s-button-group>
    </s-grid>
  </s-grid>
</s-section>
```

##### html

```html
<!-- Empty state with Intents API actions -->
<!-- Note: Intents require JavaScript to invoke. This HTML shows the UI structure. -->
<s-section accessibilityLabel="Empty state with intents">
  <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
    <s-box maxInlineSize="200px" maxBlockSize="200px">
      <s-image
        aspectRatio="1/0.5"
        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
        alt="Illustration showing product creation"
      ></s-image>
    </s-box>
    <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
      <s-stack alignItems="center">
        <s-heading>No products yet</s-heading>
        <s-paragraph>
          Add products from your Shopify catalog to get started with quality auditing.
        </s-paragraph>
      </s-stack>
      <s-button-group>
        <s-button slot="secondary-actions">Browse products</s-button>
        <s-button slot="primary-action">Create product</s-button>
      </s-button-group>
    </s-grid>
  </s-grid>
</s-section>

<!-- 
JavaScript usage for the buttons:

// Browse products
shopify.intents.invoke('browse:shopify/Product');

// Create product
const activity = await shopify.intents.invoke('create:shopify/Product');
const response = await activity.complete;
if (response.code === 'ok') {
  shopify.toast.show('Product created');
}
-->
```

***
