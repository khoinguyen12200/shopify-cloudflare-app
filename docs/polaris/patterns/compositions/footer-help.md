---
title: Footer help
description: >-
  Merchants sometimes need more context than a page can provide. The footer help
  composition offers a subtle way to link to documentation, support, or related
  information at the bottom of a page.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help.md
api_name: app-home
---

# Footer help

Merchants sometimes need more context than a page can provide. The footer help composition offers a subtle way to link to documentation, support, or related information at the bottom of a page.

Place footer help at the bottom of the page or section it relates to with clear, descriptive link text that tells merchants where they'll go. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (3) Templates (4)

### Supported components

* [Link](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/link)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)
* [Text](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/text)

### Recommended templates

* [Homepage](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/homepage)
* [Index](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/resource-index)
* [Details](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/details)
* [Settings](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/settings)

#### Use cases

* Linking to documentation for the current feature
* Providing access to support or contact options
* Displaying legal information like terms or privacy policies

***

## Examples

### Display centered help text with documentation link

Merchants can find documentation or support when they need more context than a page provides. This pattern displays centered help text with an external documentation link. The [stack](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/stack) uses `alignItems="center"` to center the text, and the [link](https://shopify.dev/docs/api/app-home/latest/web-components/actions/link) uses `target="_blank"` for links that open in a new tab.

##### jsx

```tsx
<s-stack alignItems="center">
  <s-text>Learn more about <s-link href="">creating puzzles</s-link>.</s-text>
</s-stack>
```

##### html

```html
<s-stack alignItems="center">
  <s-text>Learn more about <s-link href="">creating puzzles</s-link>.</s-text>
</s-stack>
```

***
