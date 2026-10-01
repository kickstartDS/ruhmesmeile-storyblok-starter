## Text
`<div>` · `.l-container.l-container--rich-text`

Component used for displaying text in chapters

_The component features a block of text centered within a white, rounded rectangle that casts a subtle shadow, giving it a slightly elevated appearance against a light blue background. The text is neatly aligned to the left, using a clean, sans-serif font that enhances readability and provides a modern, professional look._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container · conditional
    - **child-1** — `<div>` · container · conditional
      - **child-2** — `<p>` · container · conditional
        - **child-1** — `<strong>` · text · conditional
        - **child-2** — `<strong>` · container · conditional
          - **child-1** — `<a>` · control · conditional
      - **child-3** — `<p>` · container · conditional
        - **child-1** — `<em>` · text · conditional
      - **text** — `<p>` · text · conditional
    - **text** — `<span>` · text · conditional
  - **text--center** — `<div>` · slot · conditional
  - **text--columns** — `<div>` · slot · conditional
  - **text--highlight** — `<div>` · slot · only when `highlightText` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| align | left* · center | token-swap | height |
| highlightText | false* · true | presence | height |
| layout | singleColumn* · multiColumn | token-swap | height |
| text | string | content | text, text |

<small>\* = default</small>

**Variants**
- `align: center` — _In this variant, the text is centered within the white, rounded rectangle, which has increased in height, giving it a more spacious appearance. The overall design maintains its modern and professional look, with the text alignment change enhancing the balance and symmetry of the component._
- `highlightText: true` — _In this variant, the component's height has increased, allowing for more content within the white, rounded rectangle. The text now includes highlighted elements, such as bold and italicized words, and a blue hyperlink, adding emphasis and interactivity to the content._
- `layout: multiColumn` — _In this variant, the text is organized into multiple columns, creating a more structured and segmented appearance compared to the default. The overall height of the component is slightly increased, accommodating the new layout while maintaining the same clean, sans-serif font and modern look. The multi-column format enhances readability by breaking up the text into more digestible sections._
- components-text--single-column — _The variant features a taller block of text within the same white, rounded rectangle, maintaining the subtle shadow and light blue background. The text now includes multiple paragraphs with varied formatting, such as bold and italic styles, and a blue hyperlink, adding visual interest and emphasis to certain parts of the content._

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 5/8 configurations proven
