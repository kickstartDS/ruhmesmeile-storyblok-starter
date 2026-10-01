## Contact
`<div>` · `.l-container.l-container--contact`

Component used for user interaction

_The component features a clean and minimalistic design with a light blue background that provides a soft, calming effect. It includes a white, rounded rectangle that appears to be a text input field, giving it a modern and approachable look. The overall appearance is simple and functional, focusing on user interaction._

**Anatomy**
- **root** — `<div>` · container
  - **contact--image-full-width** — `<address>` · slot · conditional
    - **body** — `<div>` · container · conditional
      - **header** — `<div>` · container · conditional
        - **subtitle** — `<span>` · text · conditional
        - **title** — `<span>` · text · conditional
      - **links** — `<ul>` · container · conditional
        - **child-1** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
      - **rich-text** — `<div>` · slot · conditional
    - **image-wrap** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **contact--image-square** — `<address>` · slot · conditional
    - **body** — `<div>` · text · conditional
      - **header** — `<div>` · container · conditional
        - **subtitle** — `<span>` · text · conditional
        - **title** — `<span>` · text · conditional
      - **links** — `<ul>` · container · conditional
        - **child-1** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
        - **child-2** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
      - **rich-text** — `<div>` · slot · conditional
    - **image-wrap** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **contact--image-vertical** — `<address>` · slot · conditional
    - **body** — `<div>` · container · conditional
      - **header** — `<div>` · container · conditional
        - **subtitle** — `<span>` · text · conditional
        - **title** — `<span>` · text · conditional
      - **links** — `<ul>` · container · conditional
        - **child-1** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
        - **child-2** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
      - **rich-text** — `<div>` · slot · conditional
    - **image-wrap** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional
  - **contact--image-wide** — `<address>` · slot · conditional
    - **body** — `<div>` · container · conditional
      - **header** — `<div>` · container · conditional
        - **subtitle** — `<span>` · text · conditional
        - **title** — `<span>` · text · conditional
      - **links** — `<ul>` · container · conditional
        - **child-1** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
        - **child-2** — `<li>` · container · conditional
          - **link** — `<a>` · control · conditional
            - **icon** — `<svg>` · glyph · conditional
    - **image-wrap** — `<div>` · container · conditional
      - **child-2** — `<noscript>` · container · conditional
      - **image** — `<img>` · media · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| component | string | content *(unproven)* |  |
| copy | string | content *(unproven)* |  |
| image | object | content *(unproven)* |  |
| subtitle | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- components-contact--circular-avatar — _This variant of the component is significantly more detailed than the default. It features a larger height and includes additional elements such as a header with a title and subtitle, links with icons, and a rich text section. An image wrap with a placeholder image is also present, giving the component a more comprehensive and informative appearance._
- components-contact--full-image-width — _This variant of the component is significantly larger, with a height of 507.797px compared to the default. It introduces a full-width image section on the left, accompanied by a header with a title and subtitle on the right. Below the header, there is rich text and a link with an icon, creating a more detailed and informative layout._
- components-contact--vertical-image-with-paragraph — _This variant of the component is significantly more detailed and visually engaging compared to the default. It features a larger height and includes an image placeholder on the left, with text elements such as a title, subtitle, and descriptive text on the right. Additionally, there are interactive link elements with icons, enhancing the component's functionality and providing a more comprehensive user interaction experience._
- components-contact--wide-image — _This variant of the component is significantly larger, with a height increase to 135.234px. It introduces a structured layout featuring an image placeholder on the left and text elements on the right, including a bold title and a subtitle. Additionally, there are two links with icons, adding a more interactive and informative aspect compared to the default design._

**Slots**
- `links` → `root` — items: ariaLabel, icon, label, newTab, url · observed counts: 0, 1, 2

**Tokens**
- `root/contact--image-full-width`: `--dsa-contact--gap-horizontal`, `--dsa-contact--gap-vertical`, `--dsa-contact__body--flex-basis`, `--dsa-contact__body--gap`, `--dsa-contact__copy--color`, `--dsa-contact__copy--font`, `--dsa-contact__header--gap`, `--dsa-contact__image--border-radius`, `--dsa-contact__image--flex-basis`, `--dsa-contact__link--color`, `--dsa-contact__link--color_hover`, `--dsa-contact__link--font`, `--dsa-contact__link--font-weight`, `--dsa-contact__link--padding-vertical`, `--dsa-contact__link--text-decoration`, `--dsa-contact__link--text-decoration_hover`, `--dsa-contact__link__icon--margin-right`, `--dsa-contact__link__icon--size`, `--dsa-contact__links--gap`, `--dsa-contact__subtitle--color`, `--dsa-contact__subtitle--font`, `--dsa-contact__subtitle--font-weight`, `--dsa-contact__title--color`, `--dsa-contact__title--font`, `--dsa-contact__title--font-weight`
- `root/contact--image-square`: `--dsa-contact--gap-horizontal`, `--dsa-contact--gap-vertical`, `--dsa-contact__body--flex-basis`, `--dsa-contact__body--gap`, `--dsa-contact__copy--color`, `--dsa-contact__copy--font`, `--dsa-contact__header--gap`, `--dsa-contact__image--border-radius`, `--dsa-contact__image--flex-basis`, `--dsa-contact__link--color`, `--dsa-contact__link--color_hover`, `--dsa-contact__link--font`, `--dsa-contact__link--font-weight`, `--dsa-contact__link--padding-vertical`, `--dsa-contact__link--text-decoration`, `--dsa-contact__link--text-decoration_hover`, `--dsa-contact__link__icon--margin-right`, `--dsa-contact__link__icon--size`, `--dsa-contact__links--gap`, `--dsa-contact__subtitle--color`, `--dsa-contact__subtitle--font`, `--dsa-contact__subtitle--font-weight`, `--dsa-contact__title--color`, `--dsa-contact__title--font`, `--dsa-contact__title--font-weight`
- `root/contact--image-vertical`: `--dsa-contact--gap-horizontal`, `--dsa-contact--gap-vertical`, `--dsa-contact__body--flex-basis`, `--dsa-contact__body--gap`, `--dsa-contact__copy--color`, `--dsa-contact__copy--font`, `--dsa-contact__header--gap`, `--dsa-contact__image--border-radius`, `--dsa-contact__image--flex-basis`, `--dsa-contact__link--color`, `--dsa-contact__link--color_hover`, `--dsa-contact__link--font`, `--dsa-contact__link--font-weight`, `--dsa-contact__link--padding-vertical`, `--dsa-contact__link--text-decoration`, `--dsa-contact__link--text-decoration_hover`, `--dsa-contact__link__icon--margin-right`, `--dsa-contact__link__icon--size`, `--dsa-contact__links--gap`, `--dsa-contact__subtitle--color`, `--dsa-contact__subtitle--font`, `--dsa-contact__subtitle--font-weight`, `--dsa-contact__title--color`, `--dsa-contact__title--font`, `--dsa-contact__title--font-weight`
- `root/contact--image-wide`: `--dsa-contact--gap-horizontal`, `--dsa-contact--gap-vertical`, `--dsa-contact__body--flex-basis`, `--dsa-contact__body--gap`, `--dsa-contact__copy--color`, `--dsa-contact__copy--font`, `--dsa-contact__header--gap`, `--dsa-contact__image--border-radius`, `--dsa-contact__image--flex-basis`, `--dsa-contact__link--color`, `--dsa-contact__link--color_hover`, `--dsa-contact__link--font`, `--dsa-contact__link--font-weight`, `--dsa-contact__link--padding-vertical`, `--dsa-contact__link--text-decoration`, `--dsa-contact__link--text-decoration_hover`, `--dsa-contact__link__icon--margin-right`, `--dsa-contact__link__icon--size`, `--dsa-contact__links--gap`, `--dsa-contact__subtitle--color`, `--dsa-contact__subtitle--font`, `--dsa-contact__subtitle--font-weight`, `--dsa-contact__title--color`, `--dsa-contact__title--font`, `--dsa-contact__title--font-weight`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 5/5 configurations proven
