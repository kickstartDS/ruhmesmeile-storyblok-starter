## Blog Teaser
`<div>` · `.l-container.l-container--blog-teaser`

Display a blog teaser with date, tags, headline, teaser text and author

_The Blog Teaser component features a clean and minimal design with a prominent headline in bold, dark text, creating a strong focal point. Below the headline, there is a lighter, smaller teaser text that provides a brief introduction to the blog post. The overall layout is spacious, with a soft background that enhances readability and gives a modern, professional impression._

**Anatomy**
- **root** — `<div>` · container
  - **avatar** — `<article>` · container · conditional
    - **child-1** — `<div>` · container · conditional
      - **body** — `<div>` · container · conditional
        - **link** — `<div>` · container · conditional
          - **button** — `<button>` · slot · conditional
        - **text** — `<div>` · container · conditional
          - **rich-text** — `<div>` · slot · conditional
          - **topic** — `<p>` · text · conditional
      - **image** — `<div>` · container · conditional
        - **child-2** — `<noscript>` · container · conditional
        - **image** — `<img>` · media · conditional
  - **copy** — `<article>` · container · only when `date` truthy
    - **child-1** — `<div>` · container · only when `date` truthy
      - **child-1** — `<div>` · container · only when `date` truthy
        - **content** — `<span>` · text · only when `date` truthy
      - **child-2** — `<div>` · container · only when `date` truthy
        - **content** — `<span>` · text · only when `date` truthy
    - **child-2** — `<div>` · container · only when `date` truthy
      - **body** — `<div>` · container · only when `date` truthy
        - **link** — `<div>` · container · only when `date` truthy
          - **button** — `<a>` · slot · only when `date` truthy
        - **text** — `<div>` · container · only when `date` truthy
          - **rich-text** — `<div>` · slot · only when `date` truthy
          - **topic** — `<p>` · text · only when `date` truthy
      - **image** — `<div>` · container · only when `date` truthy
        - **child-2** — `<noscript>` · container · only when `date` truthy
        - **image** — `<img>` · media · only when `date` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| alt | string | content *(unproven)* |  |
| author | object | content *(unproven)* |  |
| className | string | content *(unproven)* |  |
| date | string | presence | copy, child-1, child-1, content, child-2, content, child-2, body, link, button, text, rich-text, topic, image, child-2, image |
| headline | string | content *(unproven)* |  |
| image | string | content *(unproven)* |  |
| link | object | content *(unproven)* |  |
| readingTime | string | content *(unproven)* |  |
| teaserText | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- blog-blog-teaser--default — _This variant of the Blog Teaser component includes additional elements that enhance its informational depth. Tags are displayed above the headline, adding context to the content. An image is included on the right, providing a visual element that complements the text. The author, date, and reading time are now present below the teaser text, offering more detailed metadata about the blog post._

**Slots**
- `tags` → `root` — items: entry · observed counts: 0, 2

**Tokens**
- `root/avatar`: `--dsa-blog-teaser--background`, `--dsa-blog-teaser--gap`, `--dsa-blog-teaser__avatar--size`, `--dsa-blog-teaser__copy--color`, `--dsa-blog-teaser__copy--color_hover`, `--dsa-blog-teaser__copy--font`, `--dsa-blog-teaser__copy--margin-top`, `--dsa-blog-teaser__image--border-radius`, `--dsa-blog-teaser__image--transform`, `--dsa-blog-teaser__image--transition`, `--dsa-blog-teaser__meta--color`, `--dsa-blog-teaser__meta--font`, `--dsa-blog-teaser__meta__author--font-weight`, `--dsa-blog-teaser__tag-label--font`, `--dsa-blog-teaser__topic--font`, `--dsa-blog-teaser__topic--font-size`, `--dsa-blog-teaser__topic--font-weight`
- `root/copy`: `--dsa-blog-teaser--background`, `--dsa-blog-teaser--gap`, `--dsa-blog-teaser__avatar--size`, `--dsa-blog-teaser__copy--color`, `--dsa-blog-teaser__copy--color_hover`, `--dsa-blog-teaser__copy--font`, `--dsa-blog-teaser__copy--margin-top`, `--dsa-blog-teaser__image--border-radius`, `--dsa-blog-teaser__image--transform`, `--dsa-blog-teaser__image--transition`, `--dsa-blog-teaser__meta--color`, `--dsa-blog-teaser__meta--font`, `--dsa-blog-teaser__meta__author--font-weight`, `--dsa-blog-teaser__tag-label--font`, `--dsa-blog-teaser__topic--font`, `--dsa-blog-teaser__topic--font-size`, `--dsa-blog-teaser__topic--font-weight`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
