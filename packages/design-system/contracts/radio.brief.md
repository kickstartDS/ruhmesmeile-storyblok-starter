## Radio
`<div>` · `.dsa-radio`

Radio buttons allow users to select a single option from a list of mutually exclusive options.

_The radio button component features a circular button with a label to its right, set against a clean, white background. The overall design is simple and minimalistic, with a subtle shadow around the container, giving it a slightly elevated appearance. The text is straightforward and easy to read, contributing to a user-friendly interface._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<label>` · container
    - **field** — `<div>` · container
      - **box** — `<span>` · container
      - **input** — `<input>` · control
      - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| hint | string | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |

<small>\* = default</small>

**Tokens**
- `root`: `--dsa-radio--background`, `--dsa-radio--background_active`, `--dsa-radio--background_checked`, `--dsa-radio--border`, `--dsa-radio--border-color`, `--dsa-radio--border-color_checked`, `--dsa-radio--border-color_focus`, `--dsa-radio--border-color_hover` _(+7 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.25 — 1/4 configurations proven; no story for `disabled: true`, `invalid: false, true`
