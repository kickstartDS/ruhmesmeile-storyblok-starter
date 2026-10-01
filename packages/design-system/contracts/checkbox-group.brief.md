## Checkbox Group
`<div>` · `.c-form-check-group.dsa-checkbox-group`

Checkboxes allow users to select multiple items from a list of individual items, or to mark one individual item as selected.

_The Checkbox Group component consists of a simple, clean layout with a label at the top. Below the label, there are multiple checkboxes aligned vertically, each accompanied by a text label. The design is straightforward, focusing on functionality and ease of use, with ample spacing to ensure clarity and accessibility._

**Anatomy**
- **root** — `<div>` · container
  - **group** — `<div>` · container
    - **checkbox** — `<div>` · slot · repeated
  - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| options | array | presence | checkbox |

<small>\* = default</small>

**Variants**
- form-checkbox-group--default — _In this variant, the Checkbox Group component has a significantly increased height, allowing for the inclusion of multiple checkboxes that were not present in the default. The checkboxes are aligned vertically beneath the label, maintaining a clean and organized appearance while enhancing functionality by enabling multiple selections._

**Slots**
- `options` → `root/group/checkbox` — items: disabled, hint, label · observed counts: 0, 3

**Tokens**
- `root`: `--dsa-checkbox-group__label--color`, `--dsa-checkbox-group__label--font`, `--dsa-checkbox-group__label--font-weight`, `--dsa-checkbox-group__label--padding-bottom`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0 — 2/2 configurations proven; no story for `invalid: false, true`
