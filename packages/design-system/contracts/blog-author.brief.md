## Blog Author
`<div>` · `.l-container.l-container--contact`

The author of the blog post

_The component features a clean, minimalist design with a white background and a subtle shadow, giving it a slightly elevated appearance. The author's name, "John Doe," is displayed prominently in bold, dark text, while a placeholder image is absent, leaving a simple and uncluttered look. The overall impression is professional and straightforward, focusing on the author's identity._

**Anatomy**
- **root** — `<div>` · container
  - **contact** — `<address>` · slot

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| byline | string | content *(unproven)* |  |
| image | object | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- blog-blog-author--default — _The variant features a significantly taller design, accommodating additional content such as a profile image and contact information. The author's name is still prominent, but now accompanied by a professional title and social media/contact details, creating a more detailed and engaging presentation. The overall look is more informative and visually rich compared to the minimalist default._

**Slots**
- `links` → `root` — items: ariaLabel, icon, label, newTab, url · observed counts: 0, 2

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
