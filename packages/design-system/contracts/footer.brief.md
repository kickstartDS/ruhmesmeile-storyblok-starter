## Footer
`<div>` · `.dsa-footer`

Footer component for displaying site logo, grouped navigation links, social links and a legal bottom bar at the bottom of the page.

_The footer component has a clean and structured appearance, featuring a white background with rounded corners that give it a modern look. It includes subtle horizontal lines that likely separate different sections, such as navigation links or social media icons. The overall design is minimalistic, with a focus on clarity and organization._

**Anatomy**
- **root** — `<div>` · container
  - **content** — `<div>` · container
    - **bottom** — `<div>` · container
      - **copyright** — `<p>` · container · only when `navGroups` non-empty
        - **legal-link** — `<a>` · control · only when `navGroups` non-empty
      - **logo** — `<a>` · slot
    - **columns** — `<div>` · container · only when `navGroups` non-empty
      - **column** — `<div>` · container · repeated
        - **column-heading** — `<h3>` · text · only when `navGroups` non-empty
        - **nav-list** — `<ul>` · container · only when `navGroups` non-empty
          - **nav-item** — `<li>` · container · repeated
            - **link** — `<a>` · control · only when `navGroups` non-empty

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| copyright | string | content *(unproven)* |  |
| legalLink | object | content *(unproven)* |  |
| logo | object | content *(unproven)* |  |
| navGroups | array | presence | copyright, legal-link, columns, column, column-heading, nav-list, nav-item, link |

<small>\* = default</small>

**Variants**
- layout-footer--footer — _This variant of the footer component is significantly taller, allowing for more content. It now includes a visible logo, copyright information, and a legal link at the bottom. Additionally, there are new columns with headings and navigation links, enhancing the footer's functionality and informational capacity._

**Slots**
- `navGroups` → `root/content/columns` — items: heading, items · observed counts: 0, 3
- `socialLinks` → `root` — items: ariaLabel, icon, url · observed counts: 0, 4

**Tokens**
- `root`: `--dsa-footer--background-color`, `--dsa-footer--border-top`, `--dsa-footer--gap-vertical`, `--dsa-footer--max-width`, `--dsa-footer__bottom--border-top`, `--dsa-footer__bottom--gap`, `--dsa-footer__bottom--padding-top`, `--dsa-footer__column--gap` _(+22 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.5 — 2/2 configurations proven; no story for `inverted: true`
