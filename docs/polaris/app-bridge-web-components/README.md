---
title: App Bridge web components
description: >-
  While Web components build the UI inside your app's iframe, App Bridge web
  components control parts of the Shopify admin that surround it. Use them to
  add navigation menus, configure page titles, and manage save bar behavior so
  your app feels native to merchants.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components'
  md: 'https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components.md'
api_name: app-home
---

# App Bridge web components

**Info:**

App Bridge isn't versioned with Polaris. App Bridge APIs and web components are identical in every App Home reference version.

While [Web components](https://shopify.dev/docs/api/app-home/latest/web-components) build the UI inside your app's iframe, App Bridge web components control parts of the Shopify admin that surround it. Use them to add navigation menus, configure page titles, and manage save bar behavior so your app feels native to merchants.

### Adding App Bridge web components to your app

When you scaffold your app using [Shopify CLI](https://shopify.dev/docs/api/shopify-cli), the App Bridge library is added to your app automatically. You can also manually add App Bridge in any framework by adding the following script tag to your app's HTML head:

##### HTML

```html
<head>
  <meta name="shopify-api-key" content="%SHOPIFY_API_KEY%" />
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
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
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
    </html>
  );
}
```

For TypeScript users, Shopify provides a companion npm library for App Bridge types, available at [`@shopify/app-bridge-types`](https://www.npmjs.com/package/@shopify/app-bridge-types). You can install this library in your project using `yarn` or `npm`. Loading App Bridge in your app from [cdn.shopify.com/shopifycloud/app-bridge.js](https://cdn.shopify.com/shopifycloud/app-bridge.js) installs the latest version of the library. To keep your types in step, specify `@shopify/app-bridge-types@latest` in your `package.json` file.

***

## Available components

[![App nav](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/apps/tools/app-bridge-navigation-menu-DdMXEPrX.png)![App nav](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/apps/tools/app-bridge-navigation-menu-DdMXEPrX.png)](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav)

[App nav](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav)

[Create a navigation menu so merchants can browse between pages in your app.](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-nav)

[![App window](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/s-app-window-jyBt5mAs.png)![App window](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/s-app-window-jyBt5mAs.png)](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-window)

[App window](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-window)

[Open a fullscreen modal window to display pages from your app for larger or complex workflows.](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/app-window)

[![Title bar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/title-bar-app-home-alt-zV-YTElN.png)![Title bar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/title-bar-app-home-alt-zV-YTElN.png)](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar)

[Title bar](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar)

[Configure the admin title bar to display your app's page title, primary and secondary actions, and breadcrumb navigation.](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/title-bar)

[![Save bar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/forms-DcWg4gCD.png)![Save bar](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/app-bridge-web-components/forms-DcWg4gCD.png)](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar)

[Save bar](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar)

[Enable automatic save bar integration for HTML forms by adding the data-save-bar attribute to your form element.](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar)

***
