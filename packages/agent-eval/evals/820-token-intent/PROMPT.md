The `Stat` component renders correctly, and its stylesheet already reads from
the design system's token layer — nothing in it is hardcoded.

Design review flagged it anyway. Set next to the rest of the system, the figure
and its caption sit awkwardly: the vertical rhythm is visibly off, and the type
doesn't read as belonging to the same family as the surrounding UI. Theming is
inconsistent too — on some brand themes the figure, the caption and the trend
indicator come out in colours nobody intended, and they don't follow when the
theme changes.

Go through `src/components/stat/stat.scss` and make it use the token layer the
way this design system intends its tokens to be used.

Requirements:

- Keep the rendered markup and the component's API exactly as they are. This is
  a styling change, not a rewrite.
- Every value must still come from a token. Do not replace anything with a
  literal, and do not simply drop declarations that are awkward to fix.
- The `up` and `down` trends must stay visually distinct from one another.

Do not modify `stat.schema.json` or `StatComponent.tsx`.
