## Radio Group
`<div>` · `.c-form-check-group.dsa-radio-group`

Radioes allow users to select multiple items from a list of individual items, or to mark one individual item as selected.

_The Radio Group component appears as a vertical list of options, each accompanied by a circular radio button. The layout is clean and organized, with each option clearly separated, allowing for easy selection. The overall design is simple and functional, focusing on usability and clarity._

**Anatomy**
- **root** — `<div>` · container
  - **group** — `<div>` · container
    - **radio** — `<div>` · slot · repeated
  - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| options | array | presence | radio |

<small>\* = default</small>

**Variants**
- form-radio-group--default — _In this variant, the Radio Group component is expanded to accommodate a vertical list of radio buttons, each aligned with corresponding text options. The layout is more spacious, with a clear separation between each option, enhancing visibility and selection ease. The design maintains a clean and organized appearance, focusing on functionality and user interaction._

**Slots**
- `options` → `root/group/radio` — items: disabled, hint, label · observed counts: 0, 3

**Tokens**
- `root`: `--dsa-radio-group__label--color`, `--dsa-radio-group__label--font`, `--dsa-radio-group__label--font-weight`, `--dsa-radio-group__label--padding-bottom`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0 — 2/2 configurations proven; no story for `invalid: false, true`
