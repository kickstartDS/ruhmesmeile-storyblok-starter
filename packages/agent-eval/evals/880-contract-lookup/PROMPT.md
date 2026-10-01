Answer eight questions about the design system this repository belongs to. Each
answer is a fact the design system already knows about itself — a token name, a
class name, a mechanism, an anatomy path, a coverage gap.

Write your answers to `answers.json` at the repository root, as a JSON object
with exactly these keys:

| key | component | question |
| --- | --- | --- |
| `q1` | `Button` | the component token that themes `variant: primary`'s background colour |
| `q2` | `Button` | the CSS class `variant: tertiary` adds to the root element |
| `q3` | `Button` | the mechanism by which `disabled` becomes visible |
| `q4` | `Faq` | the props each item of its `questions` slot carries, as an array |
| `q5` | `Button` | the `size` values no story proves, as an array |
| `q6` | `Blog Aside` | the two spellings its own tokens use for one element, as an array |
| `q7` | `Button` | the computed background colour `variant: primary` produces on the root |
| `q8` | `Section` | how many component types its `components` slot accepts, as a number |

Answer from the design system's own tooling rather than from memory or
guesswork. A plausible-sounding name that is not the real one scores zero, and
these components are not present in this checkout — only their published
description is reachable.

Example shape (values are wrong on purpose):

```json
{ "q1": "--dsa-example-token", "q5": ["small"], "q8": 3 }
```
