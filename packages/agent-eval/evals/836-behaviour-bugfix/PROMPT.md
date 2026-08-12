# Task

Two bug reports came in against `Dismissible`, both from the app team:

> Escape keeps closing banners on pages where the banner was already torn
> down. Once one has been through `destroy()`, the key still gets swallowed.

> We're seeing the `dismissed` event arrive more than once for the same banner.

Both reproduce with the component as shipped. The markup and the props are
fine — this is in the client behaviour.
