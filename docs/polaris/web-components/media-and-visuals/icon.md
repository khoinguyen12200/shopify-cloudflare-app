---
title: Icon
description: >-
  The icon component renders graphic symbols to visually communicate actions,
  status, and navigation throughout the interface. Use icon to reinforce button
  actions, indicate status states, or provide wayfinding cues that help users
  understand available functionality.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/icon.md
api_name: app-home
---

# Icon

The icon component renders graphic symbols to visually communicate actions, status, and navigation throughout the interface. Use icon to reinforce button actions, indicate status states, or provide wayfinding cues that help users understand available functionality.

Icons support multiple sizes, tones for semantic meaning, and can be integrated with other components like [button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button), [badge](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/badge), and [chip](https://shopify.dev/docs/api/app-home/latest/web-components/typography-and-content/chip) to enhance visual communication.

#### Use cases

* **Visual indicators:** Add visual indicators to buttons for actions like save, delete, or edit.
* **Status communication:** Display status icons for success, warning, error, or informational states.
* **Navigation cues:** Provide visual cues in links or navigation elements.
* **Feature identification:** Help merchants quickly identify features or sections with icons.

***

## Properties

Configure the following properties on the icon component.

* **color**

  **"base" | "subdued"**

  **Default: 'base'**

  **required**

  The color emphasis level that controls visual intensity.

  * `base`: Primary color for body text, standard UI elements, and general content with good readability.
  * `subdued`: Deemphasized color for secondary text, supporting labels, and less critical interface elements.

* **tone**

  **"info" | "success" | "warning" | "critical" | "auto" | "neutral" | "caution"**

  **Default: 'auto'**

  **required**

  The semantic meaning and color treatment of the component.

  * `info`: Informational content or helpful tips.
  * `success`: Positive outcomes or successful states.
  * `warning`: Important warnings about potential issues.
  * `critical`: Urgent problems or destructive actions.
  * `auto`: Automatically determined based on context.
  * `neutral`: General information without specific intent.
  * `caution`: Advisory notices that need attention.

* **type**

  **"" | "replace" | "search" | "split" | "link" | "edit" | "info" | "incomplete" | "complete" | "product" | "variant" | "collection" | "select" | "color" | "money" | "order" | "code" | ... 541 more ... | "x-circle-filled"**

  **required**

  The icon to display from the icon library.

  Set to a valid icon name to display that icon. To hide the icon completely, use an empty string `''`. To reserve the icon's space without displaying an icon, use `'empty'`.

* **size**

  **"small" | "base"**

  **Default: 'base'**

  **required**

  The size of the icon.

  * `small`: Smaller icon suitable for inline use within text or compact UI elements.
  * `base`: Default size that works well for standalone icons and standard use cases.

* **interest​For**

  **string**

  **required**

  The ID of the component to show when users hover over or focus on this component. Use this to connect interactive components to popovers or tooltips that provide additional context or information.

***

## Examples

### Display icons

Add visual cues to help users understand available actions. This example displays common icons for home, orders, products, and settings.

## html

```html
<s-stack direction="inline" gap="base">
  <s-icon type="home"></s-icon>
  <s-icon type="order"></s-icon>
  <s-icon type="product"></s-icon>
  <s-icon type="settings"></s-icon>
</s-stack>
```

### Apply semantic tones

Communicate status through color-coded icons. This example displays icons with warning, success, info, and caution tones.

## html

```html
<s-stack direction="inline" gap="base">
  <s-icon type="alert-circle" tone="warning"></s-icon>
  <s-icon type="check-circle" tone="success"></s-icon>
  <s-icon type="info" tone="info"></s-icon>
  <s-icon type="alert-triangle" tone="caution"></s-icon>
</s-stack>
```

### Reduce the size

Fit icons into tight layouts without losing clarity. This example uses a small-sized icon that takes up minimal space.

## html

```html
<s-icon type="search" size="small"></s-icon>
```

### Apply subdued color

De-emphasize icons for secondary content. This example displays a subdued icon with lower contrast for supporting information.

## html

```html
<s-icon type="question-circle" color="subdued"></s-icon>
```

### Add an ID

Target icons from scripts. This example adds an ID attribute for JavaScript event handling and accessibility references.

## html

```html
<s-icon type="settings" id="settings-icon"></s-icon>
```

### Connect to related content

Improve accessibility for screen reader users. This example connects an icon to related interactive content using the `interest` attribute.

## html

```html
<s-tooltip id="info-tooltip">
  SKU must be unique across all products and cannot be changed after creation
</s-tooltip>
<s-icon type="info" tone="info" interestFor="info-tooltip" />
```

### Use in buttons

Reinforce button actions with visual cues. This example places icons in buttons for add and delete actions with appropriate tones.

## html

```html
<s-button-group>
  <s-button slot="secondary-actions" icon="plus">Add product</s-button>
  <s-button slot="secondary-actions" icon="delete" tone="critical">
    Delete
  </s-button>
</s-button-group>
```

### Use in badges

Enhance status badges with visual indicators. This example pairs badges with icons for active and pending states.

## html

```html
<s-stack direction="inline" gap="base">
  <s-badge tone="success" icon="check-circle">Active</s-badge>
  <s-badge tone="warning" icon="alert-triangle">Pending</s-badge>
</s-stack>
```

***

## Available icons

Search and filter across all the available icons:

***

## Best practices

* **Use icons to support actions and status, not decorate**: Icons should clarify what an action does or indicate state. Use the trash icon for delete actions, a checkmark for completed status, or a warning icon for errors. Avoid adding icons purely for visual interest.
* **Maintain consistency across your interface**: Always use the same icon for the same action or concept throughout your extension. If you use a pencil for edit in one place, use it everywhere. Inconsistent icon usage confuses merchants.
* **Pair icons with text labels whenever possible**: Icons work best as visual reinforcement alongside text. Without text, even common icons can be ambiguous—a gear might mean settings, preferences, or configuration. Only use icons alone in space-constrained contexts like icon-only buttons with proper accessibility labels.
* **Choose icons that are universally recognizable**: Stick to icons with established meanings like magnifying glass (search), trash (delete), and plus (add). Test any icon you're unsure about—if it needs explanation, it's not the right choice.
* **Use semantic tones to communicate meaning**: Apply tones like `critical` for destructive actions, `success` for positive states, and `warning` for caution. Tones should convey information, not serve as decoration.

***

## Limitations

* Icons are limited to the predefined set provided by the component. Custom SVG icons, icon fonts, or external icon libraries aren't supported.
* Icons can't be animated or include interactive states beyond color changes. For complex graphics or illustrations, use the [image](https://shopify.dev/docs/api/app-home/latest/web-components/media-and-visuals/image) component instead.
* Icon color is determined by the `tone` and `color` properties. Custom colors or gradients aren't available.

***
