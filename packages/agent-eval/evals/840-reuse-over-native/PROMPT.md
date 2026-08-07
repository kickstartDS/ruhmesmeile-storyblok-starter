Implement the `NotificationBanner` component for this kickstartDS design system
package.

Its props are already specified in
`src/components/notification-banner/notification-banner.schema.json` — treat
that schema as the source of truth for the component's API.

A notification banner sits at the top of a page and announces a change: a
headline, a short message, an optional call to action, and a control to dismiss
it.

Requirements:

- Implement the component under `src/components/notification-banner/`.
- This package already builds on the shared component library that ships with
  the design system. Compose the banner the way the rest of the design system
  composes larger components out of smaller ones.
- Follow this design system's conventions for authoring a component: file
  layout, naming, styling approach, and how interactive behaviour is
  implemented.
- Dismissing the banner must work at runtime and must be operable by keyboard.
- Styling must use the design system's tokens rather than literal values.

Do not modify `notification-banner.schema.json`.
