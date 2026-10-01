## TextField
`<div>` · `.dsa-text-field`

TextField buttons allow users to select a single option from a list of mutually exclusive options.

_The TextField component is enclosed in a softly rounded rectangular container with a subtle shadow, giving it a slightly elevated appearance against the background. Inside, there's a label in bold, dark text above a long, narrow input field with rounded corners, which appears empty and ready for user input. The overall design is clean and minimalistic, emphasizing functionality and ease of use._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<label>` · container
    - **field** — `<div>` · container
      - **input** — `<input>` · control
    - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| hint | string | content *(unproven)* |  |
| icon | string | content *(unproven)* |  |
| inputMode | enum | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| placeholder | string | content *(unproven)* |  |
| value | string | content *(unproven)* |  |

<small>\* = default</small>

**Tokens**
- `root`: `--dsa-text-field--background`, `--dsa-text-field--background_focus`, `--dsa-text-field--border`, `--dsa-text-field--border-color`, `--dsa-text-field--border-color_active`, `--dsa-text-field--border-color_focus`, `--dsa-text-field--border-color_hover`, `--dsa-text-field--color` _(+9 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.17 — 1/8 configurations proven; no story for `disabled: true`, `hideLabel: false, true`, `invalid: false, true`
