---
title: Link
description: >-
  The link component makes text interactive, allowing users to navigate to other
  pages or perform specific actions. Use link for navigation, external
  references, or triggering actions while maintaining standard link semantics
  and accessibility.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components/actions/link'
  md: 'https://shopify.dev/docs/api/app-home/latest/web-components/actions/link.md'
api_name: app-home
---

# Link

The link component makes text interactive, allowing users to navigate to other pages or perform specific actions. Use link for navigation, external references, or triggering actions while maintaining standard link semantics and accessibility.

Links support standard URLs, custom protocols, navigation within Shopify admin pages, and can open in new windows for external destinations. For prominent actions or form submissions, use [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) instead.

#### Use cases

* **External resources:** Link to external documentation, help articles, or related tools.
* **Admin navigation:** Navigate to other Shopify admin pages or resource details.
* **App pages:** Link between different pages or sections within your app.
* **Help and support:** Provide access to support resources or additional information.

***

## Properties

Configure the following properties on the link component.

* **tone**

  **"critical" | "auto" | "neutral"**

  **Default: 'auto'**

  **required**

  The semantic meaning and color treatment of the component.

  * `critical`: Urgent problems or destructive actions.
  * `auto`: Automatically determined based on context.
  * `neutral`: General information without specific intent.

* **accessibility​Label**

  **string**

  **required**

  A label that describes the purpose or content of the component for assistive technologies like screen readers. Use this to provide additional context when the visible content alone doesn't clearly convey the component's purpose.

* **href**

  **string**

  **required**

  The URL to navigate to when clicked. The `click` event fires first, then navigation occurs. If `commandFor` is also set, the command executes instead of navigation.

* **target**

  **"auto" | AnyString | "\_blank" | "\_self" | "\_parent" | "\_top"**

  **Default: 'auto'**

  **required**

  The browsing context where the linked URL should be displayed.

  * `auto`: The target is automatically determined based on the origin of the URL.
  * `_blank`: Opens the URL in a new window or tab.
  * `_self`: Opens the URL in the same browsing context as the current one.
  * `_parent`: Opens the URL in the parent browsing context of the current one. If there is no parent, behaves as `_self`.
  * `_top`: Opens the URL in the topmost browsing context (the highest ancestor of the current one). If there is no ancestor, behaves as `_self`.

* **download**

  **string**

  **required**

  Prompts the browser to download the linked URL rather than navigate to it. When set, the value specifies the suggested filename for the downloaded file.

  The filename suggestion is only respected for same-origin URLs, `blob:`, and `data:` schemes. Cross-origin URLs can still trigger downloads, but browsers might ignore the suggested filename.

  Learn more about the [download attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download).

* **lang**

  **string**

  **required**

  The language of the text content. Use this when the text is in a different language than the rest of the page, allowing assistive technologies such as screen readers to invoke the correct pronunciation. The value should be a valid language subtag from the [IANA language subtag registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry).

* **command**

  **'--auto' | '--show' | '--hide' | '--toggle'**

  **Default: '--auto'**

  **required**

  The action that [command](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#command) should take when this component is activated.

  * `--auto`: A default action for the target component.
  * `--show`: Shows the target component.
  * `--hide`: Hides the target component.
  * `--toggle`: Toggles the visibility of the target component.

* **command​For**

  **string**

  **required**

  The component that [commandFor](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#commandfor) should act on when this component is activated.

* **interest​For**

  **string**

  **required**

  The ID of the component to show when users hover over or focus on this component. Use this to connect interactive components to popovers or tooltips that provide additional context or information.

### AnyString

A utility type that enables autocomplete for specific string literals while still accepting any string value. By intersecting \`string\` with an empty object type, this prevents TypeScript from widening literal types, preserving IDE suggestions for known values while maintaining flexibility for custom strings.

```ts
string & {}
```

### Events

The link component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **click**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the link is clicked.

  Learn more about the [click event](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event).

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

The link component supports slots for additional content placement within the component. Learn more about [using slots](https://shopify.dev/docs/api/polaris/using-polaris-web-components#slots).

* **children**

  **HTMLElement**

  The text or elements displayed within the link component, which navigates users to a different location when activated.

***

## Examples

### Add a basic link

Add an inline link to let merchants navigate to another page. This example shows a basic text link with an `href` property.

## html

```html
<s-link href="#beep">fulfilling orders</s-link>
```

### Embed links in paragraph text

Embed links within a [Paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph) so merchants can navigate to related content inline. This example shows two links inside a paragraph that inherit the surrounding text tone.

## html

```html
<s-paragraph>
  Your product catalog is empty. Start by <s-link href="javascript:void(0)">adding your first product</s-link> or <s-link href="javascript:void(0)">importing existing inventory</s-link>.
</s-paragraph>
```

### Add links inside a banner

Place links inside banners to provide direct actions alongside important notifications. This example shows a link inside an info banner prompting merchants to create a campaign.

## html

```html
<s-banner tone="info">
  <s-paragraph>
    Black Friday campaigns are now available!
    <s-link href="javascript:void(0)">Create your campaign</s-link>
  </s-paragraph>
</s-banner>
```

### Add links inside a box container

Place links inside a box container to provide navigation within a visually distinct content area. This example shows two links inside a bordered box with background and padding.

## html

```html
<s-box padding="base" background="base" borderWidth="base" borderColor="base">
  <s-paragraph>
    Boost your store's conversion with professional themes. <s-link href="javascript:void(0)">Browse theme store</s-link> or <s-link href="javascript:void(0)">customize your current theme</s-link>.
  </s-paragraph>
</s-box>
```

### Trigger a file download

Use the `download` property to trigger a file download when the link is clicked. This example shows a link that downloads a CSV file for customer data export.

## html

```html
<s-paragraph>
  Export your customer data for marketing analysis. <s-link href="javascript:void(0)" download="customer-export.csv">Download customer list</s-link>
</s-paragraph>
```

### Open external links in a new tab

Open external URLs in a new tab so merchants stay on the current page. This example shows two links with `target="_blank"` pointing to external documentation.

## html

```html
<s-box padding="base">
  <s-paragraph>
    Need help with policies? Read our <s-link href="javascript:void(0)" target="_blank">billing docs</s-link> or review the <s-link href="javascript:void(0)" target="_blank">terms of service</s-link>.
  </s-paragraph>
</s-box>
```

### Set the language for a link

Set the `lang` property so screen readers pronounce the link text correctly. This example shows a French-language link with the `lang` attribute set.

## html

```html
<s-paragraph>
  Voir en français: <s-link lang="fr">Gérer les produits</s-link>
</s-paragraph>
```

### Match link tone to surrounding context

Configure links that inherit the tone of their parent paragraph and match the surrounding context. This example shows links inside paragraphs with six different tones.

## html

```html
<s-stack gap="base">
  <s-paragraph>
    Default tone: <s-link>View orders</s-link>
  </s-paragraph>


  <s-paragraph tone="success">
    Neutral tone: <s-link>Inventory help</s-link>
  </s-paragraph>


  <s-paragraph tone="critical">
    Critical tone: <s-link>Close store</s-link>
  </s-paragraph>


  <s-paragraph tone="warning">
    Warning tone: <s-link>Update billing info</s-link>
  </s-paragraph>


  <s-paragraph tone="info">
    Info tone: <s-link>Learn more about reports</s-link>
  </s-paragraph>


  <s-paragraph tone="caution">
    Subdued tone: <s-link>View archived products</s-link>
  </s-paragraph>
</s-stack>
```

***

## Best practices

* **Open external links in new tabs:** Use `target="_blank"` only for external URLs (like help documentation or partner sites). Keep internal admin links in the same tab to maintain workflow context.

***

## Limitations

* Links within extensions have limited control over navigation behavior in the Shopify admin. Some admin navigation patterns might override link behavior for consistency.
* Links with `target="_blank"` automatically get `rel="noopener noreferrer"` for security, but external URLs are still subject to browser security policies. Some browsers might block external navigation from extensions or show security warnings.
* Links don't have a built-in loading or disabled state. If clicking a link triggers a slow navigation or async operation, you must implement loading feedback yourself.
* The `download` attribute for forcing file downloads has inconsistent browser support. It works reliably for same-origin files but might be ignored for cross-origin resources. Safari on iOS doesn't support the download attribute at all.

***
