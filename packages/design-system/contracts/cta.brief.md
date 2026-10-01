## Cta
`<div>` · `.l-container.l-container--storytelling`

Call to Action (CTA) component for prompting users to take specific actions on a website.

_The CTA component features a clean and minimalistic design with a light blue background that gives it a calm and inviting appearance. It includes a rounded rectangular button in the center, which stands out due to its white color and subtle shadow, suggesting interactivity. The overall look is simple yet effective, drawing attention to the call to action without overwhelming the viewer._

**Anatomy**
- **root** — `<div>` · container
  - **copy** — `<div>` · container · conditional
    - **box** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **child-3** — `<div>` · container · conditional
          - **button** — `<a>` · slot · repeated
        - **headline** — `<div>` · slot · conditional
        - **rich-text** — `<div>` · slot · conditional
    - **image** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **cta--align-bottom** — `<div>` · slot · conditional
    - **box** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **child-3** — `<div>` · container · conditional
          - **button** — `<a>` · slot · conditional
        - **headline** — `<div>` · slot · conditional
        - **rich-text** — `<div>` · slot · conditional
    - **image** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **cta--color-neutral** — `<div>` · slot · only when `colorNeutral` truthy
    - **box** — `<div>` · container · only when `colorNeutral` truthy
      - **content** — `<div>` · container · only when `colorNeutral` truthy
        - **child-3** — `<div>` · container · only when `colorNeutral` truthy
          - **button** — `<a>` · slot · repeated
        - **headline** — `<div>` · slot · only when `colorNeutral` truthy
        - **rich-text** — `<div>` · slot · only when `colorNeutral` truthy
    - **image** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **cta--highlight-text** — `<div>` · slot · conditional
    - **box** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **child-3** — `<div>` · container · conditional
          - **button** — `<a>` · slot · conditional
        - **headline** — `<div>` · slot · conditional
        - **rich-text** — `<div>` · slot · conditional
    - **image** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **cta--image-padding** — `<div>` · slot · conditional
    - **box** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **child-3** — `<div>` · container · conditional
          - **button** — `<a>` · slot · repeated
        - **headline** — `<div>` · slot · conditional
        - **rich-text** — `<div>` · slot · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| align | center* · top · bottom | token-swap | borderRadius, color, font, gap, height |
| backgroundImage | string | content *(unproven)* |  |
| colorNeutral | false* · true | presence | cta--color-neutral, box, content, child-3, button, headline, rich-text |
| headline | string | content *(unproven)* |  |
| highlightText | false* · true | class-toggle | borderRadius, color, font, gap, height |
| image | object | content *(unproven)* |  |
| padding | false* · true | class-toggle | borderRadius, color, font, gap, height, paddingLeft, paddingRight, width |
| sub | string | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| textAlign | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `align: bottom` — _This variant of the CTA component features a significantly larger height, creating a more spacious layout. The content is aligned towards the bottom, with a prominent image on the left and text elements, including a headline and subheading, on the right. The button is now positioned below the text, maintaining its interactive appearance, while the overall design remains clean and organized._
- `padding: true` — _This variant of the CTA component is more expansive, with a height of 640px, creating a more prominent presence. It introduces a structured layout with a headline, subheading, and descriptive text, accompanied by a "Learn more" button, enhancing its informational aspect. Additionally, an image area is included, adding visual interest and context to the call to action._
- components-cta--banner — _This variant of the CTA component introduces a more structured and content-rich design compared to the default. The height is increased, allowing for the inclusion of a headline, subheading, and additional text, all centrally aligned. The presence of two buttons at the bottom enhances interactivity, providing clear options for user engagement._
- `colorNeutral: true`, `highlightText: true`, `padding: true` — _This variant of the CTA component features a more structured and content-rich design compared to the default. It includes a prominent headline and subheading, along with a descriptive text area, all set against a neutral, muted background that adds emphasis without being overwhelming. The buttons are now integrated within the content area, providing clear options for user interaction._
- `padding: true` — _The variant of the CTA component features a more compact design with a reduced height, giving it a denser appearance. The button is slightly wider, enhancing its prominence. The layout adjustments, including the padding shift, create a more balanced and structured look compared to the default._
- `highlightText: true` — _This variant of the CTA component introduces a more structured and informative layout compared to the default. It features a prominent headline and subheading, providing context and drawing attention. The addition of rich text and a blue button enhances the interactive and engaging nature of the component, making it more visually dynamic and informative._
- components-cta--left-aligned — _This variant of the CTA component is more structured and visually engaging compared to the default. It features a defined height, allowing for a more substantial presence on the page. The button is wider and aligned to the left, creating a more dynamic layout. The text alignment has shifted from center to start, giving the content a more organized and professional appearance._
- `highlightText: true`, `padding: true` — _This variant of the CTA component features a more dynamic design with a background image of a blue dot carpet pattern, adding visual interest. The layout shifts from a centered alignment to a left-aligned format, with text and buttons positioned to the left, creating a more structured and organized appearance. Additionally, an image is introduced on the left side, enhancing the component's visual appeal and providing a balanced composition._
- `colorNeutral: true`, `padding: true` — _This variant of the CTA component features a taller design with a height of 640px, creating a more spacious layout. The background color shifts to a soft blue, providing a gentle contrast to the content. An image is introduced on the left side, balancing the text and adding visual interest, while the button slightly increases in width, maintaining its central role in prompting user interaction._

**Slots**
- `buttons` → `root` — items: icon, label, url · observed counts: 0, 1, 2

**Tokens**
- `root/copy`: `--dsa-cta--border-radius`, `--dsa-cta--gap`, `--dsa-cta__content--horizontal-padding`, `--dsa-cta__content--max-width`, `--dsa-cta__content--vertical-padding`, `--dsa-cta__copy--color`, `--dsa-cta__copy--font`, `--dsa-cta__headline--color`, `--dsa-cta__image--padding`, `--dsa-cta__subheadline--color`, `--dsa-cta_color-neutral__copy--color`, `--dsa-cta_color-neutral__headline--color`, `--dsa-cta_color-neutral__subheadline--color`, `--dsa-cta_highlight-text__copy--font`, `--dsa-cta_highlight-text__headline--font`
- `root/cta--align-bottom`: `--dsa-cta--border-radius`, `--dsa-cta--gap`, `--dsa-cta__content--horizontal-padding`, `--dsa-cta__content--max-width`, `--dsa-cta__content--vertical-padding`, `--dsa-cta__copy--color`, `--dsa-cta__copy--font`, `--dsa-cta__headline--color`, `--dsa-cta__image--padding`, `--dsa-cta__subheadline--color`, `--dsa-cta_color-neutral__copy--color`, `--dsa-cta_color-neutral__headline--color`, `--dsa-cta_color-neutral__subheadline--color`, `--dsa-cta_highlight-text__copy--font`, `--dsa-cta_highlight-text__headline--font`
- `root/cta--color-neutral`: `--dsa-cta--border-radius`, `--dsa-cta--gap`, `--dsa-cta__content--horizontal-padding`, `--dsa-cta__content--max-width`, `--dsa-cta__content--vertical-padding`, `--dsa-cta__copy--color`, `--dsa-cta__copy--font`, `--dsa-cta__headline--color`, `--dsa-cta__image--padding`, `--dsa-cta__subheadline--color`, `--dsa-cta_color-neutral__copy--color`, `--dsa-cta_color-neutral__headline--color`, `--dsa-cta_color-neutral__subheadline--color`, `--dsa-cta_highlight-text__copy--font`, `--dsa-cta_highlight-text__headline--font`
- `root/cta--highlight-text`: `--dsa-cta--border-radius`, `--dsa-cta--gap`, `--dsa-cta__content--horizontal-padding`, `--dsa-cta__content--max-width`, `--dsa-cta__content--vertical-padding`, `--dsa-cta__copy--color`, `--dsa-cta__copy--font`, `--dsa-cta__headline--color`, `--dsa-cta__image--padding`, `--dsa-cta__subheadline--color`, `--dsa-cta_color-neutral__copy--color`, `--dsa-cta_color-neutral__headline--color`, `--dsa-cta_color-neutral__subheadline--color`, `--dsa-cta_highlight-text__copy--font`, `--dsa-cta_highlight-text__headline--font`
- `root/cta--image-padding`: `--dsa-cta--border-radius`, `--dsa-cta--gap`, `--dsa-cta__content--horizontal-padding`, `--dsa-cta__content--max-width`, `--dsa-cta__content--vertical-padding`, `--dsa-cta__copy--color`, `--dsa-cta__copy--font`, `--dsa-cta__headline--color`, `--dsa-cta__image--padding`, `--dsa-cta__subheadline--color`, `--dsa-cta_color-neutral__copy--color`, `--dsa-cta_color-neutral__headline--color`, `--dsa-cta_color-neutral__subheadline--color`, `--dsa-cta_highlight-text__copy--font`, `--dsa-cta_highlight-text__headline--font`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.82 — 10/48 configurations proven; no story for `align: top`, `inverted: true`
