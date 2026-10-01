## Divider
`<hr>` · `.c-divider.dsa-divider`

Dividers bring clarity to a layout by grouping and dividing content in close proximity.

_The divider appears as a thin, light gray horizontal line that spans the width of its container. It has a subtle presence, providing a clear separation between sections without drawing too much attention to itself. The simplicity and neutrality of the design help maintain focus on the surrounding content._

**Anatomy**
- **root** — `<hr>` · container

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| component | string | content *(unproven)* |  |
| variant | default* · accent | class-toggle | root |

<small>\* = default</small>

**Variants**
- `variant: accent` — _The variant with `variant=accent` appears as a thin, dark gray horizontal line. This change gives it a more pronounced presence compared to the default, subtly drawing more attention while still maintaining its role as a separator._

**Tokens**
- `root`: `--dsa-divider--background`, `--dsa-divider--background_accent`, `--dsa-divider--height`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 2/2 configurations proven
