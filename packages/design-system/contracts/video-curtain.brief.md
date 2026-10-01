## Video Curtain
`<div>` · `.l-container.l-container--visual`

Video curtain component for displaying a video background with overlay text and buttons.

_The Video Curtain component features a clean and minimalistic design with a large, central video background. Overlaying the video is a text area that includes a headline, subtext, and additional descriptive text, all aligned centrally. The overall appearance is sleek and modern, with a focus on the video content, enhanced by the overlay text and buttons for interaction._

**Anatomy**
- **root** — `<div>` · container
  - **video-curtain--color-neutral** — `<div>` · slot · only when `colorNeutral` truthy
    - **content** — `<div>` · container · only when `colorNeutral` truthy
      - **box** — `<div>` · container · only when `colorNeutral` truthy
        - **headline** — `<div>` · slot · only when `colorNeutral` truthy
        - **link** — `<div>` · container · only when `colorNeutral` truthy
          - **child-1** — `<div>` · container · only when `colorNeutral` truthy
            - **button** — `<button>` · slot · only when `colorNeutral` truthy
        - **rich-text** — `<div>` · slot · only when `colorNeutral` truthy
    - **continue** — `<div>` · container · only when `colorNeutral` truthy
      - **continue-btn** — `<button>` · control · only when `colorNeutral` truthy
        - **icon** — `<svg>` · glyph · only when `colorNeutral` truthy
    - **media** — `<div>` · container · only when `colorNeutral` truthy
      - **overlay** — `<div>` · container · only when `colorNeutral` truthy
      - **video** — `<video>` · media · only when `colorNeutral` truthy
  - **video-curtain--content-center** — `<div>` · slot · conditional
    - **content** — `<div>` · container · conditional
      - **box** — `<div>` · container · conditional
        - **headline** — `<div>` · slot · conditional
        - **link** — `<div>` · container · conditional
          - **child-1** — `<div>` · container · conditional
            - **button** — `<button>` · slot · conditional
        - **rich-text** — `<div>` · slot · conditional
    - **continue** — `<div>` · container · conditional
      - **continue-btn** — `<button>` · control · conditional
        - **icon** — `<svg>` · glyph · conditional
    - **media** — `<div>` · container · conditional
      - **overlay** — `<div>` · container · conditional
      - **video** — `<video>` · media · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| colorNeutral | false* · true | presence | video-curtain--color-neutral, content, box, headline, link, child-1, button, rich-text, continue, continue-btn, icon, media, overlay, video |
| headline | string | content *(unproven)* |  |
| highlightText | false* · true | class-toggle | video-curtain--content-center |
| overlay | false* · true | token-swap | height, width |
| sub | string | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| textPosition | enum | content *(unproven)* |  |
| video | object | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `overlay: true` — _In this variant, the Video Curtain component introduces an overlay that adds a subtle layer over the video background, enhancing the text's visibility. The content box now has defined dimensions, providing structure to the headline, subtext, and additional descriptive text. A new interactive button appears, offering a call-to-action that complements the overall design._
- `colorNeutral: true`, `highlightText: true`, `overlay: true` — _The variant of the Video Curtain component introduces a neutral color scheme, giving it a softer and more subdued appearance. The overlay is more pronounced, with highlighted text that stands out against the video background, enhancing readability. This version maintains the modern aesthetic but with a calmer, more balanced visual impact._
- `highlightText: true`, `overlay: true` — _In this variant of the Video Curtain component, the overlay text area is more prominent, with increased dimensions for both the headline and the overall text box. The headline is now wider and taller, enhancing its visibility and impact. Additionally, the presence of the highlight text class adds emphasis to the text, making it stand out more against the video background._

**Slots**
- `buttons` → `root` — items: icon, label, url · observed counts: 0, 1

**Tokens**
- `root/video-curtain--color-neutral`: `--dsa-video-curtain__copy--color`, `--dsa-video-curtain__copy--font`, `--dsa-video-curtain__headline--color`, `--dsa-video-curtain__subheadline--color`, `--dsa-video-curtain__textbox--background-color`, `--dsa-video-curtain__textbox--border-radius`, `--dsa-video-curtain__textbox--padding`, `--dsa-video-curtain_bottom__overlay--background`, `--dsa-video-curtain_color-neutral__copy--color`, `--dsa-video-curtain_color-neutral__headline--color`, `--dsa-video-curtain_color-neutral__subheadline--color`, `--dsa-video-curtain_corner__overlay--background`, `--dsa-video-curtain_highlight-text__copy--font`
- `root/video-curtain--content-center`: `--dsa-video-curtain__copy--color`, `--dsa-video-curtain__copy--font`, `--dsa-video-curtain__headline--color`, `--dsa-video-curtain__subheadline--color`, `--dsa-video-curtain__textbox--background-color`, `--dsa-video-curtain__textbox--border-radius`, `--dsa-video-curtain__textbox--padding`, `--dsa-video-curtain_bottom__overlay--background`, `--dsa-video-curtain_color-neutral__copy--color`, `--dsa-video-curtain_color-neutral__headline--color`, `--dsa-video-curtain_color-neutral__subheadline--color`, `--dsa-video-curtain_corner__overlay--background`, `--dsa-video-curtain_highlight-text__copy--font`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 4/8 configurations proven
