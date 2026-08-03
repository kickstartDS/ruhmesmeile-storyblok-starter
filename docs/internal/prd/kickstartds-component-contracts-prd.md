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
dist/contracts/index.json                      # catalog + format version
dist/contracts/{name}.brief.md                 # generated LLM projection (§8.2)
```

Format identifier: `kickstartds/component-contract@1`.

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
- **`observedIn`** lists story ids for parts not present in the default. This is the audit trail for §5.10 coverage.
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

### 5.6 `default` — the baseline

```jsonc
"default": {
  "configuration": { "variant": "secondary", "size": "medium",
                     "disabled": false, "type": "button" },
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
    "story": "components-button--secondary-button",
    "screenshot": "img/screenshots/components-button--secondary-button.png"
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

### 6.3 Pass 3 — Reconciliation

Pure function over Pass 1 + Pass 2 output. No I/O beyond reading them.

1. **Identify the default story** per component — the story whose `args` are the subset-closest match to `{Name}Defaults.ts`. Deterministic tie-break: lowest story id.
2. **Union the observed DOM trees** across all stories of the component into one anatomy tree. Parts present in every story → `presence: "always"`. Parts present in some → `presence: "conditional"`, with `observedIn` recorded.
3. **Name the parts.** In order: (a) the BEM element segment when a class matches `__(\w+)`; (b) the token grammar's element name when a `--dsa-*` custom property is active on the node; (c) the slot prop name; (d) positional fallback `child-{n}`. **This is the single inference step**, it is convention-driven, and every part records `observedIn` so a human can check it. Ambiguity emits a lint warning rather than a silent choice.
4. **Attribute conditional parts to props** by finding the minimal `args` difference between a story where the part appears and one where it does not → `gate`.
5. **Diff each non-default story against the default** on classes, styles, attributes and box → the `variants[]` delta.
6. **Attribute each delta to a prop** via the story's `args` difference, and classify the `mechanism` → `bindings[]`.
7. **Join the vocabularies**: for each enum value, match `{observed class}` ↔ `{token segment}` ↔ `{api value}`; mismatches become `issues`.
8. **Compute coverage** from proven vs. possible.

### 6.4 Determinism

- All maps emitted with sorted keys; all arrays in a defined order (schema order for props, enum order for values, DOM order for parts).
- `OBSERVED_PROPERTIES` is a fixed list, not `getComputedStyle` enumeration.
- Input content hashes recorded in `generated.inputs`; CI asserts regenerating twice produces an empty diff.
- Non-deterministic content (dates, random IDs, blurhashes) excluded from `text` capture via a denylist.

### 6.5 Cost model

| Stage                   | Added cost                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| Pass 1                  | ~1s for all 77 components (file reads + parsing)                              |
| Pass 2                  | one `page.evaluate()` per story, ~50ms × 157 ≈ 8s, **inside an existing run** |
| Pass 3                  | pure computation, ~2s                                                         |
| **Total added CI time** | **well under a minute**                                                       |

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

| Tool                                  | Returns                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `get-component-contract(name)`        | Full contract JSON                                                    |
| `get-component-anatomy(name)`         | `anatomy` + `composition` only — cheap structural view                |
| `get-prop-visual-impact(name, prop?)` | `bindings` + relevant `axes` — the "what happens if I set this" query |
| `list-component-contracts()`          | Catalog with coverage scores                                          |
| `lint-component-contracts()`          | All `issues` across all contracts                                     |

New resources: `contracts://index`, `contracts://{name}`.

The Design Tokens MCP gains a reverse lookup — `get_token_usage(token)` → which components and parts bind it — because contracts finally make that computable.

### 8.2 The `brief` projection

A full contract is large. Agents mostly need orientation, then detail on demand. So we generate a Markdown `brief` per component:

```markdown
## Button

`<a>` (or `<button>` without `url`) · `.dsa-button.c-button`

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
| `anatomy-drift`           | part set changed vs. last contract          | breaking-change signal in PRs                                |

The first, second and fourth were found by a five-line join in the Specs spike. They had been invisible to every existing artifact.

### 8.4 Downstream

- **Storyblok MCP** — component composition currently reasons over content patterns. Contracts add "this component's `content_mode` changes layout, not just spacing".
- **website** — contracts are buildable input for prop→token debugging tooling.
- **Design Tokens Editor** — "which components does this token affect, and where" becomes answerable.

---

## 9. What This Deliberately Does Not Model

Stated so nobody has to guess, per Curtis #7.

| Not modelled                                       | Why                                                           | If it becomes load-bearing                              |
| -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Responsive behaviour                               | §7                                                            | `styles` keyed by viewport, `@2`                        |
| Interaction states (`:hover`, `:active`, `:focus`) | Not observable in a static `postVisit` capture                | Playwright can force states; additive `states` on parts |
| Non-default themes                                 | 9 branding themes swap values, not structure                  | Emit per theme; structure is shared                     |
| Motion / transitions                               | Duration tokens exist but timing is not observable statically | Additive                                                |
| Accessibility semantics                            | `addon-a11y` already runs; separate concern                   | Join a11y results by story id                           |
| Cross-component dependency graph                   | Component-scoped by design                                    | Derivable from `composition.accepts`                    |
| Figma                                              | §10                                                           | Consume, don't produce                                  |
| Platform neutrality                                | We have one platform (§2, principle 3)                        | Revisit if a second appears                             |

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

### Phase 1 — Foundation (schema + static pass + capture)

1. Author `contract.schema.json` for `kickstartds/component-contract@1`.
2. Build Pass 1 (`scripts/contracts/static.mjs`), reusing `tokenGrammar.mjs`.
3. Extend `postVisit` with the observation capture; write `.observations/{story-id}.json`.
4. Verify: observations produced for all 157 stories; screenshots unchanged; CI time delta measured.

**Exit:** every component has `api`, `composition`, candidate `axes`; every story has an observation. Screenshot pipeline provably unaffected.

### Phase 2 — Reconciliation (the value)

5. Build Pass 3: anatomy union, part naming, gate attribution, variant diffing, mechanism classification, vocabulary join, coverage.
6. Emit contracts for all components; validate all against the schema.
7. Assert byte-identical output across two consecutive runs.
8. Hand-review anatomy for 10 components spanning simple → compositional.

**Exit:** 100% validate; regeneration diff empty; part naming judged correct or trivially correctable on 10 sampled components; `axis-token-mismatch` reproduces the `terciary` finding without being told about it.

### Phase 3 — Lint & fix

9. Implement the §8.3 rules; run across all components.
10. Triage; fix `terciary` and `share-bar`/`sharebar`; ratchet coverage where cheap.
11. Wire into CI as warnings, then as errors for `axis-token-mismatch` and `part-name-inconsistency`.

**Exit:** lint green or explicitly waived; the two known defects fixed.

### Phase 4 — Delivery

12. Ship contracts in `dist/contracts/`; add to the design-system `build` script.
13. Add the five MCP tools + two resources to Component Builder MCP.
14. Generate `brief.md` per component; measure token cost of a realistic agent session.
15. Add `get_token_usage` reverse lookup to Design Tokens MCP.

**Exit:** an agent can answer "what happens visually if I set `variant: primary`" from MCP alone, without reading source.

### Phase 5 — Evaluation

16. A/B a set of realistic UI-building tasks with and without contracts in context.
17. Measure: correct token usage, correct prop usage, hallucinated props, iterations to correct output.
18. ADR recording the outcome and any `@2` changes.

---

## 12. Risks & Mitigations

| Risk                                                                       | Severity | Mitigation                                                                                                                                                           |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part naming inference is wrong often enough to erode trust                 | **High** | Convention-driven with a 4-step deterministic ladder; `observedIn` on every part; ambiguity warns rather than guesses; Phase 2 gates on hand review of 10 components |
| Stories are a poor variant matrix (137 stories, 77 components)             | **High** | `coverage` makes it explicit rather than hidden; contracts assert only what is proven; missing coverage becomes an actionable backlog                                |
| DOM capture is flaky (fonts, async, animation)                             | Medium   | Reuse the existing `waitForPageReady` + 1s settle already proven stable for image snapshots; denylist volatile content                                               |
| Contract size balloons agent context                                       | Medium   | `brief` projection + granular tools (`get-component-anatomy`) rather than always returning the full contract                                                         |
| Components delegating to `@kickstartds/base` produce DOM we do not control | Medium   | This is precisely why we observe rather than infer — the base package's DOM is captured as-is                                                                        |
| Non-determinism sneaks in                                                  | Medium   | Content hashes in `generated.inputs`; CI asserts empty regeneration diff                                                                                             |
| `postVisit` changes break the screenshot pipeline                          | Medium   | Capture runs _before_ screenshot logic and writes to a separate directory; Phase 1 exit criterion explicitly checks screenshots are unchanged                        |
| We build it and agents do not use it well                                  | Medium   | Phase 5 is an explicit measurement gate, not a formality                                                                                                             |
| Scope creep into responsive/themes/states                                  | Low      | §9 is the contract with ourselves; changes require an ADR                                                                                                            |
| Format churn breaks consumers                                              | Low      | `$format` version; consumers pin; ADR-governed evolution                                                                                                             |

---

## 13. Success Metrics

| Metric                                                 | Target                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Components with a contract                             | 77 / 77                                                                |
| Contracts validating against `contract.schema.json`    | 100%                                                                   |
| Regeneration diff on unchanged input                   | empty, byte-identical                                                  |
| Added CI time                                          | < 60s                                                                  |
| Anatomy parts requiring manual correction (sampled 10) | < 15%                                                                  |
| Axes with a complete three-vocabulary join             | > 90%                                                                  |
| Mean `coverage.score` across components                | > 0.6 initially, ratcheting                                            |
| Lint issues at Phase 3 exit                            | 0 unwaived `axis-token-mismatch`, 0 unwaived `part-name-inconsistency` |
| Hand-authored bytes in any contract                    | **0**                                                                  |
| `brief` size per component                             | < 400 tokens                                                           |
| Agent tasks: hallucinated props (A/B)                  | reduced                                                                |
| Agent tasks: correct token selected first try (A/B)    | improved                                                               |

---

## 14. Open Questions

1. **Default story identification** — is "closest `args` subset match to `{Name}Defaults.ts`" robust, or do we need a `tags: ['contract-default']` story tag? A tag is one word per component and removes an inference — probably worth it despite principle 8.
2. **Part naming ladder** — should step (d), positional fallback, exist at all, or should unnamed parts be omitted with a lint warning?
3. **`archetypes-*` components** are skipped by the manifest hook. Skip them here too?
4. **Repeated parts** (`presence: "repeated"` for slot items) — capture the first instance only, or record variance across instances?
5. **Interaction states** are the most requested thing we are excluding. Is a Playwright `:hover` force-state pass cheap enough to include in Phase 2 rather than deferring?
6. **`observedIn` on every part** is verbose. Keep only for conditional parts?
7. **Where do contracts live at runtime** — `dist/contracts/` in the design-system package, or a separate publishable `@kickstartds/contracts` package for consumers who do not want the full DS?
8. **Theme dimension** — emit one contract per theme (9×), or one contract with `resolves` chains and let consumers resolve values per theme? The latter is normalized; the former is directly usable.
9. **Should `coverage` gate CI?** A ratchet is motivating; a hard gate on a 137-story baseline may be obstructive.
10. **Contract diffs in PRs** — is an `anatomy-drift` bot comment the right change-communication mechanism, per Curtis #7?

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

## Appendix B — Contract Schema Sketch

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
