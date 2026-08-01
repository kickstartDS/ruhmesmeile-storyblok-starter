# PRD: Adopting Specs Component Contracts for the kickstartDS Design System

**Status:** 🔍 Evaluation — Recommendation pending decision
**Date:** 2026-08-01
**Author:** Design System / Platform
**Subject:** Evaluation of the [Specs](https://www.specsplugin.com/) component-contract standard ([DirectedEdges/specs](https://github.com/DirectedEdges/specs), Nathan Curtis) for adoption in `packages/design-system`
**Packages inspected:** `@directededges/specs-schema@0.28.0` (CC BY 4.0), `@directededges/specs-cli@0.25.0` (MIT)

---

## 1. Background & Problem Statement

### 1.1 What we have today

Every one of the **77 components** in [packages/design-system/src/components/](packages/design-system/src/components) carries a consistent, machine-readable contract — but only for **props**:

| Artifact | Source / Generated | What it captures |
| --- | --- | --- |
| `{name}.schema.json` | **authored** | Prop names, types, enums, defaults, `required`, nested objects, arrays, `anyOf` composition |
| `{name}.schema.dereffed.json` | generated (`kickstartDS schema dereference`) | Same, `$ref`-resolved, feeds Storybook |
| `{Name}Props.ts` | generated (`kickstartDS schema types`) | TypeScript interface |
| `{Name}Defaults.ts` | generated (`kickstartDS schema defaults`) | `DeepPartial<Props>` default object |
| `_{name}-tokens.scss` | **authored** | `--dsa-*` component tokens, incl. variant-scoped (`--dsa-button_primary--color`) |
| `{name}-tokens.json` | generated (`customPropertyExtract.cjs`) | Token → `[{ value, selector }]` catalog |
| `{name}.scss` | **authored** | BEM classes, modifier classes per enum value |
| `{Name}.stories.tsx` | **authored** | Storybook CSF, args via `getArgsShared(schema)` |
| `snippets.json` → `dist/components/presets.json` | generated (`generatePresets.test.ts`) | `{ id, group, name, code, args, screenshot }` per story |
| `src/token/component-token-catalog.json` | generated | Aggregated token catalog with `valueType` classification + container-query metadata |
| `src/token/token-graph.json` | generated | CSS custom property reference graph |

### 1.2 The gap

The **prop API** is fully specified and mechanically verified. Everything *around* it is not:

1. **Anatomy is invisible.** Which named elements make up a `Section`? Only `SectionComponent.tsx` and `section.scss` know. Nothing enumerates them, so nothing can reason about them — not the MCP servers, not agents, not docs, not a future Figma sync.
2. **Variant behaviour is convention, not contract.** `variant: "primary"` → `.c-button--solid` → `--dsa-button_primary--color`. That chain is real, consistent, and completely unasserted. A rename on either side silently breaks the relationship.
3. **Element-level styling is not addressable.** We know `--dsa-button--padding` exists; we do not know *which anatomy element* it applies to.
4. **Composition rules are implicit.** `section.schema.json` expresses allowed children as an `anyOf` of `$ref`s. Slot cardinality (min/max children), which slots exist, and when a slot renders are nowhere.
5. **No cross-component API governance.** With 77 components we have no mechanism to detect that `variant`, `kind`, and `style` mean the same thing in three places, or that `size` has three different enum value sets.
6. **No design-tool bridge.** There is **no Figma integration anywhere in this repo** (verified: Figma appears only in marketing copy and as explicit out-of-scope in [docs/internal/prd/cosmos-token-graph-prd.md](docs/internal/prd/cosmos-token-graph-prd.md)). Tokens are authored directly in SCSS/JSON.

### 1.3 Why Specs is a candidate

Specs is a schema + tooling ecosystem that formalises exactly items 1–5 as a single validated artifact per component, with a published JSON Schema, TypeScript types, a CLI, and a stated goal of being *"the record engineers, agents, and pipelines build from."* It is a **superset** of what a props schema covers, which matches how we want to grow our contract surface.

---

## 2. What Specs Actually Is — Evaluation Findings

### 2.1 Ecosystem shape

| Component | License | Cost | Notes |
| --- | --- | --- | --- |
| `@directededges/specs-schema` | **CC BY 4.0** | free | Types + JSON Schema. Type-only exports except `DEFAULT_CONFIG`. Zero runtime deps. |
| `@directededges/specs-cli` | **MIT** | free binary | Single 190 KB bundle, no deps in `package.json`. |
| Specs 2 Figma plugin | proprietary | $10/mo/seat | Pro tier. Volume discounts at 5+/10+ seats. |
| CLI Pro license | proprietary | included in $10/mo | **Metered: 50 `generate` calls/month.** |

The schema is CC BY 4.0 — attribution to Nathan Curtis and a link to the repository are required when reusing or deriving from it.

### 2.2 The spec model

```
Component                       required: title, anatomy, default
├─ title            string
├─ anatomy          Record<name, { type, instanceOf?, detectedIn?, $extensions? }>
│                   type ∈ text | glyph | vector | container | slot | instance
│                          | line | ellipse | rectangle | polygon | star
├─ props            Record<name, AnyProp>
│                   AnyProp = BooleanProp | StringProp | EnumProp
│                           | NumberProp | SlotProp | ImageProp
├─ default          Variant  ← the complete baseline, every element fully described
├─ variants         Variant[]  ← deltas only; keyed by `configuration` (PropConfigurations)
│   └─ Variant { configuration?, invalid?, layout?, elements? }
│       └─ Elements: Record<name, { children, parent, instanceOf, content, styles, propConfigurations }>
│           └─ styles: 48 properties (styles.schema.json) — literal | TokenReference | PropBinding | Conditional
├─ invalidVariantCombinations  PropConfigurations[]
├─ subcomponents    Record<name, Subcomponent>   (Component minus metadata/subcomponents)
├─ instanceExamples Record<name, { title, propConfigurations }>          [Pro]
├─ slotContentExamples Record<name, SlotContent{ anatomy, elements, layout }>  [Pro]
├─ images           Record<id, ImageData>
└─ metadata         { author, lastUpdated, generator, schema, source, config }
```

Key modelling decisions:

- **The default variant is complete; variants are deltas.** Consumers merge overrides onto the default. This is the single best idea in the model and maps well onto CSS cascade thinking.
- **Style values are rich.** Any style property may be a literal, a `TokenReference` (`{ $value, $variable }`), a `PropBinding` (`{ $binding: "#/props/showLabel" }`), or a `Conditional`.
- **Props are a flat map.** `Record<string, AnyProp>` — no nesting, no object props, no array-of-object props.

### 2.3 CLI surface

| Command | Purpose | Requires Figma? |
| --- | --- | --- |
| `specs init` | Scaffold `specs.config.yaml` | no |
| `specs fetch` | Pull file/variables/styles via Figma REST API | **yes** |
| `specs scan` | Produce a component manifest from Figma file JSON | **yes** |
| `specs generate` | Figma JSON → spec YAML/JSON | **yes** |
| `specs applyCustomTokens` | Rewrite token references | no |
| `specs analyze [props\|styling]` | Aggregate reports into `_analysis/` | **no** |
| `specs transform [contract\|css\|react\|stories]` | Fan a spec out into code artifacts | **no** |

> **Critical finding.** `specs transform` and `specs analyze` are **source-agnostic**. Both discover work by scanning the output directory for subfolders containing `api.yaml`, then parse that YAML — they never touch Figma. Verified directly in the shipped bundle (`dist/specs.js`, the component-directory filters at the `TransformCommand` and `AnalyzeCommand` entry points both reduce to `existsSync(join(outputPath, name, 'api.yaml'))`).
>
> **Consequence: we can adopt the Specs *format* without adopting the Figma *pipeline*.** If we emit conformant `api.yaml`/`variants.yaml`, the free MIT CLI's analyzers and transformers work against our design system as-is.

### 2.4 Transformer quality assessment

All four transformers are marked **EXPERIMENTAL** on the docs site. We read the `contract` transformer's implementation in full.

`specs transform contract` emits, per component:

```ts
export type DsAlertSeverity = | 'info' | 'warning' | 'error';
export interface DsAlertProps { severity?: DsAlertSeverity; dismissible?: boolean; icon?: string | null; }
export const DsAlertDefaults = { severity: "info", dismissible: false } satisfies DsAlertProps;
```

Measured against what we already generate:

| Capability | `specs transform contract` | `kickstartDS schema types` + `defaults` |
| --- | --- | --- |
| Enum union types | ✅ | ✅ |
| Required props | ❌ — **every prop is emitted optional** | ✅ (`label: Label` non-optional) |
| Nested object props | ❌ not representable | ✅ |
| Arrays of sub-objects | ❌ not representable | ✅ |
| Polymorphic children (`anyOf`) | ❌ (slot props are **skipped entirely**) | ✅ |
| `format` hints (`icon`, `image`, `markdown`) | ❌ | ✅ (drives CMS + editor UI) |
| Defaults type | plain object literal | `DeepPartial<Props>` |
| Schema layering (`kickstartDS schema layer`) | ❌ | ✅ |

**Conclusion: adopting the `contract` transformer would be a strict regression.** The same applies by extension to `css` (cannot express our `var(--a, var(--b, literal))` fallback chains or `@container` scoping), `react` (would collide with our pure-component + Context-override architecture), and `stories` (we already generate schema-driven args plus screenshot presets).

### 2.5 Analyzer quality assessment

`specs analyze props` is a different story — it is genuinely useful and we have no equivalent. Its aggregate output contains:

- `summary` — total props, total components, unique prop names, type distribution
- `propNameFrequency` — every prop name ranked by occurrence, with the components using it and the types it takes
- **`enumDiscordance`** — prop names that carry *different enum value sets* in different components
- `booleanNamingPatterns` — `is*` / `has*` / `can*` / bare counts
- `apiSurface` — per component: prop count, total enum values, slot count, boolean count
- `slots` — every slot with `anyOf`, `minItems`/`maxItems`, `nullable`

Across 77 components this is exactly the API-governance signal we lack. It requires only `api.yaml` — no Figma, no license.

`specs analyze styling` produces `styling.byComponent.json` / `styling.byToken.json`. This **overlaps heavily** with our existing `component-token-catalog.json`, `token-graph.json`, and the 29-tool Design Tokens MCP. Low incremental value.

### 2.6 Licensing gates (relevant only if a Figma path is ever pursued)

Free-tier `generate` output contains **only the default variant with raw literal values** — no variants, no token references, no named styles, no prop bindings, no invalid combinations. For a design system canon that is close to worthless.

Additionally, Figma's REST API restricts the `variables` and `styles` endpoints to **Enterprise** organisations. So the Figma ingest path requires: a Figma library (we have none) + Figma Enterprise + a Specs Pro subscription + staying under 50 generations/month.

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. Give every design system component a **single machine-readable contract** that covers anatomy, props, variants, slots, and examples — not just props.
2. Keep **JSON Schema as the authoritative source of truth for props**. Nothing about this proposal changes how props are authored.
3. Make the **schema-enum → BEM-modifier → component-token** relationship explicit and verifiable instead of conventional.
4. Gain **cross-component API governance** (enum discordance, naming drift, API surface) as a CI signal.
5. Produce an artifact that is **useful to agents and MCP consumers** without them having to read TSX and SCSS.
6. Stay **interoperable** with a broader ecosystem rather than inventing a private format, so that a future Figma library could plug in.
7. Add **zero authoring burden** for props — the contract must be generated, not hand-maintained, wherever derivation is possible.

### 3.2 Non-Goals

1. **Not adopting the Figma pipeline.** `fetch`, `scan`, `generate`, the Figma plugin, and any Pro subscription are explicitly out of scope. No Figma library exists.
2. **Not replacing our type/defaults generation.** `kickstartDS schema types|defaults|layer|dereference` stay exactly as they are.
3. **Not adopting `transform contract|css|react|stories`.** Established as a regression in §2.4.
4. **Not replacing our token pipeline.** `component-token-catalog.json`, `token-graph.json`, and the Design Tokens MCP remain canonical for tokens.
5. **Not making Specs a runtime dependency.** No Specs code should end up in `dist/` consumer bundles.
6. **Not migrating `packages/website` or the CMS schema pipeline.** Storyblok config generation is untouched.

---

## 4. Fit Analysis

### 4.1 Concept mapping

| Specs concept | kickstartDS today | Fit | Notes |
| --- | --- | --- | --- |
| `title` | schema `title` | ✅ 1:1 | |
| `description` (metadata) | schema `description` | ✅ 1:1 | |
| `EnumProp` | `type: string` + `enum` + `default` | ✅ 1:1 | |
| `BooleanProp` | `type: boolean` + `default` | ⚠️ near | Specs *requires* `default`; ours frequently omits it |
| `StringProp` + `examples` | `type: string` + `examples` | ✅ 1:1 | |
| `NumberProp` | `type: number` | ✅ 1:1 | |
| `ImageProp` | `format: "image"` | ✅ close | |
| `SlotProp` (`anyOf`, `minChildren`, `maxChildren`) | `type: array` + `items.anyOf: [$ref…]` | ⚠️ lossy | Specs `anyOf` takes bare component **names**; ours takes `$ref` **URIs**. Ours is an ordered array-of-children prop; Specs models a named slot. Cardinality is absent on our side. |
| **`required`** | JSON Schema `required` | ❌ **no equivalent** | Specs has no notion of a required prop. Must ride in `$extensions`. |
| **Nested object props** (`headline: { text }`) | very common | ❌ **not representable** | Must be flattened or dropped |
| **Arrays of sub-objects** (faq items, timeline items) | very common | ❌ **not representable** as props | Partially expressible via `subcomponents` |
| `format: "icon" \| "markdown" \| "uri"` | used throughout | ❌ no equivalent | Must ride in `$extensions['com.kickstartds']` |
| `anatomy` | implicit in TSX + BEM classes | 🟡 **the prize** | Nothing machine-readable today |
| `default` Variant → `elements[].styles` | `_{name}-tokens.scss` (component-scoped) | ⚠️ granularity mismatch | Our tokens are component-scoped; Specs styles are element-scoped |
| `variants[]` deltas | `.c-button--primary` + `--dsa-button_primary--*` | 🟡 **derivable by convention** | The mapping is real but unasserted — this is the highest-value thing to formalise |
| `layout` (flex/absolute tree) | SCSS + Bedrock primitives | ❌ poor fit | Figma auto-layout vocabulary; we'd emit nothing here |
| `instanceExamples` | `snippets.json` / `presets.json` | ✅ 1:1, **ours is richer** | We additionally carry rendered JSX `code` and a `screenshot` path |
| `slotContentExamples` / `Composition` | Section/Slider composition, Storyblok recipes | 🟡 conceptual match | Interesting for the MCP recipe layer |
| `subcomponents` | inline sub-object schemas (e.g. faq items) | ⚠️ partial | Would let us model repeated item shapes properly |
| `invalidVariantCombinations` | — | 🟡 net-new | We have no way to express "`variant: ghost` + `size: large` is invalid" |
| `metadata.config` / `metadata.source` | — | ➖ N/A | Figma-generation provenance |
| `images` | blurhash + asset pipeline | ➖ N/A | Different concern |

### 4.2 Where the model actively fights us

1. **`ElementType` is a Figma vocabulary.** `ellipse`, `polygon`, `star`, `vector`, `line` are node kinds, not web semantics. A code-first emitter would realistically only ever use `container`, `text`, `instance`, `slot`, `glyph`. Workable, but it signals where the model's centre of gravity is.
2. **`Styles` cannot represent our token architecture.** Our styling relies on `var(--dsa-x, var(--ks-y, literal))` fallback chains, `@include container.size()` container-query scoping, and three-layer token resolution. The Specs `Styles` shape (Figma-derived: fills, strokes, corner radii, effects, auto-layout) has no vocabulary for any of that. **Attempting to fill `elements.styles` from our SCSS would be lossy in the direction that matters most to us.**
3. **Props are flat.** Roughly half our components have at least one nested object or array-of-object prop. Any props projection into Specs is therefore *lossy by construction* — acceptable only because JSON Schema remains authoritative and the Specs props block is a *view*, not a *source*.
4. **Direction of flow is inverted.** Specs is architected design → spec → code. We are schema → code, with no design tool. Emitting code → spec is supported by the *format* (it is explicitly platform-independent) and by the CLI's disk-based transform/analyze, but it is **not a workflow the project documents or supports**. We would own the emitter completely.

### 4.3 Maturity and dependency risk

- Schema is at **0.28.0** — pre-1.0. The ADR record shows repeated breaking changes: ADR-007 removed three config properties (MAJOR), ADR-054 relocated `Config` to a new schema file, ADR-056 renamed `SlotProp.minItems`/`maxItems` → `minChildren`/`maxChildren`.
- All four transformers are labelled **EXPERIMENTAL**.
- Single maintainer / single-vendor project (Directed Edges, LLC).
- Mitigation is straightforward: we consume the schema for *validation* only, pin an exact version, and vendor a copy so a registry disappearance is not an outage.

---

## 5. Options Considered

### Option A — Full adoption (Figma plugin + CLI generate + transformers)

Buy Pro seats, build a Figma library mirroring 77 components, generate specs from Figma, consume transformer output.

- ✅ The intended, supported workflow; genuine design↔code sync
- ❌ Requires a Figma library that does not exist (months of design work)
- ❌ Requires Figma Enterprise for token/style references
- ❌ Recurring cost + 50 generations/month meter
- ❌ Transformers are a regression against our generated types
- ❌ Inverts our authoring model: Figma would become the source of truth for props

**Verdict: reject.** Fails on the very first precondition.

### Option B — Adopt the schema as an emitted projection; skip the pipeline ✅

Emit a Specs-conformant `api.yaml` (+ `variants.yaml`) per component from artifacts we already own — JSON Schema, token catalog, SCSS modifier classes, `snippets.json` — plus a small hand-authored `anatomy` block. Validate with Ajv against `component.schema.json`. Run `specs analyze props` in CI. Never run `generate` or `transform`.

- ✅ JSON Schema stays authoritative for props (the stated requirement)
- ✅ Zero cost, zero Figma, MIT CLI only
- ✅ Unlocks `analyze props` API governance immediately
- ✅ Produces a real, interoperable component canon for MCP/agent consumption
- ✅ Forward-compatible: if a Figma library ever appears, the ingest path is already the same format
- ⚠️ We own the emitter (~1 script, comparable in size to `extractComponentTokenCatalog.cjs`)
- ⚠️ `anatomy` must be authored per component — the real cost
- ⚠️ CC BY 4.0 attribution obligation on any derived/extended schema we publish
- ⚠️ Pre-1.0 upstream churn

**Verdict: recommend.**

### Option C — Roll our own `component-contract.json`

Design a private contract format that references the JSON Schema and adds anatomy, variant→class→token bindings, slot cardinality, and examples.

- ✅ Perfect fit; can model token fallback chains, container queries, `required`, nested props
- ✅ No CC BY 4.0 obligation, no upstream churn, no vendor
- ❌ No ecosystem, no interop, no free analyzers, no Figma on-ramp ever
- ❌ We design, document, version, and evangelise a standard — that is a product, not a feature

**Verdict: viable fallback if the Phase 0 spike shows the Specs model cannot carry enough of our semantics. Explicitly keep on the table.**

### Option D — Do nothing

- ✅ Zero cost
- ❌ All six gaps in §1.2 persist and worsen as the component count grows

**Verdict: reject.**

---

## 6. Recommendation

> **Adopt Option B, gated on a Phase 0 spike.**
>
> Treat the Specs schema as an **additional generated projection** of the design system, not as a new source of truth. JSON Schema continues to define props. The Specs artifact adds anatomy, variant deltas, slot cardinality, and examples — the things we cannot express today — and buys us the free `analyze props` governance layer plus a credible future Figma on-ramp.
>
> Explicitly **do not** adopt `specs generate`, the Figma plugin, or any of the four transformers.
>
> If the Phase 0 spike shows that fewer than ~70 % of our components can be represented without material semantic loss, fall back to **Option C**.

---

## 7. Proposed Architecture

### 7.1 Where the spec comes from

```
                     AUTHORED                              GENERATED
  ┌──────────────────────────────────┐        ┌────────────────────────────────┐
  │ {name}.schema.json               │───────▶│ props:        (EnumProp,       │
  │   props, enums, defaults,        │        │                BooleanProp,    │
  │   required, formats, anyOf       │        │                SlotProp, …)    │
  └──────────────────────────────────┘        │                                │
  ┌──────────────────────────────────┐        │ anatomy:      element map      │
  │ {name}.anatomy.json   ← NEW      │───────▶│                                │
  │   named elements + types + slots │        │ default:      baseline variant │
  └──────────────────────────────────┘        │                                │
  ┌──────────────────────────────────┐        │ variants[]:   deltas keyed by  │
  │ {name}-tokens.json               │───────▶│               configuration    │
  │ component-token-catalog.json     │        │                                │
  └──────────────────────────────────┘        │ instanceExamples:              │
  ┌──────────────────────────────────┐        │               from stories     │
  │ snippets.json  (Storybook)       │───────▶│                                │
  └──────────────────────────────────┘        │ $extensions['com.kickstartds'] │
                                              │   required, formats, refs,     │
                                              │   tokens, bemClass, screenshot │
                                              └────────────────────────────────┘
                                                            │
                                     ┌──────────────────────┼──────────────────────┐
                                     ▼                      ▼                      ▼
                          dist/specs/{name}/         Ajv validation        specs analyze props
                            api.yaml                 (CI gate)              → _analysis/props.json
                            variants.yaml                                   (CI governance gate)
```

### 7.2 Extension strategy

Specs supports DTCG-style `$extensions` on props and anatomy elements. Everything the Specs model cannot express goes into a reverse-domain namespace we own:

```yaml
props:
  label:
    type: string
    examples: ["Book a meeting"]
    $extensions:
      com.kickstartds:
        required: true              # Specs has no `required`
  icon:
    type: string
    $extensions:
      com.kickstartds:
        format: icon                # Specs has no format hints
  variant:
    type: string
    default: secondary
    enum: [primary, secondary, tertiary]
    $extensions:
      com.kickstartds:
        modifiers:                  # enum value → BEM class → token prefix
          primary:   { class: "c-button--solid",    tokenPrefix: "--dsa-button_primary" }
          secondary: { class: "c-button--outlined", tokenPrefix: "--dsa-button_secondary" }
          tertiary:  { class: "c-button--ghost",    tokenPrefix: "--dsa-button_tertiary" }
  components:
    type: slot
    anyOf: [cta, features, gallery, hero, image-text]
    $extensions:
      com.kickstartds:
        refs:                       # preserve the authoritative $ref URIs
          - "http://schema.mydesignsystem.com/cta.schema.json"
```

This keeps every spec **schema-valid** (`additionalProperties: false` is satisfied because `$extensions` is an allowed key) while losing nothing.

### 7.3 What we deliberately leave empty

| Specs field | Emit? | Why |
| --- | --- | --- |
| `default.elements[].styles` | ❌ | Cannot represent fallback chains / container queries. Tokens stay in our catalog, referenced via `$extensions`. |
| `layout` | ❌ | Figma auto-layout vocabulary; no meaningful projection from our SCSS. |
| `images` | ❌ | Handled by the blurhash/asset pipeline. |
| `metadata.source` / `metadata.config` | ❌ | Figma-generation provenance; not applicable. |
| `metadata.generator` | ✅ | Set to our emitter name + version, per schema requirements. |

### 7.4 Package placement

New script in the existing design system build, not a new package:

- `packages/design-system/scripts/emitComponentSpecs.mjs` — the emitter
- `packages/design-system/scripts/validateComponentSpecs.mjs` — Ajv validation against a vendored `component.schema.json`
- `packages/design-system/src/components/{name}/{name}.anatomy.json` — the one new authored artifact
- Output: `dist/specs/{name}/api.yaml` + `variants.yaml`, plus `dist/specs/index.json`
- `@directededges/specs-schema` enters as a **`devDependency` only**, pinned to an exact version, with the schema files vendored into `packages/design-system/vendor/specs-schema/` so builds never depend on registry availability.

---

## 8. Phased Plan

### Phase 0 — Spike (decision gate)

**Objective:** determine empirically whether the Specs model can carry our semantics.

1. Hand-write conformant `api.yaml` for **five deliberately chosen components**: `button` (trivial), `section` (compositional + slots + client behaviour), `faq` (array of sub-objects), `slider` (polymorphic `anyOf` children), and one component with a nested object prop (e.g. one using `headline: { text }`).
2. Validate all five against `component.schema.json@0.28.0` with Ajv.
3. Run `npx @directededges/specs-cli analyze props` over them and inspect `_analysis/props.json`.
4. Record, per component, a **fidelity score**: what fraction of the authored JSON Schema semantics survived, and what had to go into `$extensions`.

**Exit criteria — proceed to Phase 1 only if:**
- All five validate cleanly, **and**
- ≥ 70 % of props map to a native `AnyProp` kind without `$extensions` carrying load-bearing semantics, **and**
- `analyze props` output is judged actionable by the design system owner.

**Otherwise:** switch to Option C and reuse everything learned here as the design input for a private format.

### Phase 1 — Props + examples emitter (no anatomy)

1. Build `emitComponentSpecs.mjs`: JSON Schema → `props`, `snippets.json` → `instanceExamples`, minimal placeholder `anatomy` (`{ root: { type: container } }`) to satisfy the required field.
2. Wire Ajv validation into the build; fail the build on a non-conformant spec.
3. Emit for all 77 components; publish under `dist/specs/`.
4. Add `specs analyze props` as a **non-blocking** CI report.

**Value delivered:** enum discordance and prop-naming drift across all 77 components become visible for the first time. No authoring burden.

### Phase 2 — Anatomy + variant deltas

1. Define the `{name}.anatomy.json` authoring format (named elements, `ElementType`, slot flags, which BEM class each element maps to).
2. Author anatomy for the **top 20 components by usage** (measure via `analyze_content_patterns` from the Storyblok MCP — we already know which components appear most in real content).
3. Extend the emitter to derive `variants[]` deltas from the `enum → modifier class → token prefix` mapping declared in `$extensions`.
4. Add a **consistency check**: every declared modifier class must exist in the component's compiled CSS, and every declared token prefix must exist in `{name}-tokens.json`. This is the check that converts convention into contract.

**Value delivered:** the schema↔CSS↔token chain becomes mechanically verified. Renames on either side now fail the build.

### Phase 3 — Consumption

1. Expose specs as an MCP resource: `design-system://specs` (index) and `design-system://specs/{component}` from `packages/component-builder-mcp`.
2. Add a `get-component-spec` tool so agents read one validated artifact instead of crawling TSX + SCSS + schema + stories.
3. Promote `specs analyze props` from report to **blocking CI gate** with an allowlist for accepted discordance.
4. Author anatomy for the remaining ~57 components, opportunistically as components are touched.

### Phase 4 — Deferred: design-tool ingest

Only if a Figma component library is ever built. At that point re-evaluate Pro licensing, Figma Enterprise availability, and whether Figma or JSON Schema owns props. Nothing in Phases 0–3 blocks or prejudices this.

---

## 9. Risks & Mitigations

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| 1 | **Upstream breaking changes** (pre-1.0, documented history of MAJOR bumps) | High | Pin exact version; vendor `component.schema.json`; consume for validation only; treat upgrades as deliberate, scheduled work |
| 2 | **CC BY 4.0 attribution obligation** conflicts with our `MIT OR Apache-2.0` posture | Medium | We *validate against* the schema rather than redistributing it in `dist/`. If we ever publish a derived/extended schema, add explicit attribution to Nathan Curtis + repo link in `COPYRIGHT.md` and the package README. **Requires legal sign-off before Phase 1 ships.** |
| 3 | **Anatomy authoring burden** across 77 components | High | Phase it by usage frequency; placeholder anatomy in Phase 1 keeps specs valid meanwhile; consider deriving a first draft from BEM classes in the compiled CSS |
| 4 | **Spec drift** — generated spec diverges from real component | High | Everything derivable is derived, never authored. The only authored file is `{name}.anatomy.json`, and Phase 2's consistency check validates it against compiled CSS |
| 5 | **`$extensions` becomes the real schema** — if most semantics live there, we have Option C wearing a Specs costume | Medium | This is precisely what the Phase 0 fidelity score measures; the 70 % exit criterion exists to catch it |
| 6 | **Single-vendor dependency** | Medium | MIT CLI + CC BY schema are both forkable. Our emitter is ours. Worst case we keep the format and drop the tooling. |
| 7 | **Build time regression** | Low | Emitter is pure file transformation over already-generated artifacts; comparable cost to `extractComponentTokenCatalog.cjs` |
| 8 | **Effort spent on an artifact nobody consumes** | Medium | Phase 3 (MCP exposure) is the payoff; if Phase 1's `analyze props` output is not acted on within one cycle, stop and reassess |

---

## 10. Success Metrics

| Metric | Baseline | Target |
| --- | --- | --- |
| Components with a schema-valid spec | 0 / 77 | 77 / 77 after Phase 1 |
| Components with authored anatomy | 0 / 77 | 20 / 77 after Phase 2, 77 / 77 after Phase 3 |
| Enum discordance instances detected | unknown | measured after Phase 1; reduced by ≥ 50 % after Phase 3 |
| Schema-enum → BEM-modifier → token mappings mechanically verified | 0 | 100 % of components with authored anatomy |
| Agent context cost to understand one component | 4 files (schema + TSX + SCSS + stories) | 1 file (`api.yaml`) |
| Net new recurring cost | — | **€0** |

---

## 11. Open Questions

1. **Legal:** does validating against a CC BY 4.0 JSON Schema, without redistributing it, create an attribution obligation? Assume yes and attribute anyway, or get a definitive answer? *(Blocks Phase 1 ship, not Phase 0.)*
2. **Anatomy authoring:** hand-authored `{name}.anatomy.json`, or derived from compiled BEM classes with a hand-authored override file? The latter is cheaper but couples anatomy to CSS-class churn.
3. **Slot semantics:** our array-of-`anyOf` children prop is genuinely a different concept from a Specs named slot. Do we model each as one `SlotProp` (lossy but native), or as a `StringProp`-free custom `$extensions` construct (faithful but non-native)?
4. **Subcomponents:** should repeated item shapes (faq items, timeline items) become Specs `subcomponents`? That would improve fidelity materially but changes how those schemas are authored.
5. **Do we upstream anything?** Several of our gaps (`required`, `format` hints, token fallback chains) are plausibly general. Is engaging the Specs project on these worth the effort, or do we stay a pure consumer? Compare with the approach in [docs/adr/adr-optoma-upstreaming.md](docs/adr/adr-optoma-upstreaming.md).
6. **Storyblok relationship:** `instanceExamples` and `slotContentExamples` overlap conceptually with the section recipes in [packages/storyblok-mcp/schemas/section-recipes.json](packages/storyblok-mcp/schemas/section-recipes.json). Should recipes eventually be expressed as Specs `Composition` entries, or stay independent?

---

## Appendix A — Inspection Record

Packages downloaded and inspected on 2026-08-01:

```bash
npm pack @directededges/specs-schema @directededges/specs-cli
# → directededges-specs-schema-0.28.0.tgz  (38 KB, 3 files-worth: dist/, types/, schema/)
# → directededges-specs-cli-0.25.0.tgz     (46 KB, single 190 KB dist/specs.js bundle)
```

**`@directededges/specs-schema@0.28.0`**
- `license: "CC-BY-4.0"`, `author: Nathan Curtis <nathan@directededges.com>`
- `devDependencies: { typescript }` only — zero runtime dependencies
- Ships `schema/{component,components,root,styles,workspace}.schema.json` and `types/*.ts`
- `component.schema.json`: 42 definitions; `Component.required = ["title", "anatomy", "default"]`
- `DEFAULT_CONFIG` is the only runtime export

**`@directededges/specs-cli@0.25.0`**
- `license: MIT`; single bundled ESM file, no declared dependencies
- Internal modules confirmed present: `commands/{Generate,Scan,Fetch,Init,Analyze,ApplyCustomTokens,Transform}Command`, `analyzers/{Props,Styling}`, `transforms/{Contract,Css,React,Stories}`
- `TransformCommand` and `AnalyzeCommand` both discover work via `existsSync(join(outputPath, name, 'api.yaml'))` — **no Figma coupling**
- `ContractTransformer.buildContractLines()` confirmed to emit all props optional and to `continue` past `type === 'slot'`

## Appendix B — Sources

- Product site: <https://www.specsplugin.com/>
- Schema reference: <https://www.specsplugin.com/schema/>
- Transforms (EXPERIMENTAL): <https://www.specsplugin.com/cli/transforms/>
- `contract` transformer: <https://www.specsplugin.com/cli/transforms/contract/>
- Licensing / Free vs Pro: <https://www.specsplugin.com/overview/licensing/>
- License terms: <https://www.specsplugin.com/overview/license/>
- Repository: <https://github.com/DirectedEdges/specs>
- RFC 001 — Component Dictionary: <https://github.com/DirectedEdges/specs/blob/main/rfc/001-component-dictionary/README.md>
- Schema constitution (governance & versioning policy): `.specify/memory/constitution.md` in the repository

## Appendix C — Related Internal Documents

- [docs/internal/prd/cosmos-token-graph-prd.md](docs/internal/prd/cosmos-token-graph-prd.md) — token graph scope; establishes CSS-custom-property-only precedent
- [docs/adr/adr-cosmos-token-graph.md](docs/adr/adr-cosmos-token-graph.md) — rationale for excluding DTCG/Figma Tokens as direct inputs
- [docs/adr/adr-optoma-upstreaming.md](docs/adr/adr-optoma-upstreaming.md) — precedent for upstream-vs-fork decisions
- [docs/internal/README-component-builder-mcp.md](docs/internal/README-component-builder-mcp.md) — the MCP surface that would consume specs in Phase 3
- [docs/internal/README-design-token-mcp.md](docs/internal/README-design-token-mcp.md) — overlapping token analysis surface
