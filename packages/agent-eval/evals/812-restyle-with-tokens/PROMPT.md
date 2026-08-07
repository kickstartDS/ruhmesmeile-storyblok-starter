The `Alert` component works, but its stylesheet was written in a hurry against a
mockup and hardcodes every value it uses.

Bring `src/components/alert/alert.scss` in line with this design system's
theming approach, so that an alert picks up a consuming project's theme instead
of the colours that happen to be baked into it today.

Requirements:

- Keep the rendered markup and the component's API exactly as they are. This is
  a styling change, not a rewrite.
- Every colour, spacing, radius, font size and transition currently written as a
  literal must come from this design system's theming layer instead.
- Follow the conventions this design system uses for exposing per-component
  styling hooks.
- The four variants (`info`, `success`, `warning`, `danger`) must stay visually
  distinct from one another.

Do not modify `alert.schema.json` or `AlertComponent.tsx`.
