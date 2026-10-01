## Gallery
`<div>` · `.dsa-gallery`

Component used to display a gallery of images

_The gallery component features a clean, minimalist design with a light background and rounded corners, giving it a soft, modern appearance. Images are displayed in a horizontal layout, each accompanied by a caption below, providing a straightforward and organized presentation. The overall look is simple and functional, focusing on the images themselves._

**Anatomy**
- **root** — `<div>` · container
  - **grid** — `<div>` · container · conditional
    - **image** — `<div>` · container · repeated
      - **text-media** — `<div>` · slot · conditional
  - **slider** — `<div>` · container · conditional
    - **slider-track** — `<div>` · container · conditional
      - **slider-item** — `<div>` · container · repeated
        - **text-media** — `<div>` · slot · conditional
  - **slider-controls** — `<div>` · container · conditional
    - **slider-nav** — `<div>` · container · conditional
      - **slider-arrow** — `<button>` · control · repeated
        - **icon** — `<svg>` · glyph · conditional
    - **slider-progress** — `<div>` · container · conditional
      - **slider-progress-bar** — `<div>` · container · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| aspectRatio | unset* · square · wide · landscape | class-toggle | image |
| layout | stack · smallTiles* · largeTiles · slider | class-toggle | grid |
| lightbox | false* · true | layout | gridTemplateColumns, height, width |

<small>\* = default</small>

**Variants**
- `lightbox: true` — _In this variant, the gallery shifts from a horizontal layout to a grid format, accommodating more images in a compact space. The images are resized to smaller dimensions, creating a more dense and organized appearance. This change enhances the gallery's functionality by allowing for a more comprehensive display of images within the same area._
- `aspectRatio: landscape`, `layout: largeTiles` — _In this variant, the gallery shifts to a larger, more spacious layout with images arranged in a grid of large tiles. The images adopt a landscape aspect ratio, creating a more expansive and visually engaging presentation. The overall height of the gallery and images increases significantly, allowing for a more immersive viewing experience._
- `aspectRatio: square`, `lightbox: true` — _In this variant, the gallery shifts from a horizontal to a grid layout, accommodating more images in a compact space. Each image is now square, creating a uniform appearance, and the overall height of the gallery is significantly increased, allowing for a more immersive viewing experience. The lightbox feature enhances interactivity, inviting users to engage more deeply with the images._
- `aspectRatio: landscape`, `layout: stack` — _In this variant, the gallery shifts from a horizontal to a vertical stack layout, significantly increasing its height and creating a more elongated appearance. The images are now displayed in a column, each with a landscape aspect ratio, making them much larger and more prominent. This change emphasizes each image individually, providing a more immersive viewing experience._

**Slots**
- `images` → `root` — items: alt, caption, src · observed counts: 2, 3, 6, 7

**Tokens**
- `root`: `--dsa-gallery--gap-horizontal`, `--dsa-gallery--gap-vertical`, `--dsa-gallery--image-ratio-landscape`, `--dsa-gallery--image-ratio-square`, `--dsa-gallery--image-ratio-wide`, `--dsa-gallery--slider-gap`, `--dsa-gallery--slider-height`, `--dsa-gallery--tile-min-width-large` _(+12 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.9 — 6/32 configurations proven; no story for `aspectRatio: wide`
