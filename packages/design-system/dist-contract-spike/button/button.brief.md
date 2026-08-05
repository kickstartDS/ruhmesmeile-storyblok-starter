## Button
`<button>` · `.c-button.dsa-button`

Component used for user interaction

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

**Tokens**
- `size`: `--dsa-button_{size}--font`
- `variant`: `--dsa-button_{variant}--background-color`, `--dsa-button_{variant}--background-color_active`, `--dsa-button_{variant}--background-color_hover`, `--dsa-button_{variant}--color`, `--dsa-button_{variant}--color_active`, `--dsa-button_{variant}--color_hover`
- `root`: `--dsa-button--border-radius`, `--dsa-button--border-width`, `--dsa-button--font-weight`, `--dsa-button--padding`, `--dsa-button--text-transform`, `--dsa-button_terciary--border-color`, `--dsa-button_terciary--border-color_active`, `--dsa-button_terciary--border-color_hover`

**Coverage** 0.75 — 5/18 configurations proven; no story for `size: small, large`
> ⚠ `variant: tertiary` renders `.c-button--outline` but has no matching token segment.
