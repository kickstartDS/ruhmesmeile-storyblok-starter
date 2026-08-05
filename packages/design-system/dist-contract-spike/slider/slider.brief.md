## Slider
`<div>` · `.l-container.l-container--slider`

Slider component for displaying a carousel of content components.

**Anatomy**
- **root** — `<div>` · container
  - **arrow** — `<div>` · container · conditional
    - **track** — `<div>` · container · conditional
      - **slides** — `<div>` · container · conditional
  - **child-1** — `<div>` · container · only when `nav` truthy
    - **arrows** — `<div>` · container · only when `nav` truthy
      - **arrow** — `<button>` · control · repeated
        - **icon** — `<svg>` · glyph · only when `nav` truthy
    - **nav** — `<div>` · container · only when `nav` truthy
      - **nav-item** — `<button>` · control · repeated
        - **bullet** — `<span>` · container · only when `nav` truthy
    - **track** — `<div>` · container · only when `nav` truthy
      - **slides** — `<div>` · container · only when `nav` truthy
        - **slide** — `<div>` · container · repeated
          - **teaser-card** — `<div>` · slot · only when `nav` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| nav | false · true | presence | child-1, arrows, arrow, icon, nav, nav-item, bullet, track, slides, slide, teaser-card |
| teaseNeighbours | false* · true | class-toggle | child-1 |

<small>\* = default</small>

**Slots**
- `components` → `root` — accepts 10 component types · observed counts: 0

**Tokens**
- `root/arrow`: `--dsa-slider--animation-duration`, `--dsa-slider--autoplay-duration`, `--dsa-slider__arrow--background-color`, `--dsa-slider__arrow--background-color_active`, `--dsa-slider__arrow--background-color_hover`, `--dsa-slider__arrow--color`, `--dsa-slider__bullet--background-color`, `--dsa-slider__bullet--background-color_active`, `--dsa-slider__bullet--background-color_hover`, `--dsa-slider__bullet--border-color`, `--dsa-slider__bullet--border-color_active`, `--dsa-slider__bullet--border-color_hover`, `--dsa-slider__bullet--size`
- `root/child-1`: `--dsa-slider--animation-duration`, `--dsa-slider--autoplay-duration`, `--dsa-slider__arrow--background-color`, `--dsa-slider__arrow--background-color_active`, `--dsa-slider__arrow--background-color_hover`, `--dsa-slider__arrow--color`, `--dsa-slider__bullet--background-color`, `--dsa-slider__bullet--background-color_active`, `--dsa-slider__bullet--background-color_hover`, `--dsa-slider__bullet--border-color`, `--dsa-slider__bullet--border-color_active`, `--dsa-slider__bullet--border-color_hover`, `--dsa-slider__bullet--size`

**Coverage** 0.6 — 5/32 configurations proven; no story for `arrows: false`, `equalHeight: false`, `nav: false`, `variant: slider`
