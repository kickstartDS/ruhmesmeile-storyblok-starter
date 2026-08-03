# Phase 0 Spike — Specs component contracts

Executable spike for [`docs/internal/prd/specs-component-contracts-prd.md`](../../../../docs/internal/prd/specs-component-contracts-prd.md) §12, Phase 0.

Projects five kickstartDS components into [Specs](https://www.specsplugin.com/) `api.yaml`
contracts, validates them against `@directededges/specs-schema@0.28.0`, and scores
fidelity against the §8 mismatch register.

## Running

```bash
# one-time: fetch the Specs schema
cd /tmp && mkdir -p specs-eval && cd specs-eval
npm pack @directededges/specs-schema@0.28.0 && tar xf directededges-specs-schema-0.28.0.tgz \
  --one-top-level=directededges-specs-schema-0.28.0

# run the spike
pnpm --filter @kickstartds/design-system specs-spike
```

Options: `--schema-dir <path>`, `--out <path>`. Output lands in `dist-specs-spike/`.

## What it does

| Module                  | Responsibility                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `lib/tokenGrammar.mjs`  | Parse `--dsa-*` token names into component / variant / element path / property / state |
| `lib/deriveAnatomy.mjs` | Token names → Specs `anatomy` + `layout`, with name-collision detection                |
| `lib/mapProps.mjs`      | JSON Schema → Specs `Props`, classifying each prop native / extended / lossy           |
| `lib/buildStyles.mjs`   | Component tokens → Specs `Styles`, logging a decision per token                        |
| `lib/emitSpec.mjs`      | Assemble the `Component` object                                                        |
| `lib/validate.mjs`      | Ajv validation against the real Specs schema                                           |
| `lib/yaml.mjs`          | Minimal YAML serialiser (`yaml` is not a dependency here)                              |

The five subjects are deliberately awkward: `button` (trivial baseline), `section`
(compositional, 29-way polymorphic slot, two nested object props), `faq` (array of
sub-objects), `slider` (polymorphic children), `blog-aside` (two-level BEM nesting).

## Results

Both mechanical exit criteria pass:

- **5/5 validate** against `component.schema.json@0.28.0`
- **72 % of props map natively** (38/53), against a ≥ 70 % bar

| component  |  props | native | extended | lossy | native % |
| ---------- | -----: | -----: | -------: | ----: | -------: |
| button     |      7 |      4 |        3 |     0 |     57 % |
| section    |     25 |     21 |        1 |     3 |     84 % |
| faq        |      1 |      0 |        0 |     1 |      0 % |
| slider     |      9 |      7 |        1 |     1 |     78 % |
| blog-aside |     11 |      6 |        1 |     4 |     55 % |
| **total**  | **53** | **38** |    **6** | **9** | **72 %** |

## Findings that change the PRD

### A. `metadata` is all-or-nothing, and it is Figma-shaped

`Metadata.required = [author, lastUpdated, generator, schema, source, config]` with
`additionalProperties: false`. `source` requires `{pageId, nodeId, nodeType}` — pure
Figma provenance. PRD §11.3 proposes emitting `metadata.generator` while omitting
`metadata.source`; **that combination cannot validate.** A code-first producer must
omit `metadata` entirely (it is optional on `Component`) or fabricate Figma node IDs.
This spike omits it.

### B. There is nowhere in-band to declare coverage

`Component` and `Metadata` both set `additionalProperties: false` and neither declares
`$extensions`. The §8.7 `metadata.$extensions.com.kickstartds.coverage` design **cannot
validate**. Only `AnatomyElement` and the `*Prop` definitions carry `$extensions`.
Options: a sidecar file next to `api.yaml`, or smuggling it into `anatomy.root.$extensions`.

### C. Token names encode more than anatomy

PRD §6.4 treats BEM token names as an anatomy source. They also encode **variants and
interaction states**: `--dsa-button_primary--background-color_hover` yields variant
`primary`, property `background-color`, state `hover`. So `variants[]` deltas are
derivable too, not just anatomy — which strengthens the Phase 2 case. All 102 tokens
across the five subjects parsed cleanly; zero unparsed.

### D. `AnyProp` is ambiguous in Specs 0.28.0

`EnumProp` declares no `required` array, so a bare `{type: "string"}` validates as both
`StringProp` and `EnumProp` and therefore fails `AnyProp`'s `oneOf`. `examples` exists
only on `StringProp`, so emitting `examples: []` disambiguates. Worth reporting upstream.

### E. Specs `Typography` has no `fontWeight`

Figma models weight inside the _style name_ (`fontStyle: "Bold"`), so a numeric CSS
`font-weight` token has no lossless target. Conversely `text-transform` **does** map, to
`typography.textCase` — the PRD's §5 table understates this.

### F. `component-ref` tokens produce dangling `$token` paths

Tokens whose `valueType` is `component-ref` point at another component's `--dsa-` token,
not at a design token. Emitting them yields a `$token` path that resolves to nothing in
any DTCG file. `faq` is the worst case here: **6 of its 10 tokens are unresolvable**,
leaving a near-empty `Styles`. Any real emitter needs a resolution pass that follows
component-refs to their semantic root.

### G. Flat `Anatomy` collapses distinct parts

Specs `Anatomy` is a flat `Record<name, AnatomyElement>`, so two BEM paths ending in the
same segment become one element. `blog-aside` hits this twice:

```
collision 'link': author > link  |  sharebar > link
collision 'icon': meta > item > icon  |  share-bar > icon
```

Element names must be path-qualified (`author_link`) to survive the round trip.

## Pre-existing inconsistencies this surfaced in our own codebase

The enum → BEM modifier join is a genuine lint. Two real defects fell out:

- **`--dsa-button_terciary--*` is misspelled.** `button.schema.json` declares
  `variant: [primary, secondary, tertiary]`, but 20 token definitions and the SCSS in
  `src/components/button/` use `terciary`. The variant is unthemeable via the documented
  enum value.
- **`blog-aside` uses both `share-bar` and `sharebar`** as element segments.

Neither is caused by Specs; both were invisible until something tried to join the schema
enum to the token layer.
