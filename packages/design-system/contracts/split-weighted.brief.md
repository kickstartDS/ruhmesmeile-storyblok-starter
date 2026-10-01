## Split Weighted
`<div>` · `.l-split-weighted.l-split-weighted--align-top`

Split weighted layout component for dividing content into two sections with customizable widths.

_The Split Weighted component features a layout divided into two sections with customizable widths. The sections are aligned at the top, creating a balanced and organized appearance. The design is clean and functional, allowing for clear separation of content within the layout._

**Anatomy**
- **root** — `<div>` · container
  - **aside** — `<div>` · container
    - **content-layout** — `<div>` · container
      - **contact** — `<div>` · slot · conditional
      - **teaser-card** — `<div>` · slot · conditional
      - **text-media** — `<div>` · slot · conditional
  - **content** — `<div>` · container
    - **content-layout** — `<div>` · container
      - **headline** — `<header>` · slot · conditional
      - **rich-text** — `<div>` · slot · conditional
      - **storytelling** — `<div>` · slot · conditional
      - **teaser-card** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| asideLayout | object | content *(unproven)* |  |
| horizontalGutter | enum | content *(unproven)* |  |
| mainLayout | object | content *(unproven)* |  |
| verticalAlign | enum | content *(unproven)* |  |
| verticalGutter | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- layout-split-weighted--text-with-contact — _In this variant, the Split Weighted component features a larger vertical gutter, increasing the spacing between sections for a more open feel. The aside section is wider, allowing more space for content, while the main content area is slightly narrower, creating a more pronounced division between the two sections. This layout emphasizes the aside content, making it more prominent within the overall design._
- layout-split-weighted--text-with-teaser — _In this variant, the Split Weighted component features a wider aside section, now measuring 505.297px, which includes a teaser card. The main content section is narrower at 903.906px, with smaller gutters and newly introduced headline and rich-text elements, creating a more compact and content-rich layout._
- layout-split-weighted--text-with-teaser-tiles — _In this variant, the layout is reversed, with the aside section appearing first. The sections are aligned at the bottom, and the overall height is increased, giving a more expansive feel. The aside section is wider, while the main content area is narrower, with smaller gaps between elements, creating a more compact and dense arrangement._

**Slots**
- `mainComponents` → `root` — accepts 26 component types · observed counts: 0
- `asideComponents` → `root` — accepts 26 component types · observed counts: 0

**Tokens**
- `root`: `--dsa-split-weighted--h-gutter_default`, `--dsa-split-weighted--h-gutter_large`, `--dsa-split-weighted--h-gutter_small`, `--dsa-split-weighted--sticky-margin`, `--dsa-split-weighted--v-gutter_default`, `--dsa-split-weighted--v-gutter_large`, `--dsa-split-weighted--v-gutter_small`, `--dsa-split-weighted__aside--flex-basis_default` _(+11 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 4/4 configurations proven
