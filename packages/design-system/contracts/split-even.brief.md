## Split Even
`<div>` · `.l-split-even`

Split even layout component for dividing content into two equal sections.

_The Split Even component features a layout divided into two equal sections, each occupying half of the available space. The sections are separated by a subtle gutter, providing a balanced and symmetrical appearance. The overall design is clean and minimalistic, emphasizing equal distribution of content._

**Anatomy**
- **root** — `<div>` · container
  - **content** — `<div>` · container · repeated
    - **content-layout** — `<div>` · container
      - **faq** — `<div>` · slot · conditional
      - **headline** — `<header>` · slot · conditional
      - **storytelling** — `<div>` · slot · conditional
      - **teaser-card** — `<div>` · slot · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| contentGutter | enum | content *(unproven)* |  |
| contentMinWidth | enum | content *(unproven)* |  |
| firstLayout | object | content *(unproven)* |  |
| horizontalGutter | enum | content *(unproven)* |  |
| secondLayout | object | content *(unproven)* |  |
| verticalAlign | enum | content *(unproven)* |  |
| verticalGutter | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- layout-split-even--faq-with-form — _In this variant, the Split Even component features larger horizontal and vertical gutters, creating more space between the two sections. The overall height of the component is increased, giving it a more substantial presence. Additionally, new content elements such as a FAQ section and a headline are introduced, adding depth and functionality to the layout._
- layout-split-even--main-teaser-with-grid — _In this variant, the Split Even component features a reduced horizontal and vertical gutter, creating a more compact layout. The sections are now vertically stretched, giving them a taller appearance, and a teaser card is introduced, adding visual interest and content variety. The overall design maintains its clean and balanced look but with a slightly denser arrangement._
- layout-split-even--text-with-logos — _In this variant, the Split Even component has a more expansive and centered layout compared to the default. The sections are wider, filling the available space more completely, and the content is vertically centered, creating a balanced and harmonious appearance. Additionally, the storytelling element is introduced, adding a narrative aspect to the design._

**Slots**
- `firstComponents` → `root` — accepts 26 component types · observed counts: 0
- `secondComponents` → `root` — accepts 26 component types · observed counts: 0

**Tokens**
- `root`: `--dsa-split-even--h-gutter_default`, `--dsa-split-even--h-gutter_large`, `--dsa-split-even--h-gutter_small`, `--dsa-split-even--sticky-margin`, `--dsa-split-even--v-gutter_default`, `--dsa-split-even--v-gutter_large`, `--dsa-split-even--v-gutter_small`, `--dsa-split-even__content--flex-basis_medium` _(+5 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.5 — 4/4 configurations proven; no story for `mobileReverse: true`
