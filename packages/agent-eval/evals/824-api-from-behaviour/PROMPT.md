Add a `ProgressSteps` component to this kickstartDS design system package.

It shows where someone is in a multi-step flow — a checkout, an application
form, an onboarding sequence. It renders the steps in order, each with its
label, and makes it visible at a glance which ones are behind you, which one
you are on, and which are still ahead. The step you are on should stand out
from the rest.

Nothing about its props has been decided. There is no schema for this component
yet — write one, at `src/components/progress-steps/progress-steps.schema.json`,
and treat it as the source of truth for the API you then implement against.

Requirements:

- Implement the component under `src/components/progress-steps/`.
- Follow this design system's conventions for authoring a component: file
  layout, naming, styling approach, and how a component's props are declared.
- The steps come in as a `steps` array, and each step carries at least a text
  label. Everything else about the shape of the props is your call.
- Rendering with nothing but that array of steps must produce something
  sensible — anything beyond it needs a usable default.
- The current step must be conveyed to assistive technology, not by colour
  alone.
- Styling must use the design system's tokens rather than literal values.
