## Image Story
`<div>` · `.l-container.l-container--storytelling`

Image story component for displaying an image alongside text content with customizable layout and buttons.

_The Image Story component features a clean and structured layout, with an image prominently displayed alongside text content. The design is balanced, allowing for a harmonious presentation of both visual and textual elements. The overall appearance is modern and adaptable, with customizable options for headlines and text alignment to suit various storytelling needs._

**Anatomy**
- **root** — `<div>` · container
  - **copy** — `<div>` · container
    - **box** — `<div>` · container
      - **content** — `<div>` · container
        - **child-3** — `<div>` · container · only when `headline` truthy
          - **button** — `<a>` · slot · only when `headline` truthy
        - **headline** — `<div>` · slot
        - **rich-text** — `<div>` · slot · only when `headline` truthy
    - **image** — `<div>` · container · only when `headline` truthy
      - **child-2** — `<noscript>` · container · only when `headline` truthy
      - **image** — `<img>` · media · only when `headline` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| headline | string | presence | child-3, button, rich-text, image, child-2, image |
| image | object | content *(unproven)* |  |
| largeHeadline | false* · true | token-swap | height, width |
| sub | string | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| textAlign | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `largeHeadline: true` — _In this variant, the Image Story component features a significantly larger layout, with the height expanded to accommodate more content. The headline is prominently displayed with increased height, enhancing its visual impact. Additionally, new elements such as rich text and a button have been introduced, alongside the image, creating a more dynamic and interactive presentation._

**Slots**
- `buttons` → `root` — items: disabled, icon, label, size, type, url, variant · observed counts: 0, 1

**Tokens**
- `root/copy`: `--dsa-image-story--gap`, `--dsa-image-story--horizontal-padding`, `--dsa-image-story--vertical-padding`, `--dsa-image-story__copy--color`, `--dsa-image-story__copy--font`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.67 — 2/8 configurations proven; no story for `layout: textLeft`, `padding: true`
