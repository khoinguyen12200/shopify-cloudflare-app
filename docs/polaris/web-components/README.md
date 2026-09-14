---
title: Web components
description: >-
  Polaris provides a library of web components for your app to display data, get
  input from merchants, and trigger API calls. These components follow Shopify's
  design system, ensuring that your app looks and feels native to the Shopify
  admin.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/web-components'
  md: 'https://shopify.dev/docs/api/app-home/latest/web-components.md'
api_name: app-home
---

# Web components

Polaris provides a library of web components for your app to display data, get input from merchants, and trigger API calls. These components follow [Shopify's design system](https://shopify.dev/docs/api/polaris/using-polaris-web-components), ensuring that your app looks and feels native to the Shopify admin.

***

## Adding Polaris to your app

When you scaffold your app using [Shopify CLI](https://shopify.dev/docs/api/shopify-cli), Polaris is added to your app automatically, set up with `polaris-1.js` to follow the newest stable release of Polaris version 1. Pin a release instead to control when your app moves.

You can also manually add Polaris in any framework by adding the following script tag to your app's HTML head:

##### HTML

```html
<head>
  <meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />
  <script src="https://cdn.shopify.com/shopifycloud/polaris-1.js"></script>
</head>
```

##### Remix

```tsx
// app/root.tsx
export default function App() {
  return (
    <html>
      <head>
        <meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />
        <script src="https://cdn.shopify.com/shopifycloud/polaris-1.js" />
      </head>
    </html>
  );
}
```

### Apps built from the React Router template

Apps scaffolded by [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) don't have a script tag to edit. The `AppProvider` component from [`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router) renders the App Bridge and Polaris script tags for you, and your app's document responses carry a `Link` header that preloads the Polaris script. Set the release you want in both places, and keep them the same: if they disagree, the browser downloads a file your app never runs.

##### React Router

```tsx
// app/routes/app.tsx
<AppProvider
  apiKey={apiKey}
  polarisUrl="https://cdn.shopify.com/shopifycloud/polaris-1.0.js"
>
  <Outlet />
</AppProvider>
```

##### Server configuration

```ts
// app/shopify.server.ts
const shopify = shopifyApp({
  // ...
  polarisUrl: 'https://cdn.shopify.com/shopifycloud/polaris-1.0.js',
});
```

Both options are optional, and both default to the unversioned `polaris.js` entry point, so an app that sets neither behaves exactly as it does today. They require `@shopify/shopify-app-react-router` 2.1.0 or later.

The following table shows the different options for configuring your script tag and the version of the library that is served.

| Script tag | Serves | Notes |
| - | - | - |
| `polaris-1.js` | The newest stable release in Polaris 1, currently 1.0 | Advances each time a new 1.x release goes stable |
| `polaris-1.1-rc.js` | The 1.1 release candidate | Accumulates compatible changes and bug fixes until 1.1 goes stable |
| `polaris-1.1.js` | Polaris 1.1, once its release candidate is promoted | Security fixes only |
| `polaris-1.0.js` | Polaris 1.0, released in 2025 | Frozen as released |
| `polaris.js` | The legacy unversioned entry point, currently 1.0 | Advances to 1.1 when 1.1 goes stable, then tracks 1.x. Never serves 2.x |

### Stable releases and release candidates

For production, we recommend the stable channel, `polaris-1.js`. It always serves the newest stable release in Polaris 1, so bug fixes, accessibility improvements, and new components reach your app without a script-tag change.

Each stable release is also published at its own URL, like `polaris-1.0.js` and, once 1.1 is promoted, `polaris-1.1.js`. Published stable versions are immutable except for critical security fixes, ensuring that your app continues using the version of the library you tested against. If you need to control exactly when your app moves, name a specific version instead of the channel.

Promotion doesn't update the release candidate URL in place. The stable release publishes at its own URL instead, so moving to it is a change you make in your app's code: update the script tag to `polaris-1.1.js` for that release, or to `polaris-1.js` to follow the channel.

For the fuller story on how Polaris is versioned on the CDN, see [The Polaris CDN is adopting semantic versioning](https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning).

***

## Available components

## Actions

Action components let users trigger events, perform tasks, and navigate through the interface.

[![Button](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/button-CdGXJjN3.png)![Button](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/button-CdGXJjN3.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button)

[Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button)

[Trigger actions or events, such as submitting forms, opening dialogs, or navigating to other pages.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button)

[![Button group](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/buttongroup-cu3ttjUi.png)![Button group](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/buttongroup-cu3ttjUi.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group)

[Button group](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group)

[Display multiple buttons in a layout.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button-group)

[![Clickable](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/clickable-Bed6GEzq.png)![Clickable](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/clickable-Bed6GEzq.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable)

[Clickable](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable)

[Create custom interactive elements not achievable with Button or Link.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable)

[![Clickable chip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/clickable-chip-DZ4SAGYc.png)![Clickable chip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/clickable-chip-DZ4SAGYc.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable-chip)

[Clickable chip](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable-chip)

[Categorize or highlight content attributes with an interactive button.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/clickable-chip)

[![Link](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/link-BHZwxvD8.png)![Link](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/link-BHZwxvD8.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/link)

[Link](https://shopify.dev/docs/api/app-home/latest/web-components/actions/link)

[Make text interactive for navigating to other pages or performing actions.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/link)

[![Menu](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/menu-70pxKMNc.png)![Menu](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/menu-70pxKMNc.png)](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu)

[Menu](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu)

[Display a list of actions that can be performed on a resource.](https://shopify.dev/docs/api/app-home/latest/web-components/actions/menu)

## Feedback and status indicators

Feedback and status indicators display information about the status of resources and actions.

[![Badge](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/badge-SrJGEQW5.png)![Badge](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/badge-SrJGEQW5.png)](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge)

[Badge](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge)

[Inform users about the status of a resource or indicate that an action has been completed.](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge)

[![Banner](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/banner-CSc2_A0f.png)![Banner](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/banner-CSc2_A0f.png)](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner)

[Banner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner)

[Highlight important information or required actions prominently within the interface.](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/banner)

[![Spinner](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/spinner-Bw4zIb82.png)![Spinner](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/spinner-Bw4zIb82.png)](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner)

[Spinner](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner)

[Display an animated indicator showing users that content or actions are loading.](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/spinner)

## Forms

Form components capture user input with built-in validation and formatting.

[![Checkbox](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/checkbox-DFmfCiT4.png)![Checkbox](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/checkbox-DFmfCiT4.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox)

[Checkbox](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox)

[Give users a clear way to make selections, such as agreeing to terms or choosing multiple items.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox)

[![Choice list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/choicelist-B2TfAN9x.png)![Choice list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/choicelist-B2TfAN9x.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list)

[Choice list](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list)

[Present multiple options for single or multiple selections.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/choice-list)

[![Color field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/color-field-7dgfIQZ-.png)![Color field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/color-field-7dgfIQZ-.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-field)

[Color field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-field)

[Let users select a color with a color picker or as a text input.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-field)

[![Color picker](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/color-picker-Bqlxgb4e.png)![Color picker](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/color-picker-Bqlxgb4e.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker)

[Color picker](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker)

[Let users select a color from a color palette.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker)

[![Date field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/datefield-PzzMeGH0.png)![Date field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/datefield-PzzMeGH0.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-field)

[Date field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-field)

[Let users select a specific date with a date picker.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-field)

[![Date picker](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/datepicker-DUgxVSZB.png)![Date picker](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/datepicker-DUgxVSZB.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-picker)

[Date picker](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-picker)

[Let users select a specific date or date range.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/date-picker)

[![Drop zone](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/dropzone-AQpi4uGt.png)![Drop zone](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/dropzone-AQpi4uGt.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone)

[Drop zone](https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone)

[Let users upload files through drag-and-drop functionality or by activating a button.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/drop-zone)

[![Email field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/emailfield-vytm1uVt.png)![Email field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/emailfield-vytm1uVt.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field)

[Email field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field)

[Let users enter email addresses with optimized keyboard settings.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/email-field)

[![Money field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/moneyfield-DbKmvaH-.png)![Money field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/moneyfield-DbKmvaH-.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field)

[Money field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field)

[Collect monetary values from users with built-in currency formatting and validation.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/money-field)

[![Number field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/numberfield-DD00ugG1.png)![Number field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/numberfield-DD00ugG1.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field)

[Number field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field)

[Collect numerical values from users with optimized keyboard settings and built-in validation.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/number-field)

[![Password field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/passwordfield-BE-5DANJ.png)![Password field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/passwordfield-BE-5DANJ.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/password-field)

[Password field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/password-field)

[Securely collect sensitive information from users.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/password-field)

[![Search field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/searchfield-FQ17iQis.png)![Search field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/searchfield-FQ17iQis.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/search-field)

[Search field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/search-field)

[Let users enter search terms using a single-line input field.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/search-field)

[![Select](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/select-CQdXi2Yt.png)![Select](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/select-CQdXi2Yt.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/select)

[Select](https://shopify.dev/docs/api/app-home/latest/web-components/forms/select)

[Let users pick one option from a menu.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/select)

[![Switch](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/switch-DE4Jf452.png)![Switch](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/switch-DE4Jf452.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch)

[Switch](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch)

[Give users a clear way to toggle options on or off.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/switch)

[![Text area](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/textarea-DSTYqCxX.png)![Text area](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/textarea-DSTYqCxX.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area)

[Text area](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area)

[Collect longer text content from users with a multi-line input.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-area)

[![Text field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/textfield-D5zp62-y.png)![Text field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/textfield-D5zp62-y.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field)

[Text field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field)

[Let users enter or edit text within a single-line input.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/text-field)

[![URL field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/urlfield-RWo1-vx2.png)![URL field](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/urlfield-RWo1-vx2.png)](https://shopify.dev/docs/api/app-home/latest/web-components/forms/url-field)

[URL field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/url-field)

[Collect URLs from users with built-in formatting and validation.](https://shopify.dev/docs/api/app-home/latest/web-components/forms/url-field)

## Layout and structure

Layout components create consistent visual hierarchy and organize content into clear structures.

[![Box](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/box-CO_V79Xi.png)![Box](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/box-CO_V79Xi.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box)

[Box](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box)

[Provide a flexible container for custom designs not achievable with existing components.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box)

[![Divider](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/divider-CvqN_5Pv.png)![Divider](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/divider-CvqN_5Pv.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider)

[Divider](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider)

[Create clear visual separation between elements.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/divider)

[![Grid](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/grid-BsFCiU5f.png)![Grid](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/grid-BsFCiU5f.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid)

[Grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid)

[Organize content in a matrix of rows and columns for responsive layouts.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid)

[![Ordered list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/ordered-list-DkWPfrjo.png)![Ordered list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/ordered-list-DkWPfrjo.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list)

[Ordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list)

[Display a numbered list of related items in a specific sequence.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/ordered-list)

[![Page](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/page-ZjQ0PRv6.png)![Page](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/page-ZjQ0PRv6.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page)

[Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page)

[Use as the main container for placing content in your app with preset layouts and automatic spacing between elements.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page)

[![Query container](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/querycontainer-MHu2kB_y.png)![Query container](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/querycontainer-MHu2kB_y.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/query-container)

[Query container](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/query-container)

[Establish a query container for responsive design.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/query-container)

[![Section](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/section-C8sCHOz2.png)![Section](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/section-C8sCHOz2.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section)

[Section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section)

[Group related content into clearly-defined thematic areas.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section)

[![Stack](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/stack-B6pqB8LL.png)![Stack](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/stack-B6pqB8LL.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack)

[Stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack)

[Organize elements horizontally or vertically along the block or inline axis.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack)

[![Table](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/table-yQvi0Pxe.png)![Table](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/table-yQvi0Pxe.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table)

[Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table)

[Display data clearly in rows and columns for viewing, analyzing, and comparing information.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table)

[![Unordered list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/unordered-list-HLaM9fir.png)![Unordered list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/unordered-list-HLaM9fir.png)](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list)

[Unordered list](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list)

[Display a bulleted list of related items.](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/unordered-list)

## Media and visuals

Media and visual components display images, icons, and visual elements that enhance the interface.

[![Avatar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/avatar-BVCHBUf6.png)![Avatar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/avatar-BVCHBUf6.png)](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar)

[Avatar](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar)

[Show a user's profile image or initials in a compact, visual element.](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/avatar)

[![Icon](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/icon-a6puDp7d.png)![Icon](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/icon-a6puDp7d.png)](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon)

[Icon](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon)

[Render a graphic symbol to visually communicate core parts of the interface and available actions.](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon)

[![Image](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/image-BLpC50N2.png)![Image](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/image-BLpC50N2.png)](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image)

[Image](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image)

[Embed an image within the interface and control its presentation.](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image)

[![Thumbnail](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/thumbnail-DE81GcQz.png)![Thumbnail](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/thumbnail-DE81GcQz.png)](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail)

[Thumbnail](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail)

[Display a small preview image representing content, products, or media.](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/thumbnail)

## Overlays

Overlay components display content above the page in focused, contextual layers.

[![Modal](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/modal-aqMwo-O7.png)![Modal](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/modal-aqMwo-O7.png)](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal)

[Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal)

[Display content in a focused overlay that blocks page interaction until dismissed.](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal)

[![Popover](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/popover-Dkr0w69r.png)![Popover](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/popover-Dkr0w69r.png)](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover)

[Popover](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover)

[Display content in an overlay anchored to a trigger element without blocking page interaction.](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/popover)

## Typography and content

Typography components display and format text content with consistent styling.

[![Chip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/chip-BfsVHJqK.png)![Chip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/chip-BfsVHJqK.png)](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip)

[Chip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip)

[Represent user-supplied keywords that help label, organize, and categorize objects.](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip)

[![Heading](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/heading-D2zFK9OA.png)![Heading](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/heading-D2zFK9OA.png)](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading)

[Heading](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading)

[Render hierarchical titles to communicate the structure and organization of page content.](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/heading)

[![Paragraph](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/paragraph-BpokbBlU.png)![Paragraph](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/paragraph-BpokbBlU.png)](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph)

[Paragraph](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph)

[Display a block of text that can contain inline elements such as buttons, links, or emphasized text.](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/paragraph)

[![Text](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/text-Dd2oqkHC.png)![Text](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/text-Dd2oqkHC.png)](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text)

[Text](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text)

[Display inline text with specific visual styles or tones.](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/text)

[![Tooltip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/tooltip-BXzVy986.png)![Tooltip](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/components/tooltip-BXzVy986.png)](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip)

[Tooltip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip)

[Display helpful information in a small overlay when users hover or focus on an element.](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/tooltip)

***
