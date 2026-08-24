---
description: How to build an embedded admin page with Polaris web components — the three lookups that must happen before writing markup, the element inventory in this install, which Shopify mechanism owns which job (page chrome, back navigation, saving, resource selection, layout, spacing), and the anatomy of a correct page. Apply whenever creating or editing anything under app/routes/app/, app/components/, or extensions/.
globs:
  - "app/routes/app/**"
  - "app/components/**"
  - "extensions/**"
alwaysApply: true
---

# Polaris App Home — building an embedded admin page

`@rules/shopify-and-ui.md` says the admin is Polaris and that you look every
element up. **This file is the how.** It covers the lookup procedure, the
inventory of what exists, and the mechanism that owns each job on a page.

The governing idea: **an admin page is assembled from mechanisms Shopify already
owns.** The page frame, the back link, the save affordance, the resource
selector, the spacing between sections — each has a designated owner. Building a
page means identifying which mechanism owns each job and handing the job over.
Anything you build yourself in place of one of them is code that will look
almost-right, behave subtly differently from the rest of the admin, and carry no
accessibility or responsive behaviour.

---

## 1. The three lookups, before any markup

Do all three. They answer different questions, and the third is the one that is
usually skipped.

### Lookup A — what exists in *this* install

Which elements exist is a property of the installed `@shopify/polaris-types`
version, not of Polaris in general. Elements are added and removed between
releases, so read the manifest rather than recalling a tag name:

```bash
# The authoritative list for this repo, with every attribute and slot
node_modules/@shopify/polaris-types/dist/custom-elements.json

# A quick inventory of tag names
node -e 'const d=require("./node_modules/@shopify/polaris-types/dist/custom-elements.json");
console.log([...new Set(d.modules.flatMap(m=>m.declarations||[]).map(x=>x.tagName||x.name).filter(n=>n?.startsWith("s-")))].sort().join(", "))'
```

At the time of writing this install has **59** `s-*` elements. If a tag is not in
that list it is not available to you, and the skill lookup will name what
replaced it. The same file is the fastest source of truth for an element's
attributes and its named slots.

### Lookup B — the pattern for the page you are building

Shopify publishes finished **templates** — `Details`, `Index`, `Settings`,
`Homepage` — and **compositions** — empty state, index table, metrics card,
resource list, setup guide, callout card, and more. Nearly every admin screen is
one of these. Start from the template that matches, then fill it in.

Invoke `shopify-plugin:shopify-polaris-app-home` and search for the template by
name. Pick the template *before* choosing components: the template determines
the page's columns, where actions live, and how saving works, and those
decisions are much more expensive to retrofit than a component swap.

### Lookup C — the element's real attributes, slots, and allowed children

For every element you have not verified this session, establish three things:

1. **Attributes** and their exact accepted values.
2. **Named slots** — the exact slot names. A slot name that is not on the
   element's list is not honoured, and the child will not appear where you
   intended it.
3. **What may nest inside it**, and what the element expects its parent to be.

`custom-elements.json` answers all three offline. Use the skill's doc search for
the prose and the reasoning.

**One operational note that saves a round trip:** the docs search returns
explanatory prose with the **code examples stripped out**. When you need the
actual markup — slot names, attribute spelling, nesting — fetch the reference
page itself (`https://shopify.dev/docs/api/app-home/...`) rather than trying to
infer the shape from the snippet.

### Then validate

Run the generated markup through `validate_component_codeblocks` (MCP) or the
skill's `validate.mjs` before you consider it written. Validation failing is
information: search the error, fix, re-validate.

---

## 2. Which mechanism owns which job

Identify the job, hand it to its owner. This table is the map from intent to
mechanism.

| The job | Owned by |
|---|---|
| Page frame, heading, content width | `s-page` (`heading`, `inlineSize`) |
| Navigating back to the parent screen | `<s-link slot="breadcrumb-actions">` on `s-page` |
| The page's main action, when it is not a save | `<s-button slot="primary-action">` |
| Other page-level actions (preview, duplicate, delete) | `<s-button slot="secondary-actions">` |
| **Saving edits to a record** | **The save bar** — `<form data-save-bar>`, or the Save Bar API |
| Grouping content, and the spacing between groups | `s-section`, as a direct child of `s-page` |
| A secondary column beside the main content | `<s-box slot="aside">` on `s-page` |
| Spacing between items inside a section | `s-stack` (`gap`) |
| Keeping fields and their actions aligned in columns | `s-grid` (`gridTemplateColumns`) |
| Choosing products, variants, or collections | Resource Picker — `shopify.resourcePicker(...)` |
| Choosing records your own app owns | Picker API |
| A dialog | `s-modal`, or the Modal API |
| Transient confirmation after an action | Toast API |
| Status of a record | `s-badge` |
| Empty, loading, and error states; index tables; metric tiles | The published **compositions** |

Two consequences worth stating outright, because they are the ones a page most
often gets wrong:

- **Saving belongs to the save bar, not to the page body.** The admin's
  convention is that unsaved changes surface in the bar at the top of the frame,
  with save and discard together, for every screen in every app. A save button
  placed at the bottom of a form is a second, competing convention on the same
  screen.
- **Selecting a Shopify resource belongs to the Resource Picker.** Merchants
  select products and collections by searching Shopify's catalogue in a picker,
  never by knowing and typing a handle or an ID. Handles are an internal
  identifier; asking for one moves your data-entry problem onto the merchant.

---

## 3. Anatomy of a details page

This is the `Details` template — the shape for "edit one record", which is most
admin screens. Note where the `<form>` sits.

```tsx
<form data-save-bar data-discard-confirmation>
  <s-page heading={offer.name} inlineSize="base">
    {/* Back to the parent list. A link, in the breadcrumb-actions slot. */}
    <s-link slot="breadcrumb-actions" href="/app/offers">
      {t("offers.heading")}
    </s-link>

    {/* Page-level actions that are not the save. */}
    <s-button slot="secondary-actions">{t("offers.duplicate")}</s-button>
    <s-button slot="secondary-actions" tone="critical">
      {t("offers.delete")}
    </s-button>

    {/* Main column: unslotted s-section children, in reading order. */}
    <s-section heading={t("offers.form.trigger.heading")}>
      <s-text-field label={t("offers.form.name")} name="name" required />
    </s-section>

    <s-section heading={t("offers.form.reward.heading")}>
      {/* fields */}
    </s-section>

    {/* Secondary column. */}
    <s-box slot="aside">
      <s-section heading={t("offers.summary.heading")}>
        <s-badge tone="success">{t("offers.status.active")}</s-badge>
      </s-section>
    </s-box>
  </s-page>
</form>
```

**The `<form>` wraps `s-page` from the outside.** `s-page` lays out its own
children and routes them to slots, so its children are `s-section` elements and
slotted elements — nothing else. An element placed between `s-page` and its
sections becomes an unrecognised child in the middle of that layout, and the
automatic spacing and slotting that `s-page` provides no longer reaches the
sections. Wrapping from the outside keeps `s-page`'s children exactly what it
expects while still giving every field one owning form.

---

## 4. Spacing and layout come from the structure

**Spacing is a property of using the right container, not something you add.**
`s-page` spaces its sections; `s-section` spaces its children; `s-stack` and
`s-grid` space theirs. A page whose elements sit flush against each other is a
page whose structure has been bypassed somewhere — the fix is to restore the
container, never to introduce margins.

There is no hand-written CSS on this surface and no style attribute for layout.
The vocabulary is:

- **`s-section`** — a titled group of related content, direct child of `s-page`.
  Sections are the unit of vertical rhythm on the page.
- **`s-stack`** — items in a row or column with a `gap`. Use it for content that
  sizes to itself: badges, buttons, chips, text, icons.
- **`s-grid`** — explicit columns via `gridTemplateColumns`. Use it whenever a
  form control shares a row with anything. A form control fills the inline size
  it is given and has no width attribute, so a field inside an inline `s-stack`
  takes the whole row and pushes its siblings onto the next line at every window
  width. `<s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">`
  is the shape for "field plus button".
- **`s-box`** — padding, background, border around a subtree; also the wrapper
  for the `aside` slot.

### Choosing the width, and when there are two columns

`inlineSize` on `s-page` takes `"small" | "base" | "large"`, default `"base"`.

- **`base`** — the standard page width, and the width at which a second column
  makes sense. Any screen that edits a record and also shows supporting
  information about it (status, summary, timestamps, related links) belongs here,
  with the supporting material in `<s-box slot="aside">`.
- **`small`** — a deliberately narrow, single-column layout for a short focused
  form or a simple linear workflow. It is a choice to *exclude* a second column,
  so it fits a small settings form, not a record editor.
- **`large`** — data-dense screens: dashboards, analytics, wide tables.

Pick the width from the content: a page carrying several sections of fields plus
anything contextual is a two-column `base` page.

---

## 5. Forms, saving, and validity

**Structure.** One `<form>` per screen, wrapping `s-page`. Fields carry `name`,
`label`, and their native constraints (`required`, `min`, `max`, `type`,
`minLength`) — those attributes are what make the browser block an invalid
submission, and they work before any JavaScript has loaded.

**Saving.** Choose one of the two save-bar mechanisms, and do not mix them on one
page:

- **Automatic** — `<form data-save-bar>`. The bar appears as soon as any input
  differs from its initial value, and hides on submit or reset. Add
  `data-discard-confirmation` when discarding would lose work the merchant
  cannot easily recreate. `onsubmit` and `onreset` receive the standard events,
  and either can be prevented for custom handling. This is the default choice.
- **Programmatic** — `shopify.saveBar.show(id)` / `.hide(id)` driving a
  `<ui-save-bar id="...">` that contains your own save and discard buttons. Use
  it when you need to own the buttons' state or drive the bar from something
  other than form dirtiness.

The save bar needs the full App Bridge UI library loaded via its script tag.

**Gating save on validity.** The documented `data-save-bar` integration does not
expose a disabled state for its save button, so validity is enforced rather than
displayed:

1. **Native constraints on every field** block submission in the browser and
   show the field-level message, with no round trip.
2. **The server parses the submission** (Zod, at ring 5, per
   `@rules/code-craft.md`) and returns per-field reasons; render each on its
   field via the `error` attribute. This is the authoritative gate — a submission
   can always arrive without having passed the browser.
3. **When a visibly disabled control is genuinely required**, use a mechanism
   that documents `disabled`: a `<s-button slot="primary-action" disabled>` on
   `s-page`, or the programmatic `ui-save-bar` whose buttons you own.

Prefer 1 + 2. They keep the page correct without hydration and put the real
decision in one place on the server.

---

## 6. Selecting Shopify resources

```tsx
const selected = await shopify.resourcePicker({
  type: "product",              // "product" | "variant" | "collection"
  multiple: true,               // or a number, for a cap
  selectionIds: current.map((id) => ({ id })),  // reopens with the current choice
  filter: { draft: false, archived: false },
});

if (!selected) return;          // undefined means the merchant cancelled
```

It returns an array of full resources — ids, titles, images, metadata — or
`undefined` on cancel. Always handle the cancel branch.

**Store the GIDs it returns** (`gid://shopify/Product/123`), and keep the title
alongside only as a cached label for display. GIDs are stable; titles and handles
are merchant-editable. Reopen the picker with `selectionIds` so editing a
selection starts from what is already configured rather than from empty.

For records your own app owns — plans, templates, rules — the **Picker API** is
the equivalent mechanism.

---

## 7. Writing the markup

- `s-*` elements are globally registered custom elements: **no import**. App
  Bridge React hooks come from `@shopify/app-bridge-react`; JSX types from
  `@shopify/polaris-types`. There is no `@shopify/polaris` package in this app.
- **Attribute names are camelCase**: `inlineSize`, `gridTemplateColumns`,
  `alignItems`, `borderRadius`.
- **Boolean attributes** (`disabled`, `required`, `loading`, `checked`,
  `dismissible`, `multiple`) take bare shorthand or an expression:
  `<s-button disabled>`, `<s-switch checked={isEnabled} />`.
- **Keyword attributes** (`padding`, `gap`, `tone`, `variant`, `size`,
  `direction`, `inlineSize`, `background`) always take a string:
  `<s-box padding="base">`, `<s-stack gap="loose">`.
- Every user-visible string goes through `t()` — `@rules/i18n.md`. Layout must
  survive a translation ~30% longer than the English.
- Components under `app/components/` stay presentational: props in, JSX out, no
  fetching, no `.server` imports.

---

## 8. Before calling a page done

- [ ] The screen was matched to a published template, and follows its shape
- [ ] Every element used was checked against `custom-elements.json` or the docs
      this session — attributes, slot names, allowed children
- [ ] The markup passed `validate_component_codeblocks` / `validate.mjs`
- [ ] Each job in the table in §2 is handled by its listed owner
- [ ] Back navigation is a link in `breadcrumb-actions`
- [ ] Saving is the save bar; no competing save control in the page body
- [ ] Resource selection is a picker; no field asks for a handle or an ID
- [ ] `inlineSize` matches the content, and supporting material is in `aside`
- [ ] Spacing comes entirely from `s-page` / `s-section` / `s-stack` / `s-grid`
- [ ] Every string is translated
- [ ] The server side is TDD'd — loader, action, intent handlers, payload
      builders. Polaris web components cannot be meaningfully unit-tested, so the
      rendering is **verified by hand and reported as verified by hand**
      (`@rules/testing.md`)

Non-trivial design decisions — a new screen, an information-architecture call, an
empty or error state, a flow — go through `impeccable:impeccable` first. Polaris
decides which components exist; impeccable decides hierarchy, density, flow, and
copy.
