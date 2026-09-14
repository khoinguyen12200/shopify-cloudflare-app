---
title: App Home
description: >-
  The App Home is the area in the Shopify admin where your apps open and is the
  main surface through which merchants use your app. Your app interacts with
  other parts of Shopify admin using a JavaScript SDK called App Bridge.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest'
  md: 'https://shopify.dev/docs/api/app-home/latest.md'
api_name: app-home
---

Polaris is now versioned

The Polaris web component library for App Home (iframe) apps is now versioned. Version 1.0 is the latest stable version, and version 1.1 is the current release candidate. To learn more about the new library versioning, as well as [what's new in the release candidate](https://shopify.dev/changelog/polaris-cdn-1-1-release-candidate), see [The Polaris CDN is adopting semantic versioning](https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning).

# App Home iframe apps

App Home is a dedicated area in [Shopify admin](https://shopify.dev/docs/apps/build/admin) for your app to render its landing page and UI. Merchants use the UI in this space to navigate to your app's other pages, open modals and workflows, and access your app's data.

Your app communicates with other parts of Shopify admin using a JavaScript SDK called App Bridge and renders UI inside an iframe using web components. By using App Bridge together with the web components from Shopify's Polaris design system, you can build performant apps using familiar web technologies.

## Getting started

**Info:**

There are two ways to build for App Home: iframe-based apps (covered in this reference) and [App Home UI extensions](https://shopify.dev/docs/api/app-home-ui-extension/latest). To learn more about which option is right for your use case, see [Apps in App Home](https://shopify.dev/docs/apps/build/app-home).

To start building your first app in App Home, scaffold an app using the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli). When prompted to choose the type of app you want to build, select **Build a React Router app**.

The command creates an app framework that includes all of the Shopify App Bridge and Polaris libraries you need to build your own Shopify app in App Home.

## Generate scaffold

```terminal
cd my-app
shopify app init
```

[Tutorial - Getting started with App Home](https://shopify.dev/docs/apps/build/scaffold-app)

***

## Building your app

When you open your app, its landing page is rendered in the App Home area of the Shopify admin. For merchants to use your app's features, you provide UI elements on this landing page like buttons, menus, and forms.

To add these UI elements inside the App Home, we recommend you use Polaris web components. Using Polaris ensures that your app looks and behaves like the rest of the Shopify admin. If you want to build your own UI elements, you can also use any framework and custom HTML elements you want, including vanilla JavaScript, React, or Vue.

The App Home area in Shopify admin is implemented as an iframe. To interact with other [Shopify admin](https://shopify.dev/docs/apps/build/admin) components outside this iframe, apps in App Home use Shopify's App Bridge JavaScript SDK.

Use App Bridge APIs to communicate with Shopify admin, and App Bridge web components to add UI elements such as title bars and navigation menus to other parts of Shopify admin outside the app's iframe.

![App Bridge web components example](https://shopify.dev/assets/assets/images/api/app_home/overview-all-reBhP-jU.png)

[Tutorial - Building your first app](https://shopify.dev/docs/apps/build/build?framework=reactRouter)

### Web components

You add UI to your app using web components. Shopify provides a set of components which match the [Shopify design system](https://shopify.dev/docs/apps/design) in its Polaris library. With these native UI elements, you can create consistent, accessible, and performant user interfaces that match the rest of the Shopify admin.

Because Polaris components are built on the [Web Components standard](https://developer.mozilla.org/en-US/docs/Web/Web_Components), they work like native HTML elements. You can use them in any framework or with vanilla JavaScript, just like you would a `<button>` or `<input>`.

For TypeScript users, Shopify provides a companion npm library for Polaris web components types, available at [`@shopify/polaris-types`](https://www.npmjs.com/package/@shopify/polaris-types). You can install this library in your project using `yarn` or `npm`. Match the package to the version your script loads. See [Versioning](#versioning) to learn more.

[Reference - Explore all Polaris web components](https://shopify.dev/docs/api/app-home/v1.0/web-components)

## Render a page in App Home

```jsx
export default function App() {
  return (
    <s-page heading="My App">
      <s-section heading="Welcome">
        <s-paragraph>
          Welcome to your Shopify app! Start building the main interface here.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
```

![Polaris web components example](https://shopify.dev/assets/assets/images/api/app_home/overview-polaris-DA2IBNR-.png)

### APIs

Your app uses APIs to read information from Shopify admin, launch workflows like creating products or editing orders, and provide feedback to merchants through toasts and modals. The APIs in Shopify's App Bridge library provide this functionality through the `shopify` global variable.

When the App Bridge script is included in your app, you don't need to set up or configure any additional authentication to use these APIs. Your app runs inside an authenticated session in Shopify admin, so you don't need to manage tokens or headers yourself.

Apps scaffolded with Shopify CLI already include the App Bridge script, so you don't need to add it manually.

For TypeScript users, Shopify provides a companion npm library for App Bridge types, available at [`@shopify/app-bridge-types`](https://www.npmjs.com/package/@shopify/app-bridge-types). You can install this library in your project using `yarn` or `npm`. Loading App Bridge in your app from [cdn.shopify.com/shopifycloud/app-bridge.js](https://cdn.shopify.com/shopifycloud/app-bridge.js) installs the latest version of the library. App Bridge isn't versioned with Polaris, so this is the same library in every version of this reference. To keep your types in step, specify `@shopify/app-bridge-types@latest` in your `package.json` file.

[Reference - App Bridge APIs reference](https://shopify.dev/docs/api/app-home/v1.0/apis)

## Retrive session token to authenticate with your backend

```jsx
export default function App() {
  const syncProducts = async () => {
    const token = await shopify.idToken();


    await fetch('/api/sync-products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  };


  return (
    <button onClick={syncProducts}>Sync products</button>
  );
}
```

### App Bridge web components

With App Bridge web components you can add UI elements like title bars and navigation menus to the main Shopify admin area outside of your app's iframe.

[Reference - App Bridge web components reference](https://shopify.dev/docs/api/app-home/v1.0/app-bridge-web-components)

## Render a title bar and navigation menu

```jsx
import {TitleBar, NavMenu} from '@shopify/app-bridge-react';


export default function App() {
  return (
    <>
      <TitleBar title="Product Details" subtitle="SKU: ABC-123" />
      <NavMenu>
        <a href="/">Home</a>
        <a href="/products">Products</a>
        <a href="/settings">Settings</a>
      </NavMenu>
    </>
  );
}
```

![App Bridge web components example](https://shopify.dev/assets/assets/images/api/app_home/overview-app-bridge-BZa9Gkcc.png)

***

## Versioning

The Polaris web component library for App Home (iframe) is versioned. You specify the version of the Polaris library your app uses by using the [script tag](https://shopify.dev/docs/api/app-home/latest/web-components#adding-polaris-to-your-app) in your app's HTML head.

When you scaffold your app using [Shopify CLI](https://shopify.dev/docs/api/shopify-cli), it's set up with `polaris-1.js`, which follows the newest stable release of Polaris version 1. Pin a release instead to control when your app moves.

Apps built from the React Router template don't have a script tag to edit. The `AppProvider` component from [`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router) renders it for you, and you choose the release with its `polarisUrl` prop. Set the same URL in the `polarisUrl` option of `shopifyApp()`, so that the preload hint on your document responses points at the file your app loads. Both options require `@shopify/shopify-app-react-router` 2.1.0 or later. See [Adding Polaris to your app](https://shopify.dev/docs/api/app-home/latest/web-components#adding-polaris-to-your-app) for an example.

There's no versioning for App Bridge. Adding the App Bridge [script tag](https://shopify.dev/docs/api/app-home/latest/apis#adding-app-bridge-to-your-app) in your app's HTML head ensures that you're always using the latest version of the library.

### Type​Script packages

For TypeScript users, Shopify publishes the [@shopify/polaris-types](https://www.npmjs.com/package/@shopify/polaris-types) package. Match the package version to the release your app loads, so that your types describe the components your app actually renders: a `1.0` build for `polaris-1.0.js`, or the newest `1.x` build if you follow `polaris-1.js`.

***

## Page patterns

We've created page templates for common patterns like landing pages and settings pages, so your app looks and behaves consistently with the Shopify admin and meets [Built for Shopify](https://shopify.dev/docs/apps/launch/built-for-shopify) standards.

We've also created UI compositions (combinations of Polaris web components and APIs) you can add to your app's pages for common needs like data tables, empty states, and setup flows.

[Reference - App Home page patterns](https://shopify.dev/docs/api/app-home/v1.0/patterns)

[Reference - Built for Shopify](https://shopify.dev/docs/apps/launch/built-for-shopify)

***

## Direct API access

Your app can query the Shopify [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) directly from its front-end code using the standard `fetch()` API.

For example, you can use direct API access to load product or order data when a merchant navigates to a page, or to display real-time inventory levels in your app's UI.

App Bridge automatically authenticates these requests, so you don't need to manage tokens or headers yourself. Use the `shopify:admin/api/graphql.json` URL to make authenticated requests to the Admin GraphQL API.

[Reference - Resource Fetching API](https://shopify.dev/docs/api/app-home/v1.0/apis/authentication-and-data/resource-fetching-api)

## Query Shopify data

```jsx
async function getProducts() {
  const response = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query {
          products(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `,
    }),
  });
  const { data } = await response.json();
  return data.products.edges;
}
```

***

## Configuration

You define your app's configuration in the `shopify.app.toml` file. This file controls how your app authenticates, what data it can access, and how it integrates with Shopify admin.

When you scaffold your app using Shopify CLI, a `shopify.app.toml` configuration file with some basic settings is created for you. You can give your app permissions to access Shopify data and to make direct calls to the Admin GraphQL API by editing this file.

## Configure your app

```toml
# Add these settings to shopify.app.toml to control API access and scopes
[access_scopes]
scopes = "read_products,write_products"


[access.admin]
embedded_app_direct_api_access = true
direct_api_mode = "online"
```

### Access scopes

Access scopes define what Shopify data your app can read or write using the Admin GraphQL API. You must declare the scopes your app needs before you can query the Admin API.

When merchants install your app, they're prompted to approve these permissions. Request only the scopes your app actually needs.

### Direct API access

For your app to make direct calls to the Admin GraphQL API, you need to enable direct API access in your configuration file using the `embedded_app_direct_api_access` property.

Direct API access can use either online or offline access tokens. Online tokens are tied to the current user session, while offline tokens persist and work for background jobs.

Use the `direct_api_mode` property in your configuration to control which mode your app uses.

[Reference - Access scopes reference](https://shopify.dev/docs/api/usage/access-scopes)

[Reference - App configuration reference](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

***

## Testing and deployment

Shopify CLI provides a set of tools to help you test and deploy your app.

### Local development

To run your app locally during development, start a dev server using Shopify CLI. This command creates a tunnel so Shopify can reach your local app.

## Start development server

```terminal
shopify app dev
```

Your app opens in your development store where you can test changes in real time. The CLI watches for file changes and automatically reloads your app.

### Deployment

When you're ready to go live, deploy your app, and then sync your app to Shopify using Shopify CLI.

Deploy your app to a hosting service like Google Cloud Run, Fly.io, or Render. This is where your app runs and handles requests from Shopify.

Using the Shopify CLI `deploy` command then syncs your app configuration and extensions to Shopify so that merchants can install your app.

## Deploy your app

```terminal
shopify app deploy
```

[Reference - Test apps locally](https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally)

[Reference - Deployment guide](https://shopify.dev/docs/apps/launch/deployment)

***

## Resources

[Getting started tutorial\
\
](https://shopify.dev/docs/apps/build/scaffold-app)

[Create your first Shopify app using the CLI scaffold.](https://shopify.dev/docs/apps/build/scaffold-app)

[Build your first app\
\
](https://shopify.dev/docs/apps/build/build?framework=reactRouter)

[Build out your first Shopify app from the scaffolded template.](https://shopify.dev/docs/apps/build/build?framework=reactRouter)

[App design guidelines\
\
](https://shopify.dev/docs/apps/design)

[Follow our UX guidelines to build apps that are predictable and easy to use.](https://shopify.dev/docs/apps/design)

[Developer changelog\
\
](https://shopify.dev/changelog)

[Stay up to date with the latest changes to Shopify APIs and tools.](https://shopify.dev/changelog)

[Developer community\
\
](https://community.shopify.dev)

[Connect with other developers and get help with your questions.](https://community.shopify.dev)

***
