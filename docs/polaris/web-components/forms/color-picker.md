---
title: Color picker
description: >-
  The color picker component allows users to select colors from a visual color
  palette interface. Use color picker to provide an intuitive, visual way for
  users to choose colors for themes, branding, or design customization.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker
  md: >-
    https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-picker.md
api_name: app-home
---

# Color picker

The color picker component allows users to select colors from a visual color palette interface. Use color picker to provide an intuitive, visual way for users to choose colors for themes, branding, or design customization.

Color pickers support multiple color formats, predefined color swatches, and interactive selection to make color choice easy and accurate. For combined visual and text-based color input with validation, use [color field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-field).

#### Use cases

* **Brand customization:** Allow merchants to select brand colors for themes or templates.
* **Product attributes:** Capture color selections for product variants or attributes.
* **UI customization:** Enable color selection for custom UI elements or styling.
* **Visual configuration:** Select colors for charts, reports, or visual displays.

***

## Properties

Configure the following properties on the color picker component.

* **alpha**

  **boolean**

  **Default: false**

  **required**

  Whether to enable alpha (transparency) channel selection in the color picker, allowing users to choose semi-transparent colors.

* **name**

  **string**

  **required**

  The name attribute for the field, used to identify the field's value when the form is submitted. Must be unique within the nearest containing form.

* **default​Value**

  **string**

  **required**

  The initial color value when the field first loads. Unlike `placeholder`, this is a real value that the user can edit and that gets submitted with the form. Once the user starts interacting, their input replaces it. Changing this property after the field has loaded has no effect. To update the field value at any time, use `value` instead.

* **value**

  **string**

  **required**

  The currently selected color value. Accepts multiple input formats:

  * Hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA` (3, 6, or 8 digits)
  * RGB/RGBA: `rgb(255, 0, 0)` or `rgb(255 0 0)` (comma or space-separated)
  * HSL/HSLA: `hsl(0, 100%, 50%)` or `hsl(0 100% 50%)`

  Returns an empty string if the value is invalid. The `change` event always emits values in hex format.

* **form​Reset​Callback**

  **() => void**

  **required**

  A callback that fires when the containing form is reset (using the form's `reset()` method or a reset button). When triggered, the component's `value` reverts to its `defaultValue`.

### Events

The color picker component provides event callbacks for handling user interactions. Learn more about [handling events](https://shopify.dev/docs/api/polaris/using-polaris-web-components#handling-events).

* **change**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the color picker value changes.

  Learn more about the [change event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event).

* **input**

  **CallbackEventListener\<typeof tagName> | null**

  **required**

  A callback fired when the user inputs data into the color picker.

  Learn more about the [input event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event).

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

***

## Examples

### Pick a color

Display the default color picker with hue and saturation controls.

## html

```html
<s-color-picker value="#FF0000"></s-color-picker>
```

### Enable alpha transparency

Allow users to select semi-transparent colors. This example displays a color picker with an alpha slider for adjusting opacity levels.

## html

```html
<s-box padding="large" border="base" borderRadius="base">
  <s-color-picker
    value="#FF0000FF"
    alpha
    name="color-with-alpha"
  ></s-color-picker>
</s-box>
```

***

## Best practices

* **Initialize with current values:** When editing existing colors, always set the picker's initial value to the current color. This shows merchants what they're changing from and maintains context.
* **Show preview of final result:** If possible, show how the selected color will look in its actual context (like previewing a button color on a button) alongside the picker.
* **Pair with color field for precision:** Use the component for visual selection combined with a [color field](https://shopify.dev/docs/api/app-home/latest/web-components/forms/color-field) for precise hex input. This gives merchants both visual intuition and exact control.

***

## Limitations

* The 2D color gradient area requires mouse/touch interaction. Keyboard users can only navigate between major UI elements (hue slider, alpha slider) but can't make fine-grained color adjustments in the gradient itself.
* The picker operates in the HSL color space and outputs values in hex format. Colors from other color spaces (like CMYK or LAB) might not be precisely represented, and might shift during conversion.
* On touch devices, selecting precise colors in the gradient can be difficult due to finger size obscuring the selection point. The picker works best with mouse or stylus input for fine color selection.

***
