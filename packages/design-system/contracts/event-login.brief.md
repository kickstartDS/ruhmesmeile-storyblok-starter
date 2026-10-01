## Event Login
`<div>` · `.dsa-event-login`

Event login component for user authentication to access event-related content.

_The Event Login component features a clean and simple design with a white background and rounded corners, set against a light blue backdrop. It includes two input fields for username and password, both outlined with subtle shadows. Below the inputs, there's a "Forgot your password?" link in blue, and a small blue button to the right, likely for submission. The overall look is minimalistic and user-friendly._

**Anatomy**
- **root** — `<div>` · container
  - **form** — `<form>` · container
    - **actions** — `<div>` · container
      - **button** — `<button>` · slot
      - **link** — `<a>` · control
    - **inputs** — `<div>` · container
      - **text-field** — `<div>` · slot · repeated
  - **headline** — `<header>` · slot · only when `headline` truthy
  - **text** — `<span>` · container

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| cta | object | content *(unproven)* |  |
| headline | string | presence | headline |
| passwordInput | object | content *(unproven)* |  |
| resetPassword | object | content *(unproven)* |  |
| text | string | content *(unproven)* |  |
| usernameInput | object | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-login--default — _This variant of the Event Login component is larger overall, with increased height for the root, form, and input sections. A headline now appears at the top, adding a welcoming message. The input fields are taller, providing more space for text entry. The "Forgot your password?" link is shorter in width, and the submission button is now a larger, blue link labeled "Login," enhancing its prominence and accessibility._

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
