## Stats
`<div>` · `.dsa-stats`

Component used to display stats with a number upcounter

_The component features a rectangular box with a subtle shadow, giving it a slightly elevated appearance against the background. Inside, two numbers are centered and displayed in a simple, clean font with a blue color, creating a straightforward and modern look. The overall design is minimalistic, focusing on clarity and ease of reading._

**Anatomy**
- **root** — `<div>` · container
  - **item** — `<div>` · container · repeated
    - **icon** — `<div>` · container · conditional
      - **icon** — `<svg>` · glyph · conditional
    - **number** — `<div>` · container
      - **suffix** — `<span>` · text · conditional
      - **value** — `<span>` · text
    - **rich-text** — `<div>` · slot · conditional
    - **topic** — `<div>` · text · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| align | left · center* | class-toggle | alignItems, height, textAlign, width |

<small>\* = default</small>

**Variants**
- `align: left` — _In this variant, the component's height is increased, giving it a more substantial presence. The numbers and accompanying text are aligned to the left, creating a more structured and organized appearance. Additionally, rich text and topic labels are introduced, adding context and depth to the displayed statistics._
- components-stats--count-up-with-icons — _In this variant, the component is significantly taller, giving it a more spacious appearance. Icons are introduced above each number, adding a visual element that enhances the informational aspect. Additionally, suffixes are now present next to the numbers, providing context and making the data more informative._

**Slots**
- `stat` → `root` — items: description, icon, number, title · observed counts: 2, 3

**Tokens**
- `root`: `--dsa-stats--gap-horizontal`, `--dsa-stats--gap-vertical`, `--dsa-stats__copy--color`, `--dsa-stats__copy--font`, `--dsa-stats__icon--color`, `--dsa-stats__icon--size`, `--dsa-stats__item--gap`, `--dsa-stats__number--background` _(+6 more)_

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 3/3 configurations proven
