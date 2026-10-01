## Event Filter
`<div>` · `.dsa-event-filter`

Event filter component for filtering events based on date and categories.

_The Event Filter component has a clean and organized layout with a soft blue background. It features two date picker fields labeled "From" and "To," each with a calendar icon for easy selection. Below the date fields, there's a text input for categories. The component includes two buttons: a prominent blue "Filter Appointments" button and a lighter gray "Reset Filters" button, both centered and clearly labeled for user interaction._

**Anatomy**
- **root** — `<div>` · container
  - **buttons** — `<div>` · container
    - **button** — `<button>` · slot · repeated
  - **item** — `<div>` · container · repeated
    - **date-picker** — `<div>` · container
      - **text-field** — `<div>` · slot · repeated
  - **topic** — `<span>` · text · repeated

**Visual props**

| prop | values | mechanism | affects |
| --- | --- | --- | --- |
| applyButton | object | content *(unproven)* |  |
| categories | object | content *(unproven)* |  |
| datePicker | object | content *(unproven)* |  |
| resetButton | object | content *(unproven)* |  |

<small>\* = default</small>

**Variants**
- event-event-filter--default — _The variant of the Event Filter component is taller, with a height of 694.312px compared to the default. This additional space accommodates a list of checkboxes under the "Categories" section, allowing users to select from options like "All," "Buyers," "Sellers," "Renters," "Landlords," and "Tenants."_

**Go deeper when needed**
- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop
- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)

**Coverage** n/a — 2/2 configurations proven
