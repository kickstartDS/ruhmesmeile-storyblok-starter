## Search Filter
`<div>` · `.dsa-search-filter`

Search filter component for filtering search results by categories.

_The search filter component features a clean, minimalist design with a rounded rectangular shape. It has a soft blue background that gives it a calm and approachable appearance. The component is bordered by a subtle shadow, adding a slight depth to its overall look._

**Anatomy**
- **root** — `<div>` · container
  - **categories** — `<div>` · container
    - **category** — `<div>` · container · repeated
      - **category-amount** — `<span>` · text · only when `title` truthy
      - **category-title** — `<a>` · control · only when `title` truthy
  - **title** — `<span>` · text · only when `title` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| title | string | presence | category, category-amount, category-title, title |

<small>\* = default</small>

**Variants**
- corporate-search-filter--default — _In this variant, the search filter component is taller, allowing for additional content. It now includes a title and a list of categories, each with a title and amount, enhancing its functionality and providing a more informative interface._

**Slots**
- `categories` → `root` — items: amount, title, url · observed counts: 0, 3

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
