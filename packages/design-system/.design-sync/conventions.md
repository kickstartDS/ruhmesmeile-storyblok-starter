## How to build with this design system

This is kickstartDS. It is **not** a utility-class system — there are no
`bg-*`/`p-*`/`flex` helpers to compose with, and inventing class names will
produce unstyled output. You style by (1) choosing the right component and
passing its props, and (2) setting CSS custom properties. Everything below is
verified against the bundle in this project.

### 1. Wrap your tree in `PageWrapper` — nothing is styled without it

`PageWrapper` is exported from the bundle (it has no component card of its own
because it is infrastructure, not a design element). It renders
`<Providers>` + the SVG icon sprite.

```jsx
const { PageWrapper, Section, Headline, Button } = window.KickstartDS;

ReactDOM.createRoot(document.getElementById('ds-root')).render(
  <PageWrapper>
    <Section headline={{ text: 'Key headline', sub: 'Supporting subheadline' }}>
      <Button label="Learn more" variant="primary" />
    </Section>
  </PageWrapper>
);
```

What breaks without it, concretely:

- **`Providers` substitutes kickstartDS's base components with this DS's
  themed ones** through React context (Button, Checkbox, CheckboxGroup, Radio,
  RadioGroup, SelectField, TextArea, TextField, Contact, ButtonGroup, Headline,
  Section, TeaserBox, plus the Bedrock spacing theme). Render a compound
  component outside `PageWrapper` and its *children* silently fall back to
  upstream kickstartDS markup: wrong classes, wrong props, missing headlines.
- **Icons disappear.** Components reference `<use href="#icon-…">` against the
  sprite `PageWrapper` injects.

`Providers` is also exported if you need the context without the sprite.

### 2. Styling idiom: props first, then CSS custom properties

**Props carry the design language.** Variants are props, not classes —
e.g. `Button` takes `variant` (`primary` / `secondary` / `tertiary`), `size`,
`label`, `icon`, `disabled`; `Headline` takes `level` (`h1`–`h4`) and `style`
(`h1`–`h4`, `p`) so semantic level and visual size are independent; `Section`
takes `width`, `spaceBefore`/`spaceAfter`, `backgroundColor`
(`default`/`accent`/`bold`), `inverted`, and a nested
`content: { width, align, gutter, mode, tileWidth }` that selects the layout. Read the
component's `.prompt.md` and `.d.ts` before guessing a prop.

**For your own layout glue, use the token variables — never hard-coded values.**
Real families in this bundle (`--ks-` = global semantic tokens, ~2785 of them):

| Family | Examples |
|---|---|
| Background | `--ks-background-color-default`, `--ks-background-color-accent`, `--ks-background-color-bold` |
| Text | `--ks-text-color-default`, `--ks-text-color-card` |
| Border | `--ks-border-color-default` |
| Type | `--ks-font-copy-xs…xxl`, `--ks-font-display-l`, `--ks-font-family-copy`, `--ks-font-family-display` |
| Spacing | `--ks-spacing-inset-s`/`-m`/`-l`, `--ks-spacing-inset-squish-m`, `--ks-spacing-inline-xxs` … `--ks-spacing-inline-xxl` |
| Radius | `--ks-border-radius-card`, `--ks-border-radius-control`, `--ks-border-radius-pill`, `--ks-border-radius-circle` |
| Elevation | `--ks-box-shadow-card`, `--ks-box-shadow-card-hover` |

Most colour tokens have an `-inverted` sibling and `-interactive[-hover|-active]`
states — e.g. `--ks-background-color-accent-inverted`,
`--ks-text-color-card-interactive-hover`.

**To restyle a component instance**, set its component-scoped variables rather
than overriding its classes. They are prefixed `--dsa-<component>--*` (this
project's layer) and `--c-<component>--*` (upstream kickstartDS), e.g.
`--c-button--background-color` (and `-hover`/`-active`/`-selected`),
`--c-button--border-color`, `--dsa-button--border-radius`,
`--dsa-breadcrumb__icon--color`.

```jsx
<div style={{
  display: 'grid',
  gap: 'var(--ks-spacing-inline-m)',
  padding: 'var(--ks-spacing-inset-l)',
  background: 'var(--ks-background-color-accent)',
  borderRadius: 'var(--ks-border-radius-card)',
}}>
  <TeaserCard headline="Explore This Topic" text="Short summary." />
</div>
```

### 3. Dark / inverted and themes

Inversion is an **attribute**, not a class: set `ks-inverted="true"` on any
container and the token values inside flip to their inverted variants.
Alternate brand themes are selected with `ks-theme` on a container.

```jsx
<section ks-inverted="true">…</section>
```

### 4. Where the truth lives

- `styles.css` — the single stylesheet entry; `@import`s the fonts and
  `_ds_bundle.css`. Link exactly this one file.
- `_ds_bundle.css` — every token definition and every component rule. Grep it
  when you need an exact token name; it is authoritative.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage and
  variants. `<Name>.d.ts` — the real prop types. **Read these before composing
  a component you haven't used.**

### 5. Known limitation: preview card images

The component preview cards render without their example photos. The DS's
stories reference images by a repo-relative path that does not ship with this
bundle. This affects only the cards — components render images correctly when
you pass real URLs to props like `image`, `src`, or `srcMobile`/`srcTablet`/
`srcDesktop`. Always supply your own image URLs.
