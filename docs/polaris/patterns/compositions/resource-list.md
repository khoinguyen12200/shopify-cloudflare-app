---
title: Resource list
description: >-
  When merchants need to browse and select from a collection of similar items, a
  resource list provides a compact, scannable format. It helps merchants find an
  object and navigate to its full-page representation.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list.md
api_name: app-home
---

# Resource list

When merchants need to browse and select from a collection of similar items, a resource list provides a compact, scannable format. It helps merchants find an object and navigate to its full-page representation.

Use resource lists for smaller collections, or when you need a simpler selection interface within a card or modal. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (14) APIs (4) Templates (1)

### Supported components

* [Avatar](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/avatar)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Checkbox](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/checkbox)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Clickable chip](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable-chip)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Popover](https://shopify.dev/docs/api/app-home/v1.0/web-components/overlays/popover)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Select](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/select)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)
* [Text field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/text-field)

### Available APIs

* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)
* [Resource Picker API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/resource-picker-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Details](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/details)

#### Use cases

* Displaying collections of campaigns, subscribers, or templates
* Helping merchants search and filter to find items
* Enabling bulk actions on selected resources

***

## Examples

### Provide search, filtering, and row selection for a resource list

Merchants need to browse and select from a collection of items and navigate to details. This pattern provides search, filtering, and row selection for a resource list. The [text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field) uses `icon="search"` for filtering, the [popover](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover) holds filter options, and the [checkbox](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox) enables row selection.

##### jsx

```tsx
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
        <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
        <s-button commandFor="tagged-with">Tagged with</s-button>
        <s-popover id="tagged-with">
          <s-stack gap="small-200" padding="small-200">
            <s-text-field value="VIP" placeholder="Add tag"></s-text-field>
            <s-link href="">Clear</s-link>
          </s-stack>
        </s-popover>
      </s-grid>
      <s-button variant="secondary">Save</s-button>
    </s-grid>

    <s-stack direction="inline"  gap="small-400" paddingInline="base">
      <s-clickable-chip removable>Tagged with VIP</s-clickable-chip>
    </s-stack>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Mae Jemison"></s-button>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ellen Ochoa"></s-button>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

##### html

```html
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
        <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
        <s-button commandFor="tagged-with">Tagged with</s-button>
        <s-popover id="tagged-with">
          <s-stack gap="small-200" padding="small-200">
            <s-text-field value="VIP" placeholder="Add tag"></s-text-field>
            <s-link href="">Clear</s-link>
          </s-stack>
        </s-popover>
      </s-grid>
      <s-button variant="secondary">Save</s-button>
    </s-grid>

    <s-stack direction="inline"  gap="small-400" paddingInline="base">
      <s-clickable-chip removable>Tagged with VIP</s-clickable-chip>
    </s-stack>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Mae Jemison"></s-button>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ellen Ochoa"></s-button>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

### Add items with Resource Picker API

Use the [Resource Picker API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/resource-picker-api) to let merchants add products from their catalog to the list.

##### jsx

```tsx
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter products"></s-text-field>
      <s-button
        onClick={async () => {
          const selected = await shopify.resourcePicker({
            type: 'product',
            multiple: true,
          });
          if (selected) {
            console.log('Selected products:', selected);
          }
        }}
      >
        Add products
      </s-button>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-text>Showing 2 products</s-text>
      <s-select>
        <s-option value="newest">Newest</s-option>
        <s-option value="oldest">Oldest</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
          <s-thumbnail
            size="small"
            src="https://picsum.photos/id/29/80/80"
            alt="Mountain View puzzle"
          />
          <s-stack>
            <s-heading>Mountain View</s-heading>
            <s-text>16 pieces</s-text>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Mountain View" />
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
          <s-thumbnail
            size="small"
            src="https://picsum.photos/id/12/80/80"
            alt="Ocean Sunset puzzle"
          />
          <s-stack>
            <s-heading>Ocean Sunset</s-heading>
            <s-text>9 pieces</s-text>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ocean Sunset" />
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

##### html

```html
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter products"></s-text-field>
      <s-button>Add products</s-button>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-text>Showing 2 products</s-text>
      <s-select>
        <s-option value="newest">Newest</s-option>
        <s-option value="oldest">Oldest</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
          <s-thumbnail
            size="small"
            src="https://picsum.photos/id/29/80/80"
            alt="Mountain View puzzle"
          ></s-thumbnail>
          <s-stack>
            <s-heading>Mountain View</s-heading>
            <s-text>16 pieces</s-text>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Mountain View"></s-button>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
          <s-thumbnail
            size="small"
            src="https://picsum.photos/id/12/80/80"
            alt="Ocean Sunset puzzle"
          ></s-thumbnail>
          <s-stack>
            <s-heading>Ocean Sunset</s-heading>
            <s-text>9 pieces</s-text>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ocean Sunset"></s-button>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>

<!-- 
Add products handler:
const selected = await shopify.resourcePicker({
  type: 'product',
  multiple: true,
});
if (selected) {
  console.log('Selected products:', selected);
}
-->
```

### Confirm delete with Modal API

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm deletion before removing a resource list item.

##### jsx

```tsx
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="delete"
            variant="tertiary"
            tone="critical"
            accessibilityLabel="Delete Mae Jemison"
            commandFor="delete-modal"
            command="--show"
          />
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="delete"
            variant="tertiary"
            tone="critical"
            accessibilityLabel="Delete Ellen Ochoa"
            commandFor="delete-modal"
            command="--show"
          />
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>

  <s-modal id="delete-modal" heading="Delete customer?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to delete this customer? This action cannot be undone.
      </s-text>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      commandFor="delete-modal"
      command="--hide"
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
</s-section>
```

##### html

```html
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="delete"
            variant="tertiary"
            tone="critical"
            accessibilityLabel="Delete Mae Jemison"
            commandFor="delete-modal"
            command="--show"
          ></s-button>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="delete"
            variant="tertiary"
            tone="critical"
            accessibilityLabel="Delete Ellen Ochoa"
            commandFor="delete-modal"
            command="--show"
          ></s-button>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>

  <s-modal id="delete-modal" heading="Delete customer?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to delete this customer? This action cannot be undone.
      </s-text>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      commandFor="delete-modal"
      command="--hide"
    >Delete</s-button>
    <s-button
      slot="secondary-actions"
      commandFor="delete-modal"
      command="--hide"
    >Cancel</s-button>
  </s-modal>
</s-section>
```

### Navigate to item detail

Use `href` attributes on clickable items to navigate merchants to detail pages.

##### jsx

```tsx
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-text>Showing 2 customers</s-text>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable
        href="/app/customers/mae-jemison"
        borderStyle="solid none none none"
        border="base"
        paddingInline="base"
        paddingBlock="small"
      >
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-icon type="chevron-right" />
        </s-grid>
      </s-clickable>
      <s-clickable
        href="/app/customers/ellen-ochoa"
        borderStyle="solid none none none"
        border="base"
        paddingInline="base"
        paddingBlock="small"
      >
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-icon type="chevron-right" />
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

##### html

```html
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-text>Showing 2 customers</s-text>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable
        href="/app/customers/mae-jemison"
        borderStyle="solid none none none"
        border="base"
        paddingInline="base"
        paddingBlock="small"
      >
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-icon type="chevron-right"></s-icon>
        </s-grid>
      </s-clickable>
      <s-clickable
        href="/app/customers/ellen-ochoa"
        borderStyle="solid none none none"
        border="base"
        paddingInline="base"
        paddingBlock="small"
      >
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-icon type="chevron-right"></s-icon>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

### Show action feedback with Toast API

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when actions are performed on resource list items.

##### jsx

```tsx
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
      <s-button
        onClick={() => {
          shopify.toast.show('Filters saved');
        }}
      >
        Save filters
      </s-button>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="menu-horizontal"
            variant="tertiary"
            accessibilityLabel="Actions for Mae Jemison"
            commandFor="actions-popover"
          />
          <s-popover id="actions-popover">
            <s-stack gap="none" padding="small-200">
              <s-button
                variant="tertiary"
                onClick={() => {
                  shopify.toast.show('Customer archived');
                }}
              >
                Archive
              </s-button>
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={() => {
                  shopify.toast.show('Customer deleted', { isError: true });
                }}
              >
                Delete
              </s-button>
            </s-stack>
          </s-popover>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ellen Ochoa" />
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>
```

##### html

```html
<s-section padding="none">
  <s-stack gap="small-200">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base" paddingBlockStart="base">
      <s-text-field icon="search" placeholder="Filter customers"></s-text-field>
      <s-button>Save filters</s-button>
    </s-grid>
    
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center" paddingInline="base">
      <s-checkbox label="Showing 2 customers"></s-checkbox>
      <s-select>
        <s-option value="newest">Newest update</s-option>
        <s-option value="oldest">Oldest update</s-option>
      </s-select>
    </s-grid>
    
    <s-stack>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Mae Jemison</s-heading>
              <s-text>Decatur, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button
            icon="menu-horizontal"
            variant="tertiary"
            accessibilityLabel="Actions for Mae Jemison"
            commandFor="actions-popover"
          ></s-button>
          <s-popover id="actions-popover">
            <s-stack gap="none" padding="small-200">
              <s-button variant="tertiary">Archive</s-button>
              <s-button variant="tertiary" tone="critical">Delete</s-button>
            </s-stack>
          </s-popover>
        </s-grid>
      </s-clickable>
      <s-clickable borderStyle="solid none none none" border="base" paddingInline="base" paddingBlock="small">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox></s-checkbox>
            <s-avatar></s-avatar>
            <s-stack>
              <s-heading>Ellen Ochoa</s-heading>
              <s-text>Los Angeles, USA</s-text>
            </s-stack>
          </s-stack>
          <s-button icon="menu-horizontal" variant="tertiary" accessibilityLabel="Actions for Ellen Ochoa"></s-button>
        </s-grid>
      </s-clickable>
    </s-stack>
  </s-stack>
</s-section>

<!-- 
Save filters handler:
shopify.toast.show('Filters saved');

Archive handler:
shopify.toast.show('Customer archived');

Delete handler:
shopify.toast.show('Customer deleted', { isError: true });
-->
```

***
