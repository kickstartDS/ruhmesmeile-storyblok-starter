## Faq
`<div>` · `.dsa-faq`

Component used to display a Faq section

_The FAQ component features a clean, minimalist design with a light background and rounded corners, giving it a soft appearance. Each question is presented in bold text, accompanied by a small blue arrow icon on the right, indicating interactivity. The questions are separated by thin horizontal lines, maintaining a neat and organized layout._

**Anatomy**
- **root** — `<div>` · container
  - **collapsible-box** — `<div>` · slot · repeated

**Variants**
- components-faq--dropdown-list — _The variant of the FAQ component is taller, with the height increased from 141.812px to 212.219px. This change allows for more content or spacing between the questions, giving the component a more spacious and open appearance while maintaining its clean and organized design._
- components-faq--single-dropdown — _The variant of the FAQ component is more compact, with a reduced height of 71.4062px compared to the default. This gives it a sleeker appearance while maintaining the same minimalist design and interactive elements._

**Slots**
- `questions` → `root` — items: answer, question · observed counts: 1, 2, 3

**Tokens**
- `root`: `--dsa-faq--border`, `--dsa-faq__answer--color`, `--dsa-faq__answer--font`, `--dsa-faq__icon--color`, `--dsa-faq__summary--color`, `--dsa-faq__summary--font`, `--dsa-faq__summary--font-family`, `--dsa-faq__summary--font-weight` _(+2 more)_

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 3/3 configurations proven
