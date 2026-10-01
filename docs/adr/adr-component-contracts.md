# ADR: kickstartDS Component Contracts

**Date:** 2026-09-26
**Status:** Accepted (format + identity + interop decisions; implementation phased)
**Deciders:** Jonas Ulrich
**Related:** [kickstartds-component-contracts-prd.md](../internal/prd/kickstartds-component-contracts-prd.md), [component-contracts-prd-vs-knapsack-design-system-contract.md](../internal/research/component-contracts-prd-vs-knapsack-design-system-contract.md), [specs-component-contracts-prd.md](../internal/prd/specs-component-contracts-prd.md), [adr-ui-generation-eval.md](./adr-ui-generation-eval.md), [ui-generation-eval-prd.md](../internal/prd/ui-generation-eval-prd.md)

---

## Context

The Component Contracts PRD proposes a per-component, 100% derived JSON artifact that joins the API, DOM and token vocabularies so an agent can answer "what happens visually when I set this prop" without reading source. A Phase-0 spike (since removed, its work landed in `scripts/contracts/`) produced validating contracts for five components and found two real defects (`--dsa-button_terciary--*` vs the `tertiary` enum; `blog-aside`'s `share-bar`/`sharebar` split).

Two things changed the calculus after the PRD was written:

1. The **Knapsack Design System Contract** was published (format v0.1, spec v0.11.0, 2026-09-24) — an open, Apache-2.0 format for the API half of a component, with a rigorous identity fold, a manifest with content addresses, and a normative DSDS mapping. The PRD predates it and never evaluated it.
2. **DSDS** removed its own `api` block and left a `specs[]` pointer for any contract format to fill.

This ADR records the decisions taken to start implementation: what the format is, what we adopt from Knapsack, what we emit rather than adopt, and how the eval that justifies the work is wired.

**Target scope:** the Design System components in **this monorepo** (`packages/design-system/src/components/*`), not the upstream `kickstartDS` design system they build on.

## Decision 1: Subject the monorepo's own components

**Options considered:**

1. Generate contracts for upstream `kickstartDS` components, consumed from the published package
2. Generate contracts for the components authored in this monorepo

**Chosen: Option 2.**

**Rationale:** the PRD's motivating defects (`terciary`, `share-bar`/`sharebar`, the three-vocabulary join) live in this repository's SCSS and schemas, and the eval harness already stages this monorepo's MCP servers and design system. Contracts for an upstream package we do not control would not be fixable from here, and the lint rules would report issues nobody in this repo can act on.

**Trade-offs accepted:** consumers of the published `@kickstartds/design-system` do not get contracts for its components from this repo — the format is ours, the subjects are ours. Upstreaming remains an option (see [optoma-upstreaming-checklist.md](../internal/checklists/optoma-upstreaming-checklist.md)) but is not the target.

## Decision 2: Adopt Knapsack's identity rules verbatim, not its format

**Options considered:**

1. Keep our `id` (`^[a-z0-9-]+$`) + `title`
2. Adopt the Knapsack format wholesale
3. Adopt Knapsack's **identity, integrity and interop rules** into our format, and emit Knapsack as a projection

**Chosen: Option 3.**

**Rationale:** our `id` pattern accepts `button--primary` and `-button`, both of which DSDS and Knapsack reject; we had no fold and no collision handling. Knapsack's five-step fold, two rejection classes and collision-as-hard-failure are strictly better *and* produce identifiers that are a subset of the DSDS `id` pattern — free interop. Adopting the format wholesale fails our own motivating test: Knapsack models none of anatomy, axes, bindings, tokens or evidence, which is what this PRD exists to deliver.

**Trade-offs accepted:** we now own a fold fixture suite (Knapsack's spec admits its fold has no executable test). `id`/`title` are replaced by `contractId`/`component` — a breaking format change, acceptable because the format is unshipped.

## Decision 3: `contractId` / `component` split, with our declared-name profile

**Chosen:** `contractId` = fold(declared name) carries normative identity; `component` = the JSON Schema `title` verbatim carries the display name; the two may differ. The declared name is the `src/components/{name}/` folder id, folded on every publish.

**Rationale:** identity must survive Storybook-title and display-name edits. The folder id is what every existing artifact already keys on, and it is already kebab-case so the fold is idempotent today. DSDS `id` joins to `contractId` by construction.

**Trade-offs accepted:** two components whose declared names fold to the same identifier now fail the build and must be renamed. Version and owner are not part of the identifier; they live in `index.json`.

## Decision 4: Compose with Knapsack; emit a projection, never fork

**Options considered:**

1. Extend Knapsack's schema to hold anatomy/tokens/bindings (a fork)
2. Emit a Knapsack-compatible projection from each contract as a derived build output

**Chosen: Option 2.**

**Rationale:** extending Knapsack's schema would violate its own prior-art rule (PROH-4) and re-create the second-source-of-truth problem the format exists to prevent. The projection is mechanical because `api.props` already classifies `type`/`values`/`default`, and the manifest maps directly onto `index.json`.

**Trade-offs accepted:** the projection is lossy — `role`/`axis` are dropped, `type: "enum"` widens to a JSON Schema `type` + `enum`, and props using `anyOf`/`items`/`$ref` cannot be fully represented. Losses are recorded in the projection report rather than papered over.

## Decision 5: DSDS interop via `specs[]` + a normative trait mapping

**Chosen:** a DSDS component entry lists `specs: [{ href, rel: "contract", role: "Design System Contract" }]`, and a consumer projects props/states onto DSDS `traits` (enum → `variant`/`enum` default-first; boolean → `variant`/`boolean`; `states` → `state`/`boolean`; other types get no trait).

**Rationale:** DSDS deliberately no longer owns an `api` block; the pointer costs nothing and composes without forking. Identity matches because the fold output is a valid DSDS `id`.

**Trade-offs accepted:** an enum prop without a `default` becomes a trait whose first value DSDS reads as default — a meaning the contract did not assert, so the mapping states it. We deviate from Knapsack's mechanical "any enum or boolean" rule in two recorded ways: only props with `role` `appearance`/`state` become variant traits (`type: "submit"`, role `behaviour`, is not a design variant), and `disabled` is emitted once as the boolean prop trait rather than also as a state, because §5.5/§5.8 model it as a boolean axis with `mechanism: attribute`.

## Decision 6: Two kinds of hash, two different jobs

**Chosen:** `generated.inputs` keeps truncated content hashes of the derivation inputs (proves *reproducibility*); `index.json` adds an RFC 8785 canonical-form SHA-256 `address` per published contract (proves *integrity of the published bytes*) plus `origin: "synced"`.

**Rationale:** a consumer verifying a file needs to survive reformatting by a different tool, which only canonicalization gives. Our derivation hashes cannot do that job, and the address cannot prove which inputs produced the file. They are complementary, not redundant.

**Trade-offs accepted:** RFC 8785 is a real dependency in the emitter path and must be tested against the spec's worked example.

## Decision 7: Projections are build outputs; the Specs projection stays a reference spike

**Chosen:** the Knapsack contract + manifest and the DSDS `specs[]`/`traits` are written by the design-system build into `dist/contracts/`. The Specs `api.yaml` projection was the Phase-0 spike's and never part of the build; the spike and its committed output have since been removed.

**Rationale:** Knapsack and DSDS have real schemas to validate against and real consumers; Specs models a source of truth we do not have. Validating the projection against the target's own published schema before writing it makes a projection failure a build failure, not a warning.

**Trade-offs accepted:** a second published-format surface to maintain, bounded by keeping projections one-way and mechanical.

## Decision 8: Productionize the spike into `scripts/contracts/`, not greenfield

**Chosen:** the production toolchain lives in `packages/design-system/scripts/contracts/`, seeded by and reusing the spike's proven pieces (`tokenGrammar.mjs`, the reconciliation approach). The spike stayed committed as the format's proving ground while the port ran, and was removed with its output once `generate.mjs` covered Pass 1–3.

**Rationale:** the spike already answers the hard questions (declared baseline, `introduced: true` for parts that first appear in a variant, opacity rules for glyphs, determinism normalisation). Rewriting them greenfield would discard the answers. The production path differs in identity (fold), integrity (`index.json`), projections, and wiring into `build`.

**Trade-offs accepted:** the two directories coexisted until the port completed, which it now has: `generate.mjs` derives Pass 1–3 and both projections from the components themselves, and the spike, its `dist-contract-spike/` snapshot and the `bin/project.mjs` bridge that read the legacy `id`/`title` shape are gone — the bridge was the last thing that needed the spike's output.

## Decision 9: The eval gates the format, and runs as an MCP arm

**Chosen:** Phase 5 runs the existing `packages/agent-eval` harness with four arms — `cc-none`, `cc-both` (today's servers), `cc-contracts` (contract tools added), and `cc-brief-only`. `cc-contracts` extends **Component Builder MCP** rather than standing up a fourth server; Design Tokens MCP gains a `get_token_usage` reverse lookup.

**Rationale:** a separate server would add a variable and dilute attribution; Component Builder MCP already owns "how to build UI here". Sequencing is format → projections → MCP surface → A/B, because an arm shipping a half-derived contract measures the wrong thing.

**Trade-offs accepted:** the eval is a spend-bearing, human-gated run ([adr-ui-generation-eval.md](./adr-ui-generation-eval.md), Decision 11). If `cc-contracts` does not beat `cc-both`, the format changes before shipping further — which is the point of measuring. Contract tools are advertised only when `DESIGN_SYSTEM_CONTRACTS_DIR` is set: advertising a tool whose handler can only say "not available" would put the contract vocabulary into the baseline arm's context, which is a confound, and would waste turns in production. Deployments must therefore set the variable (pointing at the installed package's `dist/contracts`); unset means the tools are withheld rather than broken.

**Discovery is three layers, and all three are gated on the same condition:**

1. **Server `instructions`** (returned by `initialize`, before any tool call) name the contract tools and what they answer — the one screen of context a model cannot skip;
2. the **"call me first" tool** of each server (`get_ui_building_instructions`, `get_token_architecture`) points at them — `get_token_architecture` lists `get_token_usage` in its `related` map, which is the discovery hook that tool already had;
3. the **tool descriptions** themselves carry their "use this when".

Layer 2 is why the discovery text landed **before** the DeepSeek cohort rather than after: it changes `dist/handlers.js`, so `parts.staged` moves and every arm that stages a server goes stale — measured, not assumed (`cc-both-deepseek-default` refused with `both:86795e84fdddd22b → both:10a39faa3fd6a3df`). That is the cost of Option B, and it is the honest one: a cohort whose arms differ in their server bytes is not a cohort. `SETUP_VERSION` deliberately was **not** bumped — `staged` already covers server bytes, so bumping it would additionally invalidate the `none` arm, which stages nothing and whose results remain valid.

**Two defects from the first landing, both found by inspecting the trials rather than the summary.** They are the reason the first DeepSeek measurement was discarded:

1. **The §9 leak.** Layer 2 was written into `get_ui_building_instructions` unconditionally, while the tools it describes are gated. 50 of the baseline arm's 60 transcripts carried §9 and **8 calls came back `No such tool available`** — the baseline was told about tools it could not have, so it was neither a clean baseline nor a fair contrast. It is now gated on the same condition as everything else, which also means an agent in production is never told about tools its server is withholding. Cost of the fix: the server bytes move again, so `both` and `contracts` re-run.
2. **The probe proved reachability, not the tool list.** `probeHostServers` checked the probe's exit code, and the probe only required ≥1 tool — so a `contracts` arm whose servers came up *without* `DESIGN_SYSTEM_CONTRACTS_DIR` would have passed setup and measured an A/A at full price. The probe now takes expected tool names (`EXPECTED_CONTRACT_TOOLS`), asserted per server for the contracts variant; verified by a negative control (exit 1, naming the missing tools). `parts.probe` moves, which stamps `cc-none-*` stale — the `none` arm never runs the probe (no servers to probe), so its measurements are unaffected.

**Three additions from the same reading of the trials.**

1. **`880-contract-lookup`.** Every other eval asks whether having a server helps on a task the agent could already do. This one asks the prior question — does the contract layer carry information nothing else in the fixture carries? The eight facts (`--dsa-button_primary--background-color`, `c-button--outline`, `attribute`, the Faq `questions` item shape, Button's unproven `size` values, Blog Aside's two spellings, Button's primary computed background, Section's accepted arity) exist nowhere in the checkout, and the fixture ships only the global `--ks-*` layer. The gate is structural — all eight answered — while the host grader `contract-lookup` **derives its key from the committed contract set**, so the key cannot drift from the thing being asked about. `mcpUseExpected: true`, so a trial that never reached a tool is excluded by the confound classifier rather than counted as eight confident guesses. Note the inversion: here `pass@1` means "answered everything" and correctness lives in `quality` — the opposite of `816`, where the gate carries the rule.
2. **`typography-pairing`, host-side.** `816`'s rule existed only in its in-sandbox gate, which is how two runs differing by one token name both scored 0.9843 while one failed. The rule now lives in `lib/typography-pairing.ts` (pure, shared by reference with the sandbox source), the grader scores its three assertions, and `graders:selftest` pins the reference answer plus three deliberate breaks — mis-paired colour, hand-set value, mixed categories — each rejected by the intended check.
**The token table's cost, for the record.** A third arm was built and run once to test it: the same servers and the same contracts with every brief regenerated without its token table. It was removed on request, but the one cohort it produced is worth writing down, because it is the only evidence there is. Seven evals, three runs each, gate only:

| arm | gate-passed |
| --- | --- |
| `both` — no contracts | 13/21 |
| `contracts` | 13/21 |
| `contracts` without the token table | **18/21** |

Per eval, 818 `1/3 → 3/3`, 840 `0/3 → 2/3`, 852 `2/3 → 3/3`, ties on 816, 860, 862 and 880 — the tasks the anti-leverage reading named, and no others. n=21 per arm, run in three batches about ninety minutes apart rather than interleaved, and no host grading, so this is a direction and not a result. Anyone re-raising the question starts from here: the briefs name the `--dsa-*` component layer as an existing fact, and the tasks that moved are the ones asking *where a value belongs*.

Power is a knob now, not a rebuild: `RUNS`/`EVAL_RUNS` set the runs per task, `EVALS_OVERRIDE` names a focused chunk, and `run-split.sh` propagates the count to the experiment so the batch verifier and the experiment cannot disagree. A focused chunk keeps the disk guards and the completeness check that a bare `EVAL_ONLY=… pnpm eval` call drops.

**Two greenfield tasks, added after building the components by hand first.** `890-pricing-plans` and `891-comparison-table` are written from scratch against a schema the fixture hands over, and both are `extra` — greenfield cost, and most of the capability signal. Every other build task in the suite is small: an atom, a composition of two, an edit. These two ask for a component with a whole row or table in it, a recommended variant that inverts, and a call to action composed from the library's Button, which is the shape where a contract's `anatomy`, `bindings` and `composition` sections have the most to say. The prompts name the requirement (*the halo sits behind the card*, *the band inverts the way everything else does*) and not the mechanism.

What the gates assert, and why:

| assertion | 890 | 891 |
| --- | --- | --- |
| inversion is the token layer's, not the component's | ✔ | ✔ |
| the inverted region is the recommended plan / column, not the row / table | ✔ | ✔ |
| the call to action is the library's Button | ✔ | ✔ |
| the halo is not painted over the card that hosts it | ✔ | — |
| a colour token that colours the inverted region is declared *inside* it | ✔ | ✔ |
| features are rows and plans are columns (`th[scope]`) | — | ✔ |
| every cell holds what the schema says, icon and label included | — | ✔ |
| the table scrolls instead of squeezing | — | ✔ |

The fifth row is the one worth the words. A custom property is substituted where it is *declared*, so a band colour declared on the block resolves against the light page and inherits the light value into the dark column — dark text on a dark surface. The gate walks the rendered DOM, takes the inverted elements, and requires the component tokens they consume to be declared by a selector matching something inside that region. It is asserted against the render rather than the stylesheet so it does not depend on what the agent called anything.

**Correction after the first run: the inversion has two legitimate routes, and the gate originally allowed one.** The first cohort of these two tasks scored 0/18, failing in every arm on the same two assertions, and the failures were the gate's. It demanded `ks-inverted="true"` on the recommended plan. The library reaches the inverted layer *both* ways: by marking the region, and by colouring it with the `-inverted` variant of each semantic token — which `section.scss` itself does, and which is also correct inside an already-flipped region, because there the `-inverted` names resolve back to the base values. Every one of the 18 trials took the second route, and one of them wrote the reasoning into a comment: *"so the column stays inverted relative to its surroundings even when it ends up inside an already inverted region."* The gate now accepts either and the token-context assertion applies only to the attribute route, because only that route creates a region whose tokens must be declared inside it. Verified by running the fixed gate against four solutions: the reference and both agent solutions pass 12/13 (the thirteenth being the monorepo's `@types/minimatch` stub, absent in a sandbox); a hand-rolled mutant still fails six assertions. Naming left the gate at the same time — it was stricter than the task's own prompt — and is now `component-contract`'s to score.

**The first cohort also produced the quality half, which was never in doubt.** With the gate as it then was, `pass@1` was 0 everywhere and told us nothing, while quality separated cleanly: 890 `0.843 ± 0.025` (no servers) against `0.994 ± 0.005` (both) and `0.969 ± 0.002` (contracts); 891 `0.889 ± 0.003` against `0.983 ± 0.017` and `0.975 ± 0.007`. The systems built the components well — the closest trials got the halo behind the card, the `--dsa-*` layer and the CTA variant right — and failed on the one mechanism nothing in the product surface documents. Neither MCP server mentions `ks-inverted` anywhere; the mechanism is only inside the fixture's token files.

**Contracts for the two new components: generated once, then taken back out of what the arm is served.** They were generated to test whether a contract lifts a build task, and the measurement said it would not, for reasons that generalise beyond these two. `pricing-plans` came out with one axis — `layout` — and `comparison-table` with none; `ks-inverted` appears **zero times** in either contract, and `highlight` appears only as a field name. Two structural causes: the axes come from prop variation on the observed part, and the interesting variation here lives *inside a slot item* (`plan[].highlight`, `plans[].highlight`), which the contract does not model as an axis; and the declared default renders an empty component (`plan: []`, as the schema defaults it), so the observation records no card at all — no card, no attribute, no mechanism. A contract for a build task that carries nothing the schema did not already say is not a treatment; it is a leak with a tool wrapper. The set went back to 62 contracts, 62 briefs, 62 narratives, index, Knapsack and DSDS projections all at 62, `contracts:validate` valid, and the two subjects withheld.

The rule behind it, which is the part worth keeping: **a build task must not be served the contract of the component it is asked to build.** The generator has no exclusion for that yet, so the next full `contracts:generate` will re-add both; the durable fix is a withheld-subject list in the generator (or an `--except`), not a manual delete.

**What the first cohort scores under the corrected gate** (replayed against the archived solutions locally, no spend): 890 `contracts` 3/3, `both` 2/3, `none` 2/3. The two remaining failures are the gate doing its job — both run-1 of `both` and run-3 of `none` wrote their own `[ks-inverted]` rules, which is the reimplementation the task exists to catch. 891 does not saturate the same way: `none` 0/3 and `both` 1/3 among the replays that completed, failing on table semantics and on cell contents rather than on the inversion. So with the gate corrected, 890 discriminates only on that one defect and 891 discriminates on structure — which is a task property, not a gate property, and the quality spread (0.84 against 0.99) remains where the signal was all along.

Verified locally by running each generated `EVAL.ts` against its reference solution in the fixture (12 of 13 assertions pass; the thirteenth is `@types/minimatch`, a stub in the monorepo root that a sandbox workspace does not have) and against three deliberate mutations: a pricing row with hardcoded colours and no `ks-inverted` (six assertions fail — literals, tokens, the inversion, a hand-rolled control and the halo painted over its own surface), the same with a one-line stylesheet (`no colour is written as a literal` has to catch it, and did not until the declaration pattern stopped being anchored to the start of a line), and the comparison table with its band colours moved from the cells to the block (only `the column's colours are declared where the inversion applies` fails, which is exactly the trap).

**Contracts for the two new components are deliberately not generated yet.** They are the *subject* of these tasks: a contracts arm that can call `get_component_brief("pricing-plans")` would be handed the reference solution's anatomy, which measures reading rather than building. The peers the tasks compose with — Button, and the token layer — are in the served set as usual. Regenerating the contract set after these components land makes the two tasks considerably easier, so that is a decision to take deliberately and re-read the arms afterwards.

## Decision 10: Contracts are generated post-Storybook and committed; Rollup ships them

**Options considered:**

1. Generate during `build` (PRD Phase 4's original wording)
2. Generate at `prepack` / publish time
3. Generate in a post-Storybook pipeline step into a committed `contracts/` directory, and copy it to `dist/contracts/` from Rollup

**Chosen: Option 3.**

**Rationale:** derivation needs a browser pass over `storybook-static` plus the generated declared-default stories, neither of which exists during `build`; `build` also begins with `rm -rf dist` and `prepack` runs in a clean environment with no Storybook. So options 1 and 2 cannot work. A committed set mirrors the existing screenshot pipeline (`build-storybook` → `test-storybook` → committed `static/img/screenshots/` → Rollup copies to `dist/static/`), keeps `build` browserless, and makes the published contracts auditable in review.

**Trade-offs accepted:** a large committed artifact set (~66 contracts plus briefs and projections). Bounded by the fact that regeneration is byte-identical, so review diffs are meaningful. `.contract-observations/` stays gitignored scratch; regenerate-and-diff (`contracts:verify`) is the CI honesty check. `dist/contracts/` is produced by Rollup, not by the generator, so the generator's default output is `contracts/`.

## Decision 11: The subject set is discovered, and skips are reported

**Chosen:** a contract subject is a directory with a renderable component export, a JSON Schema, and generated defaults — 66 of 73 directories today. Everything else is skipped and listed in the run report and `contracts-report.json`.

**Rationale:** `cms/` holds root content types, `lightbox/` and `rich-text/` are style-only partials, `tile/`/`blog-tag`/`page-wrapper` have no component, and `seo/` is explicitly data-only with no DOM. Contracts assert only what was observed, so a subject that cannot be rendered cannot be derived — better to skip it loudly than to emit an empty contract. The PRD's `archetypes-*` exclusion does not apply in this repository; this decision replaces it.

## Consequences

- **Positive:** stable, DSDS-valid identity; collision and drift become computable; published artifacts are integrity-verifiable; Knapsack and DSDS interop for free; the eval measures contracts specifically, not "more context".
- **Negative / accepted:** breaking format change (`id`/`title` → `contractId`/`component`); a fold fixture suite and an RFC 8785 implementation to own; two directories until the spike is fully superseded; projection maintenance bounded by one-way regeneration.
- **Neutral:** the format still owns the styling half exclusively; nothing here changes the anatomy/axes/bindings/variants/coverage design, which remains the PRD's core.

## Follow-ups

1. Committed `contract.schema.json` (Phase 1 step 1) — done alongside this ADR.
2. Fold + collision + canonical-address library with the Knapsack SCN-014/015 fixtures — done alongside this ADR.
3. Knapsack + DSDS projection emitters, validated against the published Knapsack schemas — done alongside this ADR.
4. Emitter ported to `scripts/contracts/` (`--static-only` across all 66 subjects, browser pass, briefs, projections) and a committed `contracts/` set produced — done alongside this ADR. `contracts:validate` (per-PR CI) and `contracts:verify` (full regeneration + diff, `workflow_dispatch`) are wired — done. Deployments carry the set in the image and point at it with `DESIGN_SYSTEM_CONTRACTS_DIR` — done. The MCP surface (§8.1) and the `cc-contracts` eval arm (Phase 5) are wired — done.
5. Pass 4 narratives implemented (`schema/narrative.schema.json`, `lib/narrative.mjs`, `bin/narrate.mjs`, `contracts:narrate`): grounded prompts, injected captioner, content-addressed skip, quarantine rules, and the declared-default screenshots rendered via the `contract-default` story tag. Running the `cc-contracts` eval remains.
