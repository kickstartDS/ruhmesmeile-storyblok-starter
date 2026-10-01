## Event List Teaser
`<div>` · `.l-container.l-container--event-list-teaser`

Display an event teaser with date, title and location

_The Event List Teaser component features a clean and modern design with a white background and subtle shadow, giving it a slightly elevated appearance. The title is bold and prominent at the top, followed by icons and text indicating the date and location, which are neatly aligned and use a soft blue color for the icons. The overall layout is spacious and organized, providing a clear and concise preview of the event details._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<a>` · control
    - **content** — `<div>` · container
      - **cta** — `<div>` · container
        - **child-1** — `<span>` · container · conditional
        - **ctaText** — `<span>` · text · only when `category` truthy
        - **icon** — `<svg>` · glyph
      - **header** — `<div>` · container
        - **category** — `<span>` · text · only when `category` truthy
        - **title** — `<span>` · text
      - **infos** — `<div>` · container
        - **details** — `<div>` · container
          - **date** — `<div>` · container
            - **info** — `<span>` · container · repeated
              - **icon** — `<svg>` · glyph
          - **info** — `<div>` · container
            - **child-2** — `<address>` · container
              - **location-address** — `<span>` · container
                - **child-1** — `<br>` · container · only when `category` truthy
              - **location-name** — `<span>` · text · only when `category` truthy
            - **icon** — `<svg>` · glyph
      - **tags** — `<div>` · container · only when `category` truthy
        - **child-1** — `<div>` · container · only when `category` truthy
          - **content** — `<span>` · text · only when `category` truthy
        - **child-2** — `<div>` · container · only when `category` truthy
          - **content** — `<span>` · text · only when `category` truthy
      - **teaser-text** — `<p>` · text · only when `category` truthy
    - **image** — `<div>` · container · only when `category` truthy
      - **child-2** — `<noscript>` · container · only when `category` truthy
      - **image** — `<img>` · media · only when `category` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| category | string | presence | ctaText, category, child-1, location-name, tags, child-1, content, child-2, content, teaser-text, image, child-2, image |
| className | string | content *(unproven)* |  |
| ctaText | string | content | ctaText |
| date | string | content *(unproven)* |  |
| image | object | content *(unproven)* |  |
| location | object | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| time | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-list-teaser--default — _This variant of the Event List Teaser is more detailed and visually rich compared to the default. It includes a category label above the title, which remains bold and prominent. The layout is expanded to accommodate additional elements such as tags, a teaser text, and an image on the right. The date and location details are more comprehensive, with the location now displayed in a block format, enhancing the overall informational depth and visual appeal._

**Slots**
- `tags` → `root` — items: string · observed counts: 0, 2

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
