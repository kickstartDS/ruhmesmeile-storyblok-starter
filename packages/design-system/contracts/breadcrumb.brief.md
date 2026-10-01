## Breadcrumb
`<div>` · `.dsa-breadcrumb`

Breadcrumb navigation component used to indicate the current page's location within a navigational hierarchy.

_The breadcrumb component appears as a horizontal bar with a light blue background, giving it a subtle and unobtrusive look. It has rounded corners, which add a touch of softness to its design. The overall appearance is clean and minimalistic, suitable for indicating navigation paths without drawing too much attention._

**Anatomy**
- **root** — `<div>` · container
  - **icon** — `<svg>` · glyph · repeated
  - **label** — `<span>` · text · only when `pages` non-empty
  - **link** — `<a>` · control · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| pages | array | presence | icon, label, link |

<small>\* = default</small>

**Variants**
- corporate-breadcrumb--default — _In this variant, the breadcrumb component now has a visible height of 21.2031px, making it more prominent. It includes icons and labels for navigation, with links that enhance its functionality. The overall design remains clean but is now more informative and interactive._

**Slots**
- `pages` → `root/link` — items: label, url · observed counts: 0, 3

**Tokens**
- `root`: `--dsa-breadcrumb--color`, `--dsa-breadcrumb--color_active`, `--dsa-breadcrumb--color_hover`, `--dsa-breadcrumb--font`, `--dsa-breadcrumb--gap`, `--dsa-breadcrumb__icon--color`, `--dsa-breadcrumb__icon--size`

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
