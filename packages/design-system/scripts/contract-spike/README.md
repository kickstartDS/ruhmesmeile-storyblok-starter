# Component Contract spike

Phase 0 spike for `docs/internal/prd/kickstartds-component-contracts-prd.md`.

Generates a `kickstartds/component-contract@1` document for five components
(`button`, `section`, `faq`, `slider`, `blog-aside`) by combining static schema/token
analysis with rendered observation of their Storybook stories.

```bash
pnpm --filter @kickstartds/design-system contract-spike
pnpm --filter @kickstartds/design-system contract-spike -- --only button
```

Output goes to `dist-contract-spike/`, which is committed so the artifacts can be diffed
in review. See `COMPARISON.md` for the findings, including a side-by-side against the
earlier Specs spike.

## The declared baseline

The default is **declared, not inferred** (PRD §5.6): it comes from `{Name}Defaults.ts`,
not from whichever story happens to sit closest to it. No authored story _is_ the
default, so one has to be generated:

```bash
node scripts/contract-spike/run.mjs --emit-stories   # writes src/contract-defaults/
pnpm build-storybook                                 # so they can be rendered
node scripts/contract-spike/run.mjs                  # full run
```

`--emit-stories` exists only because Storybook has to be rebuilt in between. A normal
run rewrites the stories too, so they stay in sync — but a _new_ component needs the
three-step dance once.

The generated stories are minimal on purpose: no `pack()`, no `getArgsShared()`, no
parameters. The args passed ARE the declared configuration; anything layered on top
would quietly change the baseline we are trying to observe. `src/contract-defaults/` is
gitignored.

`lib/declared.mjs` fills only what the schema demands — defaults, required props, and
arrays with `minItems >= 1` — preferring the schema's own `examples` and falling back to
a fixed placeholder table. Every value records its `source`, and `coverage.baseline`
reports the placeholders and empty slots. Polymorphic slots (`anyOf` over component
types) are left empty rather than authored; see `COMPARISON.md` §10 for why that is the
right call and what it costs.

## Prerequisites

- `storybook-static/` must be built (`pnpm build-storybook`)
- `snippets.json` must exist (produced by the `presets` build step) — it supplies
  per-story args
- Playwright's Chromium must be installed

## Architecture

Three passes, per the PRD §6:

| pass             | file                 | browser | output                                                                             |
| ---------------- | -------------------- | ------- | ---------------------------------------------------------------------------------- |
| 1 static         | `lib/static.mjs`     | no      | props + roles, defaults, slots, candidate axes, token grammar, resolver            |
| — baseline       | `lib/declared.mjs`   | no      | the declared default configuration, with a `source` per value                      |
| — stories        | `lib/genStories.mjs` | no      | one generated CSF story per component, rendering that configuration                |
| 2 observation    | `lib/observe.mjs`    | yes     | per-story DOM tree with classes, attrs, fixed computed styles, defined tokens, box |
| 3 reconciliation | `lib/reconcile.mjs`  | no      | anatomy, axes, default, variants, bindings, composition, coverage, issues          |

`lib/brief.mjs` renders the contract to Markdown, merging a `{component}.narrative.json`
sidecar when one exists beside the component schema (PRD §5.12 — Pass 4 itself is not
implemented in this spike). `run.mjs` orchestrates and prints a report.

Pass 3 is a pure function of passes 1 and 2, so it can be iterated on without
re-rendering anything.

## Determinism

Contracts are byte-stable across runs. Three things make that true and must be
preserved:

1. `OBSERVED_PROPERTIES` in `lib/observe.mjs` is a **fixed, ordered list**. Never
   enumerate `getComputedStyle` — its length and order are not stable across browser
   versions.
2. Volatile values are normalised at capture time: the static server's ephemeral port
   is stripped from URLs, and per-render attributes (`data-uid`, `id`, `aria-controls`,
   …) are replaced with `<generated>`.
3. `run.mjs` deep-sorts all object keys before serialising.

## Things that bit us

- Storybook injects the icon sprite as a hidden `<svg>` as the first child of
  `#storybook-root`. The component root is the first **non-hidden** child.
- Reading a custom property with `getComputedStyle` returns the _declared_ value —
  an unevaluated `calc()` chain, often hundreds of characters. We record token
  **names** only; the used value is already in the observed styles.
- A component declares the custom properties for all of its variants. Attributing a
  token to an observed style must filter by the variant qualifiers active in the
  current configuration, or you will cite `_terciary` tokens for a `secondary` button.
- Tokens cascade, so a container declares its children's tokens. Naming a part from
  the token grammar is only safe when no descendant claims that name via a BEM class.
- Storybook's `sanitize` does **not** split camelCase when building story ids, but the
  story name _is_ split out of the export name first. `Contract Defaults/BlogAside` →
  `contract-defaults-blogaside`, while `ContractDefault` → `contract-default`.
- With a declared baseline, some parts exist in no baseline at all. Dropping them
  (`if (!base) continue`) silently destroys most of `section`'s and `slider`'s variant
  deltas. The first variant to show a part records its full state under
  `introduced: true` instead.
