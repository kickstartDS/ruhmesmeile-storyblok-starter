Implement the `Disclosure` component for this kickstartDS design system package.

Its props are already specified in
`src/components/disclosure/disclosure.schema.json` — treat that schema as the
source of truth for the component's API.

A disclosure is a labelled trigger that shows and hides a panel of content
beneath it.

Requirements:

- Implement the component under `src/components/disclosure/`.
- Follow this design system's conventions for authoring a component: file
  layout, naming, styling approach, and how interactive behaviour is
  implemented.
- Expanding and collapsing must work at runtime, including for a visitor using
  only a keyboard.
- Assistive technology must be able to tell whether the panel is currently
  expanded or collapsed, and which panel the trigger controls.
- `defaultOpen` must decide the initial state without a flash of the wrong one.
- Styling must use the design system's tokens rather than literal values.

Do not modify `disclosure.schema.json`.
