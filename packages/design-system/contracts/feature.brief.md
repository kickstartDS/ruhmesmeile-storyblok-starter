## Feature
`<div>` · `.dsa-feature.dsa-feature--large.dsa-feature--stack`

Partial Component used to display a feature

_The component features a clean, minimalist design with a white background and rounded corners, giving it a modern and approachable look. The title "Feature 1" is displayed in a straightforward, black font, while the call-to-action "See more" is highlighted in blue, accompanied by a right-pointing arrow, adding a touch of interactivity. The overall appearance is simple yet effective, focusing on clarity and ease of use._

**Anatomy**
- **root** — `<div>` · container
  - **cta** — `<div>` · container
    - **link** — `<a>` · control
      - **icon** — `<svg>` · glyph
  - **header** — `<div>` · container
    - **title** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| cta | object | content *(unproven)* |  |
| icon | string | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.2 — 1/5 configurations proven; no story for `style: intext, centered, besideLarge, besideSmall`
