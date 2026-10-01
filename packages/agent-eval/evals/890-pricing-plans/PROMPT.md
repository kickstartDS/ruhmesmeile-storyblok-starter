# Task

Implement the `PricingPlans` component for this kickstartDS design system
package.

Its props are already specified in
`src/components/pricing-plans/pricing-plans.schema.json` — treat that schema as
the source of truth for the component's API, and do not change it.

A pricing section puts a row of plans next to each other so a reader can compare
them. Each plan has a name, a price, an optional period and description, a
button, and a list of what it includes. One plan can be marked as the
recommended one — the one most readers should pick — and it has to stand out
without leaving the system: it sits on the inverted surface, lifted out of the
row by a soft halo behind it.

Requirements:

- Implement the component under `src/components/pricing-plans/`.
- This package already builds on the shared component library that ships with
  the design system. Compose the plans' call to action from that library; do not
  hand-roll a button or a link.
- Follow this design system's conventions for authoring a component: file
  layout, naming, styling approach, and how the JSON Schema and the props relate.
- The recommended plan has to invert the way everything else in this library
  inverts, so that it is still right when it ends up inside a region that is
  already flipped. It must not bring a colour scheme of its own.
- The halo belongs *behind* the card: a card that paints its own surface will
  paint over a `z-index: -1` child of its own, and the halo ends up washing over
  the card instead of sitting under it.
- Plans are read as a row and compared across it, so the buttons line up.
- Styling must use the design system's tokens rather than literal values.
