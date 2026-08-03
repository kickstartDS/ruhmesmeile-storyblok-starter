# Format comparison — Specs vs. kickstartDS Component Contract

Both formats were generated from **the same five components and the same 21 Storybook
stories**, so every difference below is a property of the format, not of the input.

Output lands in `packages/design-system/dist-contract-spike/` (gitignored):

| file | format |
| --- | --- |
| `{component}/reference.specs.api.yaml` | Specs (Nathan Curtis), copied from `scripts/specs-spike` output |
| `{component}/{component}.contract.json` | kickstartDS Component Contract v1 |
| `{component}/{component}.brief.md` | human/LLM-readable rendering of the contract |

Regenerate with `pnpm --filter @kickstartds/design-system contract-spike`.

---

## 1. Headline result

The contract format answers a question the Specs format cannot express: **how do the
three vocabularies of a component relate to each other?**

```jsonc
// button.contract.json → axes
{
  "prop": "variant",
  "default": "secondary",
  "values": [
    { "api": "primary",   "class": "c-button--solid",   "tokenSegment": "_primary" },
    { "api": "secondary", "class": "c-button--clear",   "tokenSegment": "_secondary" },
    { "api": "tertiary",  "class": "c-button--outline", "tokenSegment": null,
      "issues": ["token-vocabulary-mismatch"] }
  ]
}
```

Nobody wrote that table. `api` comes from the JSON Schema, `class` from the rendered
DOM, `tokenSegment` from the token grammar — the join is *derived*, and where it fails
to join it says so.

The Specs output has no equivalent section. Its `variants` list is:

```yaml
variants:
  - configuration: { size: large }
  - configuration: { size: medium }
  - configuration: { variant: primary }
```

— configurations only, with no class, no token, no delta, and no link to evidence.
It also lists `size: large`, for which **no story exists**; nothing in the format
distinguishes an enumerated possibility from an observed fact.

## 2. Defects found automatically

Two pre-existing bugs in the design system fell out of the run without being looked for:

```
button      token-vocabulary-mismatch
            `variant: tertiary` renders `.c-button--outline` but has no token segment
            (the tokens are spelled --dsa-button_terciary--*)

blog-aside  token-segment-spelling-drift
            tokens spell the same element `share-bar` and `sharebar`
```

Neither is visible in the Specs output, because no section of that format relates the
API vocabulary to the class vocabulary to the token vocabulary.

## 3. Where the two formats disagree on facts

For `button`'s default state, the Specs output asserts:

```yaml
typography: { $token: ks.font.interface.l }
```

The contract observes:

```jsonc
"font": {
  "token":    "--dsa-button_medium--font",
  "resolves": "--ks-font-interface-m",
  "computed": "600 18.0319px 27.0478px Montserrat"
}
```

`ks.font.interface.l` is wrong. A component declares the custom properties for *all*
of its variants, so a purely static reader has to guess which one is live. The contract
does not guess: it renders the default story, reads the used value, and attributes it
to the token whose variant qualifiers match the active configuration. This class of
error is undetectable without a rendering pass — the first version of the contract
spike had the same bug, and the rendered evidence is what exposed it.

## 4. Section-by-section capability

| capability | Specs | Contract |
| --- | --- | --- |
| Prop list, types, defaults | yes | yes |
| Anatomy | flat map, 1 entry (`root`) | tree, named parts, `presence`, `role` |
| Nested component instances | — | `role: "slot"` + `instanceOf` |
| Repeated parts | — | `presence: "repeated"` |
| Conditional parts + their gate | — | `presence: "conditional"`, `gate` |
| Default state styles | token guess | `{ token, resolves, computed }` from render |
| Variants | configurations, unproven | deltas + `evidence.story` + screenshot |
| Which prop changes what, and how | — | `bindings[].mechanism` + `affects` |
| API ↔ class ↔ token join | — | `axes` |
| Slots / composition | — | `composition.slots` |
| Coverage of the possibility space | — | `coverage` + missing configurations |
| Self-reported defects | — | `issues` |

## 5. Cost

On-disk bytes (pretty-printed JSON vs. YAML):

```
component     brief   specs   contract
button         1401    2183      13860
section        1778    6918      26757
faq             574    1042       4099
slider         1681    2312      16442
blog-aside     1705    4670       9896
```

The contract is 2–7× larger than the Specs document, and carries computed values,
evidence links, screenshots and coverage that the Specs document does not contain.
Minified the contracts are roughly half those sizes (`button` 8.2 KB, `section` 14.7 KB).

The `.brief.md` rendering — the artifact intended for humans and LLMs — is **smaller
than either machine format** in every case, because it drops the evidence apparatus
and keeps the conclusions.

Runtime for all 21 stories is a single browser session in Pass 2.

## 6. Honesty of the output

The contract distinguishes what it proved from what it assumed:

- `coverage.score` — `button` 0.75, `section` 0.63, `slider` 0.6
- `blog-aside` reports `coverage: null` and **0 variants** — it has exactly one story,
  and the contract says so rather than inventing variants from the enum
- axis values with no story carry `proven: false`
- axis values with no *contrasting* story carry `discriminated: false` — without a
  counter-example you cannot separate a value's own class from the component's base
  class, so the contract declines to claim one
- bindings with no observed effect are `mechanism: "none"` rather than being omitted
- `section` reports `10/720` configurations proven

The Specs output has no vocabulary for any of this; everything in it reads as equally
asserted.

## 7. Anatomy derivation quality

```
component    parts  naming provenance
button           2  content-match:1  root:1
section          8  bem-class:5  root:1  slot-boundary:2
faq              2  root:1  slot-boundary:1
slider          12  bem-class:8  position:1  root:1  slot-boundary:1  tag:1
blog-aside      11  bem-class:4  position:1  root:1  slot-boundary:2  tag:2  token-grammar:1
```

Every part records *how* it got its name (`namedBy`). Only 2 parts across all five
components fell through to a positional `child-n` name — those are the honest
"we could not name this" cases rather than silent guesses.

Two rules do most of the work:

- **slot boundaries** — `l-container--<component>` and `dsa-<component>` mark where one
  component ends and another begins. Descending past them is allowed only where the
  outer component still defines its own tokens. Without this rule `section` produced
  **189 parts / 66 KB** of other components' internals; with it, 8 parts.
- **content match** — a leaf whose text equals a string prop's value *is* that prop's
  rendering, so `button`'s `<span>` is named `label` on evidence rather than guessed.

Two further rules were added after inspecting bad output, and both are worth keeping:

- token-grammar naming is rejected when a descendant already claims that name via a BEM
  class (tokens cascade, so containers declare their children's tokens — this had
  named `slider`'s wrapper `arrow`)
- `<svg>`, `<picture>` and `<video>` are opaque; their internals are rendering detail

## 8. Determinism

Two consecutive full runs produce byte-identical contracts for all five components.
This required normalising two sources of churn found during the spike: the static
server's ephemeral port appearing in URLs, and per-render `data-uid` attributes.

## 9. What this spike did not answer

- Interaction states (`:hover`, `:focus`) are excluded — token names carrying `_hover`
  / `_active` are captured, but no state is rendered.
- Single viewport only (1440×900); responsive behaviour is unmodelled.
- Single theme; `resolves` chains are captured but not compared across themes.
- The default story is inferred by distance from schema defaults, not declared.
- `faq` and `blog-aside` have too few stories to produce a meaningful contract. The
  format reports this honestly, but it means contract quality is bounded by story
  coverage — which is itself a useful signal.
