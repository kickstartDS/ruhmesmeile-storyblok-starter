## Logo
`<a>` · `.dsa-logo`

_The logo component appears as a rectangular image with a soft, rounded border. It is set against a light blue background, giving it a clean and modern look. The overall design is simple and unobtrusive, allowing it to integrate seamlessly into various interfaces._

**Anatomy**
- **root** — `<a>` · control
  - **child-2** — `<noscript>` · container
  - **img** — `<img>` · media

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| alt | string | content *(unproven)* |  |
| className | string | content *(unproven)* |  |
| homepageHref | string | content *(unproven)* |  |
| src | string | content *(unproven)* |  |
| srcInverted | string | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0 — 1/2 configurations proven; no story for `inverted: false, true`
