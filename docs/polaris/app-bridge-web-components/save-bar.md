---
title: Save bar
description: >-
  Enable automatic save bar integration for HTML forms by adding the
  data-save-bar attribute to your form element. When form data changes, a save
  bar automatically appears, prompting users to save or discard their changes.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar
  md: >-
    https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar.md
api_name: app-home
---

# Save bar

**Info:**

App Bridge isn't versioned with Polaris. App Bridge APIs and web components are identical in every App Home reference version.

Enable automatic save bar integration for HTML forms by adding the `data-save-bar` attribute to your form element. When form data changes, a save bar automatically appears, prompting users to save or discard their changes.

Alternatively, use the [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api) for programmatic control over the save bar behavior. Choose one approach or the other. Don't combine `data-save-bar` with programmatic methods on the same page.

For `<s-app-window>` content where you need programmatic save bar control from within the iframe, define `<ui-save-bar>` on the parent page and use `shopify.saveBar.show(id)` from within the iframe. See [Save bar in an iframe window](#save-bar-in-an-iframe-window).

**Info:**

The save bar functionality requires the full App Bridge UI library to be loaded using a [script tag](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components#adding-app-bridge-web-components-to-your-app).

#### Use cases

* **Form change tracking:** Automatically detect unsaved form changes and display a save bar using the `data-save-bar` attribute.
* **Save and discard:** Provide merchants with clear save and discard actions when form data has been modified.
* **Discard confirmation:** Add a confirmation dialog before discarding changes to prevent accidental data loss.
* **Form reset handling:** Listen for form submit and reset events to handle save and discard actions.

***

## Attributes

Add these attributes to your `<form>` element to enable save bar integration.

* **data-discard-confirmation**

  **boolean**

  Shows a confirmation dialog when the discard button is clicked, requiring merchants to confirm before losing their changes. The dialog prevents accidental data loss by adding a second step before reset. Commonly used for forms with significant data entry, multi-step workflows, or when changes cannot be easily recreated.

* **data-save-bar**

  **boolean**

  Enables automatic save bar integration. When present, the save bar appears whenever any form input value changes from its initial state. The save bar automatically hides when the form is submitted or reset. Commonly used for settings pages, product editors, or any form where merchants need visual feedback about unsaved changes.

* **onreset**

  **(event: Event) => void**

  Handler called when the form is reset via the save bar's discard button. Receives a standard `Event` that can be prevented with `event.preventDefault()` for custom discard logic. Commonly used for reverting form fields to their original values, clearing temporary state, or confirming discard actions programmatically.

* **onsubmit**

  **(event: SubmitEvent) => void**

  Handler called when the form is submitted via the save bar's save button. Receives a standard `SubmitEvent` that can be prevented with `event.preventDefault()` for custom async save logic. Commonly used for API calls to persist data, form validation before save, or showing success/error toasts after the operation completes.

***

## Examples

### Form with automatic save bar

Add the `data-save-bar` attribute to a form to automatically show a save bar when form data changes.

## Form with automatic save bar

![Add the \`data-save-bar\` attribute to a form to automatically show a save bar when form data changes.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/save-bar-form-DCwt1gj9.png)

## html

```html
<form data-save-bar>
  <s-text-field
    label="Product Title"
    name="title"
    required
  ></s-text-field>


  <s-text-area
    label="Description"
    name="description"
    rows="4"
  ></s-text-area>


  <s-text-field
    label="Price"
    name="price"
  ></s-text-field>
</form>
```

### Submit and reset handlers

Handle form submission and reset using standard HTML form events.

## Submit and reset handlers

![Handle form submission and reset using standard HTML form events.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/save-bar-reset-handlers-4hOYOxQ9.png)

## html

```html
<form
  data-save-bar
  onSubmit="console.log('submit');"
  onReset="console.log('reset');"
>
  <s-text-field label="Name" name="name"></s-text-field>
  <s-button type="submit">Submit</s-button>
  <s-button type="reset">Reset</s-button>
</form>
```

### Discard confirmation

Add `data-discard-confirmation` to show a confirmation dialog when the discard button is clicked, preventing accidental data loss.

## Discard confirmation

![Add \`data-discard-confirmation\` to show a confirmation dialog when the discard button is clicked, preventing accidental data loss.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/save-bar-discard-confirmation-BXPw9s1y.png)

## html

```html
<form data-save-bar data-discard-confirmation>
  <s-text-field
    label="Store Name"
    name="storeName"
    required
  ></s-text-field>


  <s-text-area
    label="Store Description"
    name="description"
    rows="4"
  ></s-text-area>


  <s-checkbox
    label="Enable notifications"
    name="notifications"
  ></s-checkbox>
</form>
```

### Save bar in an iframe window

For `<s-app-window>` content, define a `<ui-save-bar>` on the parent page with a unique `id`. From within the iframe, call `shopify.saveBar.show(id)` when changes are detected and `shopify.saveBar.hide(id)` after save or discard.

##### Parent page

```tsx
// @validate-ignore: ButtonHTMLAttributes<HTMLButtonElement>
function ParentPage() {
  const saveBarId = 'modal-save-bar';

  const handleSave = async () => {
    await fetch('/api/save', {method: 'POST'});
    shopify.saveBar.hide(saveBarId);
  };

  const handleDiscard = () => {
    shopify.saveBar.hide(saveBarId);
  };

  return (
    <s-page heading="Settings">
      <ui-save-bar id={saveBarId}>
        <button variant="primary" onClick={handleSave}>Save</button>
        <button onClick={handleDiscard}>Discard</button>
      </ui-save-bar>
      <s-app-window src="/settings" />
    </s-page>
  );
}
```

##### /settings route

```tsx
function SettingsPage() {
  return (
    <s-section heading="Configuration">
      <s-text-field
        label="Store name"
        onInput={() => shopify.saveBar.show('modal-save-bar')}
      />
    </s-section>
  );
}
```

***

## Best practices

* **Always provide discard functionality**: Allow merchants to revert changes by handling the discard action or using form reset.
* **Show loading states during save**: Use the [Loading API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/loading-api) to indicate when an async save operation is in progress.
* **Use `data-discard-confirmation` for destructive forms**: Add a confirmation dialog when discarding changes would result in significant data loss.
* **Control the save bar from iframe windows**: For `<s-app-window src="...">` content, define `<ui-save-bar>` on the parent page and call `shopify.saveBar.show(id)` from within the iframe. See [Save bar in an iframe window](#save-bar-in-an-iframe-window).

***
