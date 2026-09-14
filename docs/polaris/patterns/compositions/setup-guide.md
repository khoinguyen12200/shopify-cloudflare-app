---
title: Setup guide
description: >-
  New merchants need guidance to get started with your app. The setup guide
  composition provides an interactive checklist with visual progress tracking to
  walk them through essential onboarding or configuration tasks.
api_version: v1.0
source_url:
  html: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide
  md: >-
    https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide.md
api_name: app-home
---

# Setup guide

New merchants need guidance to get started with your app. The setup guide composition provides an interactive checklist with visual progress tracking to walk them through essential onboarding or configuration tasks.

Use this composition on your homepage or a dedicated onboarding page. Mark tasks as complete when merchants finish them to reinforce progress. This composition follows proven design guidelines that help your app feel native to the Shopify admin. See [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) for more details on these guidelines for apps.

### Related Components (10) APIs (2) Templates (1)

### Supported components

* [Box](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/box)
* [Button](https://shopify.dev/docs/api/app-home/v1.0/web-components/actions/button)
* [Checkbox](https://shopify.dev/docs/api/app-home/v1.0/web-components/forms/checkbox)
* [Divider](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/divider)
* [Grid](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/grid)
* [Heading](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/heading)
* [Image](https://shopify.dev/docs/api/app-home/v1.0/web-components/media-and-visuals/image)
* [Paragraph](https://shopify.dev/docs/api/app-home/v1.0/web-components/typography-and-content/paragraph)
* [Section](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/section)
* [Stack](https://shopify.dev/docs/api/app-home/v1.0/web-components/layout-and-structure/stack)

### Available APIs

* [Navigation API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/navigation-api)
* [Toast API](https://shopify.dev/docs/api/app-home/v1.0/apis/user-interface-and-interactions/toast-api)

### Recommended templates

* [Homepage](https://shopify.dev/docs/api/app-home/v1.0/patterns/templates/homepage)

#### Use cases

* Guiding merchants through initial app setup
* Tracking completion of required configuration steps
* Showing progress through multi-step onboarding

***

## Examples

### Guide merchants through setup with expandable steps

New merchants need an interactive checklist to complete onboarding or setup tasks. This pattern guides merchants through setup with expandable steps and completion tracking. The [checkbox](https://shopify.dev/docs/api/app-home/latest/web-components/forms/checkbox) tracks completion status. Each step includes a heading, description, illustration, and action button, with a progress indicator for overall completion.

##### jsx

```tsx
// @framework-globals: useState
const [expanded, setExpanded] = useState({
  guide: true,
  step1: true,
  step2: false,
  step3: false,
});

return (
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid
        gridTemplateColumns="1fr auto auto"
        gap="small-300"
        alignItems="center"
      >
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
         />
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          onClick={() => setExpanded({ ...expanded, guide: !expanded.guide })}
          icon={expanded.guide ? "chevron-up" : "chevron-down"}
         />
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">0 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box
      borderRadius="base"
      border="base"
      background="base"
      display={expanded.guide ? "auto" : "none"}
    >
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Upload an image for your puzzle" />
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            onClick={() => setExpanded({ ...expanded, step1: !expanded.step1 })}
            icon={expanded.step1 ? "chevron-up" : "chevron-down"}
           />
        </s-grid>
        <s-box
          padding="small"
          paddingBlockStart="none"
          display={expanded.step1 ? "auto" : "none"}
        >
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Start by uploading a high-quality image that will be used to
                  create your puzzle. For best results, use images that are at
                  least 1200x1200 pixels.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Upload image</s-button>
                  <s-button variant="tertiary" tone="neutral">
                    {" "}
                    Image requirements{" "}
                  </s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Customize checkout illustration"
                 />
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Choose a puzzle template" />
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            onClick={() => setExpanded({ ...expanded, step2: !expanded.step2 })}
            icon={expanded.step2 ? "chevron-up" : "chevron-down"}
           />
        </s-grid>
        <s-box
          padding="small"
          paddingBlockStart="none"
          display={expanded.step2 ? "auto" : "none"}
        >
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Choose from our library of puzzle templates including classic
                  jigsaw, hexagonal, and irregular shapes.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Browse templates</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Template selection illustration"
                 />
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Customize puzzle piece shapes" />
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            onClick={() => setExpanded({ ...expanded, step3: !expanded.step3 })}
            icon={expanded.step3 ? "chevron-up" : "chevron-down"}
           />
        </s-grid>
        <s-box
          padding="small"
          paddingBlockStart="none"
          display={expanded.step3 ? "auto" : "none"}
        >
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Fine-tune the shape and interlocking style of your puzzle
                  pieces for a unique experience.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Customize shapes</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Customization illustration"
                 />
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
    </s-box>
  </s-grid>
</s-section>
)
```

##### html

```html
<script>
  function toggleGuide(button) {
    const stepsContainer = document.getElementById('setup-steps');
    const isExpanded = stepsContainer.style.display !== 'none';
    stepsContainer.style.display = isExpanded ? 'none' : 'block';
    button.setAttribute('icon', isExpanded ? 'chevron-down' : 'chevron-up');
  }
  function toggleStep(button, stepId) {
    const detailsContainer = document.getElementById(stepId);
    const isExpanded = detailsContainer.style.display !== 'none';
    detailsContainer.style.display = isExpanded ? 'none' : 'block';
    button.setAttribute('icon', isExpanded ? 'chevron-down' : 'chevron-up');
  }
</script>
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid gridTemplateColumns="1fr auto auto" gap="small-300" alignItems="center">
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
        ></s-button>
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          icon="chevron-up"
          onClick="toggleGuide(this)"
        ></s-button>
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">0 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box id="setup-steps" borderRadius="base" border="base" background="base">
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Upload an image for your puzzle"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            icon="chevron-up"
            onClick="toggleStep(this, 'step1-details')"
          ></s-button>
        </s-grid>
        <s-box id="step1-details" padding="small" paddingBlockStart="none">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
              <s-grid gap="small-200">
                <s-paragraph>
                  Start by uploading a high-quality image that will be used to create your
                  puzzle. For best results, use images that are at least 1200x1200 pixels.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Upload image</s-button>
                  <s-button variant="tertiary" tone="neutral">Image requirements</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Customize checkout illustration"
                ></s-image>
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Choose a puzzle template"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            icon="chevron-down"
            onClick="toggleStep(this, 'step2-details')"
          ></s-button>
        </s-grid>
        <s-box id="step2-details" padding="small" paddingBlockStart="none" style="display: none;">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
              <s-grid gap="small-200">
                <s-paragraph>
                  Choose from our library of puzzle templates including classic
                  jigsaw, hexagonal, and irregular shapes.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Browse templates</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Template selection illustration"
                ></s-image>
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Customize puzzle piece shapes"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            icon="chevron-down"
            onClick="toggleStep(this, 'step3-details')"
          ></s-button>
        </s-grid>
        <s-box id="step3-details" padding="small" paddingBlockStart="none" style="display: none;">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
              <s-grid gap="small-200">
                <s-paragraph>
                  Fine-tune the shape and interlocking style of your puzzle
                  pieces for a unique experience.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Customize shapes</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Customization illustration"
                ></s-image>
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
    </s-box>
  </s-grid>
</s-section>
```

### Navigate to step actions

Use `href` attributes on step action buttons to navigate merchants to relevant pages for completing each step.

##### jsx

```tsx
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid
        gridTemplateColumns="1fr auto auto"
        gap="small-300"
        alignItems="center"
      >
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
        />
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          icon="chevron-up"
        />
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">0 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box borderRadius="base" border="base" background="base">
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Upload an image for your puzzle" />
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            icon="chevron-up"
          />
        </s-grid>
        <s-box padding="small" paddingBlockStart="none">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Start by uploading a high-quality image that will be used to
                  create your puzzle.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary" href="/app/upload">
                    Upload image
                  </s-button>
                  <s-button variant="tertiary" tone="neutral" href="/app/help/images">
                    Image requirements
                  </s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Upload illustration"
                />
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Choose a puzzle template" />
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            icon="chevron-down"
          />
        </s-grid>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Customize puzzle piece shapes" />
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            icon="chevron-down"
          />
        </s-grid>
      </s-box>
    </s-box>
  </s-grid>
</s-section>
```

##### html

```html
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid
        gridTemplateColumns="1fr auto auto"
        gap="small-300"
        alignItems="center"
      >
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
        ></s-button>
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          icon="chevron-up"
        ></s-button>
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">0 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box borderRadius="base" border="base" background="base">
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Upload an image for your puzzle"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            icon="chevron-up"
          ></s-button>
        </s-grid>
        <s-box padding="small" paddingBlockStart="none">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Start by uploading a high-quality image that will be used to
                  create your puzzle.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary" href="/app/upload">Upload image</s-button>
                  <s-button variant="tertiary" tone="neutral" href="/app/help/images">Image requirements</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Upload illustration"
                ></s-image>
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Choose a puzzle template"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            icon="chevron-down"
          ></s-button>
        </s-grid>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Customize puzzle piece shapes"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            icon="chevron-down"
          ></s-button>
        </s-grid>
      </s-box>
    </s-box>
  </s-grid>
</s-section>
```

### Show step completion with Toast

Use the [Toast API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/toast-api) to show feedback when merchants complete setup steps.

##### jsx

```tsx
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid
        gridTemplateColumns="1fr auto auto"
        gap="small-300"
        alignItems="center"
      >
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
        />
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          icon="chevron-up"
        />
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">1 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box borderRadius="base" border="base" background="base">
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox
            label="Upload an image for your puzzle"
            checked
            onChange={() => {
              shopify.toast.show('Step 1 completed!');
            }}
          />
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            icon="chevron-down"
          />
        </s-grid>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox
            label="Choose a puzzle template"
            onChange={() => {
              shopify.toast.show('Step 2 completed!');
            }}
          />
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            icon="chevron-up"
          />
        </s-grid>
        <s-box padding="small" paddingBlockStart="none">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Choose from our library of puzzle templates or create your own custom layout.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Browse templates</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Templates illustration"
                />
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider />
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox
            label="Customize puzzle piece shapes"
            onChange={() => {
              shopify.toast.show('Step 3 completed!');
            }}
          />
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            icon="chevron-down"
          />
        </s-grid>
      </s-box>
    </s-box>
  </s-grid>
</s-section>
```

##### html

```html
<s-section>
  <s-grid gap="base">
    <s-grid gap="small-200">
      <s-grid
        gridTemplateColumns="1fr auto auto"
        gap="small-300"
        alignItems="center"
      >
        <s-heading>Setup Guide</s-heading>
        <s-button
          accessibilityLabel="Dismiss Guide"
          variant="tertiary"
          tone="neutral"
          icon="x"
        ></s-button>
        <s-button
          accessibilityLabel="Toggle setup guide"
          variant="tertiary"
          tone="neutral"
          icon="chevron-up"
        ></s-button>
      </s-grid>
      <s-paragraph>
        Use this personalized guide to get your store ready for sales.
      </s-paragraph>
      <s-paragraph color="subdued">1 out of 3 steps completed</s-paragraph>
    </s-grid>
    <s-box borderRadius="base" border="base" background="base">
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Upload an image for your puzzle" checked></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 1 details"
            variant="tertiary"
            icon="chevron-down"
          ></s-button>
        </s-grid>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Choose a puzzle template"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 2 details"
            variant="tertiary"
            icon="chevron-up"
          ></s-button>
        </s-grid>
        <s-box padding="small" paddingBlockStart="none">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="base"
              alignItems="center"
            >
              <s-grid gap="small-200">
                <s-paragraph>
                  Choose from our library of puzzle templates or create your own custom layout.
                </s-paragraph>
                <s-stack direction="inline" gap="small-200">
                  <s-button variant="primary">Browse templates</s-button>
                </s-stack>
              </s-grid>
              <s-box maxBlockSize="80px" maxInlineSize="80px">
                <s-image
                  src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                  alt="Templates illustration"
                ></s-image>
              </s-box>
            </s-grid>
          </s-box>
        </s-box>
      </s-box>
      <s-divider></s-divider>
      <s-box>
        <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
          <s-checkbox label="Customize puzzle piece shapes"></s-checkbox>
          <s-button
            accessibilityLabel="Toggle step 3 details"
            variant="tertiary"
            icon="chevron-down"
          ></s-button>
        </s-grid>
      </s-box>
    </s-box>
  </s-grid>
</s-section>

<!-- 
Step completion handlers:
shopify.toast.show('Step 1 completed!');
shopify.toast.show('Step 2 completed!');
shopify.toast.show('Step 3 completed!');
-->
```

***
