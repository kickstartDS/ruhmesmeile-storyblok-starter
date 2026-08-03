## Slider
`<div>` · `.l-container.l-container--slider`

Slider component for displaying a carousel of content components.

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container
    - **arrows** — `<div>` · container
      - **arrow** — `<button>` · control · repeated
        - **icon** — `<svg>` · glyph
    - **nav** — `<div>` · container
      - **nav-item** — `<button>` · control · repeated
        - **bullet** — `<span>` · container
    - **track** — `<div>` · container
      - **slides** — `<div>` · container
        - **slide** — `<div>` · container · repeated
          - **teaser-card** — `<div>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| teaseNeighbours | false* · true | class-toggle | height, width |

<small>\* = default</small>

**Slots**
- `components` → `root` — accepts 10 component types

**Tokens**
- `root/child-1`: `--dsa-slider--animation-duration`, `--dsa-slider--autoplay-duration`, `--dsa-slider__arrow--background-color`, `--dsa-slider__arrow--background-color_active`, `--dsa-slider__arrow--background-color_hover`, `--dsa-slider__arrow--color`, `--dsa-slider__bullet--background-color`, `--dsa-slider__bullet--background-color_active`, `--dsa-slider__bullet--background-color_hover`, `--dsa-slider__bullet--border-color`, `--dsa-slider__bullet--border-color_active`, `--dsa-slider__bullet--border-color_hover`, `--dsa-slider__bullet--size`

**Coverage** 0.6 — 3/32 configurations proven; no story for `arrows: false`, `equalHeight: false`, `nav: false`, `variant: slider`
