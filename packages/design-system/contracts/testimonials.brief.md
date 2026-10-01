## Testimonials
`<div>`

Display testimonials with an optional image and rating

_The Testimonials component features a clean and structured design with a light background, giving it an airy and approachable feel. It includes a section for text, likely for the testimonial content, and may have space for an optional image and rating. The overall appearance is simple and elegant, focusing on readability and user engagement._

**Anatomy**
- **root** — `<div>` · container
  - **quote** — `<div>` · slot · repeated
  - **slider** — `<div>` · slot · conditional
    - **arrows** — `<div>` · container · conditional
      - **arrow** — `<button>` · control · repeated
        - **icon** — `<svg>` · glyph · conditional
    - **nav** — `<div>` · container · conditional
      - **nav-item** — `<button>` · control · repeated
        - **bullet** — `<span>` · container · conditional
    - **track** — `<div>` · container · conditional
      - **slides** — `<div>` · container · conditional
        - **slide** — `<div>` · container · repeated
          - **quote** — `<div>` · slot · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| layout | slider* · list · alternating | class-toggle | columnGap, display, flexDirection, height, rowGap |
| quoteSigns | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `layout: alternating` — _In this variant, the Testimonials component shifts to a more structured and vertical layout, with elements stacked in a column rather than side by side. The spacing between elements is more pronounced, creating a sense of separation and clarity. Additionally, quote marks are introduced, adding a visual cue that emphasizes the testimonial content._
- `layout: list` — _The variant of the Testimonials component differs from the default by adopting a vertical, columnar layout, which gives it a more elongated appearance. The spacing between elements is increased, creating a more spacious and organized look. This configuration emphasizes a stacked presentation, enhancing the focus on individual testimonials._
- components-testimonials--simple — _This variant of the Testimonials component introduces a more dynamic layout with the addition of a slider feature. It includes navigation elements such as nav items and bullets, enhancing interactivity. The presence of a quote section within the slide adds emphasis to the testimonial content, making it more engaging._
- components-testimonials--slider-layout — _The variant of the Testimonials component introduces a more dynamic and interactive design compared to the default. It features visible navigation arrows and indicators, enhancing user interaction. The layout is more structured, with a defined space for the testimonial content and optional image, maintaining a clean and organized appearance._
- components-testimonials--with-rating — _The variant of the Testimonials component introduces a more dynamic and interactive design compared to the default. It features visible navigation elements, including arrows and navigation dots, enhancing user interaction. The layout is more structured, with a defined space for the testimonial content and optional image, creating a visually engaging experience._
- components-testimonials--with-title — _The variant of the Testimonials component differs from the default by having a defined height, giving it a more substantial and structured appearance. This change enhances the visibility and presence of the testimonial content, making it more prominent and engaging. The overall design remains clean and elegant, maintaining its focus on readability._

**Slots**
- `testimonial` → `root` — items: image, name, quote, rating, title · observed counts: 0, 1, 3

**Tokens**
- `root`: `--dsa-testimonials--gap`, `--dsa-testimonials--padding-left`, `--dsa-testimonials--padding-top`, `--dsa-testimonials__byline--color`, `--dsa-testimonials__byline--font`, `--dsa-testimonials__byline--font-weight`, `--dsa-testimonials__icon--color`, `--dsa-testimonials__icon--content` _(+14 more)_
- `root/slider`: `--dsa-testimonials--gap`, `--dsa-testimonials--padding-left`, `--dsa-testimonials--padding-top`, `--dsa-testimonials__byline--color`, `--dsa-testimonials__byline--font`, `--dsa-testimonials__byline--font-weight`, `--dsa-testimonials__icon--color`, `--dsa-testimonials__icon--content`, `--dsa-testimonials__icon--font-family`, `--dsa-testimonials__icon--font-size`, `--dsa-testimonials__icon--left`, `--dsa-testimonials__icon--transform`, `--dsa-testimonials__image--max-width`, `--dsa-testimonials__list--gap`, `--dsa-testimonials__quote--font`, `--dsa-testimonials__quote--font-weight`, `--dsa-testimonials__quote--margin-bottom`, `--dsa-testimonials__source--color`, `--dsa-testimonials__source--font`, `--dsa-testimonials__source--font-style`, `--dsa-testimonials__source--font-weight`, `--dsa-testimonials__source--text-transform`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 7/7 configurations proven
