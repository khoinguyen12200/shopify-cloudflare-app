---
title: Account connection
description: >-
  Many apps integrate with external services like marketing platforms, sales
  channels, or analytics providers. The account connection composition gives
  merchants a clear interface to connect or disconnect these integrations.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection.md
api_name: app-home
---

# Account connection

Many apps integrate with external services like marketing platforms, sales channels, or analytics providers. The account connection composition gives merchants a clear interface to connect or disconnect these integrations.

Display connection status, the connected account name, and provide actions to connect or disconnect. Place this composition in your settings or on a dedicated integrations page.

### Related Components (6) APIs (2) Templates (1)

### Supported components

* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)

### Available APIs

* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Settings](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/settings)

#### Use cases

* Displaying connection status for sales channels or platforms
* Allowing merchants to connect or disconnect external accounts
* Integrating with marketing, social, or fulfillment services

***

## Examples

### Display connection status with connect button and terms

Merchants need to connect or disconnect external services (e.g. marketing platforms, sales channels) from your app. This pattern displays account connection layout with a connect button and terms. The [grid](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/grid) aligns account information and button, the [section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section) provides padding, and the terms text below describes the connection agreement.

##### jsx

```tsx
<s-section>
  <s-stack gap="base">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-grid-item>
        <s-stack>
          <s-heading>Puzzlify</s-heading>
          <s-text color="subdued">No account connected</s-text>
        </s-stack>
      </s-grid-item>
      <s-grid-item>
        <s-button variant="primary">Connect</s-button>
      </s-grid-item>
    </s-grid>
    <s-text>
      By clicking Connect, you agree to accept Sample App's terms and
      conditions. You'll pay a commission rate of 15% on sales made through
      Sample App.
    </s-text>
  </s-stack>
</s-section>
```

##### html

```html
<s-section>
  <s-stack gap="base">
  <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
    <s-grid-item>
      <s-stack>
        <s-heading>Puzzlify</s-heading>
        <s-text color="subdued">No account connected</s-text>
      </s-stack>
    </s-grid-item>
    <s-grid-item>
      <s-button variant="primary">Connect</s-button>
    </s-grid-item>
  </s-grid>
  <s-text>By clicking Connect, you agree to accept Sample App's terms and conditions. You'll pay a commission rate of 15% on sales made through Sample App.</s-text>
</s-stack>
</s-section>
```

### Confirm disconnect with Modal

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm account disconnection before removing the integration.

##### jsx

```tsx
<s-section>
  <s-stack gap="base">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-grid-item>
        <s-stack>
          <s-heading>Puzzlify</s-heading>
          <s-text color="subdued">Connected as puzzles@example.com</s-text>
        </s-stack>
      </s-grid-item>
      <s-grid-item>
        <s-button
          variant="secondary"
          tone="critical"
          commandFor="disconnect-modal"
          command="--show"
        >
          Disconnect
        </s-button>
      </s-grid-item>
    </s-grid>
    <s-text color="subdued">
      Your account has been connected since January 15, 2025.
    </s-text>
  </s-stack>

  <s-modal id="disconnect-modal" heading="Disconnect account?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to disconnect your Puzzlify account? You'll need to reconnect to continue syncing data.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          Any pending syncs will be cancelled and your integration settings will be removed.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      commandFor="disconnect-modal"
      command="--hide"
    >
      Disconnect
    </s-button>
    <s-button
      slot="secondary-actions"
      commandFor="disconnect-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-section>
```

##### html

```html
<s-section>
  <s-stack gap="base">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-grid-item>
        <s-stack>
          <s-heading>Puzzlify</s-heading>
          <s-text color="subdued">Connected as puzzles@example.com</s-text>
        </s-stack>
      </s-grid-item>
      <s-grid-item>
        <s-button
          variant="secondary"
          tone="critical"
          commandFor="disconnect-modal"
          command="--show"
        >
          Disconnect
        </s-button>
      </s-grid-item>
    </s-grid>
    <s-text color="subdued">
      Your account has been connected since January 15, 2025.
    </s-text>
  </s-stack>

  <s-modal id="disconnect-modal" heading="Disconnect account?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to disconnect your Puzzlify account? You'll need to reconnect to continue syncing data.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          Any pending syncs will be cancelled and your integration settings will be removed.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      commandFor="disconnect-modal"
      command="--hide"
    >
      Disconnect
    </s-button>
    <s-button
      slot="secondary-actions"
      commandFor="disconnect-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-section>
```

### Show connection feedback with Toast

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when an account is connected or disconnected.

##### jsx

```tsx
<s-section>
  <s-stack gap="base">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-grid-item>
        <s-stack>
          <s-heading>Puzzlify</s-heading>
          <s-text color="subdued">No account connected</s-text>
        </s-stack>
      </s-grid-item>
      <s-grid-item>
        <s-button
          variant="primary"
          onClick={() => {
            shopify.toast.show('Account connected successfully');
          }}
        >
          Connect
        </s-button>
      </s-grid-item>
    </s-grid>
    <s-text>
      By clicking Connect, you agree to accept Sample App's terms and
      conditions. You'll pay a commission rate of 15% on sales made through
      Sample App.
    </s-text>
  </s-stack>
</s-section>
```

##### html

```html
<s-section>
  <s-stack gap="base">
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-grid-item>
        <s-stack>
          <s-heading>Puzzlify</s-heading>
          <s-text color="subdued">No account connected</s-text>
        </s-stack>
      </s-grid-item>
      <s-grid-item>
        <s-button variant="primary">Connect</s-button>
      </s-grid-item>
    </s-grid>
    <s-text>
      By clicking Connect, you agree to accept Sample App's terms and
      conditions. You'll pay a commission rate of 15% on sales made through
      Sample App.
    </s-text>
  </s-stack>
</s-section>

<!-- 
Connect handler:
shopify.toast.show('Account connected successfully');
-->
```

***
