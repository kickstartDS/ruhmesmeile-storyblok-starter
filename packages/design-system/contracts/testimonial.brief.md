## Testimonial
`<div>` · `.l-container.l-container--quote`

Testimonial entry of Testimonials component

_The testimonial component features a clean and modern design with a white background and a subtle shadow, giving it a slightly elevated appearance. The quote is prominently displayed with blue quotation marks, adding a touch of color and emphasis. Below the quote, the author's name is bolded, providing a clear attribution._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container
    - **content** — `<div>` · container
      - **rich-text** — `<div>` · slot
      - **source** — `<div>` · container
        - **source** — `<div>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| image | object | content *(unproven)* |  |
| quote | string | content *(unproven)* |  |
| quoteSigns | enum | content *(unproven)* |  |
| rating | integer | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 1/1 configurations proven
