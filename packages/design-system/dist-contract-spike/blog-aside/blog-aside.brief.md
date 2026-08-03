## Blog Aside
`<div>` · `.l-container.l-container--blog-aside`

Meta info for a singular blog entry

**Anatomy**
- **root** — `<div>` · container
  - **icon** — `<div>` · container
    - **child-3** — `<div>` · container
      - **headline** — `<header>` · slot
      - **share-bar** — `<div>` · container
        - **link** — `<a>` · control · repeated
          - **icon** — `<svg>` · glyph
    - **contact** — `<div>` · slot
    - **meta** — `<div>` · container
      - **item** — `<span>` · container · repeated
        - **icon** — `<svg>` · glyph

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| author | object | content *(unproven)* |  |
| className | string | content *(unproven)* |  |
| date | string | content *(unproven)* |  |
| readingTime | string | content *(unproven)* |  |

<small>\* = default</small>

**Slots**
- `socialSharing` → `root` — items: icon, title, url · observed counts: 2

**Tokens**
- `root/icon`: `--dsa-blog-aside--gap`, `--dsa-blog-aside__author--gap-horizontal`, `--dsa-blog-aside__author--gap-vertical`, `--dsa-blog-aside__author__body--flex-basis`, `--dsa-blog-aside__author__image--flex-basis`, `--dsa-blog-aside__author__link--font`, `--dsa-blog-aside__author__subtitle--font`, `--dsa-blog-aside__author__title--font`, `--dsa-blog-aside__meta__item--color`, `--dsa-blog-aside__meta__item--font`, `--dsa-blog-aside__meta__item__icon--size`, `--dsa-blog-aside__share-bar__icon--size`, `--dsa-blog-aside__sharebar__link--color`, `--dsa-blog-aside__sharebar__link--color_hover`

**Coverage** n/a — 1/1 configurations proven
> ⚠ tokens spell the same element `share-bar` and `sharebar`
