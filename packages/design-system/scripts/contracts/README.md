# Component contracts — generation, identity, projections

Production toolchain for `docs/internal/prd/kickstartds-component-contracts-prd.md`.
The format, its identity rules, and its projections to the Knapsack Design System
Contract and DSDS.

```bash
pnpm --filter @kickstartds/design-system contracts:test      # unit tests
pnpm --filter @kickstartds/design-system contracts:static    # Pass 1 across every subject (no browser)
pnpm --filter @kickstartds/design-system contracts:generate  # Pass 1-3: generate the committed contracts/
pnpm --filter @kickstartds/design-system contracts:validate  # fast: schema + address check of the committed set
pnpm --filter @kickstartds/design-system contracts:narrate   # Pass 4: model prose sidecars (needs OPENAI_API_KEY)
pnpm --filter @kickstartds/design-system contracts:verify    # slow: regenerate and diff against the committed set
```

## Verification

Two levels, because the cheap one runs on every PR and the expensive one does not:

| command | what it proves | cost |
| --- | --- | --- |
| `contracts:test` | fold/collision fixtures (Knapsack SCN-014/015), RFC 8785 worked example, projection mappings | <1s |
| `contracts:validate` | every contract against the format schema, every Knapsack projection against the target's vendored schema, every content address recomputed | <1s |
| `contracts:verify` | the committed set reproduces byte-for-byte from a fresh Storybook + browser pass | ~2 min, needs Chromium |

`contracts:validate` catches a hand-edited contract, a schema that moved underneath the set, and an address that no longer matches. `contracts:verify` catches a stale committed set and any non-determinism in the derivation. CI runs the first two per PR (`contracts` job) and the third on `workflow_dispatch` (`contracts-verify` job).

## Pass 4 — narratives

`contracts:narrate` describes what each component looks like, from its screenshots, with a
vision model. The result is a **quarantined sidecar** (`contracts/{contractId}.narrative.json`,
`kickstartds/component-narrative@1`) — never inside the contract, committed, carrying
provenance, and forbidden from being depended on by any lint rule or tool contract.

```bash
OPENAI_API_KEY=… pnpm --filter @kickstartds/design-system contracts:narrate --only button
pnpm --filter @kickstartds/design-system contracts:narrate --dry-run   # what would run, no calls
```

- **Skip is content-addressed**: `generated.inputs` holds a per-screenshot hash and the
  contract's canonical address; regeneration happens only when those, the model, or
  `promptVersion` change. `--force` overrides.
- **Grounded prompts**: the variant prompt carries the contract's derived delta verbatim and
  both screenshots (default + variant), so the prose cannot invent changes. `--dry-run`
  prints what would be described.
- **Screenshots are a prerequisite.** Variant screenshots exist already; the declared-default
  ones come from the normal `test-storybook` pass, scoped with
  `--includeTags contract-default` because the generated baseline stories carry that tag.
  Items whose screenshot is missing are skipped and counted, never invented.
- **`contracts:verify` excludes narrative files from its byte diff** (model output is not
  reproducible, PRD §5.12) but still compares the briefs derived from them, and the committed
  narratives are seeded into the temp set first so those briefs regenerate identically.
- `contracts:validate` validates narratives against their schema when present, and checks the
  `component` matches the contract.

## Generation pipeline

Derivation needs a browser pass over `storybook-static`, and the declared default has
no authored story, so generation is a three-step pipeline — not part of `build`:

```bash
node scripts/contracts/bin/generate.mjs --emit-stories   # write src/contract-defaults/
pnpm --filter @kickstartds/design-system build-storybook # render them
node scripts/contracts/bin/generate.mjs                  # observe → reconcile → emit
```

Output is **committed** into `contracts/` (like `static/img/screenshots/`) and copied to
`dist/contracts/` by Rollup, which is what keeps `build` browserless. `.contract-observations/`
is gitignored scratch and can be fed back with `--observations .contract-observations`.

```
contracts/{contractId}.contract.json         normalized v1 contract
contracts/{contractId}.brief.md              lossy Markdown projection
contracts/{contractId}.narrative.json        model prose sidecar, when present
contracts/index.json                         catalog + RFC 8785 content addresses
contracts/knapsack/{contractId}.contract.json + manifest.json
contracts/dsds/specs.json
contracts/contracts-report.json
```

A subject is a directory with a renderable component, a schema, and defaults (66 today).
`cms/`, `lightbox/`, `rich-text/`, `tile/`, `blog-tag/`, `page-wrapper/` and `seo/` are
skipped and reported — never guessed at.

## What lives here

| file | what it does | PRD |
| --- | --- | --- |
| `schema/contract.schema.json` | the format schema; the authority over Appendix B | §5 |
| `lib/components.mjs` | subject discovery + the export a generated story imports | §14.4 |
| `lib/fold.mjs` | the five-step fold, its two rejection classes, collision detection | §5.1.2–§5.1.3 |
| `lib/canonical.mjs` | RFC 8785 canonical form + `sha256:` content addresses | §5.1.5 |
| `lib/deterministic.mjs` | sorted-key output + derivation input hashes | §6.4 |
| `lib/knapsack.mjs` | projection to the Knapsack Design System Contract + manifest | §10.6.1 |
| `lib/dsds.mjs` | projection to DSDS `specs[]` + `traits` | §10.5 |
| `lib/publish.mjs` | orchestrates identity, collisions and projections (pure) | §5.1.4 |
| `lib/static.mjs`, `declared.mjs`, `genStories.mjs`, `observe.mjs`, `reconcile.mjs`, `brief.mjs`, `tokenGrammar.mjs` | Pass 1–3 derivation, ported from the Phase-0 spike | §6 |
| `bin/generate.mjs` | full-set generator (committed `contracts/`) | §5.1 |
| `vendor/knapsack/` | Knapsack's published schemas, vendored verbatim for offline validation (Apache-2.0, see `NOTICE`) | — |

The Phase-0 spike (`scripts/contract-spike/`, `scripts/specs-spike/`) and its committed output
were removed once the port completed: `bin/generate.mjs` derives Pass 1–3 and both projections
from the components themselves. What the spike settled is recorded in Decision 8 of the ADR, and
the Specs comparison in §10 of the PRD.
