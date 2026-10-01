## TextArea
`<div>` · `.dsa-text-area`

TextArea buttons allow users to select a single option from a list of mutually exclusive options.

_The TextArea component is enclosed within a softly rounded rectangular container with a subtle shadow, giving it a slightly elevated appearance. Inside, there's a label in bold, dark text above a large, white text area with rounded corners, which is outlined in a light gray, providing a clean and minimalistic look. The overall design is simple and functional, focusing on clarity and ease of use._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<label>` · container
    - **field** — `<div>` · container
      - **input** — `<textarea>` · control
    - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| hint | string | content *(unproven)* |  |
| icon | string | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| placeholder | string | content *(unproven)* |  |
| value | string | content *(unproven)* |  |

<small>\* = default</small>

**Tokens**
- `root`: `--dsa-text-area--background`, `--dsa-text-area--background_focus`, `--dsa-text-area--border`, `--dsa-text-area--border-color`, `--dsa-text-area--border-color_active`, `--dsa-text-area--border-color_focus`, `--dsa-text-area--border-color_hover`, `--dsa-text-area--color` _(+7 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.17 — 1/8 configurations proven; no story for `disabled: true`, `hideLabel: false, true`, `invalid: false, true`
