---
title: Index table
description: >-
  Most apps need a way for merchants to manage collections of items. The index
  table composition provides a scannable list with search, filtering, sorting,
  and bulk actions.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table.md
api_name: app-home
---

# Index table

Most apps need a way for merchants to manage collections of items. The index table composition provides a scannable list with search, filtering, sorting, and bulk actions.

Use checkboxes for bulk selection, reveal row actions on hover, and include pagination for large data sets. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (16) APIs (3) Templates (1)

### Supported components

* [Badge](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/badge)
* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Checkbox](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/checkbox)
* [Choice list](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/choice-list)
* [Clickable](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/clickable)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Popover](https://shopify.dev/docs/api/app-home/v1.0/web-components/overlays/popover)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Table](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/table)
* [Text field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/text-field)
* [Tooltip](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/tooltip)

### Available APIs

* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Index](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/resource-index)

#### Use cases

* Displaying any collection of similar items that merchants need to manage
* Providing search and filter capabilities for large data sets
* Enabling bulk operations like activating, archiving, or deleting multiple items

***

## Examples

### Display an index table with search, sort, and bulk actions

Merchants need to view, search, filter, and take bulk actions on collections of items. This pattern displays an index table with search, sort, and bulk actions. Key attributes include `slot="filters"` on the [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) to place controls in the filters area, `clickDelegate` on [table rows](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table) to connect clicks to checkboxes, and `listSlot` on [table headers](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table) to control responsive stacking. Use the [Navigation API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/navigation-api) for programmatic navigation and the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) for confirming successful actions.

##### jsx

```tsx
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
       />
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        interestFor="sort-tooltip"
        commandFor="sort-actions"
       />
      <s-tooltip id="sort-tooltip">
        <s-text>Sort</s-text>
      </s-tooltip>
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>
                Puzzle name
              </s-choice>
              <s-choice value="pieces">Pieces</s-choice>
              <s-choice value="created">Created</s-choice>
              <s-choice value="status">Status</s-choice>
            </s-choice-list>
          </s-box>
          <s-divider />
          <s-box padding="small">
            <s-choice-list label="Order by" name="Order by">
              <s-choice value="product-title" selected>
                A-Z
              </s-choice>
              <s-choice value="created">Z-A</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header>Created</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row clickDelegate="mountain-view-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="mountain-view-checkbox" />
            <s-clickable
              href=""
              accessibilityLabel="Mountain View puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
               />
            </s-clickable>
            <s-link href="">Mountain View</s-link>
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
      <s-table-row clickDelegate="ocean-sunset-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="ocean-sunset-checkbox" />
            <s-clickable
              href=""
              accessibilityLabel="Ocean Sunset puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
               />
            </s-clickable>
            <s-link href="">Ocean Sunset</s-link>
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
      <s-table-row clickDelegate="forest-animals-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="forest-animals-checkbox" />
            <s-clickable
              href=""
              accessibilityLabel="Forest Animals puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/324/80/80"
               />
            </s-clickable>
            <s-link href="">Forest Animals</s-link>
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
    </s-table-body>
  </s-table>
</s-section>
```

##### html

```html
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      ></s-text-field>
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        interestFor="sort-tooltip"
        commandFor="sort-actions"
      ></s-button>
      <s-tooltip id="sort-tooltip">
        <s-text>Sort</s-text>
      </s-tooltip>
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>Puzzle name</s-choice>
              <s-choice value="pieces">Pieces</s-choice>
              <s-choice value="created">Created</s-choice>
              <s-choice value="status">Status</s-choice>
            </s-choice-list>
          </s-box>
          <s-divider></s-divider>
          <s-box padding="small">
            <s-choice-list label="Order by" name="Order by">
              <s-choice value="product-title" selected>A-Z</s-choice>
              <s-choice value="created">Z-A</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header>Created</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row clickDelegate="mountain-view-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="mountain-view-checkbox"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Mountain View puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>Today</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row clickDelegate="ocean-sunset-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="ocean-sunset-checkbox"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Ocean Sunset puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>Yesterday</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row clickDelegate="forest-animals-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="forest-animals-checkbox"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Forest Animals puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/324/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="">Forest Animals</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>25</s-table-cell>
        <s-table-cell>Last week</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="neutral">Draft</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Add pagination

Table with pagination controls for navigating large datasets.

##### jsx

```tsx
// @framework-globals: useState
const [currentPage, setCurrentPage] = useState(1);
const totalPages = 3;

const puzzlesByPage = {
  1: [
    {id: 'mountain-view', name: 'Mountain View', pieces: 16, created: 'Jan 15', status: 'Active', img: 29},
    {id: 'ocean-sunset', name: 'Ocean Sunset', pieces: 9, created: 'Jan 14', status: 'Active', img: 12},
    {id: 'forest-animals', name: 'Forest Animals', pieces: 25, created: 'Jan 12', status: 'Draft', img: 324},
  ],
  2: [
    {id: 'city-skyline', name: 'City Skyline', pieces: 36, created: 'Jan 10', status: 'Active', img: 1031},
    {id: 'autumn-leaves', name: 'Autumn Leaves', pieces: 16, created: 'Jan 8', status: 'Active', img: 167},
    {id: 'northern-lights', name: 'Northern Lights', pieces: 49, created: 'Jan 5', status: 'Draft', img: 360},
  ],
  3: [
    {id: 'tropical-beach', name: 'Tropical Beach', pieces: 9, created: 'Jan 3', status: 'Active', img: 1015},
    {id: 'snowy-mountains', name: 'Snowy Mountains', pieces: 64, created: 'Dec 28', status: 'Active', img: 870},
    {id: 'flower-garden', name: 'Flower Garden', pieces: 25, created: 'Dec 22', status: 'Archived', img: 106},
  ],
};

const currentPuzzles = puzzlesByPage[currentPage];

const handlePreviousPage = () => {
  if (currentPage > 1) setCurrentPage(currentPage - 1);
};

const handleNextPage = () => {
  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
};

return (
  <s-section padding="none" accessibilityLabel="Puzzles table with pagination">
    <s-table
      paginate
      hasPreviousPage={currentPage > 1}
      hasNextPage={currentPage < totalPages}
      onPreviousPage={handlePreviousPage}
      onNextPage={handleNextPage}
      paginationLabel={`Page ${currentPage} of ${totalPages}`}
    >
      <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
        <s-text-field
          label="Search puzzles"
          labelAccessibilityVisibility="exclusive"
          icon="search"
          placeholder="Searching all puzzles"
        />
        <s-button icon="sort" variant="secondary" accessibilityLabel="Sort" />
      </s-grid>

      <s-table-header-row>
        <s-table-header listSlot="primary">Puzzle</s-table-header>
        <s-table-header format="numeric">Pieces</s-table-header>
        <s-table-header>Created</s-table-header>
        <s-table-header listSlot="secondary">Status</s-table-header>
      </s-table-header-row>

      <s-table-body>
        {currentPuzzles.map((puzzle) => (
          <s-table-row key={puzzle.id}>
            <s-table-cell>
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-box border="base" borderRadius="base" overflow="hidden" inlineSize="40px" blockSize="40px">
                  <s-image objectFit="cover" src={`https://picsum.photos/id/${puzzle.img}/80/80`} />
                </s-box>
                <s-link href="">{puzzle.name}</s-link>
              </s-stack>
            </s-table-cell>
            <s-table-cell>{puzzle.pieces}</s-table-cell>
            <s-table-cell>{puzzle.created}</s-table-cell>
            <s-table-cell>
              <s-badge
                color="base"
                tone={puzzle.status === 'Active' ? 'success' : puzzle.status === 'Draft' ? 'neutral' : 'info'}
              >
                {puzzle.status}
              </s-badge>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  </s-section>
);
```

##### html

```html
<!-- Index table with pagination controls - showing page 2 of 3 -->
<s-section padding="none" accessibilityLabel="Puzzles table with pagination">
  <s-table
    paginate
    hasPreviousPage="true"
    hasNextPage="true"
  >
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      ></s-text-field>
      <s-button icon="sort" variant="secondary" accessibilityLabel="Sort"></s-button>
    </s-grid>

    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header>Created</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>

    <s-table-body>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-box border="base" borderRadius="base" overflow="hidden" inlineSize="40px" blockSize="40px">
              <s-image objectFit="cover" src="https://picsum.photos/id/1031/80/80"></s-image>
            </s-box>
            <s-link href="">City Skyline</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>36</s-table-cell>
        <s-table-cell>Jan 10</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-box border="base" borderRadius="base" overflow="hidden" inlineSize="40px" blockSize="40px">
              <s-image objectFit="cover" src="https://picsum.photos/id/167/80/80"></s-image>
            </s-box>
            <s-link href="">Autumn Leaves</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>Jan 8</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-box border="base" borderRadius="base" overflow="hidden" inlineSize="40px" blockSize="40px">
              <s-image objectFit="cover" src="https://picsum.photos/id/360/80/80"></s-image>
            </s-box>
            <s-link href="">Northern Lights</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>49</s-table-cell>
        <s-table-cell>Jan 5</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="neutral">Draft</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Confirm bulk actions with Modal

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm destructive bulk actions before executing them.

##### jsx

```tsx
// @framework-globals: useState
const puzzles = [
  { id: 'mountain-view', name: 'Mountain View', pieces: 16, created: 'Today', status: 'Active', image: 'https://picsum.photos/id/29/80/80' },
  { id: 'ocean-sunset', name: 'Ocean Sunset', pieces: 9, created: 'Yesterday', status: 'Active', image: 'https://picsum.photos/id/12/80/80' },
  { id: 'forest-animals', name: 'Forest Animals', pieces: 25, created: 'Last week', status: 'Draft', image: 'https://picsum.photos/id/324/80/80' },
];

const [selectedIds, setSelectedIds] = useState([]);

const allSelected = selectedIds.length === puzzles.length;
const someSelected = selectedIds.length > 0 && selectedIds.length < puzzles.length;
const noneSelected = selectedIds.length === 0;

const handleSelectAll = () => {
  if (allSelected) {
    setSelectedIds([]);
  } else {
    setSelectedIds(puzzles.map(p => p.id));
  }
};

const handleSelectRow = (id) => {
  if (selectedIds.includes(id)) {
    setSelectedIds(selectedIds.filter(i => i !== id));
  } else {
    setSelectedIds([...selectedIds, id]);
  }
};

const handleBulkAction = (action) => {
  console.log(`${action} items:`, selectedIds);
  // Perform bulk action here
};

return (
  <s-section padding="none" accessibilityLabel="Puzzles table with bulk selection">
    <s-table>
      {/* Bulk action bar - appears when items are selected */}
      {!noneSelected && (
        <s-box slot="filters" padding="small" background="strong">
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text fontWeight="semibold">
              {selectedIds.length} of {puzzles.length} selected
            </s-text>
            <s-stack direction="inline" gap="small">
              <s-button variant="secondary" onClick={() => handleBulkAction('edit')}>
                Bulk edit
              </s-button>
              <s-button variant="secondary" tone="critical" onClick={() => handleBulkAction('delete')}>
                Delete
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      )}

      {/* Search filters - hidden when bulk action bar is visible */}
      {noneSelected && (
        <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
          <s-text-field
            label="Search puzzles"
            labelAccessibilityVisibility="exclusive"
            icon="search"
            placeholder="Searching all puzzles"
          />
          <s-button icon="sort" variant="secondary" accessibilityLabel="Sort">
            Sort
          </s-button>
        </s-grid>
      )}

      <s-table-header-row>
        <s-table-header listSlot="primary">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              accessibilityLabel="Select all puzzles"
            />
            <s-text>Puzzle</s-text>
          </s-stack>
        </s-table-header>
        <s-table-header format="numeric">Pieces</s-table-header>
        <s-table-header>Created</s-table-header>
        <s-table-header listSlot="secondary">Status</s-table-header>
      </s-table-header-row>

      <s-table-body>
        {puzzles.map((puzzle) => (
          <s-table-row
            key={puzzle.id}
            selected={selectedIds.includes(puzzle.id)}
            onClick={() => handleSelectRow(puzzle.id)}
          >
            <s-table-cell>
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-checkbox
                  checked={selectedIds.includes(puzzle.id)}
                  onChange={() => handleSelectRow(puzzle.id)}
                  accessibilityLabel={`Select ${puzzle.name}`}
                />
                <s-clickable
                  href=""
                  accessibilityLabel={`${puzzle.name} puzzle thumbnail`}
                  border="base"
                  borderRadius="base"
                  overflow="hidden"
                  inlineSize="40px"
                  blockSize="40px"
                >
                  <s-image objectFit="cover" src={puzzle.image} />
                </s-clickable>
                <s-link href="">{puzzle.name}</s-link>
              </s-stack>
            </s-table-cell>
            <s-table-cell>{puzzle.pieces}</s-table-cell>
            <s-table-cell>{puzzle.created}</s-table-cell>
            <s-table-cell>
              <s-badge
                color="base"
                tone={puzzle.status === 'Active' ? 'success' : 'neutral'}
              >
                {puzzle.status}
              </s-badge>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  </s-section>
);
```

##### html

```html
<!-- Index table with bulk selection pattern -->
<!-- This example shows the bulk action bar visible (items selected state) -->
<s-section padding="none" accessibilityLabel="Puzzles table with bulk selection">
  <s-table>
    <!-- Bulk action bar - shown when items are selected -->
    <s-box slot="filters" padding="small" background="strong">
      <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
        <s-text>2 of 3 selected</s-text>
        <s-stack direction="inline" gap="small">
          <s-button variant="secondary">Bulk edit</s-button>
          <s-button variant="secondary" tone="critical">Delete</s-button>
        </s-stack>
      </s-stack>
    </s-box>

    <s-table-header-row>
      <s-table-header listSlot="primary">
        <s-stack direction="inline" gap="small" alignItems="center">
          <!-- Indeterminate state: some items selected -->
          <s-checkbox indeterminate accessibilityLabel="Select all puzzles"></s-checkbox>
          <s-text>Puzzle</s-text>
        </s-stack>
      </s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header>Created</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>

    <s-table-body>
      <!-- Selected row -->
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox checked accessibilityLabel="Select Mountain View"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Mountain View puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image objectFit="cover" src="https://picsum.photos/id/29/80/80"></s-image>
            </s-clickable>
            <s-link href="">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>Today</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>

      <!-- Selected row -->
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox checked accessibilityLabel="Select Ocean Sunset"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Ocean Sunset puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image objectFit="cover" src="https://picsum.photos/id/12/80/80"></s-image>
            </s-clickable>
            <s-link href="">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>Yesterday</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>

      <!-- Unselected row -->
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox accessibilityLabel="Select Forest Animals"></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Forest Animals puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image objectFit="cover" src="https://picsum.photos/id/324/80/80"></s-image>
            </s-clickable>
            <s-link href="">Forest Animals</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>25</s-table-cell>
        <s-table-cell>Last week</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="neutral">Draft</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Navigate to detail pages

Use `href` attributes on row elements to navigate merchants to detail pages when they click a row.

##### jsx

```tsx
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      />
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        commandFor="sort-actions"
      />
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>Puzzle name</s-choice>
              <s-choice value="pieces">Pieces</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-clickable
              href="/app/puzzles/mountain-view"
              accessibilityLabel="View Mountain View puzzle"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
              />
            </s-clickable>
            <s-link href="/app/puzzles/mountain-view">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-clickable
              href="/app/puzzles/ocean-sunset"
              accessibilityLabel="View Ocean Sunset puzzle"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
              />
            </s-clickable>
            <s-link href="/app/puzzles/ocean-sunset">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

##### html

```html
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      ></s-text-field>
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        commandFor="sort-actions"
      ></s-button>
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>Puzzle name</s-choice>
              <s-choice value="pieces">Pieces</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-clickable
              href="/app/puzzles/mountain-view"
              accessibilityLabel="View Mountain View puzzle"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="/app/puzzles/mountain-view">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-clickable
              href="/app/puzzles/ocean-sunset"
              accessibilityLabel="View Ocean Sunset puzzle"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="/app/puzzles/ocean-sunset">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Show bulk action feedback with Toast

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when bulk actions complete.

##### jsx

```tsx
// @validate-ignore: Type 'string' is not assignable to type 'Lowercase<string>'
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      />
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        commandFor="sort-actions"
      />
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>Puzzle name</s-choice>
              <s-choice value="pieces">Pieces</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-stack slot="bulkActions" direction="inline" gap="small-200">
      <s-button
        onClick={() => {
          shopify.toast.show('2 puzzles archived');
        }}
      >
        Archive
      </s-button>
      <s-button
        tone="critical"
        commandFor="delete-modal"
        command="--show"
      >
        Delete
      </s-button>
    </s-stack>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row clickDelegate="mountain-view-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="mountain-view-checkbox" checked />
            <s-clickable
              href=""
              accessibilityLabel="Mountain View puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
              />
            </s-clickable>
            <s-link href="">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row clickDelegate="ocean-sunset-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="ocean-sunset-checkbox" checked />
            <s-clickable
              href=""
              accessibilityLabel="Ocean Sunset puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
              />
            </s-clickable>
            <s-link href="">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>

  <s-modal id="delete-modal" heading="Delete 2 puzzles?">
    <s-text>
      Are you sure you want to delete the selected puzzles? This action cannot be undone.
    </s-text>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      onClick={() => {
        shopify.toast.show('2 puzzles deleted');
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
</s-section>
```

##### html

```html
<!-- @validate-ignore: Type 'string' is not assignable to type 'Lowercase<string>' -->
<s-section padding="none" accessibilityLabel="Puzzles table section">
  <s-table>
    <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
      <s-text-field
        label="Search puzzles"
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder="Searching all puzzles"
      ></s-text-field>
      <s-button
        icon="sort"
        variant="secondary"
        accessibilityLabel="Sort"
        commandFor="sort-actions"
      ></s-button>
      <s-popover id="sort-actions">
        <s-stack gap="none">
          <s-box padding="small">
            <s-choice-list label="Sort by" name="Sort by">
              <s-choice value="puzzle-name" selected>Puzzle name</s-choice>
              <s-choice value="pieces">Pieces</s-choice>
            </s-choice-list>
          </s-box>
        </s-stack>
      </s-popover>
    </s-grid>
    <s-stack slot="bulkActions" direction="inline" gap="small-200">
      <s-button>Archive</s-button>
      <s-button
        tone="critical"
        commandFor="delete-modal"
        command="--show"
      >Delete</s-button>
    </s-stack>
    <s-table-header-row>
      <s-table-header listSlot="primary">Puzzle</s-table-header>
      <s-table-header format="numeric">Pieces</s-table-header>
      <s-table-header listSlot="secondary">Status</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row clickDelegate="mountain-view-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="mountain-view-checkbox" checked></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Mountain View puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/29/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="">Mountain View</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>16</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
      <s-table-row clickDelegate="ocean-sunset-checkbox">
        <s-table-cell>
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-checkbox id="ocean-sunset-checkbox" checked></s-checkbox>
            <s-clickable
              href=""
              accessibilityLabel="Ocean Sunset puzzle thumbnail"
              border="base"
              borderRadius="base"
              overflow="hidden"
              inlineSize="40px"
              blockSize="40px"
            >
              <s-image
                objectFit="cover"
                src="https://picsum.photos/id/12/80/80"
              ></s-image>
            </s-clickable>
            <s-link href="">Ocean Sunset</s-link>
          </s-stack>
        </s-table-cell>
        <s-table-cell>9</s-table-cell>
        <s-table-cell>
          <s-badge color="base" tone="success">Active</s-badge>
        </s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>

  <s-modal id="delete-modal" heading="Delete 2 puzzles?">
    <s-text>
      Are you sure you want to delete the selected puzzles? This action cannot be undone.
    </s-text>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
    >Delete</s-button>
    <s-button
      slot="secondary-actions"
      commandFor="delete-modal"
      command="--hide"
    >Cancel</s-button>
  </s-modal>
</s-section>

<!-- 
Archive handler:
shopify.toast.show('2 puzzles archived');

Delete handler:
shopify.toast.show('2 puzzles deleted');
-->
```

***
