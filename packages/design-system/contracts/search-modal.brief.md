## Search Modal
`<dialog>`

Search modal component for displaying a search interface in a modal dialog.

_The search modal component appears as a clean, minimalistic dialog with a soft blue background. It features a prominent search bar at the top, which is slightly rounded and stands out against the lighter backdrop. The overall design is simple and functional, focusing on providing a straightforward search interface._

**Anatomy**
- **root** — `<dialog>` · container
  - **child-1** — `<span>` · text · only when `form` truthy
  - **section** — `<section>` · slot · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| closeAriaLabel | string | content *(unproven)* |  |
| form | object | presence | child-1 |
| headline | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- corporate-search-modal--pagefind — _The variant differs from the default by transforming the dialog into a button with a more compact and centered layout. The background shifts to a subtle, semi-transparent dark color, and the text is now centered with a bolder font. The button has a slightly rounded top border, and the overall appearance is more structured and defined, with a new child element appearing within the design._

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
