## Search Result Match
`<a>` · `.dsa-search-result-match`

_The component appears as a rectangular card with a subtle shadow, giving it a slightly elevated look against the background. It features two horizontal lines, suggesting placeholders for text content such as a title and snippet. The overall design is clean and minimalistic, emphasizing clarity and readability._

**Anatomy**
- **root** — `<a>` · control
  - **rich-text** — `<div>` · slot
  - **title** — `<div>` · container

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| snippet | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 1/1 configurations proven
