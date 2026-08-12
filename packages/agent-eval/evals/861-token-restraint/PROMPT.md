The attribution line under a `Quote` is too loud.

`.dsa-quote__author` is picking up the display text colour. That colour is for
headings and pull quotes, not for the byline sitting underneath one — it should
be the copy colour, like the source next to it already is.

Fix that.

`Quote` ships in three projects and the rest of the stylesheet is the way it is
on purpose, so keep the change to the colour that is wrong.
