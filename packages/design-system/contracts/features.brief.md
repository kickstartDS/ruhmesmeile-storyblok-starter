## Features
`<div>` · `.dsa-features`

Component used to display a set of features

_The component displays a clean, organized layout with a light blue background and rounded corners, giving it a modern and approachable feel. Each feature is presented in a white card with a simple icon at the top, followed by bold text for the feature title and lighter text for the description. A "See more" link in blue with an arrow icon adds an interactive element, inviting further exploration._

**Anatomy**
- **root** — `<div>` · container
  - **feature** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| ctas | object | content *(unproven)* |  |
| layout | largeTiles* · smallTiles · list | class-toggle | gridTemplateColumns, height, width |
| style | intext · stack* · centered · besideLarge · besideSmall | class-toggle | gridTemplateColumns, height, width |

<small>\* = default</small>

**Variants**
- `layout: smallTiles`, `style: intext` — _In this variant, the component shifts to a more compact and dense layout, displaying five smaller feature tiles in a grid format. Each feature is now presented in a narrower card, allowing more features to be visible at once, which enhances the sense of information richness. The overall height of the component has increased, accommodating the additional features while maintaining the modern and approachable design with a light blue background and rounded corners._
- `style: centered` — _The variant displays a more compact and centered layout, with three features per row instead of two. Each feature card is smaller in width and taller, creating a denser and more balanced appearance. The overall height of the component is increased, allowing for more content to be visible within each feature card._
- `style: intext` — _In this variant, the component shifts to a more compact and dense layout, accommodating three features per row instead of two. The individual feature cards are smaller in width and slightly reduced in height, creating a tighter and more efficient use of space. This configuration gives the component a more structured and information-rich appearance, while maintaining its modern and approachable feel._
- `layout: list`, `style: besideLarge` — _In this variant, the component shifts to a vertical layout with features stacked in a single column, creating a more elongated appearance. The features are presented with increased padding on the left, and the overall height of the component is significantly taller, allowing for more detailed descriptions. The icons remain prominent, but the layout feels more spacious and less compact compared to the default._
- `layout: smallTiles` — _In this variant, the component shifts to a more compact and dense layout with smaller tiles. The features are now displayed in a grid of four narrower columns, each feature card being taller and slimmer compared to the default. This arrangement creates a more structured and space-efficient presentation, allowing more features to be visible at once._

**Slots**
- `feature` → `root` — items: cta, icon, text, title · observed counts: 2, 4, 6

**Tokens**
- `root`: `--dsa-feature__copy--color`, `--dsa-feature__copy--font`, `--dsa-feature__icon--color`, `--dsa-feature__link--color`, `--dsa-feature__link--font`, `--dsa-feature__link--font-weight`, `--dsa-feature__link--gap`, `--dsa-feature__link--text-decoration` _(+15 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.88 — 6/15 configurations proven; no story for `style: besideSmall`
