# PRD: kickstartDS Component Contracts

**Status:** 📐 Proposal — awaiting decision
**Date:** 2026-08-03
**Author:** Design System / Platform
**Subject:** A kickstartDS-native component contract format that joins **anatomy**, **default + variants**, and **visual design** into one derived, verifiable artifact.
**Relationship to prior work:** Supersedes the adoption path evaluated in [specs-component-contracts-prd.md](./specs-component-contracts-prd.md). We keep the _reasoning_ from Nathan Curtis' [Component Contracts and Schemas](https://nathanacurtis.substack.com/p/component-contracts-and-schemas); we reject the _shape_, because it is Figma-derived and we are DOM-derived.
**Simplifying assumption:** Desktop-only. See §7.

---

## Executive Summary

**The problem.** When an LLM builds UI against our Design System today, it can see three things: design tokens (via the Design Tokens MCP), component APIs and stories (via Storybook's manifest and `index.json`), and prose instructions (via the Component Builder MCP). None of these say **what a component is made of**, or **what happens visually when you set a prop**. The agent knows `Button` has `variant: primary | secondary | tertiary`. It has no way to learn that `primary` renders `.c-button--solid`, which is the selector that binds `--dsa-button_primary--background-color`. Those three vocabularies exist in three different files and are joined only inside a SCSS rule that nothing reads. An agent asked to "make the CTA visually heavier" has to guess.

**The proposal.** A per-component **Component Contract** — `{name}.contract.json` — that is 100% _derived_, never authored, from artifacts we already produce. It carries five things the current stack cannot express:

1. **`anatomy`** — the component's parts, observed from the **rendered DOM**, not inferred from naming conventions.
2. **`axes`** — each variant axis with its **three-vocabulary join**: the API value, the DOM class it produces, and the token segment it themes.
3. **`default`** — the baseline configuration with resolved styles per part, plus the screenshot that proves it.
4. **`variants`** — normalized **deltas only**, one entry per proven configuration, each backed by a story and a screenshot.
5. **`bindings`** — explicit `prop → part → mechanism → effect` statements. The mechanism enum (`class-toggle`, `token-swap`, `presence`, `content`, `attribute`, `layout`) is the missing sentence: _how_ does this prop become visible?

**How it's derived.** Three passes, all mechanical. Pass 1 reads schemas, defaults and token catalogs — no browser. Pass 2 piggybacks on `postVisit` in [.storybook/test-runner.tsx](../../../packages/design-system/.storybook/test-runner.tsx), the hook that already captures our 157 screenshots, and additionally records each story's DOM tree, computed styles, active custom properties and box geometry. Pass 3 reconciles: union the parts, diff every variant story against its default, attribute each delta to the prop that changed. **The marginal cost is one extra `page.evaluate()` in a pass we already run.**

**Why not Specs.** The Phase 0 spike ([scripts/specs-spike/](../../../packages/design-system/scripts/specs-spike/)) proved the mechanics work — 5/5 contracts validated, 72% of props mapped natively — but also proved the shape fights us: `metadata` is all-or-nothing and demands Figma node IDs; `Component` has no `$extensions` so coverage cannot be declared in-band; flat `Anatomy` collapses `author > link` and `sharebar > link` into one element; and 6 of `faq`'s 10 tokens produce dangling references. We would be maintaining a translation layer to a model built for a source of truth we do not have.

**Why this is worth doing anyway.** The spike's enum→token join, a five-line check, immediately surfaced two real defects invisible to every existing artifact: `--dsa-button_terciary--*` is misspelled against the `tertiary` enum (making that variant unthemeable via its documented name), and `blog-aside` uses both `share-bar` and `sharebar`. A contract that joins vocabularies makes an entire class of silent drift computable.

**Recommendation.** Build it. Phase 1 (schema + Pass 1 + Pass 2 capture) is small and self-contained; Phase 2 (reconciliation + `bindings`) is where the value lands; Phase 3 ships it to agents via the Component Builder MCP and a token-budgeted `brief` projection.

---

## 1. Background & Problem Statement

### 1.1 What an agent can see today

| Source                                        | Surface                   | What it tells an agent                                    |
| --------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| Design Tokens MCP                             | 29 tools, 4 resources     | Every token, its value, its references, its governance    |
| Storybook manifest (`experimental_manifests`) | per-component             | id, title, description (enriched from JSON Schema)        |
| `storybook-static/index.json`                 | 211 entries               | story ids, titles, import paths, tags                     |
| `snippets.json`                               | 137 entries               | per-story JSX code, `args`, screenshot path               |
| Component Builder MCP                         | 7 tools                   | Prose instructions and templates for authoring            |
| `{name}.schema.dereffed.json`                 | 77 components             | Fully-typed prop API                                      |
| `component-token-catalog.json`                | 50 components, 807 tokens | Which tokens exist per component, and what they reference |

That is a lot. It is also, structurally, **two disconnected halves**: an API half (props, types, defaults) and a styling half (tokens, values, references). Nothing joins them.

### 1.2 The gap, concretely

Take `Button`. Three artifacts describe its `variant` prop, in three different vocabularies:

```jsonc
// 1. src/components/button/button.schema.json — the API vocabulary
"variant": { "enum": ["primary", "secondary", "tertiary"], "default": "secondary" }
```

```jsx
// 2. src/components/button/ButtonComponent.tsx — translated to the base vocabulary
variant={ variant === "primary"   ? "solid"
        : variant === "secondary" ? "clear"
        : variant === "tertiary"  ? "outline"
        : "solid" }
```

```scss
// 3. src/components/button/button.scss — joined back to the token vocabulary
&.c-button--solid {
  --c-button--color: var(--dsa-button_primary--color, …);
  --c-button--background-color: var(--dsa-button_primary--background-color, …);
}
```

So `variant: "primary"` → class `.c-button--solid` → token `--dsa-button_primary--background-color`. **That chain exists nowhere as data.** It is reconstructible only by reading three files and following a ternary. An agent given our MCP servers can see step 1 and step 3's _right-hand side_, and nothing in between.

The consequences are not hypothetical:

- **Agents guess at visual intent.** "Make this button more prominent" → the agent has no evidence that `primary` is the heavier treatment. It can read the token _name_ and infer. Inference, not determinism.
- **Drift is undetectable.** The token layer says `--dsa-button_terciary--*`. The enum says `tertiary`. Both files are individually valid. Nothing compares them, so a whole variant has been unthemeable via its documented value for as long as the typo has existed.
- **Structure is invisible.** `Faq` renders a `CollapsibleBox` per question, each with a header, a text, and an icon. The tokens know about `summary`, `answer` and `icon`. The schema knows about `questions[].question` and `questions[].answer`. Neither says these are the same things.
- **Prop→visual causality is absent.** Setting `icon` on a Button adds a DOM node. Setting `disabled` toggles a class. Setting `size` swaps a font token. These are three _different mechanisms_ with three different blast radii, and they look identical in the schema.

### 1.3 What we want to keep from Curtis

The [article](https://nathanacurtis.substack.com/p/component-contracts-and-schemas) argues seven principles. We adopt all seven as **design constraints on our own format**, with our position stated in §2. The framing we specifically want:

- **A description informs; a contract arbitrates.** Our current docs describe. We want something that can reject.
- **Anatomy / default / variants as the organising triad**, with variants as _deltas_ rather than full restatements.
- **Verifiable over readable** — the primary artifact is machine-checked; human-readable output is _generated from_ it, never alongside it.

### 1.4 What we deliberately leave behind

Specs is excellent at what it is: a Figma-extraction contract. We evaluated adopting it in [specs-component-contracts-prd.md](./specs-component-contracts-prd.md) and built a working spike. The mismatch is structural, not cosmetic — see §10 for the full accounting. In one line: **Specs models a design file; we need to model a rendered DOM.**

---

## 2. Principles

Curtis' seven, restated against our situation. Where we deviate, we say so.

| #   | Principle                                | Our position                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Well-typed over loosely formed**       | **Adopt fully.** JSON Schema, validated in CI. Every enum closed. The `mechanism` field on a binding is an enum, not prose.                                                                                                                                                                     |
| 2   | **Normalized over redundant**            | **Adopt fully, and it is our hardest constraint.** The contract must _reference_ the prop schema, not restate it; variants carry deltas, not full states; the human-readable brief is generated, never authored. Any field that duplicates an upstream source must be provably derived from it. |
| 3   | **Independent over platform biased**     | **Deviate deliberately.** We are unapologetically **web/DOM-biased**, because the DOM is our single implementation and our source of truth. Platform-neutrality would cost us determinism and buy us nothing today. We record this as a known limitation, not an accident (§9).                 |
| 4   | **Verifiable over readable**             | **Adopt fully.** The contract validates against a schema; a linter cross-checks the three vocabularies, token existence, and story coverage. The LLM-facing `brief` is a lossy projection and is explicitly **not** load-bearing.                                                               |
| 5   | **Determinism over inference**           | **Adopt, with one named concession.** Passes 1–3 are mechanical. The only inference is _part naming_ (§6.3), which is configured by convention, not hoped for — and every part records the evidence it was observed in.                                                                         |
| 6   | **Efficiency over expense to keep true** | **Adopt, and it drives the architecture.** This is why capture rides on `postVisit` rather than a new pipeline. Regenerating contracts costs one `page.evaluate()` per story on a run we already do.                                                                                            |
| 7   | **Evolvable over simply flexible**       | **Adopt.** Format version in `$format`. Changes land as ADRs in [docs/adr/](../../adr/). Consumers pin.                                                                                                                                                                                         |

One principle of our own:

| 8 | **Derived over authored** | **Nothing in a contract may be hand-written.** If a fact cannot be derived from an existing artifact, the correct fix is to enrich that artifact — not to add a hand-maintained sidecar. A contract that can be edited will be edited, and then it drifts. |

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. Emit one `{name}.contract.json` per component, fully derived, deterministic (byte-identical on unchanged input).
2. Express **anatomy** as observed structure, with each part traceable to the DOM node it was seen on.
3. Express the **three-vocabulary join** (API value ↔ DOM class ↔ token segment) as first-class data.
4. Express **default + variants** with variants as deltas, each backed by a real story and screenshot.
5. Express **`bindings`** — for every prop, which parts it affects and by which mechanism.
6. Report **coverage honestly**: which enum values, booleans and slots have visual evidence, and which do not.
7. Serve contracts to agents through MCP at a sane token cost.
8. Provide a **linter** that turns the contract into drift detection over the existing codebase.
9. Add **zero new authored files** and no new build stage beyond what `test-storybook` already runs.

### 3.2 Non-Goals

1. **Not a Figma format.** No Figma provenance, no node IDs, no round-trip. If Figma matters later, it consumes contracts; it does not produce them.
2. **Not a replacement for JSON Schema.** The schema stays the prop source of truth. The contract references it.
3. **Not responsive.** Desktop only (§7).
4. **Not a theme matrix.** Contracts are emitted against the default theme. Other themes swap token _values_, not structure.
5. **Not a rendering spec.** We do not aim to reconstruct the component from the contract.
6. **Not multi-platform.** One implementation, one DOM.
7. **Not authored prose.** No `notes` field. If it cannot be verified, it does not belong (Curtis #4).
8. **Not a Specs producer** — though §10.3 notes the projection stays cheap if we ever want it.

---

## 4. Source Inventory

Everything the contract needs, and where it already exists. **Nothing in the "New?" column is a new authored artifact.**

| Contract section                 | Derived from                          | Path                                                                         | New?         |
| -------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| `id`, `title`, `description`     | JSON Schema + Storybook manifest      | `src/components/{n}/{n}.schema.json`, `experimental_manifests`               | no           |
| `api.props`                      | Dereferenced schema                   | `{n}.schema.dereffed.json`                                                   | no           |
| `default.configuration`          | Generated defaults                    | `{Name}Defaults.ts` (via `kickstartDS schema defaults`)                      | no           |
| `anatomy`                        | **Rendered DOM**                      | new capture in `postVisit`                                                   | capture only |
| `anatomy[].tokens`               | Component token catalog               | `src/token/component-token-catalog.json` (50 components, 807 tokens)         | no           |
| `anatomy[].styles`               | **Computed styles**                   | new capture in `postVisit`                                                   | capture only |
| `axes[].values[].class`          | **Observed DOM classes**              | new capture in `postVisit`                                                   | capture only |
| `axes[].values[].tokenSegment`   | Token grammar parser                  | `scripts/specs-spike/lib/tokenGrammar.mjs` (built, proven on 102/102 tokens) | reuse        |
| `variants[]`                     | Story args + DOM/style diff           | `snippets.json` (137), `index.json` (211)                                    | no           |
| `variants[].evidence.screenshot` | Existing screenshots                  | `static/img/screenshots/{story-id}.png` (157)                                | no           |
| `bindings[]`                     | Pass 3 reconciliation                 | derived                                                                      | derived      |
| `composition.slots`              | Schema arrays with `items.anyOf`      | `{n}.schema.dereffed.json`                                                   | no           |
| `tokens[].resolved`              | Semantic catalog + token graph        | `semantic-token-catalog.json` (16 groups), `token-graph.json`                | no           |
| `coverage`                       | Stories vs. schema enum cross-product | derived                                                                      | derived      |

The only genuinely new thing is **what we record during a browser pass we already run.**

---

## 5. The Format

### 5.1 Naming and placement

```
src/components/{name}/{name}.contract.json     # generated, gitignored
dist/contracts/{name}.contract.json            # published
dist/contracts/{name}.narrative.json           # published, LLM-generated (§5.12)
dist/contracts/index.json                      # catalog + format version
dist/contracts/{name}.brief.md                 # generated LLM projection (§8.2)
```

Format identifier: `kickstartds/component-contract@1`.

The contract and the narrative are **separate files on purpose**. The contract is
deterministic and verifiable; the narrative is model-generated and advisory. Keeping
them apart is what lets us have both without one contaminating the other (§5.12).

### 5.2 Top-level shape

```jsonc
{
  "$format": "kickstartds/component-contract@1",
  "id": "button",
  "title": "Button",
  "description": "Component used for user interaction",

  "generated": {
    "inputs": {
      // content hashes — determinism check
      "schema": "sha256:…",
      "tokens": "sha256:…",
      "stories": "sha256:…",
    },
    "viewport": { "width": 1440, "height": 900 },
    "theme": "default",
  },

  "api": {
    /* §5.4 */
  },
  "anatomy": {
    /* §5.3 */
  },
  "axes": [
    /* §5.5 */
  ],
  "default": {
    /* §5.6 */
  },
  "variants": [
    /* §5.7 */
  ],
  "bindings": [
    /* §5.8 */
  ],
  "composition": {
    /* §5.9 */
  },
  "coverage": {
    /* §5.10 */
  },
}
```

Note there is **no `metadata.author`, no `source`, no prose**. Curtis #2 and #4.

### 5.3 `anatomy` — parts, observed

A **part** is a named, addressable region of the component. It is the join key between the DOM, the token layer and the prop API.

Anatomy is a **tree**, not a flat map. The Specs spike proved the flat model collapses distinct parts: `blog-aside` lost `author > link` and `sharebar > link` into one entry, and `meta > item > icon` into `share-bar > icon`. Paths are stable identifiers (`root/label`, `root/author/link`).

```jsonc
"anatomy": {
  "path": "root",
  "element": "a",                        // observed; "a" when href present, else "button"
  "classes": ["dsa-button", "c-button"], // classes present in EVERY story (invariant)
  "role": "container",                   // container | text | glyph | media | slot | control
  "presence": "always",
  "tokens": [                            // from component-token-catalog, joined by BEM path
    "--dsa-button--padding",
    "--dsa-button--border-radius",
    "--dsa-button--border-width",
    "--dsa-button--font-weight"
  ],
  "children": [
    {
      "path": "root/label",
      "element": "span",
      "classes": [],
      "role": "text",
      "presence": "conditional",
      "gate": { "prop": "label", "when": "truthy" },
      "content": { "$binding": "#/api/props/label" },
      "tokens": []
    },
    {
      "path": "root/icon",
      "element": "svg",
      "classes": ["icon"],
      "role": "glyph",
      "presence": "conditional",
      "gate": { "prop": "icon", "when": "truthy" },
      "content": { "$binding": "#/api/props/icon" },
      "tokens": [],
      "observedIn": ["components-button--button-with-icon"]
    }
  ]
}
```

Design decisions:

- **`element` and `classes` are observed, never inferred.** The spike's `inferElementType()` heuristic (name matches `/^(icon|arrow|bullet)$/` → glyph) is exactly the "inference I hope for" Curtis warns about. A real `<svg>` is not a guess.
- **`classes` records only the invariant set** — classes present in every story. Conditional classes belong to `axes` and `bindings`, stated once (Curtis #2).
- **`presence` + `gate`** is how conditional structure becomes computable. `root/icon` exists iff `icon` is truthy — derivable by diffing the DOM of a story that sets `icon` against one that does not.
- **`observedIn`** lists story ids, and is recorded **only for parts that are not
  `presence: "always"`**. For an invariant part the list would be every story of the
  component, which is noise. This is the audit trail for §5.10 coverage.
- **`tokens`** is a list of _names_, not values. Values live once, in `default.parts` and `variants[].parts`. Curtis #2.

### 5.4 `api` — reference, not restatement

```jsonc
"api": {
  "schema": "./button.schema.dereffed.json",
  "required": ["label"],
  "props": {
    "label":    { "type": "string",  "role": "content" },
    "url":      { "type": "string",  "format": "uri", "role": "behaviour" },
    "variant":  { "type": "enum",    "values": ["primary","secondary","tertiary"],
                  "default": "secondary", "role": "appearance", "axis": true },
    "size":     { "type": "enum",    "values": ["small","medium","large"],
                  "default": "medium",    "role": "appearance", "axis": true },
    "icon":     { "type": "string",  "format": "icon", "role": "content" },
    "disabled": { "type": "boolean", "default": false,  "role": "state", "axis": true },
    "type":     { "type": "enum",    "values": ["button","submit","reset"],
                  "default": "button",    "role": "behaviour" }
  }
}
```

The contract does **not** copy titles, descriptions or examples — those stay in the schema, which is referenced. What it adds is two derived classifications an agent needs and the schema does not carry:

- **`role`** ∈ `content | appearance | state | behaviour | layout | composition` — answers "will changing this change how it looks?"
- **`axis`** — true when the prop produces an observable visual delta (proven in Pass 3, not asserted). `type: submit` is a behaviour prop with no visual signature, so `axis: false`. This alone is useful: it tells an agent which props are worth reasoning about visually.

### 5.5 `axes` — the three-vocabulary join

**This is the section that does not exist anywhere today.**

```jsonc
"axes": [
  {
    "prop": "variant",
    "default": "secondary",
    "values": [
      { "api": "primary",   "class": "c-button--solid",   "tokenSegment": "_primary"   },
      { "api": "secondary", "class": "c-button--clear",   "tokenSegment": "_secondary" },
      { "api": "tertiary",  "class": "c-button--outline", "tokenSegment": null,
        "issues": ["token-vocabulary-mismatch"] }
    ]
  },
  {
    "prop": "size",
    "default": "medium",
    "values": [
      { "api": "small",  "class": "c-button--small", "tokenSegment": "_small"  },
      { "api": "medium", "class": null,              "tokenSegment": "_medium" },
      { "api": "large",  "class": "c-button--large", "tokenSegment": "_large"  }
    ]
  },
  {
    "prop": "disabled",
    "default": false,
    "values": [
      { "api": false, "class": null,                  "tokenSegment": null },
      { "api": true,  "class": "c-button--disabled",  "tokenSegment": null,
        "attributes": { "disabled": "" } }
    ]
  }
]
```

Three vocabularies, joined, as data:

- **`api`** — what a developer or CMS editor writes.
- **`class`** — what appears in the DOM. Observed by diffing the class list of a story that sets the value against the default story. `null` means the value produces no class (it is the base case — note `size: medium` correctly resolves to `null`).
- **`tokenSegment`** — the `_<variant>` segment in the token grammar that themes this value, matched against `component-token-catalog.json` via the parser already built in [tokenGrammar.mjs](../../../packages/design-system/scripts/specs-spike/lib/tokenGrammar.mjs).

**`issues` is the payoff.** `tertiary` has a class but no matching token segment, because the tokens are spelled `_terciary`. Today that is invisible in all three files. Here it is a single computed flag, and a CI failure.

### 5.6 `default` — the declared baseline

The default is **declared, not inferred**. It is `{Name}Defaults.ts` taken exactly as
it stands, and it is rendered as its own synthetic story. We do not go looking for the
story whose args happen to sit closest to the defaults.

This has a consequence worth stating plainly: **every existing Storybook story is a
variant.** None of them is the default, because none of them was written to be. A
component with 10 stories yields 10 variant deltas against a baseline that no story
describes. That is the honest reading, and it removes the fuzziest inference in the
pipeline.

#### 5.6.1 The content problem

`{Name}Defaults.ts` only covers props that carry a schema `default` — 99 of 425 props.
Content props do not: a Button with no `label` renders an empty box, and its geometry
is meaningless. Something has to supply content before the baseline can be rendered.

The resolution follows principle 8 — if a fact cannot be derived, enrich the artifact
it should have come from, rather than adding a sidecar. So the content baseline comes
from the schema's own `examples`, in this order:

1. `schema.properties[prop].examples[0]` when present — `source: "example"`
2. otherwise a fixed, type- and format-aware placeholder — `source: "placeholder"`

| type / format       | placeholder                        |
| ------------------- | ---------------------------------- |
| `string`            | `"Lorem ipsum dolor sit amet"`     |
| `string`, long-form | two fixed sentences                |
| `format: icon`      | a fixed known icon (`arrow-right`) |
| `format: uri`       | `"#"`                              |
| `format: image`     | a fixed placeholder asset          |
| array slot          | two items of the item shape        |

The contract records which of the two each value came from, so a synthetic baseline is
never mistaken for a designed one:

```jsonc
"configuration": {
  "variant":  { "value": "secondary", "source": "schema-default" },
  "size":     { "value": "medium",    "source": "schema-default" },
  "disabled": { "value": false,       "source": "schema-default" },
  "label":    { "value": "Book a meeting", "source": "example" },
  "icon":     { "value": "arrow-right",    "source": "placeholder" }
}
```

**Measured today:** of 105 true content string props (excluding `className`,
`component`, `url`, `icon` and asset formats), **64 already carry `examples` — 61%**.
The gap is 41 fields across ~25 components, enumerable and closable in one pass. That
makes "require `examples` on content fields" a realistic lint rule rather than an
aspiration, and closing it pays off in Storybook controls, docs and CMS previews too,
not just here.

`coverage` reports the placeholder count per component, so the remaining gap stays
visible and rankable instead of silently degrading the baseline.

#### 5.6.2 Rendering the baseline

Because no story describes the default, one has to be **generated** — a
`__contract-default` story per component, emitted from the schema and defaults into a
generated CSF file. It is derived, not authored, so principle 8 holds, and it rides the
existing decorators, providers, token layer and `postVisit` capture path unchanged.

This is a real addition to Phase 1 that follows directly from the decision, and it is
load-bearing: without it there is nothing to diff variants against.

#### 5.6.3 Shape

```jsonc
"default": {
  "configuration": { /* §5.6.1 */ },
  "parts": {
    "root": {
      "styles": {
        "backgroundColor": { "token": "--dsa-button_secondary--background-color",
                             "resolves": "--ks-background-color-interface-interactive",
                             "computed": "rgb(255, 255, 255)" },
        "borderRadius":    { "token": "--dsa-button--border-radius",
                             "resolves": "--ks-border-radius-control",
                             "computed": "4px" },
        "padding":         { "token": "--dsa-button--padding",
                             "resolves": null, "computed": "12px 32px" },
        "fontWeight":      { "token": "--dsa-button--font-weight",
                             "resolves": "--ks-font-weight-semi-bold",
                             "computed": "600" }
      },
      "layout": { "display": "inline-flex", "direction": "row",
                  "gap": "8px", "align": "center" },
      "box": { "width": 178, "height": 48 }
    }
  },
  "evidence": {
    "story": "components-button--contract-default",
    "screenshot": "img/screenshots/components-button--contract-default.png"
  }
}
```

Three values per style property, because each answers a different question:

- **`token`** — what to change to restyle it. The answer an agent needs when asked to theme.
- **`resolves`** — the semantic token it bottoms out in, via `token-graph.json`. Answers "is this on-system?" A `null` here means a literal, which is a governance signal.
- **`computed`** — the actual rendered value. Answers "what does it look like?" and makes the contract diffable.

`layout` and `box` are the desktop-only geometry (§7). `box` makes size relationships checkable — e.g. `large` should not render smaller than `medium`.

### 5.7 `variants` — deltas only

```jsonc
"variants": [
  {
    "when": { "variant": "primary" },
    "parts": {
      "root": {
        "classes": { "add": ["c-button--solid"], "remove": ["c-button--clear"] },
        "styles": {
          "backgroundColor": { "token": "--dsa-button_primary--background-color",
                               "resolves": "--ks-background-color-primary",
                               "computed": "rgb(0, 82, 204)" },
          "color":           { "token": "--dsa-button_primary--color",
                               "resolves": "--ks-text-color-on-primary",
                               "computed": "rgb(255, 255, 255)" }
        }
      }
    },
    "evidence": {
      "story": "components-button--primary-button",
      "screenshot": "img/screenshots/components-button--primary-button.png"
    }
  },
  {
    "when": { "size": "large" },
    "parts": {
      "root": {
        "classes": { "add": ["c-button--large"] },
        "styles": { "font": { "token": "--dsa-button_large--font",
                              "resolves": "--ks-font-interface-l",
                              "computed": "600 18px/1.4 Inter" } },
        "box": { "width": 196, "height": 56 }
      }
    },
    "evidence": { "story": "components-button--large-button", "screenshot": "…" }
  }
]
```

- **Only what changed.** A variant that touches one property lists one property. This is Curtis' `disabled: opacity 0.36` example, and it falls out naturally from diffing rather than being a discipline we have to enforce.
- **Every story is a variant** (§5.6). Deltas are computed against the generated
  `__contract-default` render, never against another story.
- **`when` is a partial configuration**, so combinatorial variants (`{variant: "primary", disabled: true}`) are expressible when a story proves them — and simply absent when no story does. Absence is then reported by `coverage`, rather than silently invented.
- **Every variant is backed by a real story and a real screenshot.** A variant with no story does not get written. This is what keeps the contract honest: it can only assert what was observed.

### 5.8 `bindings` — how a prop becomes visible

The explicit answer to "how do props relate to visual representation".

```jsonc
"bindings": [
  { "prop": "label",    "mechanism": "content",      "parts": ["root/label"] },
  { "prop": "icon",     "mechanism": "presence",     "parts": ["root/icon"],
    "detail": "part exists iff truthy" },
  { "prop": "variant",  "mechanism": "class-toggle", "parts": ["root"],
    "affects": ["backgroundColor", "color", "borderColor"],
    "tokens": ["--dsa-button_{variant}--background-color",
               "--dsa-button_{variant}--color",
               "--dsa-button_{variant}--border-color"] },
  { "prop": "size",     "mechanism": "token-swap",   "parts": ["root"],
    "affects": ["font", "box"],
    "tokens": ["--dsa-button_{size}--font"] },
  { "prop": "disabled", "mechanism": "attribute",    "parts": ["root"],
    "affects": ["opacity", "pointerEvents"] },
  { "prop": "url",      "mechanism": "element-swap", "parts": ["root"],
    "detail": "renders <a> when set, <button> when not" },
  { "prop": "type",     "mechanism": "none",         "parts": [] }
]
```

`mechanism` ∈ `content | presence | class-toggle | token-swap | attribute | element-swap | layout | none`.

Why this matters for an agent:

- `presence` tells it that setting `icon` **changes the DOM**, not just a style — so spacing assumptions may shift.
- `token-swap` tells it the prop is themeable, and the `{size}` template tells it exactly which token names to reach for.
- `element-swap` on `url` is a real fact about `Button` that is currently buried in a `!!href` ternary inside a minified base package.
- `none` on `type` tells it not to waste attention there.

The templated token names (`--dsa-button_{variant}--background-color`) are generated from the `axes` join, so the agent can construct any token name without a lookup. Normalized — the templates are derived from `axes`, not restated.

### 5.9 `composition` — slots

```jsonc
// faq
"composition": {
  "slots": [
    { "prop": "questions", "part": "root", "min": 1, "max": null,
      "itemShape": ["question", "answer"],
      "renders": { "component": "collapsible-box", "perItem": true },
      "observedCounts": [3, 5] }
  ]
}
```

```jsonc
// section
"composition": {
  "slots": [
    { "prop": "components", "part": "root/content", "min": null, "max": null,
      "accepts": ["cta","features","gallery","hero","image-text","logos", "…29 total"],
      "observedCounts": [1, 2, 3, 4] }
  ]
}
```

`accepts` comes from the schema's `items.anyOf` `$ref`s. `observedCounts` comes from the stories, and is the honest signal an agent needs to avoid generating a "features grid" with one item — the same intelligence our Storyblok MCP's `analyze_content_patterns` provides for content, applied at the component level.

### 5.10 `coverage` — what has visual evidence

```jsonc
"coverage": {
  "axes": {
    "variant":  { "total": 3, "proven": 2, "missing": ["tertiary"] },
    "size":     { "total": 3, "proven": 3, "missing": [] },
    "disabled": { "total": 2, "proven": 1, "missing": [true] }
  },
  "parts": { "total": 3, "observedInDefault": 2, "conditional": 1 },
  "combinations": { "proven": 5, "possible": 18 },
  "score": 0.72
}
```

Curtis #4: a contract that cannot say what it does not know is not verifiable. `coverage` makes gaps first-class. It also becomes an actionable backlog — "write a story for `tertiary`" — and a CI gate we can ratchet.

### 5.11 Worked example: what an agent gets for `Faq`

Abbreviated, showing the structural payoff:

```jsonc
{
  "id": "faq",
  "anatomy": {
    "path": "root",
    "element": "div",
    "classes": ["dsa-faq"],
    "role": "container",
    "tokens": ["--dsa-faq--border"],
    "children": [
      {
        "path": "root/item",
        "element": "details",
        "classes": ["c-collapsible-box"],
        "role": "container",
        "presence": "repeated",
        "gate": { "slot": "questions" },
        "children": [
          {
            "path": "root/item/summary",
            "element": "summary",
            "classes": ["c-collapsible-box__header"],
            "role": "container",
            "tokens": ["--dsa-faq_header--padding"],
            "children": [
              {
                "path": "root/item/summary/text",
                "element": "span",
                "role": "text",
                "tokens": [
                  "--dsa-faq__summary--color",
                  "--dsa-faq__summary--font",
                  "--dsa-faq__summary--font-weight",
                ],
                "content": {
                  "$binding": "#/composition/slots/0/itemShape/question",
                },
              },
              {
                "path": "root/item/summary/icon",
                "element": "svg",
                "role": "glyph",
                "tokens": ["--dsa-faq__icon--color"],
              },
            ],
          },
          {
            "path": "root/item/answer",
            "element": "div",
            "role": "text",
            "tokens": ["--dsa-faq__answer--color", "--dsa-faq__answer--font"],
            "content": { "$binding": "#/composition/slots/0/itemShape/answer" },
          },
        ],
      },
    ],
  },
  "bindings": [
    {
      "prop": "questions",
      "mechanism": "presence",
      "parts": ["root/item"],
      "detail": "one item per array entry",
    },
  ],
}
```

Today an agent asked "restyle the FAQ question text" must guess between `--dsa-faq__summary--color` and `--dsa-faq__answer--color`. With this, `questions[].question` → `root/item/summary/text` → `--dsa-faq__summary--*` is a lookup.

Note also what the spike found here: 6 of `faq`'s 10 tokens are `component-ref`s into `--dsa-topic--*`. The `resolves` field in `default.parts` surfaces that as data rather than leaving it as a dead end.

### 5.12 `narrative` — model-generated prose, quarantined

A contract tells an agent that `variant: tertiary` swaps `.c-button--solid` for
`.c-button--outline` and drops `background-color`. It does not tell it that the button
now reads as a quiet, secondary action. That judgement is genuinely useful and it is
genuinely not derivable from the DOM.

So we generate it — from the **screenshots**, with a vision model — and we keep it in a
separate file.

**This conflicts with principle 5 (determinism over inference) and principle 8 (derived
over authored), and the conflict is real rather than hand-wavable.** Model output is not
reproducible, not verifiable, and drifts with the model. Putting it inside the contract
would make the contract unverifiable, which is the one property the whole format exists
to have. The resolution is quarantine, not compromise:

| Rule                                                                       | Why                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Narrative lives in `{name}.narrative.json`, never inside the contract      | Contract regeneration stays byte-identical               |
| Narrative is **committed**, not regenerated per build                      | Stable, reviewable, diffable in the one place it matters |
| Regenerated only when the input screenshot hash changes                    | Cost is bounded; prose does not churn under it           |
| Carries full provenance: `model`, `promptVersion`, `generatedAt`, `inputs` | Drift is attributable                                    |
| **No lint rule and no tool contract may depend on it**                     | It can never become load-bearing by accident             |
| Consumers must treat it as advisory                                        | Stated in the format guide, not just implied             |

```jsonc
{
  "$format": "kickstartds/component-narrative@1",
  "component": "button",
  "default": {
    "description": "A compact, filled action control. Reads as the primary thing to do in its context — solid surface, high-contrast label, tight padding.",
    "from": "img/screenshots/components-button--contract-default.png",
  },
  "variants": [
    {
      "when": { "variant": "tertiary" },
      "difference": "Loses the filled surface for a thin outline on a transparent background. Same size and weight, noticeably quieter — an alternative action rather than the expected one.",
      "from": "img/screenshots/components-button--tertiary-button.png",
    },
  ],
  "generated": {
    "model": "…",
    "promptVersion": 1,
    "generatedAt": "…",
    "inputs": { "screenshots": { "…": "sha256:…" }, "contract": "sha256:…" },
  },
}
```

Two prompts only: one describes the default from its screenshot; one describes each
variant as a **difference** from the default, given both screenshots plus the contract's
already-derived delta. Grounding the second prompt in the derived delta is what keeps
the prose from inventing changes that did not happen.

Cost: ~77 default calls + ~137 variant calls, once, then only on screenshot change.

The narrative's real destination is `brief.md` (§8.2), where one sentence of "what this
looks like" does more for an agent than another table of computed values.

---

## 6. Derivation Pipeline

### 6.1 Pass 1 — Static extraction (no browser)

Reads only files already on disk. Produces a partial contract: `api`, `composition`, candidate `axes` (enum values + token segments), and the token→BEM-path index.

| Input                                              | Extracted                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `{n}.schema.dereffed.json`                         | props, types, enums, defaults, required, slots via `items.anyOf` |
| `{Name}Defaults.ts`                                | `default.configuration` seed                                     |
| `component-token-catalog.json`                     | token names per component, `valueType`, `referencedToken`        |
| `semantic-token-catalog.json` + `token-graph.json` | `resolves` chains                                                |
| `tokenGrammar.mjs`                                 | BEM path, variant segment, state, modifier per token             |

The token grammar parser is **already built and proven**: 102/102 tokens across five components parsed with zero misses. See [scripts/specs-spike/lib/tokenGrammar.mjs](../../../packages/design-system/scripts/specs-spike/lib/tokenGrammar.mjs).

### 6.2 Pass 2 — Rendered observation

Extends `postVisit` in [.storybook/test-runner.tsx](../../../packages/design-system/.storybook/test-runner.tsx). Today that hook already: gets story context, waits for readiness, sets the viewport, wraps the preview, and screenshots. We add one `page.evaluate()` before the screenshot.

```ts
// .storybook/test-runner.tsx — sketch
async postVisit(page, story) {
  const context = await getStoryContext(page, story);
  await waitForPageReady(page);
  await page.setViewportSize(context.parameters.viewport);

  const observation = await page.evaluate((props) => {
    const walk = (el: Element): unknown => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        classes: [...el.classList],
        attrs: Object.fromEntries(
          [...el.attributes]
            .filter((a) => a.name.startsWith("data-") || a.name === "disabled")
            .map((a) => [a.name, a.value])
        ),
        text: el.children.length === 0 ? el.textContent?.trim() || null : null,
        styles: Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])),
        customProps: [...el.attributeStyleMap ?? []]        // active --dsa-* values
          .filter(([k]) => k.startsWith("--dsa-")),
        box: el.getBoundingClientRect().toJSON(),
        children: [...el.children].map(walk),
      };
    };
    return walk(document.querySelector(".preview")!.firstElementChild!);
  }, OBSERVED_PROPERTIES);

  writeObservation(story.id, observation);   // → .observations/{story-id}.json
  /* …existing screenshot logic unchanged… */
}
```

`OBSERVED_PROPERTIES` is a fixed, ordered list (~40 CSS properties covering colour, typography, spacing, border, layout, effects). Fixed and ordered is what makes Pass 3 diffs deterministic (Curtis #5).

**Cost:** one DOM walk per story on a run we already perform for screenshots. No new browser launch, no new CI job.

Pass 2 also renders the generated `__contract-default` story per component (§5.6.2) —
77 additional stories on the same run.

### 6.3 Pass 3 — Reconciliation

Pure function over Pass 1 + Pass 2 output. No I/O beyond reading them.

1. **Take the declared default** — the `__contract-default` observation (§5.6). No story selection, no subset matching, no tie-break. Every authored story is treated as a variant.
2. **Union the observed DOM trees** across all stories of the component into one anatomy tree. Parts present in every story → `presence: "always"`. Parts present in some → `presence: "conditional"`, with `observedIn` recorded. Repeated parts (slot items) → **first instance only**; siblings in a repeat share props and tokens, so recording variance across them adds bytes without adding facts.
3. **Name the parts.** In order: (a) the BEM element segment when a class matches `__(\w+)`; (b) the token grammar's element name when a `--dsa-*` custom property is active on the node; (c) the slot prop name; (d) positional fallback `child-{n}`. **This is the single inference step**, it is convention-driven, and every conditional part records `observedIn` so a human can check it. Ambiguity emits a lint warning rather than a silent choice. Positional fallback stays for now — it is cheap to remove later if it proves to be noise, and dropping parts silently is worse than naming them dully.
4. **Attribute conditional parts to props** by finding the minimal `args` difference between a story where the part appears and one where it does not → `gate`.
5. **Diff every story against the declared default** on classes, styles, attributes and box → the `variants[]` delta.
6. **Attribute each delta to a prop** via the story's `args` difference, and classify the `mechanism` → `bindings[]`.
7. **Join the vocabularies**: for each enum value, match `{observed class}` ↔ `{token segment}` ↔ `{api value}`; mismatches become `issues`.
8. **Compute coverage** from proven vs. possible.

### 6.4 Determinism

- All maps emitted with sorted keys; all arrays in a defined order (schema order for props, enum order for values, DOM order for parts).
- `OBSERVED_PROPERTIES` is a fixed list, not `getComputedStyle` enumeration.
- Input content hashes recorded in `generated.inputs`; regenerating twice must produce an empty diff.
- Non-deterministic content (dates, random IDs, blurhashes) excluded from `text` capture via a denylist.
- Passes 1–3 only. **Pass 4 is excluded from the determinism guarantee by construction** (§5.12) — it writes a different file.

### 6.5 Pass 4 — Narrative (model, cached, out-of-band)

Runs after Pass 3, reads screenshots + the finished contract, writes
`{name}.narrative.json`. Skipped entirely when every input hash matches the committed
narrative, which is the normal case. Not part of the default build; run on demand and
committed, like the screenshots themselves.

### 6.6 Cost model

| Stage                   | Added cost                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| Pass 1                  | ~1s for all 77 components (file reads + parsing)                               |
| Pass 2                  | one `page.evaluate()` per story, ~50ms × 234 ≈ 12s, **inside an existing run** |
| Pass 3                  | pure computation, ~2s                                                          |
| Pass 4                  | ~214 vision calls on first run, ~0 thereafter; **not in the build**            |
| **Total added CI time** | **well under a minute**                                                        |

Curtis #6: the cost of keeping the contract true is close to zero, because the expensive part (booting a browser and rendering every story) is a cost we already pay.

---

## 7. The Desktop-Only Simplification

We capture at a single desktop viewport (1440×900) and record it in `generated.viewport`.

**Why this is a sound trade:**

- **Complexity collapses in the right direction.** Desktop → tablet → mobile is predominantly _reductive_: multi-column becomes single-column, sidebars stack, nav collapses. An agent given the desktop contract can infer the mobile reduction far more reliably than it could infer desktop expansion from mobile.
- **It removes the container-query dimension.** `component-token-catalog.json` carries `responsiveTokens` keyed by container query (e.g. `"@container hero (min-width: 640px)"`, `"@container hero (min-width: 960px)"`). Desktop-only means we resolve to the widest matching tier and record one value per token — turning an N-dimensional matrix into a scalar.
- **It keeps stories usable as evidence.** Stories already set `parameters.viewport` per story; we honour the story's own viewport for the screenshot and capture at the desktop reference width for observation.
- **It is honest.** `generated.viewport` is in the artifact, so no consumer can mistake a desktop measurement for a universal one.

**What we give up:** the contract cannot answer "what does this look like at 375px". Breakpoint behaviour remains in SCSS and container queries, unmodelled. If this becomes load-bearing, the format extends by making `default.parts[].styles` an array keyed by viewport — an additive change under `@2`. We are deliberately not paying for that now.

---

## 8. Consumption

### 8.1 MCP surface

Extend **Component Builder MCP** ([packages/component-builder-mcp/](../../../packages/component-builder-mcp/)) — it already owns "how to build UI here".

| Tool                                     | Returns                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `get-component-brief(name)`              | The Markdown brief (§8.2) — **the default entry point**                    |
| `get-component-contract(name)`           | Full contract JSON                                                         |
| `get-component-anatomy(name)`            | `anatomy` + `composition` only — cheap structural view                     |
| `get-prop-visual-impact(name, prop?)`    | `bindings` + relevant `axes` — the "what happens if I set this" query      |
| `get-component-screenshots(name, prop?)` | Absolute screenshot URLs for the default and each variant, with its `when` |
| `list-component-contracts()`             | Catalog with coverage scores                                               |
| `lint-component-contracts()`             | All `issues` across all contracts                                          |

New resources: `contracts://index`, `contracts://{name}`, `contracts://format-guide`,
`contracts://worked-example`.

**On the narrative.** The narrative (§5.12) is deliberately _not_ its own tool. Exposing
`get-component-narrative` would invite an agent to fetch prose without the derived facts
it describes, which is the failure mode the quarantine exists to prevent. Instead it is
merged into `get-component-brief` — rendered in italics, one sentence for the default and
one _difference_ sentence per variant — and returned inside `get-component-contract` under
a top-level `narrative` key carrying its own `$format` and `generated.model`. In both
cases it arrives attached to the observations it is a gloss on, and is always marked as
prose. `get-component-anatomy` and `get-prop-visual-impact` never include it: those are
the precision queries, and prose has no business in them.

**On screenshot URLs.** Worth doing, and nearly free: all 157 screenshots already ship in
`dist/static/`, and Storybook is already deployed under `STORYBOOK_PUBLIC_DOMAIN`, so
`https://{domain}/img/screenshots/{story-id}.png` resolves today. The contract keeps the
**relative** path only — an absolute URL would make the artifact environment-dependent and
break the byte-identical guarantee across deployments. The MCP server composes the
absolute URL from its own env at request time. This pairs directly with §5.12: the same
images that ground the narrative are the ones a vision-capable agent can look at itself.

The Design Tokens MCP gains a reverse lookup — `get_token_usage(token)` → which components and parts bind it — because contracts finally make that computable.

### 8.2 The `brief` projection

A full contract is large. Agents mostly need orientation, then detail on demand. So we generate a Markdown `brief` per component:

```markdown
## Button

`<a>` (or `<button>` without `url`) · `.dsa-button.c-button`

_A compact, filled action control. Reads as the primary thing to do in its context._

**Parts:** root › label (text), icon (glyph, only when `icon` set)

**Visual props**
| prop | values | mechanism | changes |
| --- | --- | --- | --- |
| variant | primary·secondary(d)·tertiary | class-toggle | background, text, border |
| size | small·medium(d)·large | token-swap | font, box |
| disabled | false(d)·true | attribute | opacity |

**Tokens:** `--dsa-button_{variant}--{background-color,color,border-color}`, `--dsa-button_{size}--font`, `--dsa-button--{padding,border-radius,border-width,font-weight}`

**Coverage:** 0.72 — no story for `variant: tertiary`, `disabled: true`
⚠ `variant: tertiary` has no matching token segment (tokens spell it `_terciary`)
```

Critically, per Curtis #2 and #4: **the brief is generated from the contract and is never edited.** It is a lossy view, explicitly not load-bearing, and it cannot drift because it has no independent existence.

The brief is also where the narrative (§5.12) is merged in — one italic sentence per
component and per variant. It is the only place model-generated prose is surfaced by
default, which keeps the boundary between "observed" and "described" visible to the reader.

### 8.3 Contracts as a linter

Once the vocabularies are joined, drift becomes computable. The lint rules fall straight out:

| Rule                      | Detects                                     | Real hit today                                               |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `axis-token-mismatch`     | enum value with no matching token segment   | **`button.variant: tertiary` vs `--dsa-button_terciary--*`** |
| `part-name-inconsistency` | two spellings of one part                   | **`blog-aside`: `share-bar` vs `sharebar`**                  |
| `orphan-token`            | `--dsa-*` token bound to no observed part   | dead tokens after refactors                                  |
| `unresolved-token`        | `component-ref` chain with no semantic root | **6 of `faq`'s 10 tokens**                                   |
| `uncovered-axis-value`    | enum value with no story                    | backlog generator                                            |
| `literal-in-appearance`   | appearance style with `resolves: null`      | off-system values                                            |
| `anatomy-drift`           | part set changed vs. last contract          | breaking-change signal (reported, not gated — §14)           |

The first, second and fourth were found by a five-line join in the Specs spike. They had been invisible to every existing artifact.

### 8.4 Making the format legible to an LLM

The honest answer to "will a model intuitively understand this?" is **no — not the raw
JSON.** A contract carries several ideas that are not self-evident from field names: that
`axes` is a join across three independent vocabularies; that `variants` are deltas rather
than full states; that `coverage` bounds how much of the contract is asserted rather than
assumed; that a `mechanism` is a claim about _how_ a prop becomes visible. A model handed
14 KB of that will pattern-match it as "some component metadata" and use it shallowly.

That is a solvable delivery problem, not a reason to simplify the format — the format's
job is to be true, the MCP layer's job is to be legible. Five things fix it:

1. **The brief is the front door, not the contract.** `get-component-brief` is what tool
   descriptions point at, and full JSON sits behind an explicit second call. Measured on
   the spike, `button`'s brief is 1,401 bytes against 13,860 for the contract — a 10×
   reduction that loses nothing an agent needs for the common case.
2. **A `contracts://format-guide` resource** — roughly 600 tokens explaining the four
   non-obvious ideas above, in prose, with one worked `axes` join. Read once per session,
   not per component.
3. **A `contracts://worked-example` resource** — one complete small contract (`faq`, 2.5 KB)
   annotated inline. Concrete examples teach shape far better than field documentation.
4. **Task-shaped tools over document-shaped ones.** `get-prop-visual-impact(name, prop)`
   answers a question a model actually has; `get-component-contract` hands it a document
   and hopes. Tool descriptions should state _when to call_, matching the convention the
   other MCP servers here already follow.
5. **Narrative prose in the brief** (§5.12) gives the model a semantic handle — "quieter,
   secondary action" — to hang the mechanical facts on.

Whether this actually works is exactly what Phase 5 measures. If the A/B shows agents do
no better with contracts than without, the delivery layer is the first thing to change,
not the format.

### 8.5 Downstream

- **Storyblok MCP** — component composition currently reasons over content patterns. Contracts add "this component's `content_mode` changes layout, not just spacing".
- **website** — contracts are buildable input for prop→token debugging tooling.
- **Design Tokens Editor** — "which components does this token affect, and where" becomes answerable.

---

## 9. What This Deliberately Does Not Model

Stated so nobody has to guess, per Curtis #7.

| Not modelled                                       | Why                                                            | If it becomes load-bearing                              |
| -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Responsive behaviour                               | §7                                                             | `styles` keyed by viewport, `@2`                        |
| Interaction states (`:hover`, `:active`, `:focus`) | Not observable in a static `postVisit` capture; deferred (§14) | Playwright can force states; additive `states` on parts |
| `archetypes-*` components                          | Arrangements of components into pages, not components (§14)    | Model as templates, separately — not as contracts       |
| Non-default themes                                 | 9 branding themes swap values, not structure                   | Already handled: one contract, `resolves` chains (§14)  |
| Motion / transitions                               | Duration tokens exist but timing is not observable statically  | Additive                                                |
| Accessibility semantics                            | `addon-a11y` already runs; separate concern                    | Join a11y results by story id                           |
| Cross-component dependency graph                   | Component-scoped by design                                     | Derivable from `composition.accepts`                    |
| Figma                                              | §10                                                            | Consume, don't produce                                  |
| Platform neutrality                                | We have one platform (§2, principle 3)                         | Revisit if a second appears                             |

---

## 10. Relationship to the Specs Evaluation

### 10.1 What the spike proved

[Phase 0](../../../packages/design-system/scripts/specs-spike/README.md) built a working Specs emitter: 5/5 components validated against `component.schema.json@0.28.0`, 72% of props mapped natively. The mechanics are not the problem.

### 10.2 Why the shape is wrong for us

| Specs assumption                                                                                                | Our reality                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Metadata` requires `source: {pageId, nodeId, nodeType}` — all 6 fields required, `additionalProperties: false` | We have no Figma. We must omit `metadata` entirely or fabricate node IDs                      |
| `Component` and `Metadata` have no `$extensions`                                                                | Coverage cannot be declared in-band at all                                                    |
| `Anatomy` is a flat `Record<name, …>`                                                                           | Collapses `author > link` and `sharebar > link` in `blog-aside`                               |
| Anatomy derived from Figma layers                                                                               | Ours must come from the DOM                                                                   |
| `Typography` has no `fontWeight` (Figma encodes it in `fontStyle`)                                              | Our `--dsa-*--font-weight` tokens have no target                                              |
| `Styles` values are literals or `TokenReference`                                                                | 63% of our tokens are `semantic-ref`, 12% `component-ref` — the latter produce dangling paths |
| `EnumProp` has no `required`, so `{type:"string"}` matches two definitions                                      | We must emit `examples: []` purely to satisfy `oneOf`                                         |

None of this is a criticism of Specs; it is a correct model of a Figma-sourced system. It is simply not a model of ours.

### 10.3 Interop stays cheap

Our format is a **superset in the dimensions we care about** (mechanisms, vocabulary joins, evidence, coverage) and a **subset in the dimensions we do not** (absolute positioning, Figma provenance, multi-platform). Projecting a contract to a Specs `api.yaml` is a lossy but mechanical transform, and the spike is a working prototype of it. We keep the spike as a reference implementation; we do not put it in the build.

If a Figma library ever becomes a goal, contracts are a _better_ input than our current artifacts: `anatomy` gives layer structure, `axes` gives the variant matrix, `default` + `variants` give the property deltas, and `screenshot` gives visual truth to check against.

---

## 11. Phased Plan

### Phase 1 — Foundation (schema + baseline + static pass + capture)

1. Author `contract.schema.json` for `kickstartds/component-contract@1`, seeded from
   Appendix B. **This lands first**, before any emitter — the format is defined by a
   validatable schema, not by whatever the generator happens to produce.
2. Author `narrative.schema.json` for `kickstartds/component-narrative@1`.
3. Backfill `examples` on the **41 content fields** that lack them (§5.6.1); add a lint
   rule requiring `examples` on content-typed string props.
4. Generate the `__contract-default` story per component from schema + defaults (§5.6.2).
5. Build Pass 1 (`scripts/contracts/static.mjs`), reusing `tokenGrammar.mjs`.
6. Extend `postVisit` with the observation capture; write `.observations/{story-id}.json`.
7. Verify: observations produced for all 137 authored stories **+ 77 generated defaults**;
   screenshots unchanged; build time delta measured.

**Exit:** `contract.schema.json` committed and validating; every component has a rendered
declared default, `api`, `composition`, candidate `axes`; every story has an observation.
Screenshot pipeline provably unaffected.

### Phase 2 — Reconciliation (the value)

8. Build Pass 3: anatomy union, part naming, gate attribution, variant diffing, mechanism classification, vocabulary join, coverage.
9. Emit contracts for all components (excluding `archetypes-*`); validate all against the schema.
10. Assert byte-identical output across two consecutive runs.
11. Hand-review anatomy for 10 components spanning simple → compositional.

**Exit:** 100% validate; regeneration diff empty; part naming judged correct or trivially correctable on 10 sampled components; `axis-token-mismatch` reproduces the `terciary` finding without being told about it.

### Phase 3 — Lint & fix

12. Implement the §8.3 rules; run across all components.
13. Triage; fix `terciary` and `share-bar`/`sharebar`; ratchet coverage where cheap.
14. Expose results through `lint-component-contracts()`. **No CI gating** (§14) — the tool
    reports, humans decide. Revisit once the signal has proven itself.

**Exit:** lint issues triaged; the two known defects fixed.

### Phase 4 — Delivery

15. Ship contracts in `dist/contracts/`; add to the design-system `build` script.
16. Build Pass 4 (narrative) as an on-demand script; generate and commit narratives.
17. Add the MCP tools + resources from §8.1, including `get-component-screenshots` and the
    `format-guide` / `worked-example` resources from §8.4.
18. Generate `brief.md` per component with narrative merged; measure token cost of a realistic agent session.
19. Add `get_token_usage` reverse lookup to Design Tokens MCP.

**Exit:** an agent can answer "what happens visually if I set `variant: primary`" from MCP alone, without reading source.

### Phase 5 — Evaluation

20. A/B a set of realistic UI-building tasks with and without contracts in context.
21. Measure: correct token usage, correct prop usage, hallucinated props, iterations to correct output. Include a brief-only vs. full-contract arm to test §8.4.
22. ADR recording the outcome and any `@2` changes.

---

## 12. Risks & Mitigations

| Risk                                                                       | Severity | Mitigation                                                                                                                                                           |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part naming inference is wrong often enough to erode trust                 | **High** | Convention-driven with a 4-step deterministic ladder; `observedIn` on every part; ambiguity warns rather than guesses; Phase 2 gates on hand review of 10 components |
| Stories are a poor variant matrix (137 stories, 77 components)             | **High** | `coverage` makes it explicit rather than hidden; contracts assert only what is proven; missing coverage becomes an actionable backlog                                |
| DOM capture is flaky (fonts, async, animation)                             | Medium   | Reuse the existing `waitForPageReady` + 1s settle already proven stable for image snapshots; denylist volatile content                                               |
| Contract size balloons agent context                                       | Medium   | `brief` projection + granular tools (`get-component-anatomy`) rather than always returning the full contract                                                         |
| Components delegating to `@kickstartds/base` produce DOM we do not control | Medium   | This is precisely why we observe rather than infer — the base package's DOM is captured as-is                                                                        |
| Non-determinism sneaks in                                                  | Medium   | Content hashes in `generated.inputs`; regeneration check asserts an empty diff; the model pass writes a different file (§5.12)                                       |
| `postVisit` changes break the screenshot pipeline                          | Medium   | Capture runs _before_ screenshot logic and writes to a separate directory; Phase 1 exit criterion explicitly checks screenshots are unchanged                        |
| We build it and agents do not use it well                                  | Medium   | Phase 5 is an explicit measurement gate, not a formality                                                                                                             |
| Placeholder content makes some default baselines unrepresentative          | Medium   | `source` recorded per value; placeholder count reported in `coverage`; 41-field `examples` backfill in Phase 1 (§5.6.1)                                              |
| Narrative prose drifts from what components look like                      | Medium   | Regenerated on screenshot-hash change; provenance recorded; barred from being depended on by any lint rule or tool (§5.12)                                           |
| Agents use the contract shallowly because the format is unintuitive        | Medium   | Brief-first delivery, format-guide and worked-example resources, task-shaped tools (§8.4); Phase 5 A/Bs brief-only vs. full contract                                 |
| Scope creep into responsive/themes/states                                  | Low      | §9 is the contract with ourselves; changes require an ADR                                                                                                            |
| Format churn breaks consumers                                              | Low      | `$format` version; consumers pin; ADR-governed evolution                                                                                                             |

---

## 13. Success Metrics

| Metric                                                  | Target                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Components with a contract                              | 77 / 77 (excl. `archetypes-*`)                                           |
| Contracts validating against `contract.schema.json`     | 100%                                                                     |
| Regeneration diff on unchanged input                    | empty, byte-identical                                                    |
| Content fields carrying `examples`                      | 105 / 105 (from 64 today)                                                |
| `default.configuration` values sourced from placeholder | 0 for content props                                                      |
| Added build time                                        | < 60s                                                                    |
| Anatomy parts requiring manual correction (sampled 10)  | < 15%                                                                    |
| Axes with a complete three-vocabulary join              | > 90%                                                                    |
| Mean `coverage.score` across components                 | > 0.6 initially, ratcheting                                              |
| Lint issues at Phase 3 exit                             | 0 untriaged `axis-token-mismatch`, 0 untriaged `part-name-inconsistency` |
| Hand-authored bytes in any contract                     | **0**                                                                    |
| `brief` size per component                              | < 400 tokens                                                             |
| Agent tasks: hallucinated props (A/B)                   | reduced                                                                  |
| Agent tasks: correct token selected first try (A/B)     | improved                                                                 |

---

## 14. Decisions

All ten questions raised at review are settled. Recorded here with the reasoning, since
several of them changed the format rather than just the plan.

| #      | Question                                | Decision                                                                      | Consequence                                                                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **1**  | How is the default story identified?    | **It isn't.** `{Name}Defaults.ts` is the baseline, taken exactly as it stands | §5.6 rewritten; a `__contract-default` story is generated per component; every authored story becomes a variant |
| **2**  | Keep positional part-name fallback?     | **Keep it.** Cheap to remove later if it proves to be noise                   | Naming ladder step (d) stays; §6.3                                                                              |
| **3**  | Skip `archetypes-*`?                    | **Skip.** They are arrangements of components into pages, not components      | Excluded in §9 and Phase 2                                                                                      |
| **4**  | Repeated parts — first instance or all? | **First instance only.** Repeated items share props and tokens                | §6.3 step 2                                                                                                     |
| **5**  | Include interaction states now?         | **No.** Defer; revisit if it becomes load-bearing                             | §9 unchanged, deferral now explicit                                                                             |
| **6**  | `observedIn` on every part?             | **Conditional parts only.** On an invariant part it lists every story         | §5.3                                                                                                            |
| **7**  | Where do contracts live?                | **`dist/contracts/`** in the design-system package                            | §5.1; no separate `@kickstartds/contracts` package                                                              |
| **8**  | One contract per theme, or normalized?  | **Normalized** — one contract, `resolves` chains, consumers resolve per theme | §9 row updated                                                                                                  |
| **9**  | Does coverage gate CI?                  | **No CI integration for now**                                                 | Phase 3 reports through the lint tool only                                                                      |
| **10** | Contract diffs in PRs?                  | **Not for now**                                                               | `anatomy-drift` still computed, just not surfaced as a bot                                                      |

Decisions 1, 4, 6 and 8 are format changes and are reflected in §5–§6. Decisions 3, 9 and
10 are scope changes and are reflected in §9 and §11.

### 14.1 Additions accepted at the same review

| Addition                                                                                                                    | Where                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Natural-language descriptions of the default and of each variant's difference, generated from screenshots by a vision model | **new §5.12**, Pass 4 in §6.5, merged into the brief in §8.2 |
| A real JSON Schema for the contract format                                                                                  | Phase 1 step 1 — lands **before** the emitter                |
| Making the format legible to an LLM                                                                                         | **new §8.4**                                                 |
| Screenshot URLs exposed over MCP                                                                                            | §8.1 — `get-component-screenshots`                           |

Two of these carry tension worth naming rather than burying:

- **The narrative conflicts with principles 5 and 8.** Model output is neither
  deterministic nor verifiable. It is resolved by quarantine, not compromise: a separate
  committed file, regenerated only on screenshot change, with provenance, and forbidden
  from being depended on by any lint rule or tool contract (§5.12). The contract itself
  stays byte-identical across runs.
- **Screenshot URLs must not enter the contract.** An absolute URL makes the artifact
  environment-dependent. The contract stores the relative path; the MCP server composes
  the URL from its own environment (§8.1).

### 14.2 Content in the baseline — decided

The remaining question was **how far we push `examples` before falling back to
placeholders**. The recommendation in §5.6.1 was accepted at the same review: **allow the
fallback, record `source` per value, report the placeholder count in `coverage`, and
drive it to zero as a ratchet.**

Requiring `examples` unconditionally would make every baseline representative, but it
blocks Phase 1 on an authoring pass across ~25 components. Allowing placeholders unblocks
Phase 1 at the cost of some components shipping a baseline whose geometry is driven by
"Lorem ipsum" — which is acceptable _only_ because the contract says so out loud. The
measurement says the ratchet is tractable: **64 of 105 content props already have
examples (61%); the gap is 41 fields**, and closing it improves Storybook controls, docs
and CMS previews independently of contracts.

The spike implements this (`lib/declared.mjs`) and surfaced one consequence that was not
visible from the schema alone:

**Empty slots are a separate problem from placeholders.** A polymorphic slot
(`section.components` is `anyOf` over 29 component types, `slider.components` over 10)
cannot be filled from `examples`, because there is no example to take — filling it would
mean _authoring_ a child composition, which is exactly what a derived artifact must not
do. So the declared baseline for `section` renders an empty container, and only its root
part is present in `default.parts`.

The resolution is not to invent content but to stop treating "absent from the baseline"
as "nothing to record". A part that first appears in a variant has no _delta_ — its
existence is already expressed by `presence: "conditional"` plus its `gate` — so the
first variant to show it carries its **full state** under `introduced: true`, and later
variants diff against that. Nothing is restated, and nothing is lost. `coverage.baseline`
reports both gap kinds:

```jsonc
"baseline": {
  "values": 14,
  "fromExample": 0,
  "placeholders": 0,
  "emptySlots": ["components", "buttons"]
}
```

---

## Appendix A — Verified Inspection Record

Facts below were verified directly in this repository on 2026-08-03.

| Artifact                     | Location                                                | Scale                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components                   | `src/components/`                                       | 77                                                                                                                                                                                        |
| Component JSON Schemas       | `{n}.schema.json` + `.dereffed.json`                    | per component                                                                                                                                                                             |
| Storybook entries            | `storybook-static/index.json`                           | 211 (`v`, `entries`)                                                                                                                                                                      |
| Storybook manifest           | `.storybook/main.ts` → `experimental_manifests`         | `experimentalComponentsManifest: true`; enriches `description` from dereferenced schema                                                                                                   |
| Snippets                     | `snippets.json` → `dist/components/presets.json`        | 137 (`id`, `group`, `name`, `code`, `args`, `screenshot`)                                                                                                                                 |
| Screenshots                  | `static/img/screenshots/`                               | 157, named `{story-id}.png`                                                                                                                                                               |
| Snapshot source              | `__snapshots__/`                                        | Git LFS                                                                                                                                                                                   |
| Test runner hook             | `.storybook/test-runner.tsx` → `postVisit(page, story)` | Playwright `page` available; sets viewport, waits, wraps `.preview`, screenshots                                                                                                          |
| Component tokens             | `src/token/component-token-catalog.json`                | 50 components, 807 tokens; keys `displayName`, `selector`, `tokens`, `responsiveTokens`                                                                                                   |
| Token `valueType` split      | —                                                       | `semantic-ref` 510 (63%), `literal` 197 (24%), `component-ref` 100 (12%)                                                                                                                  |
| Tokens with BEM element path | —                                                       | 512 / 807 (63%)                                                                                                                                                                           |
| Responsive tokens            | `responsiveTokens`                                      | keyed by container query, e.g. `@container hero (min-width: 640px)`                                                                                                                       |
| Semantic tokens              | `src/token/semantic-token-catalog.json`                 | 16 groups: Background Color, Border Color, Border Radius, Border Width, Color, Depth, Duration, Font, Font Family, Font Size, Font Weight, Other, Shadow, Spacing, Text Color, Transition |
| Token graph                  | `token-graph.json`                                      | `full` 3,091 nodes / 5,179 edges; `design-system` 1,219 / 1,738                                                                                                                           |
| Defaults                     | `{Name}Defaults.ts` via `kickstartDS schema defaults`   | `DeepPartial<{Name}Props>`                                                                                                                                                                |
| Branding themes              | `dist/tokens/branding-tokens-{theme}.json`              | 9, W3C DTCG                                                                                                                                                                               |
| Token grammar parser         | `scripts/specs-spike/lib/tokenGrammar.mjs`              | 102/102 tokens parsed across 5 components, 0 misses                                                                                                                                       |

**The motivating defect, verified:**

- `button.schema.json` → `variant: ["primary", "secondary", "tertiary"]`
- `ButtonComponent.tsx` → `primary→"solid"`, `secondary→"clear"`, `tertiary→"outline"`
- `@kickstartds/base` Button renders `class="c-button c-button--{variant} …"`, plus `c-button--small|large`, `c-button--disabled`; children are `[iconBefore?, <span>{label}</span>, iconAfter?]`; element is `<a>` when `href` is set, else `<button>`
- `button.scss` → `&.c-button--solid { --c-button--color: var(--dsa-button_primary--color, …) }`
- `button-tokens.json` + `_button-tokens.scss` → 20 definitions spelled `--dsa-button_terciary--*`

Three vocabularies (`tertiary` / `outline` / `terciary`), joined nowhere, with a typo that has been silently unthemeable.

---

## Appendix B — Contract Schema (seed for `contract.schema.json`)

Per §14.1, this is no longer illustrative. It is the seed for a real, committed
`contract.schema.json`, authored in Phase 1 **before** the emitter exists, so the format
is defined by something validatable rather than by whatever the generator happens to
produce. All contracts validate against it; validation is a Phase 2 exit criterion.

```jsonc
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://schema.kickstartds.com/component-contract.schema.json",
  "type": "object",
  "required": [
    "$format",
    "id",
    "title",
    "generated",
    "api",
    "anatomy",
    "default",
  ],
  "additionalProperties": false,
  "properties": {
    "$format": { "const": "kickstartds/component-contract@1" },
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "generated": { "$ref": "#/definitions/Generated" },
    "api": { "$ref": "#/definitions/Api" },
    "anatomy": { "$ref": "#/definitions/Part" },
    "axes": { "type": "array", "items": { "$ref": "#/definitions/Axis" } },
    "default": { "$ref": "#/definitions/State" },
    "variants": {
      "type": "array",
      "items": { "$ref": "#/definitions/Variant" },
    },
    "bindings": {
      "type": "array",
      "items": { "$ref": "#/definitions/Binding" },
    },
    "composition": { "$ref": "#/definitions/Composition" },
    "coverage": { "$ref": "#/definitions/Coverage" },
  },
  "definitions": {
    "Part": {
      "type": "object",
      "required": ["path", "element", "role", "presence"],
      "additionalProperties": false,
      "properties": {
        "path": { "type": "string" },
        "element": { "type": "string" },
        "classes": { "type": "array", "items": { "type": "string" } },
        "role": {
          "enum": ["container", "text", "glyph", "media", "slot", "control"],
        },
        "presence": { "enum": ["always", "conditional", "repeated"] },
        "gate": { "$ref": "#/definitions/Gate" },
        "content": { "$ref": "#/definitions/Binding_" },
        "tokens": { "type": "array", "items": { "type": "string" } },
        "observedIn": { "type": "array", "items": { "type": "string" } },
        "children": {
          "type": "array",
          "items": { "$ref": "#/definitions/Part" },
        },
      },
    },
    "Binding": {
      "type": "object",
      "required": ["prop", "mechanism", "parts"],
      "additionalProperties": false,
      "properties": {
        "prop": { "type": "string" },
        "mechanism": {
          "enum": [
            "content",
            "presence",
            "class-toggle",
            "token-swap",
            "attribute",
            "element-swap",
            "layout",
            "none",
          ],
        },
        "parts": { "type": "array", "items": { "type": "string" } },
        "affects": { "type": "array", "items": { "type": "string" } },
        "tokens": { "type": "array", "items": { "type": "string" } },
        "detail": { "type": "string" },
      },
    },
    "Axis": {
      "type": "object",
      "required": ["prop", "values"],
      "additionalProperties": false,
      "properties": {
        "prop": { "type": "string" },
        "default": {},
        "values": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["api"],
            "additionalProperties": false,
            "properties": {
              "api": {},
              "class": { "type": ["string", "null"] },
              "tokenSegment": { "type": ["string", "null"] },
              "attributes": { "type": "object" },
              "issues": {
                "type": "array",
                "items": {
                  "enum": [
                    "token-vocabulary-mismatch",
                    "class-vocabulary-mismatch",
                    "no-visual-signature",
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
}
```

---

## Appendix C — Related Documents

- [specs-component-contracts-prd.md](./specs-component-contracts-prd.md) — the Specs adoption evaluation this supersedes
- [packages/design-system/scripts/specs-spike/README.md](../../../packages/design-system/scripts/specs-spike/README.md) — Phase 0 spike results and findings
- [design-tokens-mcp-prd-component-tokens.md](./design-tokens-mcp-prd-component-tokens.md) — component token surfacing
- [design-tokens-mcp-prd-intent-governance.md](./design-tokens-mcp-prd-intent-governance.md) — token governance rules
- [schema-layers-prd.md](./schema-layers-prd.md) — JSON Schema layering
- [cosmos-token-graph-prd.md](./cosmos-token-graph-prd.md) — token dependency graph
- Nathan Curtis, [Component Contracts and Schemas](https://nathanacurtis.substack.com/p/component-contracts-and-schemas)
- Nathan Curtis, [Slots in Design Systems](https://nathanacurtis.substack.com/p/slots-in-design-systems)
- [Specs schema documentation](https://www.specsplugin.com/schema/)
- [Design System Doc spec](https://designsystemdocspec.org/)
