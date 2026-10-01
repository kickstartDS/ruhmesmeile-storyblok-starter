## Teaser Card
`<div>` · `.l-container.l-container--teaser-card`

Component used to tease content

_The Teaser Card component features a clean and structured design, with a prominent image at the top that captures attention. Below the image, there's a headline that stands out, followed by a brief text description that provides additional context. The overall layout is balanced, with a button at the bottom inviting interaction, all set against a light background that enhances readability and focus._

**Anatomy**
- **root** — `<div>` · container
  - **teaser-card--compact** — `<div>` · slot · conditional
    - **child-1** — `<div>` · container · conditional
      - **body** — `<div>` · container · conditional
        - **link** — `<div>` · container · conditional
          - **button** — `<a>` · slot · conditional
        - **text** — `<div>` · container · conditional
          - **rich-text** — `<div>` · slot · conditional
          - **topic** — `<p>` · container · conditional
            - **headline** — `<span>` · text · conditional
      - **child-1** — `<div>` · container · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional
  - **teaser-card--landscape** — `<div>` · slot · conditional
    - **child-1** — `<div>` · container · conditional
      - **body** — `<div>` · container · conditional
        - **link** — `<div>` · container · conditional
          - **button** — `<a>` · slot · conditional
        - **text** — `<div>` · container · conditional
          - **rich-text** — `<div>` · slot · conditional
          - **topic** — `<p>` · container · conditional
            - **headline** — `<span>` · text · conditional
      - **child-1** — `<div>` · container · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional
  - **teaser-card--no-image** — `<div>` · slot · conditional
    - **child-1** — `<div>` · container · conditional
      - **body** — `<div>` · container · conditional
        - **text** — `<div>` · container · conditional
          - **topic** — `<p>` · container · conditional
            - **child-1** — `<span>` · container · conditional
  - **teaser-card--no-link** — `<div>` · slot · conditional
    - **child-1** — `<div>` · container · conditional
      - **body** — `<div>` · container · conditional
        - **link** — `<div>` · container · conditional
          - **button** — `<a>` · slot · conditional
        - **text** — `<div>` · container · conditional
          - **rich-text** — `<div>` · slot · conditional
          - **topic** — `<p>` · container · conditional
            - **headline** — `<span>` · text · conditional
      - **child-1** — `<div>` · container · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional
    - **child-2** — `<div>` · container · only when `label` truthy
      - **body** — `<div>` · container · only when `label` truthy
        - **link** — `<div>` · container · only when `label` truthy
          - **button** — `<a>` · slot · only when `label` truthy
        - **text** — `<div>` · container · only when `label` truthy
          - **rich-text** — `<div>` · slot · only when `label` truthy
          - **topic** — `<p>` · container · only when `label` truthy
            - **headline** — `<span>` · text · only when `label` truthy
      - **child-1** — `<div>` · container · only when `label` truthy
        - **child-2** — `<noscript>` · container · only when `label` truthy
        - **image** — `<img>` · media · only when `label` truthy
    - **label** — `<span>` · text · only when `label` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| button | object | content *(unproven)* |  |
| headline | string | content | headline, headline, headline, headline |
| image | string | content *(unproven)* |  |
| imageAlt | string | content *(unproven)* |  |
| imageRatio | enum | content *(unproven)* |  |
| label | string | presence | child-2, body, link, button, text, rich-text, topic, headline, child-1, child-2, image, label |
| layout | stack* · row · compact | class-toggle | background, border, color, font, fontWeight, gap, height |
| text | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `layout: compact` — _The compact variant of the Teaser Card features a more condensed layout, with the image and text elements closely integrated. The image remains prominent, but the text and button are more tightly grouped, creating a cohesive and efficient use of space. This design maintains clarity and focus while offering a more streamlined appearance compared to the default._
- components-teaser-card--page-navigation — _The variant of the Teaser Card features a landscape layout, which alters the overall structure compared to the default. The image is positioned prominently, maintaining its attention-grabbing role, but the text and button are arranged to complement this new orientation. The design remains clean and inviting, with a clear emphasis on the headline and call-to-action button, set against a light background for enhanced readability._
- components-teaser-card--product-tiles — _The variant of the Teaser Card differs from the default by having a significantly taller height, creating a more spacious layout. It introduces a new structure with additional elements such as a body section containing a link and button, as well as a rich-text area with a topic headline. The overall design maintains a clean and organized appearance, but with more detailed content presentation._
- `layout: row` — _The variant of the Teaser Card component features a horizontal layout, indicated by the addition of the "dsa-teaser-card--row" class. It includes a category label at the top right, which wasn't present in the default. The overall height of the card is reduced, creating a more compact appearance while maintaining the structured design._

**Tokens**
- `layout`: `--dsa-teaser-card_{layout}--border`, `--dsa-teaser-card_{layout}--border-color_hover`, `--dsa-teaser-card_{layout}--overlay`, `--dsa-teaser-card_{layout}--overlay_with-label`
- `root/teaser-card--compact`: `--dsa-teaser-card--background`, `--dsa-teaser-card--background_hover`, `--dsa-teaser-card--border`, `--dsa-teaser-card--border-color_hover`, `--dsa-teaser-card--border-radius`, `--dsa-teaser-card--padding`, `--dsa-teaser-card--shadow`, `--dsa-teaser-card--shadow_hover`, `--dsa-teaser-card__body--gap`, `--dsa-teaser-card__button--font`, `--dsa-teaser-card__copy--color`, `--dsa-teaser-card__copy--font`, `--dsa-teaser-card__copy--margin-top`, `--dsa-teaser-card__image--border-radius`, `--dsa-teaser-card__image--padding`, `--dsa-teaser-card__image--transform_hover`, `--dsa-teaser-card__image--transition`, `--dsa-teaser-card__label--background-color`, `--dsa-teaser-card__label--border`, `--dsa-teaser-card__label--border-radius`, `--dsa-teaser-card__label--color`, `--dsa-teaser-card__label--font`, `--dsa-teaser-card__label--font-weight`, `--dsa-teaser-card__label--padding`, `--dsa-teaser-card__topic--color`, `--dsa-teaser-card__topic--font`, `--dsa-teaser-card__topic--font-weight`, `--dsa-teaser-card_compact--border`, `--dsa-teaser-card_compact--overlay`, `--dsa-teaser-card_compact--overlay_with-label`
- `root/teaser-card--landscape`: `--dsa-teaser-card--background`, `--dsa-teaser-card--background_hover`, `--dsa-teaser-card--border`, `--dsa-teaser-card--border-color_hover`, `--dsa-teaser-card--border-radius`, `--dsa-teaser-card--padding`, `--dsa-teaser-card--shadow`, `--dsa-teaser-card--shadow_hover`, `--dsa-teaser-card__body--gap`, `--dsa-teaser-card__button--font`, `--dsa-teaser-card__copy--color`, `--dsa-teaser-card__copy--font`, `--dsa-teaser-card__copy--margin-top`, `--dsa-teaser-card__image--border-radius`, `--dsa-teaser-card__image--padding`, `--dsa-teaser-card__image--transform_hover`, `--dsa-teaser-card__image--transition`, `--dsa-teaser-card__label--background-color`, `--dsa-teaser-card__label--border`, `--dsa-teaser-card__label--border-radius`, `--dsa-teaser-card__label--color`, `--dsa-teaser-card__label--font`, `--dsa-teaser-card__label--font-weight`, `--dsa-teaser-card__label--padding`, `--dsa-teaser-card__topic--color`, `--dsa-teaser-card__topic--font`, `--dsa-teaser-card__topic--font-weight`, `--dsa-teaser-card_compact--border`, `--dsa-teaser-card_compact--overlay`, `--dsa-teaser-card_compact--overlay_with-label`
- `root/teaser-card--no-image`: `--dsa-teaser-card--background`, `--dsa-teaser-card--background_hover`, `--dsa-teaser-card--border`, `--dsa-teaser-card--border-color_hover`, `--dsa-teaser-card--border-radius`, `--dsa-teaser-card--padding`, `--dsa-teaser-card--shadow`, `--dsa-teaser-card--shadow_hover`, `--dsa-teaser-card__body--gap`, `--dsa-teaser-card__button--font`, `--dsa-teaser-card__copy--color`, `--dsa-teaser-card__copy--font`, `--dsa-teaser-card__copy--margin-top`, `--dsa-teaser-card__image--border-radius`, `--dsa-teaser-card__image--padding`, `--dsa-teaser-card__image--transform_hover`, `--dsa-teaser-card__image--transition`, `--dsa-teaser-card__label--background-color`, `--dsa-teaser-card__label--border`, `--dsa-teaser-card__label--border-radius`, `--dsa-teaser-card__label--color`, `--dsa-teaser-card__label--font`, `--dsa-teaser-card__label--font-weight`, `--dsa-teaser-card__label--padding`, `--dsa-teaser-card__topic--color`, `--dsa-teaser-card__topic--font`, `--dsa-teaser-card__topic--font-weight`, `--dsa-teaser-card_compact--border`, `--dsa-teaser-card_compact--overlay`, `--dsa-teaser-card_compact--overlay_with-label`
- `root/teaser-card--no-link`: `--dsa-teaser-card--background`, `--dsa-teaser-card--background_hover`, `--dsa-teaser-card--border`, `--dsa-teaser-card--border-color_hover`, `--dsa-teaser-card--border-radius`, `--dsa-teaser-card--padding`, `--dsa-teaser-card--shadow`, `--dsa-teaser-card--shadow_hover`, `--dsa-teaser-card__body--gap`, `--dsa-teaser-card__button--font`, `--dsa-teaser-card__copy--color`, `--dsa-teaser-card__copy--font`, `--dsa-teaser-card__copy--margin-top`, `--dsa-teaser-card__image--border-radius`, `--dsa-teaser-card__image--padding`, `--dsa-teaser-card__image--transform_hover`, `--dsa-teaser-card__image--transition`, `--dsa-teaser-card__label--background-color`, `--dsa-teaser-card__label--border`, `--dsa-teaser-card__label--border-radius`, `--dsa-teaser-card__label--color`, `--dsa-teaser-card__label--font`, `--dsa-teaser-card__label--font-weight`, `--dsa-teaser-card__label--padding`, `--dsa-teaser-card__topic--color`, `--dsa-teaser-card__topic--font`, `--dsa-teaser-card__topic--font-weight`, `--dsa-teaser-card_compact--border`, `--dsa-teaser-card_compact--overlay`, `--dsa-teaser-card_compact--overlay_with-label`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.71 — 5/12 configurations proven; no story for `centered: true`, `imageHoverEffect: false`
