## Downloads
`<div>` · `.dsa-downloads`

Downloads component for providing users with downloadable files and resources.

_The Downloads component features a clean and simple design with a rectangular shape. It has a soft blue background with rounded corners, giving it a modern and approachable appearance. The component is minimalistic, focusing on functionality while maintaining a visually appealing look._

**Anatomy**
- **root** — `<div>` · container
  - **downloads-item** — `<a>` · slot · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| download | array | presence | downloads-item |

<small>\* = default</small>

**Variants**
- corporate-downloads--complete — _In this variant, the Downloads component has expanded to a height of 289.422px, revealing a list of downloadable items. Each item is neatly organized with an icon, title, file type, size, and a brief description, alongside a "Download" button with an icon, maintaining the component's clean and modern aesthetic._
- corporate-downloads--description-only — _The variant of the Downloads component differs from the default by having a significantly increased height, expanding to 289.422px. This change allows for more content to be displayed within the component, maintaining its clean and modern design with a soft blue background and rounded corners._
- corporate-downloads--mixed — _The variant of the Downloads component differs from the default by having a defined height of 283.906px, which allows it to display content such as file names, descriptions, and download options. This change enhances its functionality by making the downloadable resources visible and accessible, while maintaining the same modern and approachable design with a soft blue background and rounded corners._
- corporate-downloads--technical-details-only — _The variant of the Downloads component differs from the default by having a defined height of 289.422px, which allows it to display content such as file names, types, sizes, and download options. This change enhances its functionality by making the downloadable resources visible and accessible, while maintaining the same modern and approachable design with a soft blue background and rounded corners._

**Slots**
- `download` → `root/downloads-item` — items: description, format, name, previewImage, size, url · observed counts: 0, 4

**Tokens**
- `root`: `--dsa-downloads--gap`, `--dsa-downloads-item--background`, `--dsa-downloads-item--background-color_hover`, `--dsa-downloads-item--background-hover`, `--dsa-downloads-item--border-radius`, `--dsa-downloads-item--gap`, `--dsa-downloads-item--padding`, `--dsa-downloads-item--transition` _(+22 more)_

**Go deeper when needed**
- what a slot accepts before composing into it → `get_component_anatomy`
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 5/5 configurations proven
