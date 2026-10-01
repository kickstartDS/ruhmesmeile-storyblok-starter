## Section
`<section>` · `.dsa-section.l-section`

Component used to layout components into pages

_The section component has a clean and minimalistic design with a soft blue background that gives it a calm and professional appearance. It features a white rectangular area with rounded corners, creating a subtle contrast against the background. The overall look is simple and spacious, making it suitable for organizing content on a page._

**Anatomy**
- **root** — `<section>` · container
  - **container** — `<div>` · container · repeated
    - **content** — `<div>` · container · conditional
      - **headline** — `<div>` · slot · conditional
  - **slider** — `<div>` · container · conditional
    - **container** — `<div>` · container · conditional
      - **content** — `<div>` · container · conditional
        - **teaser-card** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| backgroundColor | default* · accent · bold | class-toggle | backgroundColor, height |
| backgroundImage | string | content *(unproven)* |  |
| content | object | content *(unproven)* |  |
| headline | object | content *(unproven)* |  |
| inverted | false* · true | class-toggle | backgroundColor, height |
| spaceAfter | enum | content *(unproven)* |  |
| spaceBefore | enum | content *(unproven)* |  |
| transition | enum | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- `backgroundColor: accent` — _This variant of the section component features a slightly darker, more muted background color, creating a subtle shift in tone. The section is significantly taller, providing ample space for additional content. It introduces a structured layout with a prominent headline and subheadline, enhancing its functionality for organizing and presenting information._
- layout-section--background-image — _This variant of the section component features a significantly taller design, creating a more expansive space for content. The background now includes a subtle dotted pattern, adding visual interest while maintaining a professional look. Additionally, the content is aligned to the left, providing a structured and organized layout._
- `backgroundColor: bold` — _The variant differs from the default by having a more pronounced blue background, giving it a bolder appearance. Additionally, the section is significantly taller, providing more space for content._
- layout-section--dynamic-layout — _The variant differs from the default by having a significantly increased height, expanding from 130.75px to 733.484px. This change creates a more spacious area, allowing for additional content and a more open layout while maintaining the clean and professional appearance._
- `style: framed`, `width: wide` — _This variant of the section component is significantly larger, with a height that extends to 1755.84px, creating a more expansive and open layout. The width has increased to 1298.28px, providing a broader space for content. The design now includes a framed style, adding a structured and defined appearance to the section._
- `inverted: true` — _This variant of the section component features a dark blue background, creating a more dramatic and bold appearance compared to the default. The height is significantly increased, providing a more expansive space for content. Additionally, the content is aligned to the left, giving it a structured and organized look._
- layout-section--list-layout — _The variant differs from the default by having a significantly increased height, creating a more expansive area for content. This change allows for the inclusion of multiple content blocks, such as headlines and descriptive text, while maintaining the clean and professional appearance with a soft blue background and white content areas._
- layout-section--slider — _This variant of the section component is significantly taller, providing more vertical space. It introduces a slider element containing teaser cards, which adds an interactive and dynamic aspect to the layout. The content is aligned to the left, enhancing the structured and organized appearance of the section._
- layout-section--tile-layout — _The variant differs from the default by having a significantly increased height, creating a more expansive area for content. This change enhances the section's capacity to organize and display multiple elements, such as headlines and cards, while maintaining the clean and professional appearance._
- layout-section--with-buttons — _The variant differs from the default by having a significantly increased height, expanding from 130.75px to 1401.11px. This change creates a more extensive area for content, allowing for additional elements such as headlines and topic teasers, while maintaining the clean and professional appearance._

**Slots**
- `components` → `root` — accepts 28 component types · observed counts: 0
- `buttons` → `root` — items: disabled, icon, label, size, type, url, variant · observed counts: 0, 2

**Tokens**
- `root`: `--dsa-section--background-color_accent`, `--dsa-section--background-color_bold`, `--dsa-section--background-color_default`, `--dsa-section--gutter_default`, `--dsa-section--gutter_large`, `--dsa-section--gutter_small`, `--dsa-section--space_default`, `--dsa-section--space_small` _(+29 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.63 — 11/720 configurations proven; no story for `aiDraft: true`, `headerSpacing: true`, `spotlight: true`, `style: deko`, `width: full, max, narrow`
