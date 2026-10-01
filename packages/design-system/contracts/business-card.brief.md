## Business Card
`<div>` · `.l-container.l-container--business-card`

Business card component representing an individual's or company's contact information and branding.

_The business card component has a clean and professional appearance, featuring a white background with rounded corners. It includes a light blue rectangular area that likely serves as a placeholder for content, such as text or images. The overall design is minimalistic, with a subtle shadow that adds depth and a sense of elegance._

**Anatomy**
- **root** — `<div>` · container
  - **business-card--centered** — `<div>` · slot · only when `centered` truthy
    - **content** — `<div>` · container · only when `centered` truthy
      - **address** — `<address>` · container · only when `centered` truthy
        - **contact** — `<div>` · container · only when `centered` truthy
          - **avatar** — `<img>` · media · only when `centered` truthy
          - **child-2** — `<noscript>` · container · only when `centered` truthy
          - **contact-items** — `<div>` · container · only when `centered` truthy
            - **contact-item** — `<a>` · control · repeated
              - **child-2** — `<span>` · text · only when `centered` truthy
              - **icon** — `<svg>` · glyph · only when `centered` truthy
        - **infos** — `<div>` · container · only when `centered` truthy
          - **location** — `<span>` · container · only when `centered` truthy
            - **child-1** — `<br>` · container · only when `centered` truthy
            - **child-2** — `<br>` · container · only when `centered` truthy
          - **topic** — `<div>` · container · only when `centered` truthy
            - **topic** — `<span>` · text · only when `centered` truthy
      - **buttons** — `<div>` · container · only when `centered` truthy
        - **button** — `<a>` · slot · only when `centered` truthy
      - **logo** — `<a>` · control · only when `centered` truthy
        - **child-2** — `<noscript>` · container · only when `centered` truthy
        - **image** — `<img>` · media · only when `centered` truthy
    - **image** — `<div>` · container · only when `centered` truthy
      - **child-2** — `<noscript>` · container · only when `centered` truthy
      - **image** — `<img>` · media · only when `centered` truthy
  - **child-1** — `<div>` · container · conditional
    - **content** — `<div>` · container · conditional
      - **address** — `<address>` · container · conditional
        - **contact** — `<div>` · container · conditional
          - **avatar** — `<img>` · media · conditional
          - **child-2** — `<noscript>` · container · conditional
          - **contact-items** — `<div>` · container · conditional
            - **contact-item** — `<a>` · control · repeated
              - **child-2** — `<span>` · text · conditional
              - **icon** — `<svg>` · glyph · conditional
        - **infos** — `<div>` · container · conditional
          - **location** — `<span>` · container · conditional
            - **child-1** — `<br>` · container · conditional
            - **child-2** — `<br>` · container · conditional
          - **topic** — `<div>` · container · conditional
            - **topic** — `<span>` · text · conditional
      - **buttons** — `<div>` · container · conditional
        - **button** — `<a>` · slot · conditional
      - **logo** — `<a>` · control · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional
    - **image** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **image** — `<div>` · container · conditional
    - **content** — `<div>` · container · conditional
      - **address** — `<address>` · container · conditional
        - **contact** — `<div>` · container · conditional
          - **avatar** — `<img>` · media · conditional
          - **child-2** — `<noscript>` · container · conditional
          - **contact-items** — `<div>` · container · conditional
            - **contact-item** — `<a>` · control · repeated
              - **child-2** — `<span>` · text · conditional
              - **icon** — `<svg>` · glyph · conditional
        - **infos** — `<div>` · container · conditional
          - **location** — `<span>` · container · conditional
            - **child-1** — `<br>` · container · conditional
            - **child-2** — `<br>` · container · conditional
          - **topic** — `<div>` · container · conditional
            - **topic** — `<span>` · text · conditional
      - **buttons** — `<div>` · container · conditional
        - **button** — `<a>` · slot · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **logo** — `<img>` · media · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| address | string | content *(unproven)* |  |
| avatar | object | content *(unproven)* |  |
| centered | false* · true | presence | backgroundColor, border, borderRadius, color, font, fontWeight, gap, height, padding |
| image | object | content *(unproven)* |  |
| logo | object | content *(unproven)* |  |
| topic | string | content | topic, topic, topic |

<small>\* = default</small>

**Variants**
- `centered: true` — _This variant of the business card component is significantly taller, with a height of 631.75px compared to the default. It features a centered layout with additional elements such as a logo, contact information, and a button, all arranged neatly within the light blue area. The design maintains its professional and minimalistic style, but with more detailed content and a structured presentation._
- corporate-business-card--default — _The variant of the business card component is significantly taller, expanding from a height of 226.406px to 631.75px. It introduces several new elements, including a logo, contact information, and an avatar, all arranged within a light blue area. The design maintains its clean and professional look, but now includes additional content such as an address, contact details, and a button, enhancing its functionality and visual interest._
- corporate-business-card--without-image — _This variant of the business card component is taller and more detailed than the default. It features additional elements such as contact information, a logo, and a button, all arranged within a larger light blue area. The logo now has a blue color scheme, and the overall design includes more text and icons, giving it a more comprehensive and informative appearance._

**Slots**
- `contactLinks` → `root` — items: icon, label, url · observed counts: 0, 3
- `buttons` → `root` — items: label, url · observed counts: 0, 1

**Tokens**
- `root/business-card--centered`: `--dsa-business-card--background-color`, `--dsa-business-card--border`, `--dsa-business-card--border-radius`, `--dsa-business-card--gap`, `--dsa-business-card--padding`, `--dsa-business-card__address--gap`, `--dsa-business-card__avatar--border-radius`, `--dsa-business-card__avatar--size`, `--dsa-business-card__contact--color`, `--dsa-business-card__contact--color_hover`, `--dsa-business-card__contact--font`, `--dsa-business-card__contact--font-weight`, `--dsa-business-card__contact--gap`, `--dsa-business-card__contact--icon-size`, `--dsa-business-card__contact-items--gap`, `--dsa-business-card__image--aspect-ratio`, `--dsa-business-card__image--border-radius`, `--dsa-business-card__infos--color`, `--dsa-business-card__infos--font`, `--dsa-business-card__logo--max-width`, `--dsa-business-card__topic--color`, `--dsa-business-card__topic--font`, `--dsa-business-card__topic--font-weight`, `--dsa-business-card__topic--margin-top`
- `root/child-1`: `--dsa-business-card--background-color`, `--dsa-business-card--border`, `--dsa-business-card--border-radius`, `--dsa-business-card--gap`, `--dsa-business-card--padding`, `--dsa-business-card__address--gap`, `--dsa-business-card__avatar--border-radius`, `--dsa-business-card__avatar--size`, `--dsa-business-card__contact--color`, `--dsa-business-card__contact--color_hover`, `--dsa-business-card__contact--font`, `--dsa-business-card__contact--font-weight`, `--dsa-business-card__contact--gap`, `--dsa-business-card__contact--icon-size`, `--dsa-business-card__contact-items--gap`, `--dsa-business-card__image--aspect-ratio`, `--dsa-business-card__image--border-radius`, `--dsa-business-card__infos--color`, `--dsa-business-card__infos--font`, `--dsa-business-card__logo--max-width`, `--dsa-business-card__topic--color`, `--dsa-business-card__topic--font`, `--dsa-business-card__topic--font-weight`, `--dsa-business-card__topic--margin-top`
- `root/image`: `--dsa-business-card--background-color`, `--dsa-business-card--border`, `--dsa-business-card--border-radius`, `--dsa-business-card--gap`, `--dsa-business-card--padding`, `--dsa-business-card__address--gap`, `--dsa-business-card__avatar--border-radius`, `--dsa-business-card__avatar--size`, `--dsa-business-card__contact--color`, `--dsa-business-card__contact--color_hover`, `--dsa-business-card__contact--font`, `--dsa-business-card__contact--font-weight`, `--dsa-business-card__contact--gap`, `--dsa-business-card__contact--icon-size`, `--dsa-business-card__contact-items--gap`, `--dsa-business-card__image--aspect-ratio`, `--dsa-business-card__image--border-radius`, `--dsa-business-card__infos--color`, `--dsa-business-card__infos--font`, `--dsa-business-card__logo--max-width`, `--dsa-business-card__topic--color`, `--dsa-business-card__topic--font`, `--dsa-business-card__topic--font-weight`, `--dsa-business-card__topic--margin-top`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 4/4 configurations proven
