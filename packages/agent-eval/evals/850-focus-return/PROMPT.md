Bug report from the accessibility audit, against `FilterFlyout`:

> Opening the filters with a keyboard is a dead end. The panel appears but the
> caret stays on the button, so the next Tab walks past the filters and into
> the page behind them. There is no way to back out of the panel either — you
> have to Tab all the way through it. Once you are inside, getting back to
> where you started means shift-tabbing blind.

Please sort this out. The flyout opens and closes correctly today and the
markup is fine — this is about what happens to the keyboard once it does.

The component and its stylesheet are not the problem; leave them alone.
