`PageHeader` brought its own breakpoints with it and they don't line up with
anything else. On a wide screen the header's padding steps up but the section
directly underneath it doesn't, so the page looks like it was assembled from two
different designs — and every time the spacing scale gets retuned, this one
component stays where it was.

Make the header scale the way the rest of the system does.

The type styles are fine, and the markup isn't the problem.
