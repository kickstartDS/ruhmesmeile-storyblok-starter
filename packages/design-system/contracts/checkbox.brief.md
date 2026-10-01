## Checkbox
`<div>` · `.dsa-checkbox`

Checkboxes allow users to select multiple items from a list of individual items, or to mark one individual item as selected.

_The checkbox component is housed within a rounded rectangular container with a subtle shadow, giving it a slightly elevated appearance. The checkbox itself is a small square with a thin border, positioned to the left of the label text. The label text is simple and aligned horizontally with the checkbox, providing a clean and straightforward look._

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
- `root`: `--dsa-checkbox--background`, `--dsa-checkbox--background_active`, `--dsa-checkbox--background_checked`, `--dsa-checkbox--border`, `--dsa-checkbox--border-color`, `--dsa-checkbox--border-color_checked`, `--dsa-checkbox--border-color_focus`, `--dsa-checkbox--border-color_hover` _(+7 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.25 — 1/4 configurations proven; no story for `disabled: true`, `invalid: false, true`
