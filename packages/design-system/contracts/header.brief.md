## Header
`<header>` · `.dsa-header`

Header layered on top by the CMS

_The header component features a clean, minimalist design with a white background and subtle rounded corners, giving it a modern and approachable appearance. It is framed by a soft shadow, which adds a sense of depth and separation from the content below. The overall look is simple and unobtrusive, allowing for easy integration with various content management systems._

**Anatomy**
- **root** — `<header>` · container
  - **content** — `<div>` · container
    - **logo** — `<a>` · slot
    - **nav-main** — `<div>` · slot · only when `navItems` non-empty

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| logo | object | content *(unproven)* |  |
| navItems | array | presence | nav-main |

<small>\* = default</small>

**Variants**
- layout-header--header — _In this variant, the header now includes a logo on the left, adding a focal point and brand identity to the design. Additionally, a navigation menu appears, providing structured links across the header, which enhances functionality and user navigation._

**Slots**
- `navItems` → `root/content/nav-main` — items: active, items, label, url · observed counts: 0, 5

**Tokens**
- `root`: `--dsa-header--background`, `--dsa-header--max-width`, `--dsa-header__logo--height`, `--dsa-header_floating--backdrop-filter`, `--dsa-header_floating--background`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.5 — 2/16 configurations proven; no story for `dropdownInverted: true`, `floating: true`, `flyoutInverted: true`, `inverted: true`
