## Slider
`<div>` · `.l-container.l-container--slider`

Slider component for displaying a carousel of content components.

_The slider component is housed within a light blue container that gives a soft, subtle appearance. It features a white track with rounded edges, creating a clean and modern look. The overall design is minimalistic, focusing on functionality while maintaining an elegant aesthetic._

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

**Variants**
- `arrows: true`, `nav: true` — _This variant of the slider component introduces navigation arrows and a navigation bar with bullet indicators, enhancing interactivity and user control. The container height is significantly increased, allowing for a more spacious display of content. The addition of teaser cards within the slides provides a more engaging and informative experience._
- `arrows: true`, `nav: true` — _In this variant, the slider component is significantly taller, with a height of 596.953px, creating a more prominent presence. It includes navigation arrows on either side, enhancing interactivity and user control. Additionally, the component gains an autoplay feature, indicated by the presence of the class `c-slider--autoplay`, suggesting a dynamic and engaging user experience._
- `arrows: true`, `nav: true` — _This variant of the slider component features a significantly increased height, giving it a more prominent and substantial presence. Additionally, navigation arrows are visible on either side of the content, enhancing interactivity and guiding user engagement. The overall design maintains its clean and modern aesthetic while offering more functionality._
- `arrows: true`, `nav: true`, `teaseNeighbours: true` — _In this variant, the slider component is more compact, with a reduced height and width for the overall container and individual slides. The presence of navigation arrows and indicators adds functionality, while the "teaseNeighbours" feature subtly reveals adjacent slides, enhancing the interactive experience. The design maintains its clean and modern aesthetic but feels more dynamic and engaging._

**Slots**
- `components` → `root` — accepts 10 component types · observed counts: 0

**Tokens**
- `root/arrow`: `--dsa-slider--animation-duration`, `--dsa-slider--autoplay-duration`, `--dsa-slider__arrow--background-color`, `--dsa-slider__arrow--background-color_active`, `--dsa-slider__arrow--background-color_hover`, `--dsa-slider__arrow--color`, `--dsa-slider__bullet--background-color`, `--dsa-slider__bullet--background-color_active`, `--dsa-slider__bullet--background-color_hover`, `--dsa-slider__bullet--border-color`, `--dsa-slider__bullet--border-color_active`, `--dsa-slider__bullet--border-color_hover`, `--dsa-slider__bullet--size`
- `root/child-1`: `--dsa-slider--animation-duration`, `--dsa-slider--autoplay-duration`, `--dsa-slider__arrow--background-color`, `--dsa-slider__arrow--background-color_active`, `--dsa-slider__arrow--background-color_hover`, `--dsa-slider__arrow--color`, `--dsa-slider__bullet--background-color`, `--dsa-slider__bullet--background-color_active`, `--dsa-slider__bullet--background-color_hover`, `--dsa-slider__bullet--border-color`, `--dsa-slider__bullet--border-color_active`, `--dsa-slider__bullet--border-color_hover`, `--dsa-slider__bullet--size`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.6 — 5/32 configurations proven; no story for `arrows: false`, `equalHeight: false`, `nav: false`, `variant: slider`
