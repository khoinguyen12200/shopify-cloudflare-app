---
title: Modal
description: >-
  The modal component displays content in an overlay. Use to create a
  distraction-free experience such as a confirmation dialog or a settings panel.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal.md
api_name: app-home
---

# Modal

The modal component displays content in an overlay. Use to create a distraction-free experience such as a confirmation dialog or a settings panel.

A button triggers the modal using the `commandFor` attribute. Content within the modal scrolls if it exceeds available height.

#### Use cases

* **Confirmation dialogs:** Display confirmation prompts for destructive or irreversible actions like deleting resources.
* **Settings panels:** Present focused settings or configuration forms in a distraction-free overlay.
* **Data entry:** Collect structured input through forms displayed in a modal with save and cancel actions.
* **Detail previews:** Show detailed information or previews without navigating away from the current page.

***

## Properties

Configure the following properties on the modal component.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose of the modal. When set, it will be announced to users using assistive technologies and will provide them with more context.

  This overrides the `heading` prop for screen readers.

* **heading**

  **string**

  **required**

  A title that describes the content of the modal.

* **padding**

  **"base" | "none"**

  **Default: 'base'**

  **required**

  Adjust the padding around the modal content.

  `base`: applies padding that is appropriate for the element.

  `none`: removes all padding from the element. This can be useful when elements inside the modal need to span to the edge of the modal. For example, a full-width image. In this case, rely on box with a padding of 'base' to bring back the desired padding for the rest of the content.

* **size**

  **"small" | "small-100" | "base" | "large" | "large-100"**

  **Default: 'base'**

  **required**

  The size of the modal component, controlling its width and height. Larger sizes provide more space for content while smaller sizes are more compact.

* **show​Overlay**

  **() => void**

  **required**

  A method to programmatically show the overlay.

* **hide​Overlay**

  **() => void**

  **required**

  A method to programmatically hide the overlay.

* **toggle​Overlay**

  **() => void**

  **required**

  A method to programmatically toggle the visibility of the overlay.

### Events

The modal component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **afterhide**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired after the modal is hidden.

* **aftershow**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired after the modal is shown.

* **hide**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the modal is hidden.

* **show**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the modal is shown.

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

### Slots

The modal component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The content displayed within the modal component, typically including form fields, information, or interactive elements.

* **primary-action**

  **HTMLElement**

  The main action button displayed in the modal footer, representing the primary action users should take.

  Only accepts a single button component with a `variant` of `primary`. This action should align with the modal's main purpose.

* **secondary-actions**

  **HTMLElement**

  Additional action buttons displayed in the modal footer, providing alternative or supporting actions.

  Only accepts button components with a `variant` of `secondary` or `auto`. These are visually de-emphasized to establish clear hierarchy.

***

## Examples

### Confirm a merchant action

Focus merchant attention on a critical decision before proceeding. This example presents a delete confirmation with cancel and confirm buttons.

## html

```html
<s-button commandFor="modal">Open</s-button>


<s-modal id="modal" heading="Details">
  <s-paragraph>Displaying more details here.</s-paragraph>


  <s-button slot="secondary-actions" commandFor="modal" command="--hide">
    Close
  </s-button>
  <s-button
    slot="primary-action"
    variant="primary"
    commandFor="modal"
    command="--hide"
  >
    Save
  </s-button>
</s-modal>
```

### Show information in a modal

Present information that needs merchant acknowledgment. This example displays a simple announcement with a heading and body text.

## html

```html
<s-button commandFor="info-modal" command="--show">Show product info</s-button>


<s-modal id="info-modal" heading="Product information">
  <s-text>This product is currently out of stock and cannot be ordered.</s-text>


  <s-button slot="secondary-actions" commandFor="info-modal" command="--hide">
    Close
  </s-button>
</s-modal>
```

### Confirm an action with buttons

Provide clear choices with action buttons in the modal footer. This example pairs primary and secondary buttons for confirming or canceling.

## html

```html
<s-stack gap="base">
  <s-button tone="critical" commandFor="delete-modal" command="--show">
    Delete product
  </s-button>


  <s-modal id="delete-modal" heading="Delete product?">
    <s-stack gap="base">
      <s-text>Are you sure you want to delete "Winter jacket"?</s-text>
      <s-text tone="caution">This action cannot be undone.</s-text>
    </s-stack>


    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      commandFor="delete-modal"
      command="--hide"
    >
      Delete product
    </s-button>
    <s-button
      slot="secondary-actions"
      variant="secondary"
      commandFor="delete-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-stack>
```

### Collect input with a form

Gather information without leaving the current context. This example embeds a feedback form with text inputs and a submit button.

## html

```html
<s-stack gap="base">
  <s-button variant="primary" commandFor="edit-modal" command="--show">
    Edit customer
  </s-button>


  <s-modal id="edit-modal" heading="Edit customer information" size="large">
    <s-stack gap="base">
      <s-text-field
        label="Customer name"
        name="name"
        value="Sarah Johnson"
      ></s-text-field>


      <s-email-field
        label="Email address"
        name="email"
        value="sarah@example.com"
      ></s-email-field>


      <s-text-field
        label="Phone number"
        name="phone"
        value="+1 555-0123"
      ></s-text-field>


      <s-select label="Customer group" name="group">
        <s-option value="retail">Retail</s-option>
        <s-option value="wholesale" selected>Wholesale</s-option>
        <s-option value="vip">VIP</s-option>
      </s-select>
    </s-stack>


    <s-button
      slot="primary-action"
      variant="primary"
      commandFor="edit-modal"
      command="--hide"
    >
      Save changes
    </s-button>
    <s-button
      slot="secondary-actions"
      variant="secondary"
      commandFor="edit-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-stack>
```

### Choose modal size

Adjust modal width to match your content needs. This example demonstrates small, base, and large size variations.

## html

```html
<s-stack gap="base">
  <s-stack direction="inline" gap="base">
    <s-button commandFor="small-modal" command="--show">Small modal</s-button>
    <s-button commandFor="large-modal" command="--show">Large modal</s-button>
  </s-stack>


  <!-- Small modal for quick confirmations -->
  <s-modal id="small-modal" heading="Confirm action" size="small-100">
    <s-text>Are you sure you want to proceed?</s-text>
    <s-button
      slot="primary-action"
      variant="primary"
      commandFor="small-modal"
      command="--hide"
    >
      Confirm
    </s-button>
    <s-button
      slot="secondary-actions"
      variant="secondary"
      commandFor="small-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>


  <!-- Large modal for detailed content -->
  <s-modal id="large-modal" heading="Order details" size="large-100">
    <s-stack gap="base">
      <s-section>
        <s-heading>Order #1001</s-heading>
        <s-text>Placed on March 15, 2024</s-text>
      </s-section>


      <s-divider></s-divider>


      <s-section>
        <s-heading>Items</s-heading>
        <s-stack gap="small">
          <s-text>Winter jacket - $89.99</s-text>
          <s-text>Wool scarf - $29.99</s-text>
          <s-text>Leather gloves - $45.99</s-text>
        </s-stack>
      </s-section>


      <s-divider></s-divider>


      <s-text type="strong">Total: $165.97</s-text>
    </s-stack>


    <s-button
      slot="primary-action"
      variant="primary"
      commandFor="large-modal"
      command="--hide"
    >
      Close
    </s-button>
  </s-modal>
</s-stack>
```

### Display full-width content

Display media or tables that need full-width space. This example sets the `padding` property to false for edge-to-edge content.

## html

```html
<s-stack gap="base">
  <s-button commandFor="image-modal" command="--show">
    View product image
  </s-button>


  <s-modal id="image-modal" heading="Product image" padding="none">
    <s-box background="subdued" padding="base">
      <s-text>Image would display here with full width</s-text>
    </s-box>


    <s-button
      slot="secondary-actions"
      variant="secondary"
      commandFor="image-modal"
      command="--hide"
    >
      Close
    </s-button>
  </s-modal>
</s-stack>
```

### Delete with async handling

Safely handle destructive operations with proper feedback. This example implements loading states, error handling, and async confirmation.

## html

```html
<s-button tone="critical" commandFor="delete-modal">Delete product</s-button>


<s-modal id="delete-modal" heading="Delete product?">
  <s-text>This will permanently delete "Blue T-Shirt". This action cannot be undone.</s-text>


  <s-button slot="secondary-actions" commandFor="delete-modal" command="--hide">Cancel</s-button>
  <s-button slot="primary-action" variant="primary" tone="critical" id="confirm-delete">
    Delete product
  </s-button>
</s-modal>


<script>
  const modal = document.getElementById('delete-modal');
  const deleteBtn = document.getElementById('confirm-delete');


  deleteBtn.addEventListener('click', async () => {
    deleteBtn.loading = true;
    try {
      await fetch('/api/products/123', { method: 'DELETE' });
      modal.hideOverlay();
      // Show success feedback to merchant
    } catch (error) {
      // Handle error - show error message
    } finally {
      deleteBtn.loading = false;
    }
  });
</script>
```

***

## Best practices

* Use for focused, specific tasks that require merchants to make a decision or acknowledge critical information.
* Include a prominent and clear call to action.
* Don't nest modals (avoid launching one modal from another).
* Use specific action verbs: Label buttons with clear verbs like "Delete", "Save", or "Continue" rather than vague terms like "Yes", "OK", or "Submit".
* For destructive actions, explain the consequences in the modal body.
* Use thoughtfully and sparingly—don't create unnecessary interruptions.
* Use as a last resort for important decisions, not for contextual tools or actions that could happen on the page directly.

***

## Limitations

* Modals can only be opened by user interaction, not programmatically on page load.
* The modal always renders centered in the viewport and cannot be repositioned.
* Content within the modal scrolls if it exceeds the available height.

***
