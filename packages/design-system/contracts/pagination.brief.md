## Pagination
`<div>` · `.dsa-pagination`

Pagination component for navigating through pages of content.

_The pagination component is housed within a rounded rectangular container with a subtle shadow, giving it a slightly elevated appearance against the background. Inside, there are two navigation icons, a double arrow pointing left and a single arrow pointing left, both centered and spaced apart. The overall design is clean and minimalistic, with a focus on functionality and ease of navigation._

**Anatomy**
- **root** — `<div>` · container
  - **link** — `<a>` · control · repeated
    - **icon** — `<svg>` · glyph
  - **pages** — `<div>` · container
    - **link** — `<a>` · control · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| ariaLabels | object | content *(unproven)* |  |
| pages | array | presence | link |

<small>\* = default</small>

**Variants**
- corporate-pagination--default — _In this variant, the pagination component includes numbered page links between the navigation icons, extending the functionality beyond just the arrows. The numbers are evenly spaced, with the current page highlighted in blue, adding a visual cue for the user's current position. This change enhances the component's usability by allowing direct access to specific pages._

**Slots**
- `pages` → `root/pages/link` — items: active, url · observed counts: 0, 12

**Tokens**
- `root`: `--dsa-pagination--background`, `--dsa-pagination--background_active`, `--dsa-pagination--background_active_hover`, `--dsa-pagination--background_hover`, `--dsa-pagination--border`, `--dsa-pagination--border-radius`, `--dsa-pagination--color`, `--dsa-pagination--color_active` _(+7 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0 — 2/2 configurations proven; no story for `truncate: false, true`
