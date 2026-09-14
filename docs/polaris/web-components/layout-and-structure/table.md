---
title: Table
description: >-
  The table component displays data clearly in rows and columns, helping users
  view, analyze, and compare structured information. Use table to present
  datasets, product lists, order details, or any tabular content that benefits
  from organized rows and columns.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table.md
api_name: app-home
---

# Table

The table component displays data clearly in rows and columns, helping users view, analyze, and compare structured information. Use table to present datasets, product lists, order details, or any tabular content that benefits from organized rows and columns.

Tables automatically adapt to screen size, rendering as lists on small screens and tables on larger ones for optimal readability across devices.

#### Use cases

* **Data tables:** Display tabular data with headers, rows, and cells.
* **Filterable data:** Add search or filter controls above the table with the `filters` slot.
* **Paginated data:** Show large datasets with pagination controls.
* **Structured data:** Present structured data in accessible table format.

***

## Properties

Configure the following properties on the table component.

* **variant**

  **"auto" | "list"**

  **Default: 'auto'**

  **required**

  The layout variant of the table component.

  * `list`: Always displays as a list layout.
  * `table`: Always displays as a traditional table layout.
  * `auto`: Automatically displays as a table on wide screens and as a list on narrow screens.

* **loading**

  **boolean**

  **Default: false**

  **required**

  Whether the table is in a loading state, such as during initial page load or when loading the next page in a paginated table. When `true`, the table might be in an inert state that prevents user interaction.

* **paginate**

  **boolean**

  **Default: false**

  **required**

  Whether to use pagination controls.

* **has​Previous​Page**

  **boolean**

  **Default: false**

  **required**

  Whether there's a previous page of data.

* **has​Next​Page**

  **boolean**

  **Default: false**

  **required**

  Whether there's an additional page of data.

### Slots

The table component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The table structure defining headers and data rows.

  Accepts table header row (for column headers) and table body (for data rows) components. Structure your table with a table header row first, followed by table body.

* **filters**

  **HTMLElement**

  Filter controls displayed above the table.

  Accepts input components like search field or select for filtering table data. These controls appear in a dedicated area above the table content.

### Events

The table component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **nextpage**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the user navigates to the next page.

* **previouspage**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the user navigates to the previous page.

### CallbackEventListener

A function that handles events from UI components. This type represents an event listener callback that receives a \`CallbackEvent\` with a strongly-typed \`currentTarget\`. Use this for component event handlers like \`click\`, \`focus\`, \`blur\`, and other DOM events.

```ts
(EventListener & {
      (event: CallbackEvent<T>): void;
    }) | null
```

### CallbackEvent

An event object with a strongly-typed \`currentTarget\` property that references the specific HTML element that triggered the event. This type extends the standard DOM \`Event\` interface and ensures type safety when accessing the element that fired the event.

```ts
Event & {
  currentTarget: HTMLElementTagNameMap[T];
}
```

***

## Table body

The table body component represents the main content area of a table, containing the data rows. Use table body as a child of table to structure your table data, with each table row within the body representing a single record or entry.

Table body must contain table row components, which in turn contain table cell components for the actual data values.

* **declare class TableBody extends PreactCustomElement implements TableBodyProps { constructor(); }**

### Slots

The table body component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The data rows displayed in the table body.

  Accepts table row components, with each row representing a single record or entry in the table.

***

## Table cell

The table cell component represents a single data cell within a table row. Use table cell as a child of table row to display individual data values, with each cell corresponding to a column in the table.

Table cell automatically inherits styling and alignment from its parent table structure and supports text content or other inline components.

* **declare class TableCell extends PreactCustomElement implements TableCellProps { constructor(); /** @private */ get [headerFormatSymbol](): HeaderFormat; /** @private */ set [headerFormatSymbol](format: HeaderFormat); }**

### Slots

The table cell component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The data value displayed in this cell.

  Accepts text content or inline components representing the cell's data value.

***

## Table header

The table header component represents a single column header within a table header row. Use table header as a child of table header row to define column headings and optionally enable column sorting.

Table header provides semantic meaning for screen readers and can include sorting controls when configured. Each header corresponds to a column in the table body.

* **list​Slot**

  **ListSlotType**

  **Default: 'labeled'**

  **required**

  The content designation for this column when the table displays in list variant on mobile devices.

* **format**

  **HeaderFormat**

  **required**

  The format of the column that controls styling and alignment of cell content.

### ListSlotType

Represents the semantic type of content slots within list items. - \`primary\`: The main content or title of the list item. - \`secondary\`: Supporting or descriptive content below the primary content. - \`kicker\`: A small label or tag displayed above the primary content. - \`inline\`: Content displayed inline with the primary content. - \`labeled\`: Content with an associated label.

```ts
'primary' | 'secondary' | 'kicker' | 'inline' | 'labeled'
```

### HeaderFormat

Represents the format options for table headers that control styling and alignment of column content. Available values: - \`base\`: Standard format for text columns - \`currency\`: Right-aligned format for monetary values - \`numeric\`: Right-aligned format for numeric values

```ts
'base' | 'numeric' | 'currency'
```

### Slots

The table header component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The column heading text.

  This text labels the column in table variant and appears as a label for data in list variant.

***

## Table header row

The table header row component represents the header row of a table, containing column headings. Use table header row as the first child of table (before table body) to define the table structure and provide column labels.

Table header row must contain table header components for each column. These headers provide context for the data columns and can support sorting functionality.

* **declare class TableHeaderRow extends PreactCustomElement implements TableHeaderRowProps { constructor(); /** @private */ connectedCallback(): void; /** @private */ disconnectedCallback(): void; }**

### Slots

The table header row component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The column headers displayed in the table header row.

  Accepts table header components, with each header defining a column and providing its label.

***

## Table row

The table row component represents a single row of data within a table body. Use table row as a child of table body to structure individual records or entries in the table.

Table row must contain table cell components, with each cell representing a data value for the corresponding column. The number of cells should match the number of headers in the table.

* **click​Delegate**

  **string**

  **required**

  The ID of an interactive element, such as `s-link`, in the row that will be the target of the click when the row is clicked. This is the primary action for the row; it should not be used for secondary actions.

  This is a click-only affordance, and does not introduce any keyboard or screen reader affordances. Which is why the target element must be in the table; so that keyboard and screen reader users can interact with it normally.

### Slots

The table row component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The data cells displayed in this table row.

  Accepts table cell components, with each cell containing a data value for the corresponding column.

***

## Examples

### Add a data table

Create a data table with header columns and rows of structured content. This example shows a customer table with name, email, order count, and phone columns.

## html

```html
<s-section padding="none">
  <s-table>
    <s-table-header-row>
      <s-table-header>Name</s-table-header>
      <s-table-header>Email</s-table-header>
      <s-table-header format="numeric">Orders placed</s-table-header>
      <s-table-header>Phone</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>John Smith</s-table-cell>
        <s-table-cell>john@example.com</s-table-cell>
        <s-table-cell>23</s-table-cell>
        <s-table-cell>123-456-7890</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Jane Johnson</s-table-cell>
        <s-table-cell>jane@example.com</s-table-cell>
        <s-table-cell>15</s-table-cell>
        <s-table-cell>234-567-8901</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Brandon Williams</s-table-cell>
        <s-table-cell>brandon@example.com</s-table-cell>
        <s-table-cell>42</s-table-cell>
        <s-table-cell>345-678-9012</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Configure columns for mobile list layout

Use the `listSlot` property on table headers to control how columns are displayed when the table is converted to a list layout on mobile. This example shows a product table with badges and appropriate slot assignments for mobile readability.

## html

```html
<s-section padding="none">
  <s-table>
    <s-table-header-row>
      <s-table-header listSlot="primary">Product</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
      <s-table-header listSlot="labeled">Inventory</s-table-header>
      <s-table-header listSlot="labeled">Price</s-table-header>
    </s-table-header-row>


    <s-table-body>
      <s-table-row>
        <s-table-cell>Water bottle</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>128</s-table-cell>
        <s-table-cell>$24.99</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>T-shirt</s-table-cell>
        <s-table-cell>
          <s-badge tone="warning">Low stock</s-badge>
        </s-table-cell>
        <s-table-cell>15</s-table-cell>
        <s-table-cell>$19.99</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Cutting board</s-table-cell>
        <s-table-cell>
          <s-badge tone="critical">Out of stock</s-badge>
        </s-table-cell>
        <s-table-cell>0</s-table-cell>
        <s-table-cell>$34.99</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Add pagination for large datasets

Use the `paginate`, `hasPreviousPage`, and `hasNextPage` properties to display pagination controls for navigating large datasets. This example shows a paginated product table with next and previous page buttons.

## html

```html
<s-section padding="none">
  <s-table paginate hasPreviousPage hasNextPage>
    <s-table-header-row>
      <s-table-header listSlot="primary">Product</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
      <s-table-header listSlot="secondary" format="numeric">Sales</s-table-header>
    </s-table-header-row>


    <s-table-body>
      <s-table-row>
        <s-table-cell>Product 1</s-table-cell>
        <s-table-cell>Active</s-table-cell>
        <s-table-cell>250</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Product 2</s-table-cell>
        <s-table-cell>Active</s-table-cell>
        <s-table-cell>180</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Product 3</s-table-cell>
        <s-table-cell>Paused</s-table-cell>
        <s-table-cell>95</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Show a loading state while fetching data

Set the `loading` property to display a loading overlay while fetching or refreshing table data. This example shows a product table with the loading state active.

## html

```html
<s-section padding="none">
  <s-table loading>
    <s-table-header-row>
      <s-table-header listSlot="primary">Product</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
      <s-table-header listSlot="labeled">Inventory</s-table-header>
    </s-table-header-row>


    <s-table-body>
      <s-table-row>
        <s-table-cell>Water bottle</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>128</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>T-shirt</s-table-cell>
        <s-table-cell>
          <s-badge tone="warning">Low stock</s-badge>
        </s-table-cell>
        <s-table-cell>15</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Cutting board</s-table-cell>
        <s-table-cell>
          <s-badge tone="critical">Out of stock</s-badge>
        </s-table-cell>
        <s-table-cell>0</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>Notebook set</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>245</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Add a search filter to a table

Use the `filters` slot to add search or filter controls above the table. This example shows a search field that lets merchants filter products by name.

## html

```html
<s-section padding="none">
  <s-table>
    <s-search-field slot="filters" label="Search products" labelAccessibilityVisibility="exclusive" placeholder="Search products"></s-search-field>
    <s-table-header-row>
      <s-table-header listSlot="primary">Product</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
      <s-table-header listSlot="labeled">Inventory</s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>Water bottle</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>128</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>T-shirt</s-table-cell>
        <s-table-cell>
          <s-badge tone="warning">Low stock</s-badge>
        </s-table-cell>
        <s-table-cell>15</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

### Display data in list format

Use the `variant` property to display data as stacked key-value pairs instead of as a grid. This is the default layout on mobile devices. This example shows a customer table rendered in list format.

## html

```html
<s-section padding="none">
  <s-table variant="list">
    <s-table-header-row>
      <s-table-header listSlot="kicker">ID</s-table-header>
      <s-table-header listSlot="primary">Customer</s-table-header>
      <s-table-header listSlot="secondary">Email</s-table-header>
      <s-table-header listSlot="inline">Status</s-table-header>
      <s-table-header listSlot="labeled" format="numeric">
        Orders
      </s-table-header>
      <s-table-header listSlot="labeled" format="currency">
        Total spent
      </s-table-header>
    </s-table-header-row>
    <s-table-body>
      <s-table-row>
        <s-table-cell>#1001</s-table-cell>
        <s-table-cell>Sarah Johnson</s-table-cell>
        <s-table-cell>sarah@example.com</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>23</s-table-cell>
        <s-table-cell>$1,245.50</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>#1002</s-table-cell>
        <s-table-cell>Mike Chen</s-table-cell>
        <s-table-cell>mike@example.com</s-table-cell>
        <s-table-cell>
          <s-badge tone="neutral">Inactive</s-badge>
        </s-table-cell>
        <s-table-cell>7</s-table-cell>
        <s-table-cell>$432.75</s-table-cell>
      </s-table-row>
      <s-table-row>
        <s-table-cell>#1003</s-table-cell>
        <s-table-cell>Emma Davis</s-table-cell>
        <s-table-cell>emma@example.com</s-table-cell>
        <s-table-cell>
          <s-badge tone="success">Active</s-badge>
        </s-table-cell>
        <s-table-cell>15</s-table-cell>
        <s-table-cell>$892.25</s-table-cell>
      </s-table-row>
    </s-table-body>
  </s-table>
</s-section>
```

***

## Best practices

* **Use for structured, comparable data:** The component works best when displaying multiple records with consistent attributes that merchants need to scan and compare. For simple lists without comparison needs, consider using a simpler component.
* **Design for mobile transformation:** The component automatically converts to a list layout on mobile devices. Ensure your column headers and data make sense when displayed as stacked key-value pairs rather than a grid.
* **Keep column counts reasonable:** Tables with many columns become difficult to scan and require horizontal scrolling. Aim for the minimum columns needed to support user tasks, and consider whether some data could be revealed on demand.
* **Provide clear column headers:** Column headers help merchants understand what each column represents. Write concise, descriptive headers that clearly identify the data type or attribute.
* **Consider data volume:** Large tables impact performance and user experience. Use pagination for datasets with more than 50-100 rows, or consider whether filtering or search would help merchants find specific records more efficiently.

***

## Limitations

* The component doesn't include built-in sorting or search functionality. You'll need to implement these features yourself if merchants need to organize data within the table. For filtering, use the `filters` slot to add filter UI such as a search field.
* The component doesn't support sticky headers that remain visible during scrolling. If merchants need to reference column headers while viewing data further down the table, consider using pagination to keep datasets smaller.

***
