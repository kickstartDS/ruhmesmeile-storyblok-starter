## Section
`<section>` · `.dsa-section.l-section`

Component used to layout components into pages

**Anatomy**
- **root** — `<section>` · container
  - **container** — `<div>` · container · repeated
    - **content** — `<div>` · container
      - **headline** — `<div>` · slot
  - **slider** — `<div>` · container · conditional
    - **container** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **teaser-card** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| backgroundColor | default* · accent · bold | class-toggle | backgroundColor, backgroundImage, height |
| backgroundImage | string | content *(unproven)* |  |
| content | object | content *(unproven)* |  |
| headline | object | content *(unproven)* |  |
| inverted | false* · true | class-toggle | backgroundColor, backgroundImage |
| spaceAfter | enum | content *(unproven)* |  |
| spaceBefore | enum | content *(unproven)* |  |
| transition | enum | content *(unproven)* |  |

<small>\* = default</small>

**Slots**
- `components` → `root` — accepts 29 component types
- `buttons` → `root` — items: disabled, icon, label, size, type, url, variant · observed counts: 0, 2

**Tokens**
- `root`: `--dsa-section--background-color_accent`, `--dsa-section--background-color_bold`, `--dsa-section--background-color_default`, `--dsa-section--gutter_default`, `--dsa-section--gutter_large`, `--dsa-section--gutter_small`, `--dsa-section--space_default`, `--dsa-section--space_small` _(+29 more)_

**Coverage** 0.63 — 10/720 configurations proven; no story for `aiDraft: true`, `headerSpacing: true`, `spotlight: true`, `style: deko`, `width: full, max, narrow`
