## Mosaic
`<div>` · `.dsa-mosaic`

Mosaic component for displaying a collection of tiles in various layouts.

_The Mosaic component displays a collection of tiles arranged in a grid-like layout. It features a combination of images and text blocks, creating a balanced and visually engaging composition. The images are vibrant and dynamic, while the text is presented in a clean, readable font, providing a modern and organized appearance._

**Anatomy**
- **root** — `<div>` · container
  - **storytelling** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| layout | alternate* · textLeft · textRight | token-swap | height |

<small>\* = default</small>

**Variants**
- `layout: textLeft` — _In this variant, the Mosaic component is significantly taller, with the overall height increased to 2160px, giving it a more elongated appearance. The storytelling section within the component is also taller, now at 720px, which allows for more vertical space for content. The layout has shifted to have text on the left, creating a more structured and linear presentation compared to the default grid-like arrangement._
- components-mosaic--colorful-tiles — _In this variant, the Mosaic component is significantly taller, creating a more elongated appearance. The storytelling sections are also taller, allowing for more vertical space for content. This change enhances the visual impact and provides a more spacious layout for the tiles._

**Slots**
- `tile` → `root` — items: backgroundColor, backgroundImage, button, headline, image, sub, text, textColor · observed counts: 2, 3

**Tokens**
- `root`: `--dsa-mosaic--horizontal-padding`, `--dsa-mosaic--vertical-padding`, `--dsa-mosaic__copy--color`, `--dsa-mosaic__copy--font`, `--dsa-mosaic__headline--color`, `--dsa-mosaic__headline--font`, `--dsa-mosaic__subheadline--color`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.6 — 3/6 configurations proven; no story for `largeHeadlines: true`, `layout: textRight`
