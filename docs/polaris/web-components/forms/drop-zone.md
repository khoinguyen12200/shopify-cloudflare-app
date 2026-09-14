---
title: Drop zone
description: >-
  The drop zone component lets users upload files through drag-and-drop or by
  clicking to browse. Use for file uploads such as images, documents, or CSV
  imports.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone'
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone.md
api_name: app-home
---

# Drop zone

The drop zone component lets users upload files through drag-and-drop or by clicking to browse. Use for file uploads such as images, documents, or CSV imports.

The component provides visual feedback during drag operations and supports file type validation through the `accept` property. Rejected files trigger the `droprejected` event for custom error handling.

#### Use cases

* **File uploads:** Enable drag-and-drop file uploading for product images, documents, or media assets.
* **Bulk imports:** Allow merchants to upload CSV or spreadsheet files for bulk data imports.
* **Media management:** Provide an intuitive interface for uploading and managing media files with type validation.
* **Document collection:** Collect documents like invoices, certificates, or compliance files with file type restrictions.

***

## Properties

Configure the following properties on the drop zone component.

* **accept**

  **string**

  **Default: ''**

  **required**

  A string representing the types of files that are accepted by the drop zone. This string is a comma-separated list of unique file type specifiers which can be one of the following:

  * A file extension starting with a period (".") character (e.g. .jpg, .pdf, .doc)
  * A valid MIME type string with no extensions

  If omitted, all file types are accepted.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or contents of the item. When set, it will be announced to buyers using assistive technologies and will provide them with more context.

* **disabled**

  **boolean**

  **Default: false**

  **required**

  Whether the field is disabled, preventing any user interaction.

* **error**

  **string**

  **required**

  An error message displayed below the checkbox to indicate validation problems. When set, the checkbox is styled with error indicators and the message is announced to screen readers.

* **label**

  **string**

  **required**

  The text displayed as the field label, which identifies the purpose of the field to users. This label is associated with the field for accessibility and helps users understand what information to provide.

* **label​Accessibility​Visibility**

  **"visible" | "exclusive"**

  **Default: 'visible'**

  **required**

  Controls whether the label is visible to all users or only to screen readers.

  * `visible`: The label is shown to everyone (default).
  * `exclusive`: The label is visually hidden but still announced by screen readers.

  Use `exclusive` when the surrounding context makes the label redundant visually, but screen reader users still need it for clarity.

* **multiple**

  **boolean**

  **Default: false**

  **required**

  Whether multiple files can be selected or dropped at once.

* **name**

  **string**

  **required**

  The name attribute for the field, used to identify the field's value when the form is submitted. Must be unique within the nearest containing form.

* **required**

  **boolean**

  **Default: false**

  **required**

  Whether the field requires a value before form submission. Displays a visual indicator and adds semantic meaning, but doesn't automatically validate or show errors. Use the `error` property to display validation messages.

* **value**

  **string**

  **Default: ''**

  **required**

  This sets the input value for a file type, which cannot be set programatically, so it can only be reset.

* **files**

  **File\[]**

  **Default: \[]**

  **required**

  An array of File objects representing the files currently selected by the user.

  This property is read-only and cannot be directly modified. To clear the selected files, set the `value` prop to an empty string or null.

### Events

The drop zone component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **change**

  **CallbackEventListener\<typeof tagName>**

  **required**

  A callback fired when the drop zone value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **droprejected**

  **CallbackEventListener\<typeof tagName>**

  **required**

  A callback fired when a dropped file is rejected due to file type or size restrictions.

* **input**

  **CallbackEventListener\<typeof tagName>**

  **required**

  A callback fired when the user inputs data into the drop zone.

  Learn more about the [input event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event).

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

## Examples

### Accept file uploads

Let users upload files by dragging or clicking to browse. This example creates a basic upload area with default prompts.

## html

```html
<s-drop-zone
  label="Upload"
  accessibilityLabel="Upload image of type jpg, png, or gif"
  accept=".jpg,.png,.gif"
  multiple
  onInput="console.log('onInput', event.currentTarget?.value)"
  onChange="console.log('onChange', event.currentTarget?.value)"
  onDropRejected="console.log('onDropRejected', event.currentTarget?.value)"
></s-drop-zone>
```

### Allow multiple file uploads

Accept multiple files in a single interaction. This example uses the `multiple` attribute with a custom label.

## html

```html
<s-drop-zone label="Drop files to upload" multiple></s-drop-zone>
```

### Upload images

Preview uploaded images before submission. This example generates thumbnails after file selection.

## html

```html
<s-drop-zone accept="image/*" label="Upload images" multiple></s-drop-zone>
```

### Require file upload

Ensure files are provided before form submission. This example enforces validation using the `required` attribute.

## html

```html
<s-drop-zone name="file" required label="Upload file"></s-drop-zone>
```

### Disable uploads during processing

Block uploads while files are being processed. This example demonstrates the `disabled` state during an active upload.

## html

```html
<s-drop-zone label="Upload not available" disabled></s-drop-zone>
```

### Restrict file types

Accept only specific file formats. This example restricts uploads to PDF and DOC files using the `accept` property.

## html

```html
<s-drop-zone
  accept=".pdf,.doc,.docx"
  label="Upload documents"
  multiple
></s-drop-zone>
```

### Show upload errors

Communicate why an upload failed. This example displays error messaging when files are rejected.

## html

```html
<s-drop-zone
  label="Upload file"
  error="File size must be less than 5mb"
></s-drop-zone>
```

### Configure accessibility labels

Support screen reader users with clear labels. This example configures custom accessibility announcements.

## html

```html
<s-drop-zone
  label="Upload files"
  accessibilityLabel="Upload files using drag and drop or file selector"
  labelAccessibilityVisibility="exclusive"
  multiple
></s-drop-zone>
```

### Upload with validation

Handle the complete upload lifecycle with validation and feedback. This example combines type and size validation, error states, and disabled state during processing.

## html

```html
<s-drop-zone 
  id="upload" 
  label="Product images" 
  accept="image/*" 
  multiple
></s-drop-zone>


<script>
  const dropzone = document.getElementById('upload');


  dropzone.addEventListener('change', async (e) => {
    const files = e.currentTarget.files;


    // Validate size (5MB max per file)
    const maxSize = 5 * 1024 * 1024;
    if (files.some(f => f.size > maxSize)) {
      dropzone.error = 'Files must be under 5MB';
      return;
    }
    dropzone.error = '';


    // Disable during upload
    dropzone.disabled = true;


    const formData = new FormData();
    files.forEach(f => formData.append('images[]', f));


    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
      dropzone.value = ''; // Clear for next upload
      // Show success feedback
    } catch (error) {
      dropzone.error = 'Upload failed. Please try again.';
    } finally {
      dropzone.disabled = false;
    }
  });


  dropzone.addEventListener('droprejected', () => {
    dropzone.error = 'Only image files are accepted';
  });
</script>
```

***

## Best practices

* Set clear file type and size restrictions using the `accept` property.
* Use the `droprejected` event to display meaningful error messages when uploads fail validation.
* Consider using `disabled` to prevent uploads during processing.

***

## Limitations

* File size validation must be handled in your event handler; the component only validates file types.
* The `change` event provides the file list but does not automatically upload files.
* Multiple file selection requires the `multiple` attribute to be set.

***
