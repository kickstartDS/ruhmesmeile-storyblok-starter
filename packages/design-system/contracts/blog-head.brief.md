## Blog Head
`<div>` · `.c-post-head.dsa-blog-head`

Intro portion of a singular blog entry

_The component features a clean and simple design with a prominent headline in bold, dark text at the top, providing a clear focal point. Below the headline, there is a small image with an alt text description, adding a visual element to the layout. The overall appearance is minimalistic, with a light background that enhances readability and a subtle border that frames the content._

**Anatomy**
- **root** — `<div>` · container
  - **headline** — `<div>` · slot
  - **image** — `<div>` · container
    - **child-2** — `<noscript>` · container
    - **image** — `<img>` · media
  - **meta** — `<div>` · container
    - **child-2** — `<div>` · container · only when `date` truthy
      - **child-1** — `<div>` · container · only when `date` truthy
        - **content** — `<span>` · text · only when `date` truthy
      - **child-2** — `<div>` · container · only when `date` truthy
        - **content** — `<span>` · text · only when `date` truthy
    - **date** — `<time>` · text · only when `date` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| alt | string | content *(unproven)* |  |
| date | string | presence | child-2, child-1, content, child-2, content, date |
| headline | string | content *(unproven)* |  |
| image | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- blog-blog-head--default — _In this variant, the component is significantly larger, with the image expanding to fill most of the space, creating a more immersive visual experience. The addition of a date and extra metadata above the headline provides context and categorization, enhancing the informational aspect of the design. The overall layout feels more dynamic and content-rich compared to the minimalistic default._

**Slots**
- `tags` → `root` — items: entry · observed counts: 0, 2

**Tokens**
- `root`: `--dsa-blog-head--margin-bottom`, `--dsa-blog-head__date--color`, `--dsa-blog-head__date--font`, `--dsa-blog-head__date--font-weight`, `--dsa-blog-head__headline--color`, `--dsa-blog-head__headline--font`, `--dsa-blog-head__headline--font-weight`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
