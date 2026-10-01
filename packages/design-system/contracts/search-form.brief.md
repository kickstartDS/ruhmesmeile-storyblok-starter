## Search Form
`<form>` · `.dsa-search-form`

Search form component for submitting search queries and displaying search results.

_The search form component features a clean and minimalistic design with a rounded rectangular input field prominently placed at the top. It has a subtle shadow effect, giving it a slightly elevated appearance against the light blue background. Below the input field, there is a small instruction text with a key icon, adding a functional touch without overwhelming the simplicity of the design._

**Anatomy**
- **root** — `<form>` · container
  - **child-2** — `<div>` · container
    - **child-1** — `<li>` · container
      - **search-result** — `<div>` · slot
    - **link** — `<a>` · control
    - **search-result-match** — `<a>` · slot
  - **nav** — `<div>` · container
    - **button** — `<button>` · slot
    - **pagination** — `<div>` · slot
  - **results** — `<ol>` · container
  - **search-bar** — `<div>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| component | string | content *(unproven)* |  |
| moreButtonLabel | string | content *(unproven)* |  |
| result | object | content *(unproven)* |  |
| resultPerPage | number | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 1/1 configurations proven
