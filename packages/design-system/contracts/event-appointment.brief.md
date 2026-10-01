## Event Appointment
`<a>` · `.dsa-event-appointment`

_The Event Appointment component appears as a sleek, rectangular button with rounded corners, set against a subtle shadowed background that gives it a slightly elevated look. Inside, there's a simple arrow icon on the right, suggesting interactivity, while the rest of the space is reserved for displaying text content like date, label, and time. The overall design is clean and modern, with a focus on functionality and ease of use._

**Anatomy**
- **root** — `<a>` · control
  - **infos** — `<span>` · container
  - **label** — `<span>` · container
    - **icon** — `<svg>` · glyph

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| date | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| time | string | content *(unproven)* |  |

<small>\* = default</small>

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 1/1 configurations proven
