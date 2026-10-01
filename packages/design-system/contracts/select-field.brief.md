## SelectField
`<div>` · `.dsa-select-field`

SelectField buttons allow users to select a single option from a list of mutually exclusive options.

_The SelectField component features a clean and simple design, with a rectangular input area that has slightly rounded corners. It includes a label above the input field, which is aligned to the left and presented in a bold font. The input area has a subtle shadow, giving it a slightly elevated appearance, and includes a small downward arrow on the right side, indicating a dropdown menu._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<label>` · container
    - **field** — `<div>` · container
      - **icon** — `<svg>` · glyph
      - **input** — `<select>` · control
        - **child-1** — `<option>` · container · only when `options` non-empty
        - **child-2** — `<option>` · container · only when `options` non-empty
        - **child-3** — `<option>` · container · only when `options` non-empty
    - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| hint | string | content *(unproven)* |  |
| icon | string | content *(unproven)* |  |
| invalidMessage | string | content *(unproven)* |  |
| label | string | content *(unproven)* |  |
| options | array | presence | child-1, child-2, child-3 |
| value | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- form-select-field--default — _In this variant of the SelectField component, three new elements appear within the input area. These additions are subtle and do not significantly alter the overall clean and simple design, but they contribute additional functionality or information within the input field itself. The rest of the component retains its slightly elevated appearance with a shadow and a downward arrow on the right side._

**Slots**
- `options` → `root/child-1/field/input/child-1` — items: disabled, label, value · observed counts: 0, 3

**Tokens**
- `root`: `--dsa-select-field--background`, `--dsa-select-field--background_focus`, `--dsa-select-field--border`, `--dsa-select-field--border-color`, `--dsa-select-field--border-color_active`, `--dsa-select-field--border-color_focus`, `--dsa-select-field--border-color_hover`, `--dsa-select-field--color` _(+9 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.17 — 2/8 configurations proven; no story for `disabled: true`, `hideLabel: false, true`, `invalid: false, true`
