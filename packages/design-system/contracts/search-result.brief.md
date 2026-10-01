## Search Result
`<div>` · `.l-container.l-container--search-result`

Search result component for displaying individual search results.

_The search result component appears as a clean, structured layout with a light background. It features a prominent title area, likely intended for displaying the search result title, and a space for a preview image on the left. The overall design is simple and functional, focusing on clarity and ease of reading._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container
    - **content** — `<div>` · container
      - **header** — `<div>` · container
        - **title** — `<a>` · control
      - **link** — `<a>` · control
      - **matches** — `<div>` · container
        - **search-result-match** — `<a>` · slot · repeated
      - **rich-text** — `<div>` · slot
    - **preview-image-row** — `<div>` · container
      - **preview-image-wrapper** — `<a>` · control
        - **child-2** — `<noscript>` · container
        - **preview-image** — `<img>` · media

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| imageColSize | enum | content *(unproven)* |  |
| initialMatch | string | content *(unproven)* |  |
| previewImage | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |
| url | string | presence | search-result-match |

<small>\* = default</small>

**Variants**
- corporate-search-result--default — _This variant of the search result component is significantly larger, with a more detailed and expanded layout. It includes a visible header and link area, and introduces a section for matches that displays prominently. The design now accommodates rich text content, enhancing the component's informational depth and visual complexity._

**Slots**
- `matches` → `root` — items: snippet, title, url · observed counts: 0, 3

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.5 — 2/2 configurations proven; no story for `showLink: false`
