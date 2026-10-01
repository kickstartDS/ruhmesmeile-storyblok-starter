## Button
`<button>` · `.c-button.dsa-button`

Component used for user interaction

_The button has a soft gray background with rounded corners, giving it a subtle and approachable appearance. The text "Book a meeting" is centered in a dark, legible font, providing a clear contrast against the lighter background. The overall design is simple and functional, suitable for user interaction._

**Anatomy**
- **root** — `<button>` · control
  - **label** — `<span>` · text

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| disabled | false* · true | attribute | root |
| icon | string | content *(unproven)* |  |
| label | string | content | label |
| size | small · medium* · large | token-swap | root |
| variant | primary · secondary* · tertiary | class-toggle | backgroundColor, borderTopColor, borderTopStyle, borderTopWidth, color, height, width |

<small>\* = default</small>

**Variants**
- `variant: primary` — _The variant button has a bold blue background, creating a more striking and prominent appearance compared to the default. The text is white, enhancing readability and contrast against the blue. The button is slightly narrower, giving it a more compact look._
- `disabled: true`, `variant: primary` — _The variant button has a solid blue background, creating a more prominent and bold appearance compared to the default. The text is white, enhancing contrast and visibility, but the button appears slightly faded due to reduced opacity, indicating its disabled state. The overall size is marginally larger, giving it a more substantial presence._
- components-button--secondary-button — _The variant of the button is slightly wider, with the root element expanding from 202.094px to 222.094px. Additionally, the label inside the button has increased in width from 148px to 168px, allowing for more text or spacing within the button._
- `variant: tertiary` — _The tertiary variant of the button has a transparent background, giving it a lighter appearance compared to the default. It features a subtle, solid border that adds definition, and the button is slightly taller and narrower, with the label area also reduced in width._

**Tokens**
- `size`: `--dsa-button_{size}--font`
- `variant`: `--dsa-button_{variant}--background-color`, `--dsa-button_{variant}--background-color_active`, `--dsa-button_{variant}--background-color_hover`, `--dsa-button_{variant}--color`, `--dsa-button_{variant}--color_active`, `--dsa-button_{variant}--color_hover`
- `root`: `--dsa-button--border-radius`, `--dsa-button--border-width`, `--dsa-button--font-weight`, `--dsa-button--padding`, `--dsa-button--text-transform`, `--dsa-button_terciary--border-color`, `--dsa-button_terciary--border-color_active`, `--dsa-button_terciary--border-color_hover`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.75 — 5/18 configurations proven; no story for `size: small, large`
> ⚠ `variant: tertiary` renders `.c-button--outline` but has no matching token segment.
