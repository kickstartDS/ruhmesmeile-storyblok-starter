## Event Header
`<div>` · `.dsa-event-header`

Event header component for displaying event title, categories, and introductory text.

_The Event Header component features a clean and minimal design with a light blue background that gives it a calm and professional appearance. It includes a rounded rectangular area that likely serves as a placeholder for the event title, categories, or introductory text. The overall look is simple and unobtrusive, focusing on clarity and readability._

**Anatomy**
- **root** — `<div>` · container
  - **categories** — `<div>` · container · only when `title` truthy
    - **category** — `<div>` · container · repeated
      - **content** — `<span>` · text · only when `title` truthy
  - **headline** — `<header>` · slot · only when `title` truthy
  - **rich-text** — `<div>` · slot · only when `title` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| intro | string | content *(unproven)* |  |
| title | string | presence | categories, category, content, headline, rich-text |

<small>\* = default</small>

**Variants**
- event-event-header--default — _In this variant, the Event Header component has expanded to include additional elements such as categories and a headline, giving it a more informative and structured appearance. The categories are displayed as rounded tags above the bold event title, followed by introductory text, all set against the same light blue background. This version is more content-rich and visually engaging compared to the default._

**Slots**
- `categories` → `root` — items: label · observed counts: 0, 2

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
