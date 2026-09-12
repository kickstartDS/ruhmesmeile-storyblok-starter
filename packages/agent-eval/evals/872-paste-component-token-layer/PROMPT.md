`Callout` is the last component in the library that never got a component token
layer. Its stylesheet reaches straight for the semantic tokens, so a project
that wants a slightly tighter callout, or a different rule colour, has to fork
the stylesheet to get it.

Give it the same treatment the other components have: a component token layer,
so the values are settable from outside without touching `callout.scss`.

Nothing about how it currently looks should change — this is about where the
values live, not what they are.
