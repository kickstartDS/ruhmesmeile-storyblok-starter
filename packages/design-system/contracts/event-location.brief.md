## Event Location
`<div>` · `.l-container.l-container--event-location`

Event location component for displaying event dates, location details, and related links.

_The Event Location component features a clean and structured design with a white background and rounded corners, giving it a modern and approachable look. It includes a prominent blue bar that likely serves as a placeholder for text or links, adding a touch of color and emphasis. The overall appearance is minimalistic, focusing on clarity and ease of reading._

**Anatomy**
- **root** — `<div>` · container
  - **event-location--spacious** — `<div>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| address | string | content *(unproven)* |  |
| displayMode | enum | content *(unproven)* |  |
| locationName | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-location--default — _The variant of the Event Location component is significantly taller, expanding from a height of 63.5938px to 212.109px. This increase in height allows for more content to be displayed, such as detailed location information and additional links, while maintaining the clean and structured design with a white background and rounded corners._

**Slots**
- `dates` → `root` — items: ariaLabel, date, label, newTab, time, url · observed counts: 0, 2
- `links` → `root` — items: label, newTab, url · observed counts: 0, 2

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
