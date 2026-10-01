## Cookie Consent
`<div>`

Cookie consent component for managing user consent regarding cookies and tracking technologies on a website.

_The cookie consent component features a sleek, rounded rectangular design with a soft blue background, giving it a calm and unobtrusive appearance. It has a subtle shadow effect, adding a sense of depth and making it stand out slightly from the page. The overall look is clean and modern, ensuring it integrates smoothly with various website designs._

**Anatomy**
- **root** — `<div>` · container
  - **button** — `<button>` · slot · conditional
  - **child-1** — `<span>` · text · conditional
  - **cookie-consent-dialog** — `<dialog>` · slot · conditional
  - **cookie-consent-notice** — `<div>` · slot · conditional

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| component | string | content *(unproven)* |  |
| dialog | object | content *(unproven)* |  |
| notice | object | content *(unproven)* |  |
| revisitButton | object | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- corporate-cookie-consent--banner — _The variant of the cookie consent component has a more expansive and structured appearance compared to the default. It features a wider layout with a defined width of 1440px, giving it a more prominent presence on the page. The border at the top is removed, and the shadow effect is slightly more pronounced, enhancing its visibility and emphasis._
- corporate-cookie-consent--c-15-t — _The variant transforms the cookie consent component into a compact button with a semi-transparent dark overlay, giving it a more subtle and integrated appearance. The font changes to Montserrat, and the text is centered, enhancing readability and modernity. The button's rounded corners and increased padding create a more tactile and inviting look, while the overall size is significantly reduced, making it less intrusive on the page._
- corporate-cookie-consent--card — _The variant of the cookie consent component is more prominent, with the notice now displayed in a flexible layout. It has a defined height of 207.031px and a width of 757.328px, making it more substantial and noticeable compared to the default. The overall design remains clean and modern, maintaining its integration with various website designs._

**Tokens**
- `root`: `--dsa-cookie-consent-dialog--background-color`, `--dsa-cookie-consent-dialog--border`, `--dsa-cookie-consent-dialog--border-radius`, `--dsa-cookie-consent-dialog--box-shadow`, `--dsa-cookie-consent-dialog--max-height`, `--dsa-cookie-consent-dialog--max-width`, `--dsa-cookie-consent-dialog--padding-horizontal`, `--dsa-cookie-consent-dialog--spacing-horizontal` _(+42 more)_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 4/4 configurations proven
