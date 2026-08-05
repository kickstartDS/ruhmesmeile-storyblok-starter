# Format comparison — Specs vs. kickstartDS Component Contract

Both formats were generated from **the same five components and the same 21 authored
Storybook stories**, so every difference below is a property of the format, not of the
input. The contract additionally renders **5 generated baseline stories** (§10).

Output lands in `packages/design-system/dist-contract-spike/`, which is committed so the
two formats can be diffed in review:

| file                                     | format                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `{component}/reference.specs.api.yaml`   | Specs (Nathan Curtis), copied from `scripts/specs-spike` output |
| `{component}/{component}.contract.json`  | kickstartDS Component Contract v1                               |
| `{component}/{component}.brief.md`       | human/LLM-readable rendering of the contract                    |
| `{component}/{component}.narrative.json` | model-generated prose sidecar, when one exists                  |

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
    {
      "api": "primary",
      "class": "c-button--solid",
      "tokenSegment": "_primary",
    },
    {
      "api": "secondary",
      "class": "c-button--clear",
      "tokenSegment": "_secondary",
    },
    {
      "api": "tertiary",
      "class": "c-button--outline",
      "tokenSegment": null,
      "issues": ["token-vocabulary-mismatch"],
    },
  ],
}
```

Nobody wrote that table. `api` comes from the JSON Schema, `class` from the rendered
DOM, `tokenSegment` from the token grammar — the join is _derived_, and where it fails
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

`ks.font.interface.l` is wrong. A component declares the custom properties for _all_
of its variants, so a purely static reader has to guess which one is live. The contract
does not guess: it renders the default story, reads the used value, and attributes it
to the token whose variant qualifiers match the active configuration. This class of
error is undetectable without a rendering pass — the first version of the contract
spike had the same bug, and the rendered evidence is what exposed it.

## 4. Section-by-section capability

| capability                        | Specs                      | Contract                                    |
| --------------------------------- | -------------------------- | ------------------------------------------- |
| Prop list, types, defaults        | yes                        | yes                                         |
| Anatomy                           | flat map, 1 entry (`root`) | tree, named parts, `presence`, `role`       |
| Nested component instances        | —                          | `role: "slot"` + `instanceOf`               |
| Repeated parts                    | —                          | `presence: "repeated"`                      |
| Conditional parts + their gate    | —                          | `presence: "conditional"`, `gate`           |
| Default state styles              | token guess                | `{ token, resolves, computed }` from render |
| Variants                          | configurations, unproven   | deltas + `evidence.story` + screenshot      |
| Which prop changes what, and how  | —                          | `bindings[].mechanism` + `affects`          |
| API ↔ class ↔ token join          | —                          | `axes`                                      |
| Slots / composition               | —                          | `composition.slots`                         |
| Coverage of the possibility space | —                          | `coverage` + missing configurations         |
| Self-reported defects             | —                          | `issues`                                    |

## 5. Cost

On-disk bytes (pretty-printed JSON vs. YAML):

```
component     brief   specs   contract
button         1401    2183       8718
section        1778    6918      15370
faq             574    1042       3142
slider         1681    2312      13950
blog-aside     1705    4670      11420
```

The contract is 2–6× larger than the Specs document, and carries computed values,
evidence links, screenshots and coverage that the Specs document does not contain.

The `.brief.md` rendering — the artifact intended for humans and LLMs — is **smaller
than either machine format** in every case, because it drops the evidence apparatus
and keeps the conclusions.

Runtime for all 26 stories is a single browser session in Pass 2.

## 6. Honesty of the output

The contract distinguishes what it proved from what it assumed:

- `coverage.score` — `button` 0.75, `section` 0.63, `slider` 0.6
- `blog-aside` reports `coverage: null` — it has exactly one authored story, and the
  contract says so rather than inventing variants from the enum
- `coverage.baseline` reports how much of the declared default is designed rather than
  synthesised: `fromExample`, `placeholders`, and `emptySlots`
- axis values with no story carry `proven: false`
- axis values with no _contrasting_ story carry `discriminated: false` — without a
  counter-example you cannot separate a value's own class from the component's base
  class, so the contract declines to claim one
- bindings with no observed effect are `mechanism: "none"` rather than being omitted
- `section` reports `11/720` configurations proven

The Specs output has no vocabulary for any of this; everything in it reads as equally
asserted.

## 7. Anatomy derivation quality

```
component    parts  inDefault  naming provenance
button           2          2  content-match:1  root:1
section          8          1  bem-class:5  root:1  slot-boundary:2
faq              2          2  root:1  slot-boundary:1
slider          15          4  bem-class:10  position:1  root:1  slot-boundary:1  tag:1  token-grammar:1
blog-aside      19          9  bem-class:7  position:2  root:1  slot-boundary:4  tag:3  token-grammar:2
```

Every part records _how_ it got its name (`namedBy`). Only 4 parts across all five
components fell through to a positional `child-n` name — those are the honest
"we could not name this" cases rather than silent guesses.

Two rules do most of the work:

- **slot boundaries** — `l-container--<component>` and `dsa-<component>` mark where one
  component ends and another begins. Descending past them is allowed only where the
  outer component still defines its own tokens. Without this rule `section` produced
  **189 parts / 66 KB** of other components' internals; with it, 8 parts.
- **content match** — a leaf whose text equals a string prop's value _is_ that prop's
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
- Pass 4 (the narrative, PRD §5.12) is **not implemented**. The plumbing is: a
  `{component}.narrative.json` sitting beside the component schema is merged into the
  brief as italic prose, and the brief renders identically without one. No narrative
  is committed, because a hand-written one would be exactly the authored-artifact-
  pretending-to-be-derived problem the format exists to avoid.
- `faq` and `blog-aside` have too few stories to produce a meaningful contract. The
  format reports this honestly, but it means contract quality is bounded by story
  coverage — which is itself a useful signal.

## 10. The declared baseline, and what it cost

The first version of this spike **inferred** the default: it scored every story by its
distance from the schema defaults and used the closest one as the baseline. That is
convenient and wrong — no story was written to be the default, so the baseline moved
whenever someone added a story, and one arbitrary story was silently privileged over
the rest.

The baseline is now **declared**: built from `{Name}Defaults.ts` plus whatever the
schema demands, emitted as a generated `Contract Defaults/*` story, and rendered through
the same decorators as everything else. Every authored story is now a variant.

The change paid off immediately, and also surfaced a genuine problem.

**What improved.** With a stable baseline that no story occupies, deltas that were
previously invisible show up:

```
                 before          after
button           3 variants  →   4 variants
section          9           →  10
faq              1           →   2
slider           2           →   4
blog-aside       0           →   1
```

`blog-aside` and `slider` gained a `presence` binding they could not have had before —
with the sole story acting as its own baseline there was nothing to compare against, so
`blog-aside` reported one `mechanism: "none"` binding where it now reports a real one.

**What it cost.** Two of the five components cannot be rendered meaningfully from their
declared defaults, because their content slot is polymorphic:

| component            | slot               | shape         | baseline                                  |
| -------------------- | ------------------ | ------------- | ----------------------------------------- |
| `section.components` | `anyOf` 29 types   | no `minItems` | `[]`                                      |
| `slider.components`  | `anyOf` 10 types   | no `minItems` | `[]`                                      |
| `faq.questions`      | typed object items | `minItems: 1` | 2 items, from the schema's own `examples` |

A typed item shape can be synthesised from `examples` — `faq` gets two real questions,
`blog-aside` gets a full author object. A polymorphic slot cannot: there is no example
to take, and filling it would mean _authoring_ a child composition. So `section`'s
baseline renders an empty container, and only its root part is in `default.parts`
(`inDefault: 1` of 8 above).

Left alone, this would have been destructive. The variant loop previously did
`if (!base) continue` — any part absent from the baseline was dropped, so with a thin
baseline most of `section`'s and `slider`'s deltas would have silently vanished and
their bindings would have collapsed to `none`.

The fix is not to invent content. A part that first appears in a variant has no _delta_
to express — its existence is already stated by `presence: "conditional"` and its
`gate` — so the **first** variant to show it carries its full state under
`introduced: true`, and later variants diff against that. Nothing is restated, nothing
is lost, and `coverage.baseline` names the gap out loud:

```jsonc
"baseline": {
  "values": 14,
  "fromExample": 0,
  "placeholders": 0,
  "emptySlots": ["components", "buttons"]
}
```

Across all five components the placeholder table was never reached: every synthesised
value came from a schema `examples` entry. That is a better result than the 61%
repo-wide `examples` coverage predicted, and it is the number PRD §14.2 ratchets to zero.
