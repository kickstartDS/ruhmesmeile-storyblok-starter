## Html
`<div>` · `.dsa-html.dsa-html--sixteen-to-nine.test`

Display raw HTML.

_The component appears as a clean, white rectangular box with a subtle shadow, giving it a slightly elevated look against a light gray background. The aspect ratio is sixteen-to-nine, creating a balanced and modern appearance. The rounded corners add a touch of softness to the overall design._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<p>` · text · only when `html` truthy
  - **consent** — `<div>` · container · only when `consent` truthy
    - **button** — `<button>` · slot · only when `consent` truthy
    - **rich-text** — `<div>` · slot · only when `consentText` truthy

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| className | string | content *(unproven)* |  |
| component | string | content *(unproven)* |  |
| consent | false* · true | presence | backgroundImage, borderTopColor, color, display, height, marginBottom, marginTop, width |
| consentAspectRatio | enum | content *(unproven)* |  |
| consentBackgroundImage | string | content *(unproven)* |  |
| consentButtonLabel | string | content *(unproven)* |  |
| consentText | string | presence | rich-text |
| html | string | presence | child-1 |

<small>\* = default</small>

**Variants**
- components-html--html — _In this variant, the component includes the text "Hello World" inside the box, which was not present in the default. The text is positioned towards the left, adding a simple yet noticeable element to the otherwise clean design._
- `consent: true` — _In this variant, the component introduces a consent feature, overlaying the original design with a semi-transparent background image. A prompt appears in the center, asking for user consent, accompanied by a prominent button labeled "yes!" The overall look is more interactive and visually engaging compared to the default._
- `consent: true` — _In this variant, the component no longer displays a background image, resulting in a simpler appearance. The button within the component is noticeably wider, enhancing its prominence and making it more inviting for interaction. The overall design maintains its clean and modern look, with the button providing a focal point._

**Tokens**
- `root`: `--dsa-html__consent--background`, `--dsa-html__consent--color`, `--dsa-html__consent--font`, `--dsa-html__consent--font-weight`

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** 0.75 — 4/4 configurations proven; no story for `inverted: true`
