## Event Registration
`<div>` · `.dsa-event-registration`

Event registration component for users to register for events.

_The Event Registration component features a clean and organized layout with a soft blue header containing icons for date, location, and time. Below, there are two input fields with rounded edges, providing a modern and approachable feel. A checkbox is positioned to the left, accompanied by a subtle "Mandatory" label, and a small, rounded blue button is placed on the right, adding a touch of color and emphasis._

**Anatomy**
- **root** — `<div>` · container
  - **form** — `<form>` · container
    - **footer** — `<div>` · container
      - **button** — `<a>` · slot
      - **mandatory-text** — `<em>` · text
    - **inputs** — `<div>` · container
      - **checkbox** — `<div>` · slot
      - **text-field** — `<div>` · slot · repeated
  - **headline** — `<header>` · slot · only when `label` truthy
  - **infos** — `<div>` · container
    - **details** — `<div>` · container
      - **date** — `<div>` · container
        - **info** — `<span>` · container · repeated
          - **icon** — `<svg>` · glyph
      - **info** — `<div>` · container
        - **child-2** — `<address>` · container
          - **location-address** — `<span>` · container
            - **child-1** — `<br>` · container · only when `label` truthy
          - **location-name** — `<span>` · text · only when `label` truthy
        - **icon** — `<svg>` · glyph
    - **link** — `<a>` · control

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| confirmationCheckboxLabel | string | content *(unproven)* |  |
| cta | object | content *(unproven)* |  |
| date | string | content *(unproven)* |  |
| emailInput | object | content *(unproven)* |  |
| label | string | presence | headline, child-1, location-name |
| link | object | content *(unproven)* |  |
| location | object | content *(unproven)* |  |
| mandatoryText | string | content *(unproven)* |  |
| nameInput | object | content *(unproven)* |  |
| time | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-registration--default — _In this variant, the Event Registration component is more detailed and expanded. It includes a prominent headline and additional information such as the event date, location, and time, which are clearly displayed with increased dimensions. The input fields are larger, and the button is significantly wider, providing a more substantial and inviting appearance. A link for more information is also present, enhancing the component's functionality._

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
