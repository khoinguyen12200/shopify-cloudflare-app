---
title: Patterns
description: >-
  Most apps include common pages like landing and settings pages, which appear
  in the App Home iframe. There are two types of patterns for building those
  pages — templates for full page layouts and compositions for smaller groupings
  of web components that solve specific tasks.
api_version: v1.0
source_url:
  html: 'https://shopify.dev/docs/api/app-home/latest/patterns'
  md: 'https://shopify.dev/docs/api/app-home/latest/patterns.md'
api_name: app-home
---

# Patterns

Most apps include common pages like landing and settings pages, which appear in the App Home iframe. There are two types of patterns you should used to build those pages:

* **Templates:** Full page patterns for common Shopify app pages.
* **Compositions:** Smaller groupings of web components and APIs that solve specific tasks in your pages.

Each of the patterns below combines web components and APIs into performant layouts that most apps need while satisfying [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) out of the box.

## Templates

Templates are full-page layouts for paths and functionality found in most Shopify apps. Use one as your starting point so your app feels familiar in Shopify admin and meets merchant expectations for navigation, spacing, and interaction.

[![Homepage](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/homepage-ChqqEmaF.png)![Homepage](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/homepage-ChqqEmaF.png)](https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage)

[Homepage](https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage)

[The primary landing page for your app, providing quick access to key information and actions.](https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage)

[![Index](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/index-BloCXL71.png)![Index](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/index-BloCXL71.png)](https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index)

[Index](https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index)

[Most apps need a way for merchants to manage collections of resources, and perform actions on them.](https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index)

[![Details](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/details-DE5wyX2J.png)![Details](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/details-DE5wyX2J.png)](https://shopify.dev/docs/api/app-home/latest/patterns/templates/details)

[Details](https://shopify.dev/docs/api/app-home/latest/patterns/templates/details)

[From the index, edit and view individual resources within an efficient dual-column layout.](https://shopify.dev/docs/api/app-home/latest/patterns/templates/details)

[![Settings](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/settings-CEaS0R1v.png)![Settings](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/settings-CEaS0R1v.png)](https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings)

[Settings](https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings)

[All apps will have settings merchants will want to configure to control your app's behavior.](https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings)

## Compositions

Compositions solve specific interface challenges like displaying data tables, showing empty states, or guiding merchants through setup. A page of your app (as seen in the templates above) will often be composed of many of these kinds of common compositions.

Combinations of web components and APIs are provided here as compositions so that you can quickly add functionality without reinventing useful patterns.

[![Account connection](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/accountConnection-fq88OD33.png)![Account connection](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/accountConnection-fq88OD33.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection)

[Account connection](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection)

[Enable merchants to connect or disconnect their store from external accounts or services.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection)

[![App card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/appCard-Gh6-_ylZ.png)![App card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/appCard-Gh6-_ylZ.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card)

[App card](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card)

[Introduce and promote relevant apps to merchants within your app experience.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card)

[![Callout card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/calloutCard-CnvB0_jX.png)![Callout card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/calloutCard-CnvB0_jX.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card)

[Callout card](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card)

[Encourage merchants to take action on new features or opportunities.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card)

[![Empty state](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/emptyState-DjOI5bCw.png)![Empty state](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/emptyState-DjOI5bCw.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/empty-state)

[Empty state](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/empty-state)

[Provide guidance and encourage action when no data or items are available.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/empty-state)

[![Footer help](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/footerHelp-CC7OJpSv.png)![Footer help](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/footerHelp-CC7OJpSv.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help)

[Footer help](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help)

[Refer merchants to more information related to the product or feature they're using.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help)

[![Index table](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/indexTable-ChEqwjyh.png)![Index table](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/indexTable-ChEqwjyh.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table)

[Index table](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table)

[Display and manage collections of items with search, filtering, sorting, and bulk actions.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table)

[![Interstitial nav](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/interstitialNav-B0U4SeyX.png)![Interstitial nav](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/interstitialNav-B0U4SeyX.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav)

[Interstitial nav](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav)

[Provide deeper navigation by linking merchants to related pages within a section.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav)

[![Media card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/mediaCard-mcNUs4Od.png)![Media card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/mediaCard-mcNUs4Od.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card)

[Media card](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card)

[Present visual information alongside actionable, educational content.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card)

[![Metrics card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/metricsCard-DE5fYzI8.png)![Metrics card](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/metricsCard-DE5fYzI8.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card)

[Metrics card](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card)

[Display key metrics, statistics, or trends at a glance.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card)

[![Resource list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/resourceList-Cpk419GV.png)![Resource list](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/resourceList-Cpk419GV.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list)

[Resource list](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list)

[Display a collection of objects of the same type, like products or customers.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list)

[![Setup guide](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/setupGuide-Dnf6rLx-.png)![Setup guide](https://shopify-assets.shopifycdn.com/shopifycloud/shopify-dev/development/assets/assets/images/templated-apis-screenshots/admin/patterns/setupGuide-Dnf6rLx-.png)](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide)

[Setup guide](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide)

[Guide merchants through onboarding and setup with interactive checklists and progress tracking.](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide)

***
