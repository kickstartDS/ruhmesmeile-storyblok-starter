## Logos
`<div>`

Component used to display a set of logos

_The component displays a set of logos centered within a rounded rectangular container. The background is a soft blue, and the logos are evenly spaced, giving a clean and organized appearance. Each logo features a colorful, circular design above the text "Logoipsum NETWORK," creating a professional and cohesive look._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<div>` · container
    - **logos--align-center** — `<div>` · slot · conditional
      - **cta** — `<div>` · container · conditional
        - **button** — `<button>` · slot · conditional
        - **text** — `<div>` · text · conditional
      - **logo-tiles** — `<div>` · slot · conditional
      - **tagline** — `<div>` · text · conditional
    - **logos--align-left** — `<div>` · slot · conditional
      - **cta** — `<div>` · container · conditional
        - **text** — `<div>` · container · conditional
          - **link** — `<a>` · control · conditional
      - **logo-tiles** — `<div>` · slot · conditional
      - **tagline** — `<div>` · text · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| align | left · center* | token-swap | color, font, fontWeight, height |
| cta | object | content *(unproven)* |  |
| logosPerRow | integer | content *(unproven)* |  |
| tagline | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- components-logos--centered-with-button — _In this variant, the component is significantly taller, allowing for more content. A tagline and a call-to-action button have been added below the logos, providing additional context and interaction. The overall layout remains centered, maintaining a clean and organized appearance._
- `align: left` — _In this variant, the logos are aligned to the left within a taller container, creating a more spacious layout. A call-to-action text and link appear below the logos, along with a tagline, adding informative and interactive elements to the design. The overall appearance is more detailed and engaging compared to the default._
- components-logos--logo-row — _In this variant, the height of the container and its elements has increased, giving the component a more spacious appearance. The logos are still centered, but the additional height allows for a more open and less compact presentation, enhancing the overall visual impact._
- components-logos--logo-wall — _In this variant, the component is significantly taller, allowing for a more extensive display of logos. The logos are arranged in a grid format with multiple rows, and a tagline "Our Customers" is added above them. This creates a more comprehensive and informative presentation compared to the default._

**Slots**
- `logo` → `root` — items: alt, src · observed counts: 2, 6, 12

**Tokens**
- `root/child-1/logos--align-center`: `--dsa-logos-gap`, `--dsa-logos__grid--gap-horizontal`, `--dsa-logos__grid--gap-vertical`, `--dsa-logos__grid_mobile--cols`, `--dsa-logos__grid_tablet--cols`, `--dsa-logos__tagline--color`, `--dsa-logos__tagline--font`, `--dsa-logos__tagline--font-weight`
- `root/child-1/logos--align-left`: `--dsa-logos-gap`, `--dsa-logos__grid--gap-horizontal`, `--dsa-logos__grid--gap-vertical`, `--dsa-logos__grid_mobile--cols`, `--dsa-logos__grid_tablet--cols`, `--dsa-logos__tagline--color`, `--dsa-logos__tagline--font`, `--dsa-logos__tagline--font-weight`

**Go deeper when needed**
- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 1 — 5/5 configurations proven
