---
title: Settings
description: >-
  All apps have settings merchants need to configure to control your app's
  behavior. For React Router-based Shopify apps, this will be defined in a route
  file like app.settings.jsx.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings'
  md: 'https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings.md'
api_name: app-home
---

# Settings

All apps have settings merchants need to configure to control your app's behavior. For React Router-based Shopify apps, this will be defined in a route file like `app.settings.jsx`.

The settings template organizes related options into logical groups that provide contextual help alongside form controls. It also leverages the Save Bar API to protect unsaved changes from being lost.

The settings pattern follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines.

### Related Components (13) APIs (3) Compositions (3)

### Supported components

* [Badge](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/badge)
* [Banner](https://shopify.dev/docs/api/app-home/v1.0/web-components/feedback-and-status-indicators/banner)
* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Icon](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/icon)
* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Number field](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/number-field)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Switch](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/switch)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)

### Available APIs

* [Modal API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/modal-api)
* [Save Bar API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/save-bar-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended compositions

* [Account connection](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/account-connection)
* [Footer help](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/footer-help)
* [Interstitial nav](https://shopify.dev/docs/api/app-home/v1.0/patterns/compositions/interstitial-nav)

#### Use cases

* Configuring app behavior and preferences
* Managing notification settings and thresholds
* Organizing complex options into logical groups

***

## Examples

### Configure a settings page with toggles and contextual help

Merchants need to configure app behavior; the settings template groups options and protects unsaved changes. This example configures a settings page for a Product Quality Auditor app with quality criteria toggles, weight controls, and notification preferences in the main column and contextual help in the aside. Add `data-save-bar` to your form element to enable the [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api), which displays save/discard controls when the form has unsaved changes.

##### jsx

```tsx
// @validate-ignore: Argument of type 'EventTarget | null' is not assignable to parameter of type 'HTMLFormElement | undefined', Type 'null' is not assignable to type 'HTMLFormElement | undefined', Argument of type 'FormData' is not assignable to parameter of type 'Iterable<readonly [PropertyKey, any]>', Argument of type 'FormData' is not assignable to parameter of type 'Iterable<readonly any[]>'
<form
  data-save-bar
  onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const formEntries = Object.fromEntries(formData);
    console.log("Form data", formEntries);
  }}
  onReset={(event) => {
    console.log("Handle discarded changes if necessary");
  }}
>
      <s-page heading="Settings" inlineSize="small">
        {/* === */}
        {/* Store Information */}
        {/* === */}
        <s-section heading="Store Information">
          <s-text-field
            label="Store name"
            name="store-name"
            value="Puzzlify Store"
            placeholder="Enter store name"
          />
          <s-text-field
            label="Business address"
            name="business-address"
            value="123 Main St, Anytown, USA"
            placeholder="Enter business address"
          />
          <s-text-field
            label="Store phone"
            name="store-phone"
            value="+1 (555) 123-4567"
            placeholder="Enter phone number"
          />
          <s-choice-list label="Primary currency" name="currency">
            <s-choice value="usd" selected>
              US Dollar ($)
            </s-choice>
            <s-choice value="cad">Canadian Dollar (CAD)</s-choice>
            <s-choice value="eur">Euro (€)</s-choice>
          </s-choice-list>
        </s-section>

        {/* === */}
        {/* Notifications */}
        {/* === */}
        <s-section heading="Notifications">
          <s-select
            label="Notification frequency"
            name="notification-frequency"
          >
            <s-option value="immediately" selected>
              Immediately
            </s-option>
            <s-option value="hourly">Hourly digest</s-option>
            <s-option value="daily">Daily digest</s-option>
          </s-select>
          <s-choice-list
            label="Notification types"
            name="notifications-type"
            multiple
          >
            <s-choice value="new-order" selected>
              New order notifications
            </s-choice>
            <s-choice value="low-stock">Low stock alerts</s-choice>
            <s-choice value="customer-review">
              Customer review notifications
            </s-choice>
            <s-choice value="shipping-updates">Shipping updates</s-choice>
          </s-choice-list>
        </s-section>

        {/* === */}
        {/* Connected accounts */}
        {/* === */}
        <s-section heading="Connected accounts">
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

        {/* === */}
        {/* Preferences */}
        {/* === */}
        <s-section heading="Preferences">
          <s-box border="base" borderRadius="base">
            <s-clickable
              padding="small-100"
              href="/app/settings/shipping"
              accessibilityLabel="Configure shipping methods, rates, and fulfillment options"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Shipping & fulfillment</s-heading>
                  <s-paragraph color="subdued">
                    Shipping methods, rates, zones, and fulfillment preferences.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider />
            </s-box>

            <s-clickable
              padding="small-100"
              href="/app/settings/products_catalog"
              accessibilityLabel="Configure product defaults, customer experience, and catalog settings"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Products & catalog</s-heading>
                  <s-paragraph color="subdued">
                    Product defaults, customer experience, and catalog display
                    options.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider />
            </s-box>

            <s-clickable
              padding="small-100"
              href="/app/settings/customer_support"
              accessibilityLabel="Manage customer support settings and help resources"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Customer support</s-heading>
                  <s-paragraph color="subdued">
                    Support settings, help resources, and customer service
                    tools.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
          </s-box>
        </s-section>

        {/* === */}
        {/* Tools */}
        {/* === */}
        <s-section heading="Tools">
          <s-stack
            gap="none"
            border="base"
            borderRadius="base"
            overflow="hidden"
          >
            <s-box padding="small-100">
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Reset app settings</s-heading>
                  <s-paragraph color="subdued">
                    Reset all settings to their default values. This action
                    cannot be undone.
                  </s-paragraph>
                </s-box>
                <s-button tone="critical">Reset</s-button>
              </s-grid>
            </s-box>
            <s-box paddingInline="small-100">
              <s-divider />
            </s-box>

            <s-box padding="small-100">
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Export settings</s-heading>
                  <s-paragraph color="subdued">
                    Download a backup of all your current settings.
                  </s-paragraph>
                </s-box>
                <s-button>Export</s-button>
              </s-grid>
            </s-box>
          </s-stack>
      </s-section>
  
      {/* Footer help */}
      <s-stack alignItems="center" paddingBlock="large">
        <s-text color="subdued">
          Learn more about <s-link href="https://help.shopify.com" target="_blank">quality scoring best practices</s-link>.
        </s-text>
      </s-stack>
  </s-page>
</form>
```

##### html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
    <title>Pattern</title>
  </head>
  <body>
    <!-- === -->
    <!-- Settings page pattern -->
    <!-- === -->
    <form data-save-bar onSubmit="" onReset="">
      <s-page heading="Settings" inlineSize="small">
        <!-- === -->
        <!-- Store Information -->
        <!-- === -->
        <s-section heading="Store Information">
          <s-text-field
            label="Store name"
            name="store-name"
            value="Puzzlify Store"
            placeholder="Enter store name"
          ></s-text-field>
          <s-text-field
            label="Business address"
            name="business-address"
            value="123 Main St, Anytown, USA"
            placeholder="Enter business address"
          ></s-text-field>
          <s-text-field
            label="Store phone"
            name="store-phone"
            value="+1 (555) 123-4567"
            placeholder="Enter phone number"
          ></s-text-field>
          <s-choice-list label="Primary currency" name="currency">
            <s-choice value="usd" selected>US Dollar ($)</s-choice>
            <s-choice value="cad">Canadian Dollar (CAD)</s-choice>
            <s-choice value="eur">Euro (€)</s-choice>
          </s-choice-list>
        </s-section>
        <!-- === -->
        <!-- Notifications -->
        <!-- === -->
        <s-section heading="Notifications">
          <s-select
            label="Notification frequency"
            name="notification-frequency"
          >
            <s-option value="immediately" selected>Immediately</s-option>
            <s-option value="hourly">Hourly digest</s-option>
            <s-option value="daily">Daily digest</s-option>
          </s-select>
          <s-choice-list
            label="Notification types"
            name="notifications-type"
            multiple
          >
            <s-choice value="new-order" selected
              >New order notifications</s-choice
            >
            <s-choice value="low-stock">Low stock alerts</s-choice>
            <s-choice value="customer-review"
              >Customer review notifications</s-choice
            >
            <s-choice value="shipping-updates">Shipping updates</s-choice>
          </s-choice-list>
        </s-section>
        <!-- === -->
        <!-- Connected accounts -->
        <!-- === -->
        <s-section heading="Connected accounts">
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
        <!-- === -->
        <!-- Preferences -->
        <!-- === -->
        <s-section heading="Preferences">
          <s-box
            border="base"
            borderRadius="base"
          >
            <s-clickable
              padding="small-100"
              href="/app/settings/shipping"
              accessibilityLabel="Configure shipping methods, rates, and fulfillment options"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Shipping & fulfillment</s-heading>
                  <s-paragraph color="subdued">
                    Shipping methods, rates, zones, and fulfillment preferences.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right"></s-icon>
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider></s-divider>
            </s-box>
            <s-clickable
              padding="small-100"
              href="/app/settings/products_catalog"
              accessibilityLabel="Configure product defaults, customer experience, and catalog settings"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Products & catalog</s-heading>
                  <s-paragraph color="subdued">
                    Product defaults, customer experience, and catalog display
                    options.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right"></s-icon>
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider></s-divider>
            </s-box>
            <s-clickable
              padding="small-100"
              href="/app/settings/customer_support"
              accessibilityLabel="Manage customer support settings and help resources"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Customer support</s-heading>
                  <s-paragraph color="subdued">
                    Support settings, help resources, and customer service
                    tools.
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right"></s-icon>
              </s-grid>
            </s-clickable>
          </s-box>
        </s-section>
        <!-- === -->
        <!-- Tools -->
        <!-- === -->
        <s-section heading="Tools">
          <s-stack
            gap="none"
            border="base"
            borderRadius="base"
            overflow="hidden"
          >
            <s-box padding="small-100">
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Reset app settings</s-heading>
                  <s-paragraph color="subdued">
                    Reset all settings to their default values. This action
                    cannot be undone.
                  </s-paragraph>
                </s-box>
                <s-button tone="critical">Reset</s-button>
              </s-grid>
            </s-box>
            <s-box paddingInline="small-100">
              <s-divider></s-divider>
            </s-box>
            <s-box padding="small-100">
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Export settings</s-heading>
                  <s-paragraph color="subdued">
                    Download a backup of all your current settings.
                  </s-paragraph>
                </s-box>
                <s-button>Export</s-button>
              </s-grid>
            </s-box>
          </s-stack>
        </s-section>
      
      <!-- Footer help -->
      <s-stack alignItems="center" paddingBlock="large">
        <s-text color="subdued">
          Learn more about <s-link href="https://help.shopify.com" target="_blank">quality scoring best practices</s-link>.
        </s-text>
      </s-stack>
  </s-page>
    </form>
  </body>
</html>
```

### Confirm reset with Modal API

Use the [Modal API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/modal-api) to confirm destructive actions like resetting all settings to their default values.

##### jsx

```tsx
<s-grid justifyItems="center" alignItems="center" minBlockSize="200px">
  <s-box padding="small-100">
    <s-grid
      gridTemplateColumns="1fr auto"
      alignItems="center"
      gap="base"
    >
      <s-box>
        <s-heading>Reset app settings</s-heading>
        <s-paragraph color="subdued">
          Reset all settings to their default values. This action cannot be undone.
        </s-paragraph>
      </s-box>
      <s-button
        tone="critical"
        commandFor="reset-modal"
        command="--show"
      >
        Reset
      </s-button>
    </s-grid>
  </s-box>

  <s-modal id="reset-modal" heading="Reset all settings?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to reset all settings to their default values? This will clear all your customizations and cannot be undone.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          This will reset notification preferences, connected accounts, and all other configurations.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      onClick={() => {
        shopify.toast.show('Settings reset to defaults');
      }}
    >
      Reset settings
    </s-button>
    <s-button
      slot="secondary-actions"
      commandFor="reset-modal"
      command="--hide"
    >
      Cancel
    </s-button>
  </s-modal>
</s-grid>
```

##### html

```html
<s-grid justifyItems="center" alignItems="center" minBlockSize="200px">
  <s-box padding="small-100">
    <s-grid
      gridTemplateColumns="1fr auto"
      alignItems="center"
      gap="base"
    >
      <s-box>
        <s-heading>Reset app settings</s-heading>
        <s-paragraph color="subdued">
          Reset all settings to their default values. This action cannot be undone.
        </s-paragraph>
      </s-box>
      <s-button
        tone="critical"
        commandFor="reset-modal"
        command="--show"
      >Reset</s-button>
    </s-grid>
  </s-box>

  <s-modal id="reset-modal" heading="Reset all settings?">
    <s-stack direction="block" gap="base">
      <s-text>
        Are you sure you want to reset all settings to their default values? This will clear all your customizations and cannot be undone.
      </s-text>
      <s-banner tone="warning">
        <s-text>
          This will reset notification preferences, connected accounts, and all other configurations.
        </s-text>
      </s-banner>
    </s-stack>
    <s-button
      slot="primary-action"
      variant="primary"
      tone="critical"
      onClick="shopify.toast.show('Settings reset to defaults')"
    >Reset settings</s-button>
    <s-button
      slot="secondary-actions"
      commandFor="reset-modal"
      command="--hide"
    >Cancel</s-button>
  </s-modal>
</s-grid>
```

### Show save feedback with Toast API

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when settings are saved. Combine with the Save Bar API for a complete form experience.

##### jsx

```tsx
// @validate-ignore: Argument of type 'EventTarget | null' is not assignable to parameter of type 'HTMLFormElement | undefined', Type 'null' is not assignable to type 'HTMLFormElement | undefined', Argument of type 'FormData' is not assignable to parameter of type 'Iterable<readonly [PropertyKey, any]>', Argument of type 'FormData' is not assignable to parameter of type 'Iterable<readonly any[]>'
<form
  data-save-bar
  onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const formEntries = Object.fromEntries(formData);
    console.log("Form data", formEntries);
    shopify.toast.show('Settings saved successfully');
  }}
  onReset={(event) => {
    console.log("Handle discarded changes if necessary");
  }}
>
  <s-section heading="Notifications">
    <s-select
      label="Notification frequency"
      name="notification-frequency"
    >
      <s-option value="immediately" selected>Immediately</s-option>
      <s-option value="hourly">Hourly digest</s-option>
      <s-option value="daily">Daily digest</s-option>
    </s-select>
    <s-choice-list
      label="Notification types"
      name="notifications-type"
      multiple
    >
      <s-choice value="new-order" selected>New order notifications</s-choice>
      <s-choice value="low-stock">Low stock alerts</s-choice>
      <s-choice value="customer-review">Customer review notifications</s-choice>
    </s-choice-list>
  </s-section>
</form>
```

##### html

```html
<script>
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const formEntries = Object.fromEntries(formData);
    console.log("Form data", formEntries);
    shopify.toast.show('Settings saved successfully');
  }
  function handleReset(event) {
    console.log("Handle discarded changes if necessary");
  }
</script>
<form
  data-save-bar
  onSubmit="handleSubmit(event)"
  onReset="handleReset(event)"
>
  <s-section heading="Notifications">
    <s-select
      label="Notification frequency"
      name="notification-frequency"
    >
      <s-option value="immediately" selected>Immediately</s-option>
      <s-option value="hourly">Hourly digest</s-option>
      <s-option value="daily">Daily digest</s-option>
    </s-select>
    <s-choice-list
      label="Notification types"
      name="notifications-type"
      multiple
    >
      <s-choice value="new-order" selected>New order notifications</s-choice>
      <s-choice value="low-stock">Low stock alerts</s-choice>
      <s-choice value="customer-review">Customer review notifications</s-choice>
    </s-choice-list>
  </s-section>
</form>
```

***
