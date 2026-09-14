---
title: Spinner
description: >-
  The spinner component displays an animated indicator showing users that
  content or actions are loading. Use spinner to communicate ongoing processes
  like fetching data, processing requests, or waiting for operations to
  complete.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner.md
api_name: app-home
---

# Spinner

The spinner component displays an animated indicator showing users that content or actions are loading. Use spinner to communicate ongoing processes like fetching data, processing requests, or waiting for operations to complete.

Spinners support multiple sizes and should be used for page or section loading states. For button loading states, use the `loading` property on the [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) component instead.

#### Use cases

* **Loading indicators:** Show loading spinners during asynchronous operations.
* **Loading feedback:** Show an indeterminate loading indicator during async operations.
* **Async operations:** Provide visual feedback during API calls or data loading.
* **Inline loading:** Display inline loading indicators within components.

***

## Properties

Configure the following properties on the spinner component.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **size**

  **"base" | "large" | "large-100"**

  **Default: 'base'**

  **required**

  The size of the loading spinner.

  * `base`: Default size suitable for inline loading indicators or standard UI contexts.
  * `large`: Larger spinner for more prominent loading states.
  * `large-100`: Extra large spinner for full-page or emphasized loading states.

***

## Examples

### Add a loading spinner

Create a spinner with an accessibility label to indicate a loading state. This example shows an extra large spinner with a descriptive label for screen readers.

## html

```html
<s-spinner accessibilityLabel="Loading" size="large-100"></s-spinner>
```

### Use spinners of different sizes

Use the `size` property to match the spinner to its context. This example shows all three sizes—base for inline use, large for section loading, and large-100 for full-page states.

## html

```html
<s-stack direction="inline" alignItems="center" gap="large">
  <s-spinner accessibilityLabel="Loading" size="base"></s-spinner>
  <s-spinner accessibilityLabel="Loading" size="large"></s-spinner>
  <s-spinner accessibilityLabel="Loading" size="large-100"></s-spinner>
</s-stack>
```

### Show a loading state in a content section

Center a spinner with a text label in a section to communicate when content is loading. This example shows a vertically stacked spinner and status message for a product list.

## html

```html
<s-stack alignItems="center" gap="base" padding="large">
  <s-spinner accessibilityLabel="Loading products" size="large"></s-spinner>
  <s-text>Loading products...</s-text>
</s-stack>
```

### Display an inline loading indicator

Place a compact spinner inline with a text label for form submissions and quick actions. This example shows a horizontal layout with a spinner and saving status message.

## html

```html
<s-stack direction="inline" alignItems="center" gap="small">
  <s-spinner accessibilityLabel="Saving"></s-spinner>
  <s-text>Saving...</s-text>
</s-stack>
```

***

## Best practices

* **Show for asynchronous operations:** Display spinners when loading takes longer than 500ms for operations like saving forms, fetching data, or processing actions. For instant actions, spinners might flash distractingly.
* **Scope to specific areas:** Place spinners within the component being loaded (like inside a button during save, or in a section during data fetch) rather than blocking the entire interface.
* **Provide context with labels:** Always include `accessibilityLabel` describing what's loading, like **Loading products**, **Saving changes**, or **Processing payment**. This helps screen reader users understand what's happening.
* **Pair with action feedback:** After a spinner completes, show clear success or error messages so merchants know the operation finished and its outcome.

***

## Limitations

* The component shows indeterminate loading only. It can't display progress percentage or time remaining. For operations with known duration or measurable progress, consider using a progress bar component or custom solution.
* The component continues spinning indefinitely until you remove it. It doesn't automatically stop after a timeout or show error states. You must implement timeout logic and error handling yourself.
* Rendering many spinners simultaneously (like in a table with 50+ rows each showing a spinner) can cause performance issues, especially on older mobile devices.
* The component itself doesn't provide a way to cancel the loading operation. If merchants need to cancel, you must implement separate UI controls like a **Cancel** [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) alongside the spinner.

***
