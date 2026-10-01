## Hero
`<div>` · `.l-container.l-container--hero`

Hero component for displaying a prominent visual section with headline, subheadline, text, and call-to-action buttons.

_The Hero component in its default configuration appears as a large, empty white rectangle with a thin border, suggesting a placeholder for content. It lacks any visible text, images, or buttons, giving it a minimalistic and unadorned look. The absence of elements like a headline or call-to-action buttons makes it appear as a blank canvas ready for customization._

**Anatomy**
- **root** — `<div>` · container
  - **visual** — `<div>` · slot
    - **hero--color-neutral** — `<div>` · slot · only when `colorNeutral` truthy
      - **content** — `<div>` · container · only when `colorNeutral` truthy
        - **box** — `<div>` · container · only when `colorNeutral` truthy
          - **headline** — `<div>` · slot · only when `colorNeutral` truthy
          - **link** — `<div>` · container · only when `colorNeutral` truthy
            - **child-1** — `<div>` · container · only when `colorNeutral` truthy
              - **button** — `<a>` · slot · only when `colorNeutral` truthy
          - **rich-text** — `<div>` · slot · only when `colorNeutral` truthy
      - **media** — `<div>` · container · only when `colorNeutral` truthy
        - **image** — `<picture>` · media · only when `colorNeutral` truthy
        - **overlay** — `<div>` · container · only when `colorNeutral` truthy
    - **hero--content-below** — `<div>` · slot · only when `highlightText` truthy
      - **content** — `<div>` · container · only when `highlightText` truthy
        - **box** — `<div>` · container · only when `highlightText` truthy
          - **headline** — `<div>` · slot · only when `highlightText` truthy
          - **link** — `<div>` · container · only when `highlightText` truthy
            - **child-1** — `<div>` · container · only when `highlightText` truthy
              - **button** — `<a>` · slot · only when `highlightText` truthy
          - **rich-text** — `<div>` · slot · only when `highlightText` truthy
      - **media** — `<div>` · container · only when `highlightText` truthy
        - **image** — `<picture>` · media · only when `highlightText` truthy
        - **overlay** — `<div>` · container · only when `highlightText` truthy
    - **hero--content-left** — `<div>` · slot · only when `textbox` truthy
      - **content** — `<div>` · container · only when `skipButton` truthy
        - **box** — `<div>` · container · only when `skipButton` truthy
          - **headline** — `<div>` · slot · only when `skipButton` truthy
          - **link** — `<div>` · container · only when `skipButton` truthy
            - **child-1** — `<div>` · container · only when `skipButton` truthy
              - **button** — `<a>` · slot · repeated
          - **rich-text** — `<div>` · slot · only when `skipButton` truthy
      - **continue** — `<div>` · container · only when `skipButton` truthy
        - **continue-btn** — `<button>` · control · only when `skipButton` truthy
          - **icon** — `<svg>` · glyph · only when `skipButton` truthy
      - **media** — `<div>` · container · only when `textbox` truthy
        - **image** — `<picture>` · media · only when `textbox` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| colorNeutral | false* · true | presence | hero--color-neutral, content, box, headline, link, child-1, button, rich-text, media, image, overlay |
| headline | string | content *(unproven)* |  |
| highlightText | false* · true | presence | hero--content-below, content, box, headline, link, child-1, button, rich-text, media, image, overlay |
| image | object | content *(unproven)* |  |
| skipButton | false* · true | presence | content, box, headline, link, child-1, button, rich-text, continue, continue-btn, icon |
| sub | string | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| textPosition | enum | content *(unproven)* |  |
| textbox | false · true* | presence | hero--content-left, media, image |

<small>\* = default</small>

**Variants**
- `highlightText: true`, `overlay: true`, `textbox: false` — _This variant of the Hero component is significantly more detailed and visually engaging than the default. It features a larger height, allowing for the inclusion of a headline, subheadline, descriptive text, and a call-to-action button, all positioned below a prominent image with an overlay effect. The overall design is more structured and informative, providing a clear focal point and inviting interaction._
- `height: fullScreen`, `skipButton: true` — _In this variant, the Hero component is significantly taller, expanding from 576px to 900px, creating a more prominent visual presence. It now includes a headline, subheadline, descriptive text, and call-to-action buttons, all contained within a box that appears on the left side. Additionally, a "continue" button with an icon is present, enhancing interactivity and guiding user engagement._
- `colorNeutral: true`, `height: fullImage`, `overlay: true`, `textbox: false` — _The variant of the Hero component is significantly more detailed and visually engaging compared to the default. It features a large, gradient background with a soft overlay, creating a more dynamic and inviting appearance. The addition of a headline, descriptive text, and a call-to-action button provides structure and focus, transforming the component from a blank canvas into a compelling visual section._

**Slots**
- `buttons` → `root` — items: icon, label, url · observed counts: 0, 1, 2

**Tokens**
- `root/visual/hero--color-neutral`: `--dsa-hero--min-height`, `--dsa-hero--min-height_small`, `--dsa-hero__copy--color`, `--dsa-hero__copy--font`, `--dsa-hero__headline--color`, `--dsa-hero__overlay--background`, `--dsa-hero__skip-button--color`, `--dsa-hero__skip-button--shadow`, `--dsa-hero__skip-button--transform_hover`, `--dsa-hero__subheadline--color`, `--dsa-hero__textbox--backdrop-filter`, `--dsa-hero__textbox--background-color`, `--dsa-hero__textbox--border-radius`, `--dsa-hero__textbox--box-shadow`, `--dsa-hero__textbox--max-width`, `--dsa-hero__textbox--padding`, `--dsa-hero_below__textbox--max-width`, `--dsa-hero_below__textbox--padding`, `--dsa-hero_color-neutral__copy--color`, `--dsa-hero_color-neutral__headline--color`, `--dsa-hero_color-neutral__subheadline--color`, `--dsa-hero_corner__overlay--background`, `--dsa-hero_highlight-text__copy--font`, `--dsa-hero_left__overlay--background`, `--dsa-hero_offset__overlay--background`, `--dsa-hero_offset__textbox--max-width`, `--dsa-hero_offset__textbox--offset`, `--dsa-hero_offset__textbox--padding`, `--dsa-hero_right__overlay--background`
- `root/visual/hero--content-below`: `--dsa-hero--min-height`, `--dsa-hero--min-height_small`, `--dsa-hero__copy--color`, `--dsa-hero__copy--font`, `--dsa-hero__headline--color`, `--dsa-hero__overlay--background`, `--dsa-hero__skip-button--color`, `--dsa-hero__skip-button--shadow`, `--dsa-hero__skip-button--transform_hover`, `--dsa-hero__subheadline--color`, `--dsa-hero__textbox--backdrop-filter`, `--dsa-hero__textbox--background-color`, `--dsa-hero__textbox--border-radius`, `--dsa-hero__textbox--box-shadow`, `--dsa-hero__textbox--max-width`, `--dsa-hero__textbox--padding`, `--dsa-hero_below__textbox--max-width`, `--dsa-hero_below__textbox--padding`, `--dsa-hero_color-neutral__copy--color`, `--dsa-hero_color-neutral__headline--color`, `--dsa-hero_color-neutral__subheadline--color`, `--dsa-hero_corner__overlay--background`, `--dsa-hero_highlight-text__copy--font`, `--dsa-hero_left__overlay--background`, `--dsa-hero_offset__overlay--background`, `--dsa-hero_offset__textbox--max-width`, `--dsa-hero_offset__textbox--offset`, `--dsa-hero_offset__textbox--padding`, `--dsa-hero_right__overlay--background`
- `root/visual/hero--content-left`: `--dsa-hero--min-height`, `--dsa-hero--min-height_small`, `--dsa-hero__copy--color`, `--dsa-hero__copy--font`, `--dsa-hero__headline--color`, `--dsa-hero__overlay--background`, `--dsa-hero__skip-button--color`, `--dsa-hero__skip-button--shadow`, `--dsa-hero__skip-button--transform_hover`, `--dsa-hero__subheadline--color`, `--dsa-hero__textbox--backdrop-filter`, `--dsa-hero__textbox--background-color`, `--dsa-hero__textbox--border-radius`, `--dsa-hero__textbox--box-shadow`, `--dsa-hero__textbox--max-width`, `--dsa-hero__textbox--padding`, `--dsa-hero_below__textbox--max-width`, `--dsa-hero_below__textbox--padding`, `--dsa-hero_color-neutral__copy--color`, `--dsa-hero_color-neutral__headline--color`, `--dsa-hero_color-neutral__subheadline--color`, `--dsa-hero_corner__overlay--background`, `--dsa-hero_highlight-text__copy--font`, `--dsa-hero_left__overlay--background`, `--dsa-hero_offset__overlay--background`, `--dsa-hero_offset__textbox--max-width`, `--dsa-hero_offset__textbox--offset`, `--dsa-hero_offset__textbox--padding`, `--dsa-hero_right__overlay--background`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.83 — 4/512 configurations proven; no story for `height: small`, `invertText: true`, `mobileTextBelow: false`
