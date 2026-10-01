## Content Nav
`<div>` · `.dsa-content-nav`

Content navigation component for navigating related topics or sections within content.

_The Content Nav component features a clean, minimalist design with a white background and rounded corners, giving it a modern and approachable look. It includes a central, elongated blue bar that stands out against the white, suggesting a focus area or interactive element. The overall appearance is sleek and unobtrusive, suitable for guiding users through related topics or sections._

**Anatomy**
- **root** — `<div>` · container
  - **content** — `<div>` · container
    - **links** — `<div>` · container
      - **link** — `<a>` · control · repeated
        - **icon** — `<svg>` · glyph · only when `topic` truthy
    - **more** — `<details>` · container · only when `topic` truthy
      - **more-content** — `<div>` · container · only when `topic` truthy
        - **links** — `<div>` · container · only when `topic` truthy
          - **link** — `<a>` · control · repeated
            - **icon** — `<svg>` · glyph · only when `topic` truthy
      - **toggle-more** — `<summary>` · control · only when `topic` truthy
        - **icon** — `<svg>` · glyph · only when `topic` truthy
        - **toggle-label--less** — `<span>` · text · only when `topic` truthy
        - **toggle-label--more** — `<span>` · text · only when `topic` truthy
    - **topic** — `<div>` · container · only when `topic` truthy
      - **topic** — `<span>` · text · only when `topic` truthy
  - **image** — `<div>` · container · only when `topic` truthy
    - **image** — `<img>` · media · only when `topic` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| image | object | content *(unproven)* |  |
| initiallyShown | number | content *(unproven)* |  |
| topic | string | presence | link, icon, more, more-content, links, link, icon, toggle-more, icon, toggle-label--less, toggle-label--more, topic, topic, image, image |

<small>\* = default</small>

**Variants**
- corporate-content-nav--default — _This variant of the Content Nav component is significantly larger, with a height of 404.281px, and includes additional elements such as an image placeholder and a descriptive topic section. It features a list of links related to the topic, each accompanied by an icon, and a "Show more" toggle that suggests expandable content. The design maintains a clean and organized look, with a light blue background that enhances readability and focus._

**Slots**
- `links` → `root` — items: label, url · observed counts: 0, 9

**Tokens**
- `root`: `--dsa-content-nav--background-color`, `--dsa-content-nav--border`, `--dsa-content-nav--border-radius`, `--dsa-content-nav--gap`, `--dsa-content-nav--padding`, `--dsa-content-nav__image--aspect-ratio`, `--dsa-content-nav__image--border-radius`, `--dsa-content-nav__link--color` _(+10 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
