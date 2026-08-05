## Blog Aside
`<div>` · `.l-container.l-container--blog-aside`

Meta info for a singular blog entry

**Anatomy**
- **root** — `<div>` · container
  - **icon** — `<div>` · container · only when `socialSharing` non-empty
    - **child-3** — `<div>` · container · only when `socialSharing` non-empty
      - **headline** — `<header>` · slot · only when `socialSharing` non-empty
      - **share-bar** — `<div>` · container · only when `socialSharing` non-empty
        - **link** — `<a>` · control · repeated
          - **icon** — `<svg>` · glyph · only when `socialSharing` non-empty
    - **contact** — `<div>` · slot · only when `socialSharing` non-empty
    - **meta** — `<div>` · container · only when `socialSharing` non-empty
      - **item** — `<span>` · container · repeated
        - **icon** — `<svg>` · glyph · only when `socialSharing` non-empty
  - **image** — `<div>` · container · conditional
    - **child-3** — `<div>` · container · conditional
      - **headline** — `<header>` · slot · conditional
      - **share-bar** — `<div>` · container · conditional
    - **contact** — `<div>` · slot · conditional
    - **meta** — `<div>` · container · conditional
      - **item** — `<span>` · container · conditional
        - **icon** — `<svg>` · glyph · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| author | object | content *(unproven)* |  |
| className | string | content *(unproven)* |  |
| date | string | content *(unproven)* |  |
| readingTime | string | content *(unproven)* |  |
| socialSharing | array | presence | icon, child-3, headline, share-bar, link, icon, contact, meta, item, icon |

<small>\* = default</small>

**Slots**
- `socialSharing` → `root/icon` — items: icon, title, url · observed counts: 0, 2

**Tokens**
- `root/icon`: `--dsa-blog-aside--gap`, `--dsa-blog-aside__author--gap-horizontal`, `--dsa-blog-aside__author--gap-vertical`, `--dsa-blog-aside__author__body--flex-basis`, `--dsa-blog-aside__author__image--flex-basis`, `--dsa-blog-aside__author__link--font`, `--dsa-blog-aside__author__subtitle--font`, `--dsa-blog-aside__author__title--font`, `--dsa-blog-aside__meta__item--color`, `--dsa-blog-aside__meta__item--font`, `--dsa-blog-aside__meta__item__icon--size`, `--dsa-blog-aside__share-bar__icon--size`, `--dsa-blog-aside__sharebar__link--color`, `--dsa-blog-aside__sharebar__link--color_hover`
- `root/image`: `--dsa-blog-aside--gap`, `--dsa-blog-aside__author--gap-horizontal`, `--dsa-blog-aside__author--gap-vertical`, `--dsa-blog-aside__author__body--flex-basis`, `--dsa-blog-aside__author__image--flex-basis`, `--dsa-blog-aside__author__link--font`, `--dsa-blog-aside__author__subtitle--font`, `--dsa-blog-aside__author__title--font`, `--dsa-blog-aside__meta__item--color`, `--dsa-blog-aside__meta__item--font`, `--dsa-blog-aside__meta__item__icon--size`, `--dsa-blog-aside__share-bar__icon--size`, `--dsa-blog-aside__sharebar__link--color`, `--dsa-blog-aside__sharebar__link--color_hover`

**Coverage** n/a — 2/2 configurations proven
> ⚠ tokens spell the same element `share-bar` and `sharebar`
