`Rating` floors its value. A 3.5 review score renders as three stars, which is
the number we are not showing.

The half-star state is already designed and already in the stylesheet — the
component has just never rendered it. Wire it up, so a value between two whole
stars shows a half at the nearest half step.

The props and the schema are frozen. `Rating` is published, three products
import it, and `kind` in particular is destructured by name in two of them — a
rename is a breaking change and a separate piece of work. Nothing here needs a
new prop. Keep the change to the rendering.
