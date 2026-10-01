## Headline
`<header>` · `.dsa-headline.dsa-headline--align-left.dsa-headline--space-after-small`

Component used for headlines

_The headline component features a bold, dark text aligned to the left, set against a clean white background. It is enclosed within a rounded rectangle with a subtle shadow, giving it a slightly elevated appearance. The overall design is simple and modern, with a small amount of space following the headline, ensuring clarity and emphasis._

**Anatomy**
- **root** — `<header>` · container
  - **headline** — `<h2>` · container
    - **inner** — `<span>` · container
      - **child-1** — `<span>` · container · conditional
        - **child-1** — `<strong>` · text · conditional
      - **text** — `<span>` · text · conditional
  - **subheadline** — `<p>` · container · only when `sub` truthy
    - **child-1** — `<span>` · container · conditional
      - **child-1** — `<em>` · text · conditional
    - **sub** — `<span>` · text · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| level | enum | content *(unproven)* |  |
| spaceAfter | enum | content *(unproven)* |  |
| style | h1 · h2* · h3 · h4 · p | element-swap | columnGap, fontSize, height, lineHeight, marginBottom, rowGap |
| sub | string | presence | subheadline |
| switchOrder | false* · true | token-swap | height |
| text | string | content | text |

<small>\* = default</small>

**Variants**
- `style: h1` — _The variant headline is larger and more prominent, with an increased font size and line height, enhancing its visibility and impact. The spacing around the text is slightly expanded, contributing to a more spacious and open feel while maintaining the modern and clean design._
- components-headline--h-2 — _The variant differs from the default by having a different text content, "Headline text placeholder," instead of "Lorem ipsum dolor sit amet." The overall design, including the bold, dark text and the clean white background with a subtle shadow, remains consistent with the default._
- `style: h3` — _The variant headline is slightly smaller and more compact compared to the default. The text size and line height are reduced, giving it a more subtle presence. Additionally, the space following the headline is decreased, resulting in a tighter overall appearance._
- `style: h4` — _The variant headline is smaller and more compact compared to the default. The text size is reduced, giving it a more subtle presence, and the spacing around the text is tighter, resulting in a less pronounced elevation effect. The overall appearance is more understated while maintaining the clean and modern design._
- `switchOrder: true` — _In this variant, the headline component is taller, allowing for the inclusion of a subheadline above the main text. The subheadline is presented in a lighter, smaller font, adding context to the bold, prominent main headline below. This configuration enhances the informational hierarchy and visual interest of the component._
- components-headline--with-markdown — _This variant of the headline component is taller, allowing for more content. It introduces a subheadline beneath the main headline, adding depth and context. The main headline includes a portion in blue, creating a visual hierarchy and drawing attention to specific text._
- components-headline--with-subheadline — _The variant differs from the default by having a taller height, which allows for additional content such as a subheading beneath the main headline. This change enhances the component's capacity to convey more information while maintaining its modern and clean design._

**Tokens**
- `style`: `--dsa-headline_{style}--font`, `--dsa-headline_{style}--space-after_large`, `--dsa-headline_{style}--space-after_minimum`, `--dsa-headline_{style}--space-after_small`, `--dsa-headline_{style}__subheadline--font-size`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.6 — 8/30 configurations proven; no story for `align: left, center, right`, `style: p`
