## Event Latest Teaser
`<div>` · `.l-container.l-container--event-latest-teaser`

Display an event teaser with date, title and location

_The Event Latest Teaser component features a clean and modern design with a white background and subtle shadow, giving it a slightly elevated appearance. On the left, there's a blue square icon, likely representing a calendar. The event title is prominently displayed in bold, dark text, followed by the date and location in smaller, lighter text with corresponding icons. An arrow on the right suggests further interaction or navigation._

**Anatomy**
- **root** — `<div>` · container
  - **child-1** — `<a>` · control
    - **content** — `<span>` · container
      - **event-latest-teaser-calendar** — `<span>` · slot
      - **text** — `<span>` · container
        - **infos** — `<span>` · container
          - **info** — `<span>` · container · repeated
            - **icon** — `<svg>` · glyph
        - **title** — `<span>` · text
    - **cta** — `<span>` · container
      - **child-1** — `<span>` · container · conditional
      - **cta** — `<span>` · text · only when `url` truthy
      - **icon** — `<svg>` · glyph

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| calendar | object | content *(unproven)* |  |
| className | string | content *(unproven)* |  |
| cta | string | content | cta |
| date | string | content *(unproven)* |  |
| location | string | content *(unproven)* |  |
| title | string | content *(unproven)* |  |
| url | string | presence | cta |

<small>\* = default</small>

**Variants**
- event-event-latest-teaser--default — _In this variant, the overall width of the component is slightly reduced, giving it a more compact appearance. The text areas, including the title and information sections, are narrower, which may make the content feel more condensed. Additionally, the call-to-action area is significantly wider and now includes the text "Go to event," enhancing its visibility and inviting interaction._

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
