An accessibility audit flagged the `Tag` component.

Screen readers announce its remove control as just "button" — there is no
indication of what pressing it does, or which tag it belongs to. Everything else
in the audit came back clean.

Fix that.

`Tag` is shipped and in use across several projects, so keep the change to what
the audit actually reported.
