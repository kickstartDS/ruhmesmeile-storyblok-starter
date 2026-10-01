## Event Latest
`<div>` · `.dsa-event-latest`

Display a list of latest events, ordered chronologically

_The "Event Latest" component features a clean, modern design with a light background and rounded corners, giving it a soft, approachable look. Each event is displayed in a card-like format with a blue icon on the left, followed by the date and location in a simple, readable font. The use of shadows adds depth, and the small arrow on the right suggests interactivity or further navigation._

**Anatomy**
- **root** — `<div>` · container
  - **event-latest-teaser** — `<div>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-latest--default — _The variant of the "Event Latest" component is taller, with the root element's height increased from 257.328px to 528.359px. This change allows for more events to be displayed within the same space, maintaining the clean and modern design with a light background and rounded corners._

**Slots**
- `events` → `root` — items: ariaLabel, calendar, className, cta, date, location, title, url · observed counts: 2, 4

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
