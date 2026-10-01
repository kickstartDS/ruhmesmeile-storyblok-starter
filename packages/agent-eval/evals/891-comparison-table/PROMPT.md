# Task

Implement the `ComparisonTable` component for this kickstartDS design system
package.

Its props are already specified in
`src/components/comparison-table/comparison-table.schema.json` — treat that
schema as the source of truth for the component's API, and do not change it.

The component compares what several plans include, feature by feature: one
column per plan, one row per feature, and one cell per plan in that row. A cell
holds text ("100 GB"), or an icon — `check` for included, `close` for not
included — or nothing at all when the plan has no answer there. Where an icon
carries the meaning, that meaning has to reach a screen reader as well.

One plan can be marked as the recommended one. Its column reads as a single
band, running from its header down to its button, with the row separators inside
it flipped along with it.

Requirements:

- Implement the component under `src/components/comparison-table/`.
- Compose the plans' call to action from the shared component library that ships
  with this package; do not hand-roll a button or a link.
- The recommended column has to invert the way everything else in this library
  inverts, so that it is still right when it ends up inside a region that is
  already flipped. It must not bring a colour scheme of its own.
- Rows are features and columns are plans, so this is a table: use one, with a
  header cell per plan and a header cell per feature.
- On a viewport too narrow for its columns, the table scrolls sideways rather
  than squeezing the values.
- Follow this design system's conventions for authoring a component: file
  layout, naming, styling approach, and how the JSON Schema and the props relate.
- Styling must use the design system's tokens rather than literal values.
