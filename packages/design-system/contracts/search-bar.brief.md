## Search Bar
`<div>` · `.dsa-search-bar`

Search bar component for user input and search functionality.

_The search bar component features a sleek, rounded rectangular input field with a subtle shadow, giving it a slightly elevated appearance. It includes a placeholder text that reads "Search..." accompanied by a magnifying glass icon, enhancing its intuitive design. Below the input field, there is a hint text that instructs users to press "Enter" to search, adding a functional touch to the overall clean and modern look._

**Anatomy**
- **root** — `<div>` · container
  - **alternative-text** — `<p>` · container · only when `placeholder` truthy
    - **alternativeResult** — `<a>` · control · only when `placeholder` truthy
  - **hint** — `<span>` · container
    - **child-1** — `<kbd>` · text
  - **input-container** — `<div>` · container
    - **icon** — `<svg>` · glyph
    - **text-field** — `<div>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| alternativeResult | string | content | alternativeResult |
| alternativeText | string | content *(unproven)* |  |
| buttonText | string | content *(unproven)* |  |
| hint | string | content *(unproven)* |  |
| placeholder | string | presence | alternative-text, alternativeResult |

<small>\* = default</small>

**Variants**
- corporate-search-bar--default — _In this variant, the search bar component is taller, with the height increased to 114.828px. Additionally, there is new text below the input field that reads "Did you mean AI Conference," providing an alternative suggestion. This addition enhances the component's functionality by offering potential search corrections or suggestions._

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
