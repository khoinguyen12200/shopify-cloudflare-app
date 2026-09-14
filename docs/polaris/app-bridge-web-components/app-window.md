---
title: App window
description: >-
  The app window component displays a fullscreen modal window for complex
  workflows that need dedicated screen space. The content is specified by the
  src property and should point to a route within your app.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-window
  md: >-
    https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-window.md
api_name: app-home
---

# App window

**Info:**

App Bridge isn't versioned with Polaris. App Bridge APIs and web components are identical in every App Home reference version.

The app window component displays a fullscreen modal window for complex workflows that need dedicated screen space. The content is specified by the `src` property and should point to a route within your app. The app window covers the entire screen, with a top bar controlled by the Shopify admin that allows users to exit.

For most dialogs, we recommend using the [Polaris modal component](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal), which automatically determines whether the modal should display inside your app or as a fullscreen overlay and removes the need for separate App Bridge API control.

#### Use cases

* **Complex workflows:** Display fullscreen modal windows for multi-step workflows that need dedicated screen space.
* **Isolated views:** Load a separate route within your app in a fullscreen overlay for focused tasks.
* **Extended forms:** Present complex forms or configuration interfaces that benefit from full-screen real estate.
* **Content previews:** Show rich content previews or editing interfaces in a distraction-free fullscreen view.

***

## Properties

Attributes for the app window element. This element displays a fullscreen modal window in the Shopify admin.

* **src**

  **string**

  **required**

  The URL of the content to display within the app window. Must point to a route within your app that renders the window content. The URL is loaded in an iframe when the window opens. Commonly used for multi-step workflows, bulk editors, or detailed views that need full-screen space.

* **id**

  **string**

  A unique identifier you assign to the app window element. Used when connecting buttons via `commandFor` or accessing the element with `document.getElementById()`. Choose a descriptive name like `"settings-window"` or `"edit-modal"`.

***

## Instance methods

Instance properties and methods available on the app window element for programmatic control.

* **add​Event​Listener**

  **(type: "show" | "hide", listener: EventListenerOrEventListenerObject) => void**

  Adds an event listener for app window lifecycle events. Supported events: `show` fires when the window opens, `hide` fires when the window closes. Commonly used for tracking analytics, updating UI state, or cleaning up resources when the window closes.

* **content​Window**

  **Window | null**

  Returns the Window object of the app window iframe, or `null` if the window is closed. Use this to communicate with the iframe content via `postMessage()` or access its document. Only accessible when the app window is open.

* **hide**

  **() => Promise\<void>**

  Closes the app window. Returns a Promise that resolves when the window is fully hidden. Any unsaved changes in forms with `data-save-bar` will prompt the user before closing. Commonly used for programmatic close after completing a workflow.

* **remove​Event​Listener**

  **(type: "show" | "hide", listener: EventListenerOrEventListenerObject) => void**

  Removes a previously added event listener. Pass the same event type and listener function that was used with `addEventListener()`. Commonly used for cleanup when a component unmounts to prevent memory leaks.

* **show**

  **() => Promise\<void>**

  Opens the app window and displays the content from the `src` URL. Returns a Promise that resolves when the window is fully visible. Use `await` or `.then()` to run code after the window opens. Commonly used for launching workflows triggered by user actions.

* **src**

  **string**

  Gets or sets the URL of the content displayed in the app window. Changing this value while the window is open navigates to the new URL. Commonly used for dynamic navigation within an open window.

* **toggle**

  **() => Promise\<void>**

  Toggles the app window between open and closed states. Returns a Promise that resolves when the transition completes. Opens the window if closed, closes it if open. Commonly used for toggle buttons that control window visibility.

***

## Examples

### Show and hide

Open a fullscreen modal for complex workflows. This example uses the [`command`](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-command) attribute on a button to toggle the app window.

## Show and hide

![Open a fullscreen modal for complex workflows. This example uses the \[\`command\`\](/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-command) attribute on a button to toggle the app window.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-show-hide-BAfeZlKz.png)

## html

```html
<s-app-window id="app-window" src="/app-window-content.html"></s-app-window>


<s-button command="--show" commandFor="app-window">Open App Window</s-button>
<s-button command="--hide" commandFor="app-window">Close App Window</s-button>
```

### Title bar heading

Add context to fullscreen workflows. This example sets a title using the page component with the `heading` attribute.

## Title bar heading

![Add context to fullscreen workflows. This example sets a title using the page component with the \`heading\` attribute.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-title-bar-heading-BdqUiPJX.png)

## html

```html
<s-app-window src="/app-window-content.html"></s-app-window>


// app-window-content.html
<s-page heading="Product editor"></s-page>
```

### Title bar actions

Provide actions in fullscreen workflows. This example adds primary and secondary action buttons to the title bar using page slots.

## Title bar actions

![Provide actions in fullscreen workflows. This example adds primary and secondary action buttons to the title bar using page slots.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-title-bar-actions-CoAdGV6z.png)

## html

```html
<s-app-window src="/app-window-content.html"></s-app-window>


// app-window-content.html
<s-page heading="Product editor">
  <s-button slot="primary-action" onClick="shopify.toast.show('Save')">Save</s-button>
  <s-button slot="secondary-actions" onClick="shopify.toast.show('Preview')">Preview</s-button>
</s-page>
```

### Title bar accessory badge

Show status in fullscreen workflows. This example displays a status badge using the `accessory` slot with `tone` for color.

## Title bar accessory badge

![Show status in fullscreen workflows. This example displays a status badge using the \`accessory\` slot with \`tone\` for color.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-title-bar-accessory-badge-C6Ho8nRd.png)

## html

```html
<s-app-window src="/app-window-content.html"></s-app-window>


// app-window-content.html
<s-page heading="Edit Product">
  <s-badge slot="accessory" tone="warning">Draft</s-badge>
  <s-button slot="primary-action">Save</s-button>
</s-page>
```

### Title bar icons and menus

Add icons and dropdown menus to actions. This example pairs icon buttons with [`commandFor`](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-commandFor) to create dropdown menus.

## Title bar icons and menus

![Add icons and dropdown menus to actions. This example pairs icon buttons with \[\`commandFor\`\](/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-commandFor) to create dropdown menus.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-title-bar-icons-menus-KSDHKHn5.png)

## html

```html
<s-app-window src="/app-window-content.html"></s-app-window>


// app-window-content.html
<s-page heading="Product Details">
  <s-button slot="primary-action" icon="save">Save</s-button>
  <s-button slot="secondary-actions" commandFor="actions-menu" icon="menu">More actions</s-button>
  <s-menu id="actions-menu">
    <s-button icon="duplicate">Duplicate</s-button>
    <s-button icon="archive">Archive</s-button>
    <s-button icon="delete" tone="critical">Delete</s-button>
  </s-menu>
</s-page>
```

### Instance methods

Control the app window programmatically. This example calls the `show()`, `hide()`, and `toggle()` methods.

## Instance methods

![Control the app window programmatically. This example calls the \`show()\`, \`hide()\`, and \`toggle()\` methods.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-instance-methods-BRlID13l.png)

## html

```html
<s-app-window id="app-window" src="/app-window-content.html"></s-app-window>


<s-button onClick="document.getElementById('app-window').show()">Show App Window</s-button>
<s-button onClick="document.getElementById('app-window').hide()">Hide App Window</s-button>
```

### Command attribute

Control the app window declaratively. This example uses the [`command`](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-command) and [`commandFor`](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-commandFor) attributes on buttons.

## Command attribute

![Control the app window declaratively. This example uses the \[\`command\`\](/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-command) and \[\`commandFor\`\](/docs/api/app-home/latest/web-components/actions/button#properties-propertydetail-commandFor) attributes on buttons.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-command-attribute-CQQ5zI-J.png)

## html

```html
<s-app-window id="app-window" src="/app-window-content.html"></s-app-window>


<s-button command="--show" commandFor="app-window">Open App Window</s-button>
<s-button command="--hide" commandFor="app-window">Hide App Window</s-button>
<s-button command="--toggle" commandFor="app-window">Toggle App Window</s-button>
```

### Form with save bar

Prevent data loss in fullscreen forms. This example integrates the save bar using `data-save-bar` to track unsaved changes.

## Form with save bar

![Prevent data loss in fullscreen forms. This example integrates the save bar using \`data-save-bar\` to track unsaved changes.](https://shopify.dev/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/app-window-form-with-save-bar-DNN_gy8s.png)

## html

```html
<s-app-window src="/app-window-content.html"></s-app-window>


// app-window-content.html
<s-page heading="Product editor">
  <form id="settings-form" data-save-bar>
    <s-text-field label="Product title" name="productTitle"></s-text-field>
    <s-text-area label="Description" name="description"></s-text-area>
  </form>
</s-page>
```

***

## Best practices

* **Open only via explicit user action**: Launch app windows from buttons that clearly indicate a fullscreen experience will open. Never open automatically on page load.
* **Set descriptive titles**: Use the [page component](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar) inside your app window content to set a heading that clearly describes the current task.
* **Handle unsaved changes**: Add `data-save-bar` to forms to automatically prompt merchants before they exit with unsaved changes. See [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api).
* **Return to context on close**: Ensure closing the app window returns merchants to where they started. Don't navigate them elsewhere unexpectedly.

***
