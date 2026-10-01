## Image Text
`<div>` · `.l-container.l-container--text-media`

Component used to display an image beside or above/below a text block

_The component features a clean, minimalist design with a white text block set against a soft blue background. The text block has rounded corners and a subtle shadow, giving it a slightly elevated appearance. The sample text inside is simple and centered, contributing to an overall balanced and modern look._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container
    - **gallery** — `<div>` · container
      - **media** — `<figure>` · container
        - **child-2** — `<noscript>` · container
        - **image** — `<img>` · media
    - **rich-text** — `<div>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| image | object | content *(unproven)* |  |
| layout | above* · below · beside-right · beside-left | class-toggle | height, justifyContent, maxWidth, paddingBottom, paddingLeft, width |
| text | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- components-image-text--above-layout — _The variant features a significantly larger component, with the height of the root and its child elements expanded to accommodate a more substantial image and text block. The image now occupies a prominent space, with a width of 824px and a height of 547px, giving it a dominant presence beside the text. The overall design maintains its clean and modern aesthetic, but the increased size and inclusion of a placeholder image create a more visually engaging layout._
- `layout: beside-right` — _The variant displays the image beside the text block on the right, significantly increasing the overall height and creating a more expansive layout. The image area is now larger, occupying half the width, with the text aligned to the left, giving a more structured and balanced appearance. The padding adjustments and the image's new position enhance the visual separation between text and image, contributing to a more dynamic and engaging design._

**Tokens**
- `root/child-1`: `--dsa-image-text--color`, `--dsa-image-text--font`, `--dsa-image-text_highlight--color`, `--dsa-image-text_highlight--font`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.5 — 3/8 configurations proven; no story for `highlightText: true`, `layout: below, beside-left`
