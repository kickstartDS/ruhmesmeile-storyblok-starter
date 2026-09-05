# UI Generation Eval Implementation Checklist

Tracks progress for building the UI generation eval loop in `packages/agent-eval`.
See [ui-generation-eval-prd.md](../prd/ui-generation-eval-prd.md) for the full PRD and [adr-ui-generation-eval.md](../../adr/adr-ui-generation-eval.md) for architectural decisions.

**Status:** P1 in progress — grader library complete (structural, toolchain, runtime), fixture upgraded, 4-variant matrix ready. Everything validated at zero spend. Remaining P1 work (1.17–1.19) needs the paid matrix run; 1.9 deferred to P2.
**Last updated:** 2026-08-07

---

## Phase 0: Scaffold & First End-to-End Run

**Exit criterion:** one end-to-end run produces a result with a transcript and a project snapshot.

- [x] 0.1 Create `packages/agent-eval/` package scaffold (`package.json` with `private: true`, `tsconfig.json`, `README.md`)
- [x] 0.2 Add `@vercel/agent-eval` dependency and verify the CLI resolves
- [x] 0.3 Add `.gitignore` entries for `results/`, `.fixture-cache/`, `node_modules/`
- [x] 0.4 Implement `agent-eval.config.ts` — shared defaults (timeout 900, `sandbox: 'docker'`, `copyFiles: 'all'`, `earlyExit: false`, pinned judge model)
- [x] 0.5 Implement `lib/mcp/variants.ts` — the 4 MCP variant descriptors (`none`, `component-builder`, `design-tokens`, `both`)
- [x] 0.6 ~~`lib/mcp/start-component-builder.mjs`~~ → superseded: `lib/mcp/stage.ts` + `.mcp.json` (see deviation D-3)
- [x] 0.7 ~~`lib/mcp/start-design-tokens.mjs`~~ → superseded by the same
- [x] 0.8 Implement `lib/experiment.ts` — `defineExperiment()` building `ExperimentConfig` from a variant descriptor, incl. the computed variant-version guard
- [x] 0.9 ~~`lib/fixtures/build-fixture.mjs`~~ → superseded: design system installed from npm, no packing step (see deviation D-4)
- [x] 0.10 Implement `lib/fixtures/hygiene.ts` — config-load check failing on any agent-instruction file (D14)
- [x] 0.11 Author eval `810-atom-from-schema/` (`PROMPT.md`, `EVAL.ts`, `package.json`, `src/`)
- [x] 0.12 Add experiment `experiments/cc-none-sonnet-high.ts`
- [x] 0.13 Add experiment `experiments/cc-both-sonnet-high.ts`
- [x] 0.14 Wire package scripts: `eval`, `eval:dry`, `eval:smoke`, `playground`, `status`, `refingerprint`, `typecheck`
- [x] 0.15 Verify `pnpm eval:dry` reports the expected task × variant × run plan
- [x] 0.16 Verify a real single-eval run produces `summary.json`, transcript, and `project/` — **human-initiated, costs money**
- [x] 0.17 Document setup (API keys, Docker prerequisites, how to run one eval) in the package README
- [x] 0.18 Capture the agent transcript ourselves from `EVAL.ts` (ADR Decision 15)
- [x] 0.19 Confirm `agent-transcript.jsonl` + `agent-transcript-meta.json` land in `project/` — `found: true` on all 3 runs
- [x] 0.20 Deny `WebSearch`/`WebFetch` in every variant (ADR Decision 16)
- [x] 0.21 Verify the deny rules survive `--dangerously-skip-permissions` — `toolCalls` must contain no `WebFetch`/`WebSearch`

## Phase 1: Grader Set & First Real Comparison

**Exit criterion:** first real answer to "does either MCP help?", with cost and time deltas.

- [x] 1.1 Implement `lib/graders/component-contract.ts` — the component file contract
- [x] 1.2 Implement `lib/graders/purity.ts` — no React state, `forwardRef`, Context-overridable
- [x] 1.3 Implement `lib/graders/token-conformance.ts` — known tokens only, no hardcoded values, correct layer references
- [x] 1.4 Implement `lib/graders/schema-validity.ts` — JSON Schema validity, prop coverage, specific naming
- [x] 1.5 Implement `lib/graders/bem.ts` — BEM naming, namespaced to the component block
- [x] 1.6 Implement `lib/graders/ds-reuse.ts` — DS components over hand-rolled native elements (not applicable until the fixture ships the DS)
- [x] 1.7 Implement `lib/graders/style-placement.ts` — component imports its own stylesheet, tokens pulled in via `@use`
- [x] 1.8 Implement `lib/graders/toolchain.ts` — typecheck + Sass compile, executed in-sandbox by `EVAL.ts`, graded host-side from `toolchain-report.json`
- [ ] 1.9 Implement `lib/graders/stories.ts` — story exists, renders, play function passes → **deferred to P2** (see D-21)
- [x] 1.10 Implement the a11y grader (`lib/graders/toolchain.ts`, `a11y`) — jsdom render + axe, 0 critical/serious violations
- [x] 1.11 Implement `lib/graders/mcp-usage.ts` — tool call counts, ordering, context tokens (transcript-based)
- [x] 1.12 Implement `lib/graders/negative-usage.ts` — `none` variant asserts zero MCP tool calls (and zero web research)
- [x] 1.13 Implement `lib/graders/quality.ts` — weighted composite score, versioned weights
- [x] 1.14 Implement `lib/report/collect.ts` — normalized Outcome record + local failure classifier (§7.5)
- [x] 1.15 Implement `lib/report/metrics.ts` — quality/cost/time/efficiency aggregation with baseline deltas
- [x] 1.15a `bin/grade.ts` + `pnpm grade` — host-side grading CLI (text + `--json`)
- [x] 1.15b `bin/graders-selftest.ts` + `pnpm graders:selftest` — grade the real design system, fail on contract drift
- [x] 1.15c Correct `EVAL.ts` to the measured contract (`badge.scss`, `Badge.client.js`)
- [x] 1.16 Add experiments for the remaining 2 MCP variants (`component-builder`, `design-tokens`)
- [x] 1.17 Author 4 more evals to reach 5 total — at least one must be a composition task with the design system installed, or `ds-reuse` is never exercised (D-20)
  - [x] 1.17a Extract the shared harness to `lib/eval-harness/harness.ts`, generate `EVAL.ts` with esbuild (D-33, D-34)
  - [x] 1.17b `812-restyle-with-tokens` — restyle `alert.scss` onto the token layer; targets the design-tokens MCP's weakest measured result (+0.04)
  - [x] 1.17c `832-client-behaviour` — Disclosure; targets `purity` stuck at 0.75 and `client-behaviour` swinging 0.00–1.00
  - [x] 1.17d `840-reuse-over-native` — NotificationBanner over a vendored DS slice; finally exercises `ds-reuse` (D-20, D-35)
  - [x] 1.17e `860-restraint` — a scoped a11y fix on a shipped component; measures over-editing, which no existing eval penalises (D-36)
  - [x] 1.17f Register all five targets in `lib/graders/targets.ts`
  - [x] 1.17g Validate every new eval in both directions at zero spend (D-37)
- [x] 1.18 Run the full 4-variant core matrix, record actual per-trial cost (D-31, D-32)
- [x] 1.19 Revisit D6 (budget) and D9 (runs per task) against measured cost (D-32)

## Phase 2: Static Artifacts — COMPLETE

**Exit criterion:** G4 — a historical run is fully inspectable from a static URL. **Met.**

`pnpm report build --all` → `pnpm report:index` → `kamal deploy -d agent-eval-results`
publishes the whole campaign: an index of tasks × arms with headline metrics and
baseline deltas, a screenshot per trial, and a link from each screenshot into
that trial's own Storybook. See ADR 67 (artifacts), ADR 68 (retention and
download), ADR 69 (deployment).

- [x] 2.1 Build a Storybook per trial from `run-N/project/` — landed as `lib/report/host/` + `lib/report/manifest.ts` + `bin/report.ts`, not `lib/report/build-report-storybook.ts`
- [x] 2.2 `Summary.stories.tsx`
- [x] 2.3 `Conversation.stories.tsx` — transcript with expandable MCP tool calls
- [x] 2.4 `Graders.stories.tsx` — per-assertion pass/fail + raw output
- [x] 2.5 `Source.stories.tsx` — produced files first, then the fixture's
- [x] 2.6 `storySort` ordering — Summary → Component → Conversation → Graders → Output → Source
- [x] 2.7 Capture story screenshots as review artifacts — `lib/report/screenshot.ts` + `lib/report/serve.ts`, run automatically by `report build` (`--no-screenshots` to skip). Playwright-core, 2× DPR, cropped to the component's own box
- [x] 2.8 Implement the results index site (experiments × timestamps × tasks, headline metrics, baseline deltas) — `bin/report-index.ts` → `pnpm report:index`, writes `results/index.html`. Reproduces the campaign matrix exactly, with a thumbnail per trial linking to its Storybook
- [x] 2.9 `open <experiment>/<eval>/run-N` — timestamps resolved via `resolveMatrix()`, so addresses omit them
- [x] 2.10 Implement retention pruning (last 10 per experiment + pinned baseline runs — D10) — `bin/prune-results.ts` → `pnpm results:prune`. Dry-run by default; explicit pins via `results/<experiment>/.pinned`; currently-reported runs pinned implicitly
- [x] 2.11 Add `config/deploy-agent-eval-results.yml` — Kamal static site behind shared JWT auth (D7) — plus `packages/agent-eval/Dockerfile` and `server/index.ts` (Express, token-paste login, CSP)
- [x] 2.12 Implement `results:download` script (CI artifact retrieval, idempotent merge) — `bin/download-results.ts` → `pnpm results:download`. Locates run dirs structurally by `summary.json`; never overwrites an existing trial

Beyond the original list, and needing PRD §8 reconciliation:

- [x] 2.13 `Report/Component → Rendered` — the produced component, rendered live and interactive
- [x] 2.14 `Report/Component → Provenance` — what came from the agent vs. the host
- [x] 2.15 `Report/Output` — one page for all toolchain/runtime output, rather than separate Build/Typecheck/Lint/A11y pages

## Phase 3: Task Suite & Judge

**Exit criterion:** judge ≥80% agreement with human grading on the calibration set.

- [x] 3.1 Expand the task suite to 20–30 evals across the `8xx` ranges
      **Twenty evals, all through the ADR 53 gate.** Thirteen were authored after
      Phase 1: `802`, `804`, `806`, `811`, `816`, `817`, `818`, `820`, `824`,
      `836`, `842`, `850`, `852`. Every one of them needs the next campaign to
      produce numbers; none of them can be read against Phase 1.

                      | eval                      | slug                  | tier  | what it grades                                        | MCP effect expected |
                      | ------------------------- | --------------------- | ----- | ----------------------------------------------------- | ------------------- |
                      | `802-composite-from-two`  | `testimonial`         | extra | assembling one component out of two the package ships | yes                 |
                      | `804-story-conventions`   | `price-tag`           | extra | the package's story conventions                       | yes                 |
                      | `806-inverted-context`    | `spotlight`           | core  | inverted text colours on a bold surface               | yes                 |
                      | `810-atom-from-schema`    | `badge`               | extra | an atom built from a supplied schema                  | —                   |
                      | `811-token-intent`        | `stat`                | core  | picking tokens by intent, not by appearance           | yes                 |
                      | `812-restyle-with-tokens` | `alert`               | extra | replacing literals with tokens                        | yes                 |
                      | `816-typography-pairing`  | `article-teaser`      | extra | type as a system: family, size and line height agree  | yes                 |
                      | `817-responsive-tokens`   | `page-header`         | core  | responsive scaling through tokens                     | yes                 |
                      | `818-component-token-layer` | `callout`           | core  | the `--dsa-` layer over the `--ks-` layer             | yes                 |
                      | `820-extend-schema-safely` | `avatar`             | core  | adding to a published API without breaking it         | yes                 |
                      | `824-api-from-behaviour`  | `progress-steps`      | extra | designing a surface from a behavioural brief          | yes                 |
                      | `832-client-behaviour`    | `disclosure`          | extra | framework-free client behaviour                       | —                   |
                      | `836-behaviour-bugfix`    | `dismissible`         | core  | repairing client behaviour without demolishing it     | yes                 |
                      | `840-reuse-over-native`   | `notification-banner` | extra | reaching for the package before reaching for HTML     | yes                 |
                      | `842-reuse-edit`          | `promo-tile`          | core  | the same, as an edit rather than a build              | yes                 |
                      | `850-focus-return`        | `filter-flyout`       | core  | **control** — behavioural a11y neither server covers  | **no**              |
                      | `852-a11y-repair`         | `media-card`          | core  | **control** — static a11y neither server covers       | **no**              |
                      | `860-restraint`           | `tag`                 | core  | not rewriting what already works (saturated at 1.00)  | —                   |
                      | `861-token-restraint`     | `quote`               | core  | fixing one token without "improving" its neighbours   | no                  |
                      | `862-api-freeze`          | `rating`              | core  | using what already ships rather than adding to it     | —                   |

                      Twelve core, eight extra. Two controls rather than one, and every treatment
                      task's reading is conditional on both staying flat.

  - [x] D-106 — the suite is **cost-tiered**, and the tier is a property of the
        task rather than a scheduling flag. Phase 1 measured a greenfield trial
        at $4.24–$5.67 and an edit trial at $0.23 — a twentyfold spread, and the
        reason D6's "$40 hard cap per full run of the 4-variant matrix" had
        quietly become a per-_eval_ cap at a measured $35.18. `Target` carries
        `tier: "core" | "extra"`; `defaultEvals()` returns `evalsInTier("core")`
        unless `EVAL_EXTRA_EVALS` is set. Twelve core evals are all edit or diff
        tasks and run at roughly $150 a campaign; the eight extra evals carry
        the greenfield generation tasks and the Phase 1 headline matrix, and
        cost roughly $450 more. The headline comparison is reproducible on
        demand, and the quality gate against response drift — the thing that
        wants running often — is affordable.
  - [x] D-107 — **a task is only authored once the correct answer is shown to be
        something the design system actually does and an MCP actually encodes,
        and shown to be _prevalent_ rather than merely present.** Three tasks
        changed shape under this rule and one died of it. `815-logical-properties`
        was dropped: zero design-system stylesheets use `margin-inline-start`,
        sixteen use `margin-left`, and the component-builder server never
        mentions logical properties — it would have graded a house style the
        house does not have. `850` was planned as a WAI-ARIA menu with roving
        arrow keys; a grep across every component turned up exactly one keyboard
        handler in the entire design system, so the roving pattern went and
        focus return — which `NavToggle.client.js` does explicitly — took its
        place. `816` was planned as theme adaptation until the design-tokens
        server's own `typography-pairing` rule turned out to describe a sharper
        and un-tested defect. This is lesson (ac), and it is cheap: every one of
        these came out of a grep that cost nothing against a matrix that costs
        $35.
  - [x] D-108 — **`850-focus-return` is a second control task, and a stronger one
        than `852`.** Neither server documents focus, Escape or keyboard
        behaviour — `grep -c` over `component-builder-mcp/src` returns zero on
        every file. But the component-builder server _does_ ship
        `get-client-behavior-template`, so an agent holding it will be pulled
        into calling a tool that has nothing to say about the question being
        graded. `852` controls for static a11y with no plausible tool to reach
        for; `850` controls for behavioural a11y with a plausible one. A spread
        on either is not an MCP effect and invalidates the reading of every
        treatment task — lesson (aa), a negative result is only as strong as the
        temptation it survives.
  - [x] `850-focus-return` (`filter-flyout`) — ships a flyout that already
        passes every check the suite runs on `832`: the trigger is a real button,
        `aria-expanded` is honest, the stylesheet reveals the panel off that
        attribute. What it does not do is move focus into the panel, close on
        Escape, or hand focus back to the trigger. Graded by driving the client
        module in jsdom rather than grepping for `.focus()`, which passes an
        implementation that focuses the wrong thing at the wrong time.
        Open/closed is read **only** through `aria-expanded`, never `hidden` or
        computed styles, because the house pattern is CSS-driven and reading it
        any other way would fail a correct answer.
        Three of its sixteen assertions cover behaviour that already works, per
        lesson (af): the cheapest way to satisfy a bug report about a panel you
        cannot escape is to stop opening it. The gate proved that necessary —
        the demolition state fails five assertions, three of them the regression
        half, and without them it would have scored better than the shipped bug.
        Twelve states, each failing exactly its own: unsolved 4 failed (the four
        fix assertions, restraint and regression clean) · **solved A** (focus the
        panel, `document` keydown) 16 passed · **solved B** (focus the first
        link, `window` keydown) 16 passed · demolition 5 failed · Escape without
        focus return 2 · leaked keydown in `destroy()` 1 · any key closes 1 ·
        focus never enters the panel 1 · component edited 1 · schema edited 1 ·
        token partial retuned 1 · dependency added 1 · stories file added 1.
  - [x] `802-composite-from-two` (`testimonial`) — the only task that tests
        composition across **two** existing components, and unlike `840` they sit
        in the source tree rather than `node_modules`, so `list-existing-
components` is the affordance under test. Two of them on purpose, so a
        half-composite is distinguishable from a whole one. Neither sibling is
        imported anywhere, so there is no usage to copy.
  - [x] D-109 — **reuse is graded from the source _and_ the DOM, not either
        alone.** Gate state D copied `className="dsa-portrait"` onto a raw
        `<img>`; the rendered HTML contains `dsa-portrait` and the DOM-side
        assertion passes on its own. The import-side assertion is what catches
        it, and the DOM-side is what catches an import that is never rendered.
        Lesson (ai): a copied class name is not a reused component.
        Seventeen assertions, thirteen gate states, all discriminating:
        unsolved 12 failed · two structurally different solutions 17/17 each ·
        stars reused but portrait hand-rolled 2 · class name without the
        component 2 · stars redrawn inline 2 · sibling restyled 1 · sibling
        token retuned 1 · schema extended 1 · dependency 1 · literal hex 1 ·
        `useState` 1 · stories file 1.
  - [x] `816-typography-pairing` (`article-teaser`) — the design-tokens server's
        `typography-pairing` rule made executable: four type categories, each
        with its own family, sizes and line heights, and a defect that crosses
        them (a display-sized title on a copy line-height, a reading time in the
        display face). Nothing else in the suite grades type as a system rather
        than as individual values.
  - [x] D-110 — **an assertion satisfiable by flattening everything to one value
        needs an anti-degenerate pin beside it.** "Each piece of type is set from
        a single category" is satisfied perfectly by setting the whole card to
        `--ks-font-copy-m`, which destroys the hierarchy the component exists to
        express. Three pins hold the shape — the title still reads as display,
        the kicker and reading time as interface, the excerpt as the copy it
        already was — and the gate's flatten-everything state fails exactly
        those three. Lesson (ag). Fourteen assertions, eleven states, all
        discriminating.
  - [x] D-111 — **two gate states passed while testing nothing.** `816` state F
        ran a `perl -pi -e` against a string that is not in the file and reported
        a clean 14/14 — a false all-clear on the "component untouched"
        assertion. State K's chained `perl` mangled the stylesheet instead of
        editing it. Both were re-run as `python3` heredocs carrying
        `assert old in t`, after which they failed 1 and 2 respectively. Every
        mutation since asserts its target exists before writing. Lesson (ad): a
        gate state that passes may be testing nothing, so check the mutation
        landed.
  - [x] D-112 — **a rubric earns the composite one at a time, by hand.**
        `Rubric.calibrated` gates whether a rubric's verdicts move the score.
        `design-intent`, `token-reasoning` and `code-idiom` are flagged true;
        `api-design` is false. The judge is still asked all four, the verdicts
        are still cached, and reports still show them — `lib/graders/judge.ts`
        drops uncalibrated rubrics from the scoring set and labels their checks
        `uncalibrated, not scored`. Without the flag, `api-design` would start
        carrying weight the instant `824` runs, on the strength of a `requires`
        fix (D-100) that has never been tested against a human label — the same
        rubric that confabulated a schema on seven of forty-eight trials
        (D-102). `pnpm calibrate --report` prints `[not scored]` beside a rubric
        that has not been flagged, so a rubric sitting at 100% agreement and
        still not counting is visible rather than mysterious. Clearing the bar
        and being believed are deliberately two separate acts.
  - [x] `824-api-from-behaviour` (`progress-steps`) — written and through the
        ADR 53 gate (ADR 75). The brief describes behaviour and ships no schema, so
        the agent designs the surface and writes it. This is what re-enables
        `api-design`, which disabled itself once it was correctly stopped from
        grading fixture-authored schemas (D-102). Verified that `untouched()`
        returns `false` for a file the fixture never shipped, so the D-100
        authorship gate treats this schema as the agent's and the rubric activates
        here and nowhere else.
        The brief pins exactly one thing — steps arrive as `steps`, each with a
        label — because the runtime and a11y checks must render the component
        without knowing its API, and because a brief that names the data it
        displays is what a real one does. Whether step state is an enum or
        scattered booleans, whether "current" is an index or a per-item flag,
        what is required versus defaulted: all left open, because those are the
        decisions the judge is there to read and asserting them here would
        pre-empt it and turn the task back into 810.
        It is the only target with an empty `schemaProperties`, which
        `component-contract` already guards for.
        Gated in six states, one more than any previous fixture: unsolved 10 failed
        / 2 ok · solved A (per-item `status` enum) 12 passed · **solved B
        (`currentStep` index) 12 passed** · anti-pattern (`useState` + literal
        colour) 2 failed · over-required schema 1 failed · stub schema 2 failed.
        The sixth state is the point — with no single right answer, the risk is an
        eval that rewards the API its author imagined, and that defect is invisible
        in the results because the arms that lose look like they wrote worse code
        rather than different code.

- [x] 3.2 Author `86x` negative/restraint tasks
  - [x] `861-token-restraint` — a `Quote` whose byline uses the display text
        colour instead of the copy colour. One token is wrong; the stylesheet
        around it carries three things a token catalogue invites an agent to
        "improve": a `#000000` inside `@media print`, commented as signed off
        because the PDF renderer drops custom properties; a `19px` in a legacy
        modifier kept for pre-relaunch content; and assorted hand-set values.
        Aimed at the design-tokens MCP, which the campaign found never flips a
        task — whether it induces scope creep is the question `860` was too easy
        to ask. `mcpUseExpected: false`, `diffTask: true`.
  - [x] ADR 53 gate, ten states, all discriminating: unsolved fails only the two
        fix assertions; **both** legitimate fixes pass 13/13 (the fallback in
        `quote.scss`, and `--dsa-quote__author--color` in the token partial);
        and each of blanket `display`→`copy`, tokenising the print exception,
        deleting the legacy modifier, rewriting the partial, adding a
        dependency, adding a file, editing the component and editing the schema
        fails exactly one assertion — its own.
  - [x] D-105 — the added-file check is absolute. It first exempted `*.test.*`,
        `*.spec.*` and `*.stories.*` on the theory that writing tests is good
        practice; the gate then showed that state passing 13/13. The exemption
        was suppressing the most likely positive signal, since
        component-builder ships `get-storybook-template` and the arm holding it
        is the one most likely to leave an unrequested story behind. A restraint
        task that exempts the artefacts an MCP hands out is blind to the effect
        it exists to measure.
  - [x] `862-api-freeze` — a published `Rating` that floors its value; the
        half-star rule already ships in the stylesheet, commented as
        designed-but-unrendered, and the schema already documents `value` as
        fractional. The fix is `860`'s idiom, use what is already there. The
        fixture is deliberately off-house-style in the ways the
        component-builder templates would correct: `kind` where the design
        system says `variant`, props and defaults inline rather than split into
        `RatingProps.ts` / `RatingDefaults.ts`, no `index.ts`. The brief freezes
        the API and says why — three products import it and two destructure
        `kind` by name. `mcpUseExpected: false`, `diffTask: true`.
  - [x] Premise checked against Phase 1 artefacts rather than assumed. On `832`
        and `840` the component-builder arms emit `XComponent.tsx` +
        `XProps.ts` + `XDefaults.ts` + `_x-tokens.scss` + `js/` where `none`
        emits `x.tsx` + `index.ts`; on greenfield that is conformance and most
        of why the arm scores. Unrequested `*.test.tsx` appears in **all** arms,
        so test-writing is a baseline habit and not an MCP effect. What no task
        yet asked is what the same template pressure does to a component that
        already exists — which is what `862` measures.
  - [x] ADR 53 gate, eleven states, all discriminating: unsolved fails only the
        two behaviour assertions; **both** correct solutions pass 15/15 (a
        rounded-to-nearest-half helper, and per-star remainder thresholds); and
        each of renaming `kind`→`variant`, adding an `allowHalf` prop,
        extending the schema, editing the token partial, splitting into
        `RatingProps.ts` + `index.ts`, adding a dependency, rounding the
        accessible name, dropping a stylesheet selector and rendering an extra
        star fails exactly one assertion — its own.
  - [x] `860`'s added-file check tightened to match (D-105). Reading the Phase 1
        artefacts first: all twelve `860` trials returned exactly the five
        shipped entries, so the exemption never fired and removing it cannot
        change a recorded verdict. Free to do, and it closes the same blind spot
        before the Haiku campaign.
- [x] 3.3 Add `REFERENCE/` gold implementations (never mounted into the sandbox)
  - [x] `814`'s hand solution kept at
        `lib/eval-harness/reference/824-api-from-behaviour/` — outside `evals/`,
        because everything in a fixture except `EVAL.ts` and `PROMPT.md` is
        uploaded and a reference solution shipped beside the task is the answer key.
  - [x] `861`'s at `lib/eval-harness/reference/861-token-restraint/` — the two
        stylesheet files, a one-line diff from what ships. For a restraint task
        the reference is mostly a record of how small the correct change is.
  - [x] `862`'s at `lib/eval-harness/reference/862-api-freeze/` — the component
        only; the eleven-line diff is confined to the star loop.
  - [x] **All twenty now have one.** `lib/eval-harness/reference/` has an entry
        per eval, each one gated to a full pass in a throwaway copy of its
        fixture before being saved. The last five were the ones written after
        Phase 1 had already bought their numbers — `811`, `812`, `810`, `832`,
        `840` — and writing them found nothing wrong with any of the five, which
        is the outcome you want from a task that has already been paid for.
  - [x] `811`'s reference took two attempts, and the first failure was the
        interesting one: `.dsa-stat__label` paired an `interface` font size with
        `--ks-text-color-copy`, and `categoryMixes` counts `color` declarations
        among the partners it category-checks. The assertion was right and the
        reference was wrong. That is the assertion doing its job on its own
        author.
  - [x] `812`'s reference is the one place a reference argued with an assertion
        and lost on purpose. Putting the variant token overrides in
        `_alert-tokens.scss` — a defensible split — fails "the variants remain
        visually distinguishable", because that check reads `alert.scss` only.
        The check is therefore stricter than its name: it constrains _where_ the
        variants live, not just that they exist. Phase 1 ran this eval across
        all four arms without tripping it, so it is a latent false negative
        rather than a live one, and it is recorded here rather than loosened —
        base defaults in the partial, variants in the stylesheet is the split
        the design system actually uses. **Superseded by D-115:** once D-113 and
        D-114 had already invalidated the fingerprint, the fix became free and
        the check was widened to read the stylesheet and the partial together.
- [x] 3.4 Implement the LLM judge rubrics — one isolated call per dimension (D-94, D-95)
- [x] 3.5 Pin the judge model — dated id, verified against the API (D-96)
- [ ] 3.6 Hand-grade ≥20 trials as the calibration set
  - [x] Harness built: `pnpm calibrate` (blind grading), `--report`, `--status`
  - [x] Sped up for the long haul: ANSI syntax highlighting and a nine-entry
        pick list of recurring diagnoses, both driven by what the first ten
        notes actually said (D-118)
  - [ ] **The binding number is per rubric, not the total.** At 10/153 the
        split is `design-intent` 4, `token-reasoning` 4, `code-idiom` 2 — and
        with 4 labels agreement can only be 0/25/50/75/100%, so the 80% gate in
        3.7 is not expressible, let alone measurable. Each rubric needs 15–20.
- [ ] 3.7 Measure judge/human agreement; iterate rubrics until ≥80%
- [ ] 3.8 Enable the judge's 15% weight in the composite score — **bump `WEIGHTS_VERSION` to `"2"` (D-97)**
  - [x] Scope fixed at **three rubrics**: `design-intent`, `token-reasoning`,
        `code-idiom`. `api-design` is gated out until `824-api-from-behaviour`
        has run and produced material to calibrate it against (D-112).
- [ ] ~~3.9 Add the second agent to the matrix (D2)~~ — **postponed out of Phase 3.** Phase 3 continues on Claude alone. A second agent doubles the cost of
      every campaign and answers a question nobody is asking yet; the open
      question in front of us is whether a cheaper Claude does as well, not
      whether a different vendor does.

### 3.4/3.5 — what was built

**Decided (D-94): the judge runs on the host, retroactively, not in the sandbox.**
PRD §7.3 specifies a `toSatisfyCriterion` assertion inside `EVAL.ts`. That makes
the rubric part of the fingerprint, so one lap of "iterate until ≥80% agreement"
costs a full capability matrix — ~$250 and sixty agent runs. Host-side, a lap
costs cents and replays over the sixty trials that already exist. ADR 72.

**Decided (D-95): only `bin/judge.ts` can spend; `lib/graders/judge.ts` can only
read.** The CLI is dry by default (`--apply` to spend) and caches verdicts to
`judge.json` beside each trial, keyed by model id + criterion hash — so editing
one rubric re-runs one rubric. The grader makes no network calls at all, which
keeps `npm run grade` free by construction rather than by discipline.
Un-judged trials report `applicable: false`; `qualityScore` renormalises, so
registering the grader changed no existing score.

**Decided (D-96): a tier is not a pin.** `agent-eval.config.ts` has
`JUDGE_MODEL: ModelTier = "opus"`, which resolves to whatever is current at call
time — fine for the agent under test, wrong for the instrument measuring it.
`lib/judge/run.ts` names a dated release, and the dry run verifies it against
`/models` before spending. That check paid for itself immediately: the first
pinned id did not exist on this account. The dated pin is deliberately not the
newest model — the current flagship ships only as an undated alias.

Two findings from the first free dry run, before any spend:

- 192 rubric calls over 48 trials, not 240 over 60. The twelve missing are the
  `860-restraint` trials across all four arms, where the correct behaviour is to
  produce nothing — so there is nothing to judge. The judge inherits ADR 54/61's
  rule via `discoverGraded()`: it is only ever shown files the agent authored.
- The `token-reasoning` rubric was 15.3K input tokens against ~1.5K for the other
  three, all of it the same 1457 semantic token names repeated on every call.
  Moving it to a cached system block took the campaign estimate from **$23.83 to
  $14.92** with no change to what the judge sees.

**Open (D-97): enabling the judge's 15% weight will move every historical
composite score.** `WEIGHTS_VERSION` exists for exactly this and must go to
`"2"` when 3.8 lands. Phase 1's matrix is explicitly _not_ being kept comparable
— the next campaign swaps Sonnet for Haiku anyway, so the composite is being
re-baselined rather than preserved.

### First campaign judged — what the verdicts said about the rubrics

192 calls over 48 trials, **$7.63 actual against a $14.92 estimate** (the
estimator charges `MAX_TOKENS` output on every call; real output averaged ~100
tokens, not 700 — it errs conservative, which is the right direction for a
number shown before spending).

| rubric            | pass / fail / unknown | verdict                        |
| ----------------- | --------------------- | ------------------------------ |
| `token-reasoning` | 35 / 10 / 3           | **discriminates**              |
| `api-design`      | 46 / 2 / 0            | near-saturated                 |
| `design-intent`   | 48 / 0 / 0            | zero variance — no information |
| `code-idiom`      | 8 / 0 / 40            | unanswerable as posed          |

`token-reasoning` per arm — `none` 3/9/0 · `design-tokens` 10/1/1 ·
`component-builder` 10/0/2 · `both` 12/0/0 — is monotonic in the same direction
the deterministic `token-conformance` grader already found (+0.43/+0.33/+0.46/
+0.46), and its three `none` passes are all `860`, where there is nothing to get
wrong. Two independent instruments agreeing is the strongest evidence available
that the rubric reads something real.

**Fixed (D-98): `buildPrompt` gated every rubric on the component existing**, so
all twelve `812-restyle-with-tokens` trials were skipped — a diff task where the
agent edits only the stylesheet, and the one task in the suite that is purely
about token choice. The rubric best qualified to judge it was the one that
refused to look. Each rubric now tests whether _its own_ material is present,
which also gets `api-design` right for free: a restyle has no public API to
judge, so it is still correctly skipped.

**Decided (D-99): three of four rubrics asked a comparative question and were
given nothing to compare against.** `token-reasoning` was the only rubric that
discriminated and the only one handed a corpus — the 1457 token names. Its
`include.tokenNames` was doing the work all along. `code-idiom`'s 40 `unknown`s
are the escape hatch functioning exactly as designed; the criterion told the
judge to answer `unknown` when it could not see the surrounding code, and it
could not. `design-intent` did not say `unknown` — it said `pass` 48 times,
which is the same failure in a nicer suit.

Fix: `lib/judge/corpus.ts` supplies real components from
`packages/design-system/src/components` to both comparative rubrics, and their
criteria were rewritten to judge _against the references_ and to fail a
candidate that is competent but foreign. **Exemplars must never be an eval's
target component** — showing the judge our own `badge` while grading an agent's
`badge` stops measuring idiom and starts measuring reproduction of our answer;
`referenceCorpus()` enforces this against `TARGETS` rather than trusting the
list, since the suite is going to 20–30 tasks. `button` and `breadcrumb` were
chosen for coverage: 7 files, ~3.4K tokens, cached like the token list.

This is the second dividend of D-94's host-side placement: the corpus is the
real design system, which the sandbox could never have supplied — it deliberately
contains only a cut-down vendored slice.

### Re-judged with the corpus — the fix worked, and exposed the next defect

132 calls, $10.09 across all cached verdicts. Both broken rubrics came alive, and
both are monotonic across arms in the same direction as the deterministic
graders:

| rubric            | before (p/f/u) | after       | `none` | `design-tokens` | `component-builder` | `both` |
| ----------------- | -------------- | ----------- | ------ | --------------- | ------------------- | ------ |
| `design-intent`   | 48 / 0 / 0     | 42 / 18 / 0 | 3/12/0 | 9/6/0           | 15/0/0              | 15/0/0 |
| `code-idiom`      | 8 / 0 / 40     | 28 / 32 / 0 | 2/13/0 | 3/12/0          | 14/1/0              | 9/6/0  |
| `token-reasoning` | 35 / 10 / 3    | 43 / 12 / 5 | 3/11/1 | 13/1/1          | 12/0/3              | 15/0/0 |
| `api-design`      | 46 / 2 / 0     | 46 / 2 / 0  | 12/0/0 | 12/0/0          | 11/1/0              | 11/1/0 |

`design-intent` now fails every non-`860` baseline trial and passes every
`component-builder` and `both` trial — its three `none` passes are exactly the
three `860` restraint trials, where nothing is produced to be foreign. Zero
variance became the cleanest separation in the set, from a corpus that cost
~3.4K cached tokens. `code-idiom` independently reproduces campaign finding (3):
`both` (9/6) is worse than `component-builder` alone (14/1).

**Fixed (D-100): `discoverGraded` is a diff-task filter, not an authorship
filter.** It hides untouched files only when `diffTask` is set; on the other
three tasks it returns whatever is on disk. `buildPrompt` trusted it as an
authorship filter — its docstring said "only files the agent actually changed",
which was false — and so `api-design` judged a **fixture-authored schema on all
36 trials that had one**. Zero of forty-eight schemas it saw were written by an
agent. Its 46/2 was measuring the quality of our own fixture files, graded
identically in every arm, which is exactly why the baseline passed 12/12.

An audit of every file kind the judge is shown confirms the other three rubrics
are clean — component and styles are agent-written on 12/12 trials wherever they
appear, so the `design-intent`, `code-idiom` and `token-reasoning` results above
stand. `buildPrompt` now gates every file on `untouched()` regardless of task
type, and `api-design` was rewritten to judge the props the author actually
defined, with the reference APIs to compare against.

This is the ninth time an eval defect has produced a plausible-looking number
rather than an obvious failure, and the second time in this phase that the
mechanism was "shown material the agent did not write" (ADR 54, ADR 61). The
rule needs restating in the strongest form: **ask of every artefact the grader
touches whether the agent authored it — `diffTask` is not the question, and no
helper answers it for you except `untouched()`.**

**Fixed (D-101): the verdict cache was keyed on criterion text alone.** `include`
is not part of that hash, and neither is `buildPrompt`. Adding the corpus to a
rubric, or fixing which files it sees, changes what the judge is shown while
leaving the criterion byte-identical — so the cache would have gone on serving
verdicts formed from different material with nothing to indicate it. Entries now
carry a `promptHash` over the system prompt, cached context and per-trial prompt.
A cache key must cover everything that changes the answer, not the part that is
easiest to hash.

### `api-design` withdrawn — the fix for D-100 made it worse (D-102)

Re-judging the 48 schema-bearing trials with the contamination removed produced
41 pass / 7 fail, and the failures do not line up with any other signal —
`design-tokens` (8/4) scores below the ungoverned baseline (9/3). Reading the
seven reasons explains why. Every one of them is a fabrication:

| the judge's claim                                                                    | the actual fixture schema                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `832` types `content` with `format: "markdown"`                                      | no `format` key exists; plain `string`                              |
| `832` component renames `label`→`summary`, `body`→`content`, "breaking the contract" | the schema's names **are** `summary`/`content` — it matched exactly |
| `840` defines `cta` as an object with `label`/`icon`                                 | flat `actionLabel`/`actionIcon`                                     |
| `840` uses `action.label`/`action.icon`, and `action.url` is missing                 | no nested object exists at all                                      |
| `840` marks `dismissLabel` required                                                  | `required` is `["headline", "message"]`                             |
| `840` defines `actionUrl`, which the component omits                                 | there is no `actionUrl`                                             |

Three of those descriptions are mutually exclusive accounts of one unchanging
file, which is what makes the diagnosis certain rather than probable. Twice the
judge failed a component for _correctly implementing_ the schema.

The cause is D-100's own fix. The briefs say "its props are already specified in
`<name>.schema.json` — treat that schema as the source of truth", and the
authorship gate then withheld that file because the agent had not written it.
The judge was told an authoritative document existed, was not shown it, and
filled the gap instead of abstaining. **Withholding evidence is not neutral when
the prompt still points at it** — the contaminated version merely graded our own
fixture, which was uninformative but inert; the corrected version invents a
fixture and marks correct work wrong, which is worse than no rubric at all.

Three changes, none of which cost anything:

- Rubrics may now declare `requires`. `api-design` requires an agent-authored
  schema, so it asks nothing on a trial that lacks one — and since no task in
  the suite has the agent write a schema, it currently self-disables everywhere.
  `qualityScore` drops absent dimensions, so it simply leaves no trace.
- The system prompt now forbids reasoning about, or reporting a discrepancy
  against, any file not in evidence.
- The `judge` grader filters cached verdicts through `buildPrompt` instead of
  reading `judge.json` directly. A retired or narrowed rubric leaves its answers
  on disk — the file is the record of what was paid for and should not be
  rewritten — but those answers must stop scoring anything.

**The real finding is a gap in the task suite, not in the rubric.** No task asks
the agent to design an API: the schema is fixture-given on `810`/`832`/`840` and
absent on `812`/`860`, and `810` is explicitly "build this from the given
schema". `api-design` had nothing authored to judge on any of the twenty. It
stays in the codebase, disabled, until 3.1 adds a task whose brief describes
behaviour and leaves the surface to the agent. Until then the judge dimension is
three rubrics, all of which discriminate.

Two lessons, both generalisations of earlier ones. A judge shown _less_ than it
needs does not answer "unknown" by default — it confabulates, and a confabulated
comparison reads exactly like a real one, which is why the seven failures looked
like signal until the underlying file was opened. And a rubric with no authored
material to judge is not a rubric that is being strict; it is a question about
nothing, and the honest implementation refuses to ask it.

**The same root reaches the surviving rubrics, in a milder form (D-103).** An
audit of all 180 remaining verdicts for reasoning about unseen material found
`token-reasoning` clean (0/60), `design-intent` mostly benign (6/60, and those
cite visible evidence such as class prefixes and `forwardRef` usage), but
`code-idiom` faulting candidates 12/60 times for _absence_: "no JSON schema
file", "omits the separate `_badge-tokens.scss` partial", "no `*Defaults` file".
The material is not a directory listing — it is only what the agent hand-wrote —
and on `810`/`832`/`840` the schema demonstrably exists. This is the mirror of
D-102: rather than inventing a file's contents, the judge inferred its
non-existence, and both errors come of treating absence of evidence as evidence.

The system prompt now states that the material is not a listing, that an unseen
file was more likely withheld than missing, and that the author is never to be
faulted for a file's absence. The arm ordering is not in doubt — `code-idiom`
separates `component-builder` (14/1) from `none` (2/13) on plainly visible
grounds, the `dsa-` prefix and the Context/`forwardRef` pattern — but some
fraction of its failures rest on unverifiable absence claims, and quantifying
that fraction is exactly what 3.6/3.7 exist to do. Human labels will disagree
where the judge invented an absence.

Because `promptHash` covers the system prompt, this marks every cached verdict
stale. Nothing is re-bought now: the next campaign judges fresh trials from
scratch, so the guard lands there at no marginal cost, and the numbers above are
reported as what they are — measurements from the pre-guard judge, which agree
with the deterministic graders.

### 3.6 harness — labels are the expensive artefact, so they set the design

`pnpm calibrate` presents the material the judge was given and asks for the same
three-way verdict; `--report` gives agreement, Cohen's kappa, a confusion matrix
and every disagreement; `--status` shows coverage. It calls nothing and costs
nothing. Four choices are load-bearing, all of them consequences of what has
already gone wrong in this phase:

- **Labels live in `calibration/labels.json`, in the package and committed.**
  `results/` is gitignored, prunable and replaced every campaign, and
  hand-grading is the most expensive artefact in the project.
- **A label is keyed by rubric id and a hash of the material, never by the
  criterion text.** 3.7 is "iterate the wording until agreement holds", and if
  editing a criterion invalidated the grading, each attempt would cost twenty
  hand-gradings and the loop would simply not be run. The human is answering a
  question about the code; the criterion is the wording under test.
- **The human sees exactly what the judge saw, and the verdict is withheld until
  after the label is given.** Otherwise agreement measures the difference in
  evidence rather than in judgement, and a verdict shown first is an anchor. It
  is revealed immediately afterwards, while the code is still in mind, because
  the note written at that moment is the diagnosis.
- **The queue is stratified.** 153 units and a target of twenty means the choice
  of twenty decides the answer; pairs are bucketed by (eval, rubric, arm) and
  drawn round-robin in hashed bucket order, so stopping at any point leaves the
  grid evenly covered. Deliberately _not_ stratified by the judge's verdict —
  oversampling its failures would measure agreement where it struggled and
  report it as agreement overall.

**Caught while testing (D-104): five labels were being reported as fourteen
observations.** Trials frequently share byte-identical code — that is the entire
point of `860-restraint`, where the correct behaviour is to change nothing — and
because a label is keyed by material, one grading legitimately covers all of
them. Counting it once per trial would have let a sample of twenty report itself
as a sample of 180, which is the same species of error as the judge's own
fabrications: a number that looks like evidence and is not. Agreement is now
computed over distinct labelled units (153 of them, from 180 trial-rubric
pairs), using the judge's majority verdict where it answered the same material
more than once.

That fallout is worth keeping: identical input answered two different ways is
the judge's own noise floor, and no amount of rubric wording lifts agreement
above it. `--report` prints self-consistency wherever repeated material was not
answered uniformly.

**PRD deviation:** §7.3's in-sandbox placement is superseded by D-94. §5.4's
`judge: { model: "<pinned>" }` is honoured, but in `lib/judge/run.ts` rather
than `agent-eval.config.ts`, since the config's field is a tier.

## Phase 4: Quality Gate

**Exit criterion:** G3 — a deliberate quality regression is caught by CI.

- [ ] 4.1 Define suite membership (`capability` vs `regression`) per eval
- [ ] 4.2 Implement task graduation rule (`pass^5 = 1.0` across two consecutive full runs)
- [ ] 4.3 Create `baselines/<experiment>.json` with reviewed thresholds
- [ ] 4.4 Implement the baseline comparator (fail on pass-rate drop, fail on quality epsilon, warn on cost/duration >25%)
- [ ] 4.5 Add the CI workflow with label gating (`ci:eval`, `ci:extra-models`) — never auto-triggered
- [ ] 4.6 Implement the hard budget guardrail ($40/run — D6) with abort
- [ ] 4.7 Add the nightly regression tripwire on the primary variant
- [ ] 4.8 Establish the known-failure comment convention (observed behavior + CI run id + date + re-enable condition)
- [ ] 4.9 Run report-only for two full cycles, then flip to blocking (D11)
- [ ] 4.10 Link eval results from the release notes of both MCP packages (G7)

## Phase 5: Content Quality (post-v1)

Out of scope for this PRD — requires its own PRD covering `storyblok-mcp` content generation evals.

- [ ] 5.1 Write the content-quality eval PRD

---

## Notes & Deviations

_Recorded as implementation proceeds._

### P0

All five deviations below came out of reading the installed `@vercel/agent-eval@1.4.0` source rather than trusting the research summary. Each one would have been a silent failure, not a loud one.

**D-1 — `experiments/` must be flat.** The PRD's `experiments/baseline/…` layout does not work: `selectExperimentFiles()` reads only flat `.ts` files directly in `experiments/` and skips subdirectories without reporting anything. Experiments are now named `<agent>-<variant>-<model>-<effort>.ts`. PRD §5.2 corrected.

**D-2 — a `variantVersion` config field is impossible.** `validateConfig` parses through a `zod` object schema, which strips unknown keys, so an extra field never reaches the fingerprint. Replaced with an external guard: `defineExperiment()` hashes the staged MCP payload, stores it in `results/<experiment>/.variant-version`, and throws on mismatch unless `--force` is present. Two mitigating findings: reuse is scoped per experiment name (`scanReusableResults(resultsDir, experimentName, …)`), so variants cannot cross-contaminate; and the guard is computed, so it cannot be forgotten. ADR Decision 9 rewritten.

**D-3 — no MCP CLI flag.** `buildClaudeCodeCliArgs()` emits `--print`, optionally `--allowedTools`/`--model`/`--effort`, always `--dangerously-skip-permissions`, and the prompt. Nothing else. MCP wiring therefore goes through `.mcp.json` plus `.claude/settings.local.json` with `enableAllProjectMcpServers: true`, both written by `setup()`. Without the settings file the servers are declared but never started, and the variant silently degrades into the baseline. New ADR Decision 14. The stdio launcher scripts (0.6, 0.7) are unnecessary.

**D-4 — design system installed from npm, not packed.** `@kickstartds/design-system` is published publicly, and `Sandbox.writeFiles()` only accepts UTF-8 strings, so a tarball is both unnecessary and awkward to transfer. The fixture pins the version in `packages/design-system/package.json` so it stays in lockstep with the tokens `design-tokens-mcp` synced at build time. ADR Decision 3 revised; item 0.9 dropped. The P0 fixture has no design-system dependency at all — it is React + TypeScript only, to keep the first run cheap. It gets added in P1 when toolchain graders need to compile against it.

**D-5 — workspace dependencies must be vendored.** The first `eval:dry` failed on `@kickstartds/shared-auth`, a `workspace:*` dependency of both MCP servers that is `private: true` and on no registry. `lib/mcp/stage.ts` now walks the dependency graph, stages workspace deps under `.mcp-servers/_vendor/`, and rewrites them to relative `file:` specifiers. New ADR Decision 13.

**Also worth flagging:** `earlyExit` defaults to `true` in `CONFIG_DEFAULTS`. Left at the default, every multi-run experiment stops after the first pass — `runs: 3` would silently behave as pass@1-with-retries and `pass^k` would be unmeasurable. `agent-eval.config.ts` overrides it to `false` with a comment explaining why.

**D-6 — the harness captured no transcript.** The first real run returned `transcript: null` and `observedModel: null` for all three trials; no `transcript.json` or `transcript-raw.jsonl` was written, and `result.json` held only `{status, duration, model, outputPaths}`. Upstream's `captureClaudeTranscript()` reads one hard-coded path and swallows every failure. Since cost, efficiency and MCP usage are all read out of the transcript, `EVAL.ts` now captures it itself and writes `agent-transcript.jsonl` + `agent-transcript-meta.json` into the workspace, where `captureGeneratedFiles()` (which runs after validation, via `git add . && git diff HEAD`) picks them up. New ADR Decision 15. The block is duplicated per fixture deliberately — only `EVAL.ts`, `EVAL.tsx` and `PROMPT.md` are withheld from the agent, so a shared helper would reveal that we read its tool calls.

**D-7 — timeout raised 900s → 1200s.** The slowest baseline trial took 653s against a 900s ceiling, and MCP variants can only be slower. A timeout kill wastes a full trial's spend, so the ceiling now sits well above the observed mean. `timeout` is fingerprinted, but the `EVAL.ts` change already invalidates cached results, so this cost nothing extra.

**Verified — no test leakage.** `splitTestFiles()` withholds `EVAL.ts`/`EVAL.tsx`/`PROMPT.md` from the upload and `verifyNoTestFiles()` asserts their absence before the agent starts; they are restored for validation afterwards. Their presence in `run-N/project/` is post-hoc, not a cheating vector. The prompt reaches the agent as a CLI argument, not as a readable file.

### First measured data point — baseline (`cc-none-sonnet-high`, 810-atom-from-schema)

Two runs, both 0/3. The second run had working transcripts and is the one to cite.

| Trial | Component            | Styles                           | Client behaviour | Duration | Web research           |
| ----- | -------------------- | -------------------------------- | ---------------- | -------- | ---------------------- |
| 1     | `BadgeComponent.tsx` | `badge.scss`                     | none             | 1026.9s  | no                     |
| 2     | `badge.tsx`          | `badge.scss`                     | none             | 304.4s   | no                     |
| 3     | `BadgeComponent.tsx` | `badge.scss`, `_badge-vars.scss` | none             | 609.9s   | 2 searches, 19 fetches |

Failing in all three: `{Name}Component.scss` naming, `.client.ts` existence, purity (React state used for dismiss), `forwardRef`, client-side dismiss, design tokens instead of literal colours. Only "the provided schema is left untouched" passes. Every trial also produced files the contract does not describe — `index.ts`, `badge.test.tsx`, `typing.ts`, `BadgeProps.ts`.

The baseline has large, consistent headroom on exactly the dimensions the MCP servers address, and the failure set is stable across trials while the _route_ to it is not — which is why `runs: 3` and `earlyExit: false` matter.

Transcript-derived, per trial: 45–94 assistant messages, 37k–89k output tokens, 2.2M–5.7M cache-read tokens, 0 MCP tool calls (as expected for `none`, and the first real evidence for the P1 `negative-usage` grader).

**D-8 — the baseline was reaching the internet for kickstartDS source.** Trial 3 searched for kickstartDS component conventions and fetched the docs site plus raw `TagLabelComponent.tsx` and `tag-label.scss` from the GitHub `next` branch. That is the knowledge the Component Builder MCP encodes, so the control was partially self-serving — and intermittently, which inflated variance in quality, cost and time simultaneously (609.9s with research vs 304.4s without). `setup()` now writes `permissions.deny: ["WebSearch", "WebFetch"]` for every variant. New ADR Decision 16. Enforcement under `--dangerously-skip-permissions` is unverified; item 0.21 checks the tool histogram, and the fallback is a `PreToolUse` hook.

**D-9 — `variantVersion` now covers all of `setup()`, not just staged packages.** The baseline stages nothing, so its package hash is constant and a change to the deny list would have been invisible to the Decision 9 guard — stale results would have been reused as if the control had never changed.

**Confirmed — D-7 was not premature.** Trial 1 took 1026.9s. Under the old 900s ceiling it would have been killed and its spend lost.

**Confirmed — transcript capture works.** `found: true` on all three trials, sourced from `/home/node/.claude/projects/-home-sandbox-workspace/<uuid>.jsonl`. Note the mismatch that defeated upstream: `HOME` is `/home/node` while the workspace is `/home/sandbox/workspace`.

**Resolved — 0.21 verified.** Third run (`2026-08-06T19-02-52.634Z`), 0/3, mean 310.7s. `toolCalls` across the three trials was `Bash`/`Read`/`Write`/`Edit` only — no `WebFetch`, no `WebSearch`, and no denial messages either, so the tools appear to be withheld from the toolset rather than blocked at call time. `--dangerously-skip-permissions` does not override `permissions.deny`; the `PreToolUse` fallback is not needed.

### Reference baseline (clean, `2026-08-06T19-02-52.634Z`)

This is the number P1 deltas should be measured against — the earlier two runs are contaminated and should not be cited.

| Trial | Component   | Styles      | Client | Duration | Asst msgs | Output tokens |
| ----- | ----------- | ----------- | ------ | -------- | --------- | ------------- |
| 1     | `badge.tsx` | `badge.css` | none   | 259.3s   | 33        | 44,419        |
| 2     | `Badge.tsx` | `badge.css` | none   | 395.9s   | 55        | 54,730        |
| 3     | `badge.tsx` | `badge.css` | none   | 276.8s   | 47        | 36,009        |

Still 0/3, but the failure profile got **worse and more consistent** once the web was closed: all three now emit plain `.css` rather than `.scss`, and the `{Name}Component` suffix disappeared entirely. That is the honest baseline — trial 3 of the previous run had been reproducing kickstartDS naming because it had read our source off GitHub. Mean duration also dropped from 647.1s to 310.7s, so the earlier timing numbers were measuring research, not generation.

All three trials again produced `index.ts` and a `badge.schema.json` re-emission; `mcpToolCallCount: 0` throughout.

**D-10 — the deny list does not cover Bash, and the sandbox has network.** Trials installed packages from the npm registry (`npm view jsdom`, `npm install -D jsdom @testing-library/react`, `react-dom@18.3.1`). Nothing fetched kickstartDS — the only `kickstartds` strings in the transcripts come from our own prompt and the fixture's `$id`, and run 1 searched the filesystem for a kickstartDS package and found none — so the control held in practice. But `npm pack @kickstartds/components` is not blocked in principle. Not worth closing yet: the registry is also how the agent gets a working toolchain, and P1 compiles against the real design system anyway. Revisit if a transcript ever shows a kickstartDS fetch.

**D-11 — the agent reads the harness runner.** All three trials opened `__agent_eval__/run.mjs`. It contains the CLI invocation, not the graders, so no assertion leaked — `EVAL.ts` is still withheld as verified earlier. Worth re-checking if upstream ever moves grading detail into that file.

## P1 findings

**D-12 — the P0 rubric graded a contract that does not exist.** `EVAL.ts`
asserted `{Name}Component.scss` and `{Name}Component.client.ts`; measured across
the 68 components of `@kickstartds/design-system`, neither pattern occurs once.
Both came from `.github/copilot-instructions.md`. The 0/3 baseline was therefore
partly a rubric artifact, and MCP variants would have been penalised for
following the Component Builder MCP's (correct) guidance. See ADR Decision 18.
**Action outstanding: correct `.github/copilot-instructions.md`.**

**D-13 — graders cannot live in the eval directory.** Only `EVAL.ts`,
`EVAL.tsx` and `PROMPT.md` are withheld from the agent; anything else uploaded
alongside the fixture is readable by the model under test. Graders are host-side
(ADR Decision 17), which also makes re-grading historical runs free.

**D-14 — the PRD's `style-placement` grader is inverted for this fixture.** "No
self-imported SCSS" is the website package's rule; the design system imports its
own stylesheet in 61/61 styled components. Graded as the design system does it.

**D-15 — absent dimensions are dropped, not zeroed** (ADR Decision 19), so the
composite score does not collapse toward zero while toolchain and judge graders
are unimplemented.

### Corrected baseline scores (`2026-08-06T19-02-52.634Z`, weights v1)

Re-graded host-side at zero spend. `pass@1` is still 0% — no trial met the file
contract — but the quality score now shows _how far off_ each trial was, which
is what deltas will be computed against.

| Metric             | Value  |
| ------------------ | ------ |
| pass@1             | 0.0%   |
| mean quality       | 0.31   |
| mean duration      | 310.7s |
| mean turns         | 45.0   |
| mean output tokens | 45,053 |

Per-grader means: `schema-validity` 1.00, `style-placement` 0.75,
`token-conformance` 0.50, `component-contract` 0.42, `purity` 0.08, `bem` 0.00,
`client-behaviour` 0.00. `ds-reuse` not applicable.

The consistent failures are the interesting part: every trial used `useState`
for dismissal (no client-behaviour file at all), invented token names
(`--space-3xs`, `--font-family-base`), emitted literal hex colours, and used a
`.c-badge` block instead of `.dsa-badge`. All four are exactly what the two MCP
servers exist to supply — a good sign for measurable headroom.

### Grader self-test floors

`pnpm graders:selftest` grades the real design system with the same graders and
fails below these measured floors: `component-contract` 0.75 (actual 0.86),
`purity` 0.60 (0.73), `token-conformance` 0.75 (0.95), `bem` 0.70 (0.92),
`style-placement` 0.75 (0.91).

### Spend decision pending

`EVAL.ts` now encodes the corrected contract, which changes the eval-directory
hash and therefore the fingerprint. Re-running the baseline requires `--force`
and is a human decision (D-11). The corrected _quality_ scores above needed no
re-run.

**D-16 — the baseline is not a blank slate; it is a _stale kickstartDS_ slate.**
Run-1 states its reasoning outright: _"I'll implement the Badge following
kickstartDS's real conventions (ITCSS/BEMIT class naming with `c-` prefix, CSS
custom property design tokens…)"_. And it is not hallucinating — `@kickstartds/base`
really does ship `.c-button`, `.c-tag-label`, `--c-mono-700`, `--c-font-inv`.
The model has genuine parametric memory of kickstartDS core and applies it in
place of this starter's `dsa-` namespace and `--ks-*` tokens.

Consequences for the experiment:

- The no-MCP control cannot be made truly naive. Denying web tools (D-8) removed
  _retrieval_, not _recall_. The floor is "kickstartDS as of the training cut",
  not "no knowledge".
- The MCP delta therefore measures **correcting stale, plausible knowledge**,
  which is a harder and more valuable claim than supplying absent knowledge — a
  confidently wrong prior is worse than no prior, because nothing in the output
  looks like a guess.
- Graders must not reward `c-`/`--c-*` as "close enough". They currently do not:
  `bem` scores 0.00 and `token-conformance` marks `--c-badge-text` unknown.

## Reference baseline (corrected gate) — `2026-08-06T19-43-51.781Z`

First run under the corrected `EVAL.ts` contract. 0/3, and now a _fair_ 0/3: the
gate asserts files that exist in the design system.

| Metric             | 19-02 (old gate) | 19-43 (corrected gate) | Δ      |
| ------------------ | ---------------- | ---------------------- | ------ |
| pass@1             | 0.0%             | 0.0%                   | —      |
| mean quality       | 0.310            | 0.297                  | −0.013 |
| mean duration      | 310.7s           | 473.7s                 | +52%   |
| mean turns         | 45.0             | 81.7                   | +82%   |
| mean output tokens | 45,053           | 56,549                 | +26%   |

**D-17 — quality is low-variance; time and cost are not.** Across six
independent trials the composite quality score spans 0.29–0.33 (two sample means
0.310 / 0.297), while duration spans 259–633s and turns 33–117. Two consequences
for the design of the comparison:

- Quality deltas are measurable at n=3. A variant that moves the composite by
  more than ~0.05 is almost certainly a real effect.
- Time and cost deltas are **not** measurable at n=3 and must be reported with
  that caveat, or with more runs. This is the first hard evidence for revisiting
  D-9 (runs per task) in item 1.19 — and it argues for splitting the run count
  by dimension rather than raising it uniformly.

**D-18 — more effort does not buy quality in the baseline.** Run-2 of 19-43 spent
633s, 117 turns and 53 shell commands, building `css.d.ts` and `typing.ts`
scaffolding, and scored 0.29 — identical to run-1's 58 turns. Turn count is
therefore not a proxy for quality, and an MCP that reduces turns while holding
quality is a real win that a pass/fail gate would show as "no change".

### Stability of the failure modes (6/6 trials)

| Grader               | 19-02 | 19-43 | Reading                                                                             |
| -------------------- | ----- | ----- | ----------------------------------------------------------------------------------- |
| `schema-validity`    | 1.00  | 1.00  | The supplied schema is always honoured — nothing to recall, so nothing to get wrong |
| `component-contract` | 0.42  | 0.43  | Naming is consistently off-contract                                                 |
| `token-conformance`  | 0.50  | 0.66  | Improved; hex literals appeared in 1 of 3 rather than 3 of 3                        |
| `style-placement`    | 0.75  | 0.58  | Noisy — one trial did not import its own stylesheet                                 |
| `purity`             | 0.08  | 0.00  | `useState` in 6/6                                                                   |
| `bem`                | 0.00  | 0.00  | `.c-badge` in 6/6                                                                   |
| `client-behaviour`   | 0.00  | 0.00  | No client file in 6/6                                                               |

`bem`, `purity` and `client-behaviour` are at the floor in every trial. These are
precisely the three conventions the two MCP servers exist to communicate, and
they have zero baseline noise — so any movement in them is attributable.

## Fixture provisioning — the confound we were measuring

**D-19 — the baseline was penalised for a dependency we forgot to install.**
Every one of the 6 graded trials wrote `badge.css` rather than `badge.scss`, and
`component-contract` and `style-placement` both scored it as a miss. Run 1 of
the corrected baseline states the reason in its own transcript:

> _"no existing components to mirror (this is a bare fixture), no Sass/Storybook/testing-library
> installed, and only React + TypeScript + Vitest are available. I'll implement the Badge
> following kickstartDS's real conventions (ITCSS/BEMIT class naming with `c-` prefix, CSS
> custom property design tokens, React-hooks-based interactivity) using only plain CSS since
> Sass isn't installed."_

The agent did not fail to follow the convention; it correctly observed that the
convention was unavailable and adapted. We were measuring our own fixture.

The fixture now declares `sass`, `jsdom`, `react-dom`,
`@testing-library/react`, `axe-core`, `typescript` and `vitest`. Declaring them
is the entire fix: the framework's agent definition runs `npm install` in the
workspace as its first install step, before the agent starts
(`claude-code/agent.js`, `install()`). This also unblocks 1.8 and 1.10, which
need a compiler and a DOM respectively.

A first attempt added an explicit `installFixtureDependencies()` to `setup()`
and a fixture `.gitignore`. Both were reverted as redundant — the framework
installs project dependencies already, and `initGitAndCommit` writes a
`.gitignore` containing `node_modules/` before `setup()` runs. Worth
remembering: reach for the framework's own lifecycle before adding a step to
`setup()`.

**Consequence: baselines A and B are both retired.** They measured a
differently-provisioned fixture and are not comparable to anything produced from
here on. The next matrix run establishes the reference.

**D-20 — provisioning is per eval, and follows what the task actually needs.**
The first version of this note said the design system must never be installed
for the core matrix. That was too broad, and only looked right because the one
eval we have is an atom.

The distinction is between two different missing inputs. A compiler is table
stakes — withholding it tests whether the agent can guess its environment, which
is not the question. The design system is the answer key for _convention_ — 68
worked examples of exactly what the MCP servers exist to transmit — so for a
task that composes nothing, installing it collapses the MCP delta for reasons
that say nothing about the servers.

But a task that _must_ compose (a card containing a Button, a form containing
Inputs) is impossible without it, and `ds-reuse` — the grader that checks the
agent delegates instead of hand-rolling `<button>` — has nothing to measure.
So:

| Eval kind                     | Design system | What the MCP delta means there              |
| ----------------------------- | ------------- | ------------------------------------------- |
| Atom (`810-atom-from-schema`) | absent        | does the agent _know_ the conventions       |
| Composition (1.17)            | present       | does the agent _find and reuse_ what exists |

Both are real questions. They must be reported separately rather than averaged,
because a single number over the two would hide which one moved. `ds-reuse`
already returns not-applicable when `delegatedElements` is empty, so the grader
layer needs no change — only the new evals' `package.json` and target entries.

**D-21 — story grading (1.9) defers to P2.**
`PROMPT.md` does not ask for a story, and grading an artifact the task never
requested measures instruction-guessing rather than capability. The PRD's
requirement — _"we want to be able to inspect a generated component wrapped
inside of a Storybook instance"_ — is P2 "Static Artifacts", which is where both
the Storybook harness and the prompt change to request stories belong.

**D-22 — the two single-MCP variants are the attribution mechanism.**
`cc-component-builder-sonnet-high` and `cc-design-tokens-sonnet-high` complete
the 4-variant matrix. The baseline's per-grader profile predicts where each
should show up: the component builder owns `bem`, `purity` and
`client-behaviour` (all at 0.00 across 6/6 trials), the tokens server owns
`token-conformance` (0.50–0.66, agent invents plausible token names). If `both`
beats neither single server on its own dimension, the servers are interfering
rather than composing — which is itself a finding worth having.

**Setup changes are now covered by the variant guard.** `FIXTURE_SETUP_VERSION`
feeds the `variantVersion` hash, because _whether we install the fixture_ lives
in `setup()`, which the framework's fingerprint cannot see. The dry run confirms
both existing experiments are now correctly flagged as stale and require
`--force`.

## D-23 — `--smoke` deletes its own results

`housekeeping.js` treats a smoke result exactly like an incomplete one:

```js
if (isComplete(dir) && !isSmoke(dir) && !isNonModel) {
  keep;
} else {
  rmSync(dir, { recursive: true });
  stats.removedIncomplete++;
}
```

`isSmoke()` reads `summary.smoke === true` from `summary.json`. So `--smoke`
proves the pipeline executes end to end and then throws away the evidence —
it cannot be used to inspect generated artifacts, transcripts, or the
`toolchain-report.json` / `runtime-report.json` files the new graders read.
The "1 incomplete" line in the run summary is the deletion being reported.

**Use a real run of a single experiment instead.** It keeps its results, and
because it is a legitimate arm of the matrix rather than a throwaway, nothing
is wasted:

```bash
pnpm eval run cc-none-sonnet-high --force   # 3 runs, results retained
pnpm grade cc-none-sonnet-high
```

**Smoke pass of 2026-08-07 (results deleted by the framework, numbers from the
console output).** All four variants ran 1 eval each and all failed the gate,
which is expected — the contract gate has never passed. Durations, n=1 each,
so directional only:

| Variant             | Duration |
| ------------------- | -------- |
| `none`              | 5m 06s   |
| `design-tokens`     | 5m 50s   |
| `component-builder` | 7m 35s   |
| `both`              | 8m 39s   |

Every MCP variant is slower than the baseline, and the ordering matches the
tool counts (7 tools vs 29 vs both). Whether that is real or n=1 noise is
exactly what the matrix has to answer — but if it holds, "time" becomes a
dimension where the servers _cost_ rather than save, and the quality gain has
to justify it.

**Also worth fixing before the matrix:** the classifier is disabled
(`AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` unset), so the framework keeps
infra and timeout failures as if they were model failures. Our own
`classify()` in `lib/report/collect.ts` re-derives this host-side from the
transcript, so grading is unaffected — but the framework's own housekeeping
will not clean up non-model failures, and `passed` counts in its console output
are not failure-class-aware. Ours are.

## Reference baseline (upgraded fixture) — `2026-08-07T06-22-20.098Z`

`cc-none-sonnet-high`, 3 runs, 0/3 passed, 3 counted, 0 excluded, `invalid: false`.
**This supersedes baselines A and B**, which measured the under-provisioned
fixture (D-19).

| Metric             | Baseline B (cold) | Baseline C (toolchain) |
| ------------------ | ----------------- | ---------------------- |
| quality            | 0.297             | **0.52**               |
| mean duration      | 473.7s            | **323.6s**             |
| mean turns         | 81.7              | **48.0**               |
| mean output tokens | 56,549            | **51,338**             |

| Grader               | B     | C        |
| -------------------- | ----- | -------- |
| `schema-validity`    | 1.00  | 1.00     |
| `toolchain`          | —     | **1.00** |
| `style-placement`    | 0.583 | 0.75     |
| `token-conformance`  | 0.664 | 0.567    |
| `component-contract` | 0.429 | 0.571    |
| `purity`             | 0.00  | 0.00     |
| `bem`                | 0.00  | 0.00     |
| `client-behaviour`   | 0.00  | 0.00     |
| `a11y`               | —     | n/a      |
| `ds-reuse`           | n/a   | n/a      |

**D-24 — the fixture defect was costing 150 seconds and 34 turns per run.**
Quality up 75%, duration down 32%, turns down 41%. The agent is no longer
spending a third of its run installing its own toolchain, and `toolchain` is a
clean 1.00 across all three runs: everything written compiles, and the Sass
compiles. Baselines A and B measured our provisioning, not the model.

**D-25 — the a11y grader was double-counting a naming miss.**
All three runs wrote `badge.tsx` / `Badge.tsx` rather than `BadgeComponent.tsx`.
`EVAL.ts` looked the component up at the contract path, found nothing, and
reported `rendered: false` — so `a11y` scored 0.00 for a mistake
`component-contract` had _already_ penalised, and the runtime dimension carried
no information whatsoever.

Two fixes, both free:

- `EVAL.ts` now discovers the component and stylesheet **by role** (any
  non-test `.tsx` in the target directory, any non-partial stylesheet), so the
  execution dimensions ask "does what they built compile and render" rather
  than re-asking "is it named correctly".
- The host graders treat "nothing to render" / "nothing to compile" as
  not-applicable rather than a scored zero. Absence is the contract grader's
  finding; scoring it twice compresses every variant toward the same number.

Re-grading `2026-08-07T06-22-20.098Z` leaves quality at 0.52 — `client-behaviour`
still holds the runtime dimension at 0.00 — but a11y is now honestly `n/a`
instead of a fake zero, and the next run will produce real axe results.

**What the baseline still fails, and what should move it.** Three graders sit at
exactly 0.00 in 3/3 runs, and they map cleanly onto the two servers:

| Grader              | Failure                                                         | Expected mover    |
| ------------------- | --------------------------------------------------------------- | ----------------- |
| `purity`            | `useState` for dismiss; no Context override                     | component-builder |
| `bem`               | `.badge` / `.c-badge`, never `.dsa-badge`                       | component-builder |
| `client-behaviour`  | no `Badge.client.js` at all                                     | component-builder |
| `token-conformance` | invents `--space-2xs`, `--font-family-base`; 15–16 hex literals | design-tokens     |

Note `component-contract` is now the _only_ grader where the component-builder
server has to beat a partial score rather than a floor — everything else is
zero, which makes the delta unusually easy to read.

## First full matrix — `2026-08-07T06-58-27` — INVALID FOR ATTRIBUTION

| Variant             | quality | Δ     | time   | turns | out-tok |
| ------------------- | ------- | ----- | ------ | ----- | ------- |
| `none`              | 0.52    | —     | 323.6s | 48.0  | 51,338  |
| `design-tokens`     | 0.64    | +0.12 | 1.61×  | 1.80× | 1.53×   |
| `both`              | 0.70    | +0.18 | 1.68×  | 1.96× | 1.42×   |
| `component-builder` | 0.72    | +0.19 | 1.68×  | 1.44× | 1.75×   |

**D-26 — the agent bypassed MCP and read the servers off disk. All 9 MCP runs
are confounded.**

`mcp-usage` reported _"MCP servers were configured but never called"_ in 9/9
runs, and it was right — there is not a single `mcp__` call in any transcript.
What happened instead, verbatim from `cc-component-builder-sonnet-high/run-1`:

```
ToolSearch {"query": "get-ui-building-instructions"}  →  "No matching deferred tools found"
ToolSearch {"query": "component-builder"}             →  "No matching deferred tools found"
cat /home/sandbox/workspace/.mcp-servers/component-builder/dist/tools.js
cat /home/sandbox/workspace/.mcp-servers/component-builder/dist/resources.js
cd /home/sandbox/workspace/.mcp-servers/component-builder/dist && node -e "
  import('./handlers.js').then(h => h.handleGetUiBuildingInstructions())"
```

The MCP tools were never exposed to the agent. It found the staged servers on
disk, read their source, and **executed the handler functions directly as a Node
library**. Staging-directory access appears in all 9 runs (19–102 mentions each).

So the delta is real _content_ from our servers, but it measures **content
availability, not MCP tool use**. Every conclusion about the servers' value via
the protocol is unsupported by this run.

Two distinct defects, both ours:

1. **Staging location.** `setupVariant()` puts the servers in `.mcp-servers/`
   _inside the agent's working directory_. The payload the protocol is supposed
   to gate is sitting in the workspace, world-readable. `--dangerously-skip-permissions`
   means no permission layer stops it.
2. **The servers never registered.** Probed locally, `component-builder` answers
   `initialize` and `tools/list` correctly (7 tools), so the build is fine — the
   failure is in the sandbox wiring. No connection error appears in the
   transcript, and `.claude/settings.local.json` carries
   `enableAllProjectMcpServers: true` as intended. Root cause still unknown.

Defect 2 is the one that matters: had the tools been exposed, the agent would
have had no reason to go reading source.

**Fixes required before any further spend:**

- [x] Probe the staged server at **setup time** — pipe `initialize` + `tools/list`
      over stdio and throw if no tools come back. Converts a silent confound
      into a hard failure before the run costs anything.
- [x] Stage outside the working directory, and treat any read of the staging
      path as a **validity failure**, not a warning — `collect.ts` should mark
      such runs `invalid` so they cannot silently enter an aggregate.
- [ ] Consider HTTP transport: both servers support `MCP_TRANSPORT=http`. Start
      the server in `setup()`, then delete the source. A running process
      survives unlinking on Linux, and there is then nothing on disk to read.

**D-27 — what survives the confound.** Two findings are unaffected, because
they hold regardless of _how_ the content reached the agent:

- **`client-behaviour` is 0.00 in all 12 runs, every variant.** Every trial used
  `useState`; none produced a `Badge.client.js`. Even with the component-builder
  instructions read directly out of its own source, the agent did not adopt the
  vanilla-JS client-behaviour convention. That is a content problem in the
  server, not a delivery problem — and the most actionable result of the day.
- **`component-builder` alone (0.72) scores at or above `both` (0.70).** Adding
  the tokens server did not compose; `token-conformance` was already 1.00 under
  `both` and 0.96–0.99 under component-builder alone. Worth re-testing once the
  protocol works, but the hypothesis that more servers ≠ better is live.

Cost, also unaffected: every variant ran **1.6–1.7× longer** than baseline for
its quality gain, and `pass@1` remained 0% across all 12 runs.

**D-28 — the a11y probe crashes in Node 24.** `Cannot set property navigator of
#<Object> which has only a getter` in 9/9 runs where a component was found.
`globalThis.navigator` is a getter-only accessor; plain assignment throws. Needs
`Object.defineProperty`. Until fixed, `a11y` is 0.00 wherever a component exists
and `n/a` where none does — the inverse of useful.

### D-26 fixes landed (ADR Decision 22)

`lib/mcp/probe.mjs` — JSON-RPC liveness probe, run in-sandbox before the agent.
Verified against both real servers: `component-builder` lists 10 tools,
`design-tokens` lists 29, and a missing entry fails with the server's stderr
attached. Folded into the variant hash, so changing it forces a re-run.

`setupVariant()` — uploads to `.mcp-servers/`, installs, moves the tree to a
sibling of the workspace, probes at the final path, then writes `.mcp.json`
with absolute paths. `SETUP_VERSION` bumped to
`4-servers-outside-workspace-and-probed`.

`stagingLeakOf()` in `mcp-usage.ts` — scans **tool inputs only**, never tool
results, so an agent reading `.mcp.json` (which names the runtime directory in
its output) is not flagged. Configuration is not payload.

`FailureClass` gains `confounded`. Re-grading the first matrix at zero cost:

| Experiment                         | before                  | after                                  |
| ---------------------------------- | ----------------------- | -------------------------------------- |
| `cc-none-sonnet-high`              | 3 counted, quality 0.52 | unchanged                              |
| `cc-component-builder-sonnet-high` | 3 counted, quality 0.72 | **0 counted, 3 excluded, RUN INVALID** |
| `cc-design-tokens-sonnet-high`     | 3 counted, quality 0.64 | **0 counted, 3 excluded, RUN INVALID** |
| `cc-both-sonnet-high`              | 3 counted, quality 0.70 | **0 counted, 3 excluded, RUN INVALID** |

Sample of what the detector caught, quoted from the excluded trials:

```
cat .mcp-servers/design-tokens/tokens/component-token-catalog.json | head -200
find /home/sandbox/workspace/.mcp-servers -maxdepth 3 -type f | sort
cat .mcp-servers/component-builder/package.json
```

The first of those is the answer key for `token-conformance` — which scored
1.00 in that trial.

Still open: **why Claude Code never exposed the tools.** Both servers answer
`tools/list` locally, `--allowedTools` is set nowhere, the claude-code agent's
`configFiles()` returns `[]`, and `.mcp.json` plus `enableAllProjectMcpServers`
were correct in the captured project. The probe now isolates the server half,
so if the next run still shows zero MCP calls, the fault is unambiguously in
Claude Code's wiring rather than ours.

### D-29 — root cause of D-26 found: the servers never started

`bin/setup-check.ts` provisions the harness's own container, runs the real
`setupVariant()`, and asserts the Decision 22 properties. No agent, no model, no
tokens. `pnpm setup:check [variant]`.

It failed twice on first contact, and the second failure is the answer to the
question the first matrix left open.

**Failure 1 — relocation was impossible.** `mv /home/sandbox/workspace/.mcp-servers
/home/sandbox/.agent-eval-mcp` → `Permission denied`. The sandbox user owns the
workspace but not its parent. Runtime directory moved to `/tmp/.agent-eval-mcp`
(mode 1777 everywhere). The parent is not load-bearing: `stagingLeakOf()` keys
on the directory _name_, so it kept working unchanged.

**Failure 2 — both servers died on startup.**

```
Cannot find package 'jsonwebtoken' imported from
  /tmp/.agent-eval-mcp/_vendor/kickstartds-shared-auth/dist/verify.js
```

Staging was correct — the vendored manifest declares `jsonwebtoken: ^9.0.0`.
`setupVariant()` was not: it installed only packages with an entry point, on the
assumption that a `file:` dependency is provisioned through its parent. npm does
place transitive deps in the parent's tree, but it _links_ `file:` deps instead
of copying them, and Node resolves from a symlink's realpath. Code in
`_vendor/kickstartds-shared-auth/dist/` searches `_vendor/…/node_modules`, then
`_vendor/node_modules`, then `/tmp/node_modules` — never the server's
`node_modules`, where npm had actually put `jsonwebtoken`.

So **`@kickstartds/shared-auth` is imported at module load** by both servers,
both crashed before `initialize`, Claude Code had no tools to expose, and the
agent fell back to reading the source off disk. Every symptom of D-26 follows
from this one line. Nothing was wrong with Claude Code's wiring, `.mcp.json`,
`enableAllProjectMcpServers`, or `--allowedTools` — the hypotheses ruled out
one by one over the investigation were all correctly ruled out.

Fix: install every staged package that has dependencies, vendored ones first so
each `file:` link resolves to a directory that is already complete.
`SETUP_VERSION` → `5-vendored-deps-installed-servers-outside-workspace`.

`pnpm setup:check both` now passes all ten assertions, and `setup()` reports
both servers answering `tools/list` at their final runtime path.

**The lesson, priced.** A full four-variant matrix bought the discovery that a
dependency was missing. A single container start, at zero spend, would have
bought the same discovery — and now does, permanently, before any run.

- [x] Fix relocation target (`/tmp`, not the workspace's parent)
- [x] Install vendored workspace dependencies
- [x] `bin/setup-check.ts` + `pnpm setup:check` — pre-flight, zero spend

### D-30 — MCP verified working: `2026-08-07T07-37-40` (`cc-component-builder`)

First run after the D-29 fix. **All three runs: 9 MCP calls, `component-builder`,
first tool `get-ui-building-instructions`.** The protocol works. Every number
from the first matrix is now known to have measured something else.

Final grade after the calibration fixes below: **3 counted, 0 excluded**,
quality **0.70**, pass@1 33.3%, 762.2s, 105.3 turns, 148,462 out-tok,
9.0 MCP calls / ~5,412 MCP-tok per run.

Two graders were wrong, and both were wrong _because_ MCP started working.

**`a11y` 0.00 in 3/3 — the probe cannot see a `forwardRef` component.** All
three runs wrote `export const Badge = forwardRef<…>`, which is what the design
system does in 68/68 components and what the MCP's React template teaches.
`forwardRef()` returns an object (`{$$typeof, render}`), so
`typeof candidate !== "function"` rejected it as "no renderable export found".
The fixture was penalising the convention it exists to reward. Now matches
`react.forward_ref` and `react.memo` by `$$typeof`, while still excluding
contexts and providers, which carry the marker but do not render.
**Not visible in re-grading** — `runtime-report.json` is produced in the sandbox,
so the stored 0.00 stands until the next run. Verified instead by replaying the
captured run-1 project locally against the fixed `EVAL.ts` (copy the project,
`npm install`, stub the harness `setupFiles` path, `npx vitest run`):
`rendered: true`, **zero axe violations**. The component was always fine; only
the probe was broken. Expect `a11y` to move 0.00 → ~1.00 on the next matrix,
which alone lifts the composite.

**2/3 excluded as `confounded` for one `find` each.** Both ran a single
directory listing over the runtime tree — no `cat`, no `node -e`, no content.
Run-3 labelled it _"Explore vendor kickstartDS directories for reference
examples"_: it was hunting for the design system to copy from, and found an auth
library. Both used MCP fully. That is not the D-26 channel, and a path listing
feeds no grader, so the leak check now has two levels (ADR Decision 24).

**1/3 excluded as `infra: sandbox dependency missing`.** The agent wrote
`Badge.stories.tsx` importing `@storybook/react-vite`, which the fixture does
not ship, and a blanket `Cannot find module` signature deleted the trial. That
is an agent choice with a real cost, and precisely the interaction worth
measuring — the MCP hands out a Storybook template the fixture cannot compile.
TS2307 is now `model`, not `infra`.

Open, and now the most interesting cost signal: **the MCP tells agents to write
Storybook stories that do not typecheck here.** Provisioning Storybook in the
fixture is item 1.9 and also serves the standing static-inspection requirement.
Until then this shows up as a `toolchain` penalty on MCP arms only.

- [x] Accept `forwardRef`/`memo` in the runtime probe
- [x] Two-level staging classification (read vs enumerate)
- [x] TS2307 is a model failure, not infra

## D-31 — first valid matrix

Four arms, three runs each, `2026-08-07T10-26-57.*Z`. After the D-30 grader
fixes and ADR Decision 26, three of four arms are valid.

| arm                 | counted         | quality | Δ     | time  | turns | out-tok | mcp calls |
| ------------------- | --------------- | ------- | ----- | ----- | ----- | ------- | --------- |
| `none`              | 3/3             | 0.63    | —     | 337s  | 39.0  | 37,595  | —         |
| `design-tokens`     | 1/3 **INVALID** | 0.67    | +0.04 | 1.43× | 1.82× | 2.16×   | 23.0      |
| `component-builder` | 3/3             | 0.87    | +0.23 | 1.85× | 1.57× | 2.78×   | 9.0       |
| `both`              | 3/3             | 0.89    | +0.25 | 2.16× | 3.17× | 3.98×   | 33.3      |

`pass@1` is 0% everywhere. No run passes every assertion, so the composite is
carrying all the signal — item 1.19 should not be read as settled.

**Component-builder buys the gain; design-tokens refines it.** +0.23 of the
+0.25 comes from the component-builder server alone. Adding design-tokens on top
adds +0.02 for 1.4× the output tokens and 2× the turns. But the marginal effect
is real and lands exactly where it should: `token-conformance` is **1.00 in all
three `both` runs** versus 0.96–0.99 on component-builder alone, which invents
`--ks-text-color-success`, `--ks-*-warning`, `--ks-*-danger` and
`--ks-text-color-on-informative`. The tokens server stops the invention; it just
cannot move the dimensions that dominate the composite.

**The baseline fails structurally, not marginally.** `purity` 0.00, `bem` 0.00,
`component-contract` 0.57, `token-conformance` 0.50 with eleven literal hex
values and a `--badge-*` namespace of its own. It writes `.c-badge`, not
`.dsa-badge`. This is not a lightly-off house style — it is a different design
system, and it is what the MCPs are worth.

**What MCP does not fix.** `purity` sits at 0.75 across every MCP run: agents
keep reaching for `useState`/`useEffect` despite the convention, and no amount of
instruction has moved it. `client-behaviour` is erratic (0.00–1.00 within a
single arm). Both are candidates for the next round of eval authoring.

**`design-tokens` is invalid for a real reason.** 2/3 runs used `Read` on
`/tmp/.agent-eval-mcp/design-tokens/tokens/componentToken/button-tokens.scss` —
the answer key for `token-conformance`. Correctly confounded. Worth noting _why_
they went to disk: they wanted an example of a component-token partial, and the
server's tool surface does not offer one. That is a product finding about the
MCP, not only an eval problem.

- [x] Count MCP calls delegated to a subagent
- [ ] Re-run `design-tokens` alone (2/3 leaked; arm still unmeasured)

## D-32 — what it costs, and what three runs can actually resolve

Closes 1.18 and 1.19. Trials now carry an estimated price (`lib/report/cost.ts`),
because the harness recorded tokens but never money, and output tokens turn out
to be a quarter of the bill.

| arm                 | $/trial | vs base | quality    | Δ     | quality per extra $ |
| ------------------- | ------- | ------- | ---------- | ----- | ------------------- |
| `none`              | $1.40   | —       | 0.63 ±0.00 | —     | —                   |
| `design-tokens`     | $4.43   | 3.17×   | 0.67 ±0.00 | +0.04 | 0.013               |
| `component-builder` | $3.52   | 2.52×   | 0.87 ±0.06 | +0.23 | **0.110**           |
| `both`              | $9.90   | 7.08×   | 0.89 ±0.06 | +0.25 | 0.030               |

Matrix total: **$61.54** for one eval — $29.71 of it on `both`, $17.07 on the
`design-tokens` arm that produced one usable trial.

**Cost is cache traffic, not output.** A single `both` trial ran 13.0M cache-read
and 712K cache-write tokens against 134K output. Priced at Sonnet list, output is
$2.01 of a $9.90 trial. Every earlier statement of the form "MCP costs ~4× more"
came from the output column and understates it: the real multiple is **7.08×**.

**`component-builder` alone is 3.7× more efficient per dollar than `both`.**
Stacking `design-tokens` on top buys +0.02 quality for +$6.38 per trial — about
$319 per quality point, against $10 per point for component-builder over
baseline.

**D9 (runs per task): three is right for the question we asked and useless for
the one we want to ask next.** Measured σ ≈ 0.06.

- baseline → `component-builder` is Δ 0.23 ≈ 3.8σ. n≈2 suffices; n=3 is sound.
- `component-builder` → `both` is Δ 0.02 ≈ 0.3σ. Resolving that needs n≈144 per
  arm — roughly $1,400 per arm on this eval.

So **the +0.02 from stacking design-tokens is not distinguishable from noise**,
and no affordable number of runs on this task will make it so. The checklist
should stop treating `both` as the leading configuration on this evidence.

**Do not buy power with runs; buy it with tasks.** Item 1.17 adds four evals.
Paired across five tasks the same total spend gives a far better shot at the
small MCP-vs-MCP effects, and exercises graders (`ds-reuse`) that a single atom
task never touches.

**D6 (budget) restated against measurement.** A 4-arm × 3-run matrix costs ~$62
per eval, so the five-eval suite from 1.17 is ~$310 a full matrix. The standing
$25 cap is per experiment-run and `both` already broke it at $29.71 — it needs
raising to $40 or the arm needs splitting, or the cap will start silently
truncating the most expensive and most interesting arm.

---

**D-33 — the shared harness cannot be a shared module.** `TEST_FILE_PATTERNS` is
hardcoded to `EVAL.ts` / `EVAL.tsx` / `PROMPT.md` and matched by basename;
everything else in a fixture is uploaded to the sandbox. A helper next to
`EVAL.ts` would show the agent that we count its MCP calls and hash the files it
must not touch. `EVAL.ts` is therefore generated from
`lib/eval-harness/{harness,sources/*}.ts` by `pnpm build:evals`, and committed,
because the fingerprint hashes the eval directory on disk. See ADR 28.

**D-34 — esbuild statically rewrote the dynamic import, and it was nearly
silent.** `await import(\`./${componentPath}\`)`was bundled into a build-time
glob of`./\*_/_`, which resolves to nothing because the component does not exist
until the agent writes it. `runtimeReport()`would have failed on every run and
zeroed the`a11y`dimension across the whole suite while everything else kept
reporting normally. Assigning the specifier to a`const` first defeats the
analysis and keeps vitest's transform in the path. See ADR 28.

**D-35 — `ds-reuse` is finally live.** `840-reuse-over-native` vendors a
four-component slice as `@kickstartds/ds`; verified to resolve and import from a
clean `npm install`. The prompt deliberately does not name the components — see
ADR 30.

**D-36 — nothing measured over-editing until now.** `860-restraint` scores blast
radius alongside the fix. This is the dimension most likely to separate `both`
from `component-builder`, where quality alone found only 0.3σ. See ADR 31.

**D-37 — validating the evals found three broken assertions.** Every new eval
was run against the shipped fixture and against a gold implementation before
being allowed near a matrix. Two `812` assertions would have failed correct
answers, and one `860` assertion passed on the known-broken fixture. All three
would have produced confident, wrong numbers. See ADR 32.

**D-38 — the next matrix is ~$310 and nothing carries forward.** `defineExperiment`
defaults to `evals: "*"`, so all four new evals join all four arms automatically;
the harness extraction also changed `810`'s fingerprint, so its existing results
are stale. `pnpm eval:dry` reports 4 `new` + 1 `changed` across 4 experiments.
The $25/run cap must be raised to ~$40 first (D-32), and `cc-design-tokens` still
needs its re-run for the 2/3 leak.

**D-39 — grading only ever read one timestamp.** A chunked campaign would have
been graded on its last chunk alone, silently. Grading now resolves the newest
result per eval across timestamps, mirroring the framework's own dedupe rule.
Verified by reproducing the recorded `810` matrix exactly. See ADR 33.

**D-40 — chunked buying can produce an incomparable matrix.** Arms measured
against different versions of the same eval still tabulate cleanly and mean
nothing. `matrixIntegrity()` separates _complete_ (a budget state) from
_comparable_ (a correctness failure), keyed on `contentFingerprint`. See ADR 34.

**D-41 — the runner has no per-eval filter.** `EVAL_ONLY` narrows the eval list
at config load; unknown names are fatal. Chunk by eval rather than by arm, so
every checkpoint holds a complete comparable sub-matrix. See ADR 35.

**D-42 — `--dry --force` silently marked stale results as current.** Found by
triggering it while testing `EVAL_ONLY`; the marker had to be restored by hand.
Only a spending run advances it now. The first fix keyed on `argv.includes("run")`
and was itself wrong — the CLI's primary form has no subcommand, so real runs
would never have advanced the marker. It is an inversion instead: advance unless
`--dry`, `--smoke`, or a read-only subcommand. See ADR 36.

**D-43 — variant drift was unattributable.** All four arms invalidated, including
`none`, which stages nothing. `variantVersion` is now composed of named parts and
the guard reports which moved. Costs nothing this time — `810`'s fingerprint had
already changed — but `probe.mjs`, `SETUP_VERSION` and `DENY_WEB_RESEARCH` must
stay frozen for the duration of a campaign. See ADR 37.

**D-44 — the generator and the formatter fought.** `--check` reported STALE
forever. `bin/build-evals.ts` now runs prettier before writing. See ADR 38.

## Phase 1.5 — campaign mechanics (zero spend, complete)

- [x] Cross-timestamp matrix resolution (`resolveMatrix`, `loadEval`, `loadMatrix`)
- [x] Integrity reporting (`collectMatrix`, `matrixIntegrity`, `printIntegrity`)
- [x] `EVAL_ONLY` scoping with fatal validation of unknown names
- [x] Drift marker advanced only by real runs
- [x] Per-input attribution of variant drift
- [x] Prettier inside the eval generator
- [x] Raise the per-run cap from $25 to $40 (`cc-both` hit $29.71) — policy only; see D-45
- [ ] Freeze `probe.mjs`, `SETUP_VERSION`, `DENY_WEB_RESEARCH`, fixtures for the campaign
- [ ] Consider committing `probe.mjs` (untracked, so drift cannot be diffed)

**D-45 — the budget cap was raised to $40, and it does not do anything.** $25 was
set before any per-trial cost was known; P1 then measured `cc-both` at $29.71 on
a _single-eval_ matrix, so the smallest run possible already exceeded it. Raised
to $40 in the PRD, ADR 11 and item 4.6. Two things stay true: nothing enforces it
(4.6 is unimplemented, so `--dry` plus attention is the actual control), and it
caps an experiment-run rather than a campaign — the ~$310 five-eval matrix is
bounded by chunking (ADR 35), not by this number.

## Phase 1.6 — chunk 1 fallout (zero spend, complete)

- [x] Root-cause `860`'s four-arm failure (stale pasted digest, not agent error)
- [x] Generate untouched-file digests at build time (`__FIXTURE_DIGESTS__`, `shipped()`)
- [x] Confirm `810`/`832`/`840` regenerate byte-identically (paid results survive)
- [x] Verify all twelve chunk-1 trials satisfy the corrected digests
- [x] Make the zero-MCP-call confound per-eval (`Target.mcpUseExpected`)
- [x] Re-grade chunk 1 under the fixed rule — `860` now 3 counted, 0 excluded per arm
- [ ] Decide how to score diff-style evals (D-48) — retroactive, does not block runs
- [ ] Re-run chunk 1 (~$2.54, human)

**D-46 — the eval failed the agents, not the other way round.** All four arms
lost `860` on one assertion, `the component token partial is left untouched`,
expecting `86b4cbb6…` and getting `df8afd6e…`. The fixture's file _is_
`df8afd6e…`, and all twelve trials reproduced it byte-for-byte. The constant had
been pasted by hand and had rotted. Digests are now derived from the fixture at
build time (ADR 39), so the expected value and the shipped file are one
artifact. `812`'s two constants were checked and were correct.

**D-47 — a confound rule that punishes the behaviour under test.** `860`'s three
MCP arms were wholly excluded for making zero MCP calls, which for a one-line
a11y fix is the restrained, correct move. The rule is sound for `810` and wrong
here, so it became per-eval (ADR 40). Re-grading recovered all nine trials
without spending anything.

**D-48 — `860`'s quality score measures the fixture, not the work.** Twelve
trials, four arms, identical `0.86 ±0.00` and identical grader detail. The
whole-component graders score the shipped `Tag`, which every arm correctly left
alone. What actually varies — blast radius, turns, cost — is where the arms
separate: `8.7`–`11.0` turns, `2298`–`2886` output tokens, `131`–`146`s. Open:
scope the composite to what the agent can affect, or report restraint metrics
directly for diff-style evals.

**D-50 — grading is retroactive, so scoring decisions never gate spend.** Chunk 1
was re-graded under a changed confound rule with no re-run: graders execute
host-side over `results/`, and the fingerprint covers the fixture, `EVAL.ts` and
the run config — not `lib/graders/`. Anything gradeable can therefore be decided
after the trials are bought and applied to artifacts already on disk. Only
fixture and harness changes have to be paid for twice. D-48 is not a blocker.

**D-49 — `810` was already stale before this round.** `agent-eval status` reports
it `changed`; the cause is the earlier harness extraction and its `package.json`,
not the digest work (the generator reports `ok`, i.e. byte-identical output). The
$61.54 of `810` results will be re-bought whatever happens next — worth folding
into the chunk plan rather than discovering at run time.

## Phase 1.7 — chunk 1 re-run and the 810 blocker

- [x] Re-run chunk 1 — `860` passes 100% in all four arms, `pass^k yes`
- [x] Confirm the digest fix (D-46) resolved the four-arm failure
- [ ] Add `@kickstartds/core` to the fixtures (D-51) — **blocks 832 / 840**
- [ ] Feed the template defect back to `component-builder-mcp`
- [ ] Re-run 810 after the fixture fix (~$65, human)

**D-51 — `810` cannot pass because the MCP's advice is unfollowable.** 0/12
trials, $61.54, always the same three assertions: `{Name}.client.js`, purity,
client-side dismissal. `get-client-behavior-template` prescribes
`@kickstartds/core`, which no fixture depends on. The highest-quality trial in
the matrix said so in a source comment before falling back to `useState`. Fix
the fixtures before buying `832` and `840` — both are `requiresClientBehaviour`
and would burn ~$140 reproducing the same dead end. See ADR 43.

**D-52 — `860` has saturated.** 100% pass, zero delta on every axis, at
~$0.24/trial. Reclassified as a drift gate (ADR 42). It carries one real
finding: MCP availability does not induce over-engineering on small diffs.

**D-53 — the first cost-efficiency ranking.** On `810`, per extra dollar over
baseline: `component-builder` 0.110 quality/$, `cc-both` 0.030, `design-tokens`
0.013. Component-builder alone is ~3.7× more efficient than both servers
together, which cost 7.08× baseline for +0.02 quality over component-builder
alone — inside the ±0.06 noise band (D-32). Provisional: `810` is the only eval
with data, and its pass bar is defective.

## Phase 1.8 — unblocking `810`

- [x] Vendor `@kickstartds/core` into `810`, `832`, `840` (ADR 44)
- [x] Add `allowJs: true` to the same three fixtures (ADR 45)
- [x] Verify the prescribed pattern installs, typechecks and hydrates in jsdom
- [x] Confirm `860`'s paid results survive the change
- [x] `typecheck`, `build:evals`, `setup:check` all green
- [x] Re-run `810` across all four arms (human, $74.73)
- [x] Scope diff-task grading to edited files — closes D-48 / ADR 41
- [x] Make `860`'s fixture house-conformant (D-60 / ADR 49)
- [ ] Re-run `860` across all four arms (human, ~$2.90)
- [x] Fix `get-client-behavior-template` — **after** the campaign (ADR 46)
      — done, D-113

**D-54 — the fixture blocked the pattern twice.** The missing package was the
visible cause; a strict `tsconfig` without `allowJs` was waiting behind it. Both
had to go before the MCP's own template would compile. Verified end to end in a
scratch copy of the fixture: `npm install`, `tsc --noEmit`, and a jsdom test that
renders the component, hydrates it via `define()`, and asserts the behaviour
fires. That check cost nothing and would have caught the defect before the first
$61.54.

**D-55 — vendoring beats depending.** A real `@kickstartds/core` install drags
in 12 runtime dependencies and a beta peer, per trial, over the network. The
vendored copy is deterministic and instant, and `840` had already set the
precedent with `@kickstartds/ds`. The eval's assertions are static, so fidelity
of the vendored runtime is not on the critical path.

**D-56 — freeze the servers, not just the fixtures.** The campaign freeze rule
named fixtures but not the MCPs. It should name both: they are the system under
test. The template defect is recorded and stays unfixed until the last chunk is
bought (ADR 46).

**D-57 — fixture staleness is per-eval, which makes it affordable.** The change
touched three evals and left `812` and `860` alone, so the ~$2.90 just spent on
`860` was not burned. Scoping fixture edits to the evals that need them is worth
real money.

## Phase 1.9 — the first real discrimination

**D-58 — the fixture was the whole blocker, and `810` now discriminates.** After
ADR 44/45, `810` went from 0/12 to passing. The arms separated for the first
time in the campaign:

| arm                    | pass@1 | quality    | cost  | quality per extra $ |
| ---------------------- | ------ | ---------- | ----- | ------------------- |
| `cc-both`              | 66.7%  | 0.96 ±0.03 | 3.88× | 0.045               |
| `cc-component-builder` | 66.7%  | 0.93 ±0.06 | 2.11× | **0.105**           |
| `cc-design-tokens`     | 0.0%   | 0.69 ±0.00 | 3.00× | 0.009               |
| `cc-none`              | 0.0%   | 0.64 ±0.02 | —     | —                   |

Spend: $74.73. Note the baseline is _cheaper_ than it looks good — `cc-none`
fails every trial at $2.49.

**D-59 — component-builder is the causal factor; design-tokens is nearly
inert.** The two component-builder arms carry the entire pass-rate gain.
`design-tokens` alone moves one dimension — `token-conformance` +0.43, and it
does reach 1.00 there, so the server works — but +0.04 composite, +0% pass@1,
at 3.00× baseline cost. It never fixes structure: `bem 0.00`,
`client-behaviour 0.00`, contract failures in all three runs.

The pairing is worse than the part: `both` costs 84% more than
`component-builder` alone for +0.03 quality, inside the ±0.06 noise band (D-32).
On this eval the recommendation is component-builder alone. One eval, two of
three passes — provisional until `832`/`840` land.

**D-60 — `860`'s fixture was not house-conformant, and it cost 0.12. Fixed.**
With diff-aware grading (ADR 47) `860` read `0.88 ±0.00`. The missing 0.12 was
`purity 0.50` on the fixture's own `TagComponent.tsx`, which never exported
`TagProvider`, plus the rare bare `@use "tag-tokens"` form (ADR 48). The fixture
now follows the measured house pattern (ADR 49). Verified before spending:
installs, typechecks, compiles, renders identically, the Context override really
swaps the implementation, and axe still reports `button-name` — so the task did
not become self-solving. Invalidates the twelve paid `860` trials; ~$2.90 to
re-buy.

**D-62 — the `860` re-run proved the fixture fix and exposed a stale assertion.**
Quality came back **1.00 ±0.00 in all four arms**, exactly as predicted, with
`purity` and `component-contract` at 1.00 and everything else `n/a`. But pass@1
went 100% → **0%** in all four arms, on one assertion:
`toContain('@use "tag-tokens"')` carries a closing quote and so pinned the bare
`@use` form that ADR 48/49 had just replaced. 11 of 12 tests passed. $2.91.

The assertion had been read and declared safe without being run — the scratch
verification deleted `EVAL.ts` before testing. ADR 50 makes running the eval
against a solved and an unsolved fixture the standard check. Now verified: 12/12
solved, 2 failures unsolved, both on the task's own assertions.

**D-63 — the two halves of `860` are independent, and only one was needed.**
`tag.scss` is untouched by every arm, so `style-placement` is `n/a` and the
`@use` extension contributed **nothing** to `860`'s score — the whole 0.12 came
from `purity` on `TagComponent.tsx`. The stylesheet change was correct for house
conformance but was not what the re-buy was for, and it is what broke the run.
On a diff-task fixture, changing files the agent never touches carries all of
the assertion risk and none of the scoring benefit.

**D-61 — "the grader punishes correct behaviour" happened a third time.**
Digest (D-54), zero-call confound, and now `client-behaviour` scoring 0.00 for
not rewriting a working client file. All three punished an agent for doing the
right thing, and all three were invisible until someone read the detail lines
rather than the score. Worth a standing check when adding any grader: what does
this return for an agent that correctly does nothing?

## Phase 1.10 — pre-verify the unbought fixtures (complete)

- [x] `812-restyle-with-tokens` verified — sound, no changes needed
- [x] `832-client-behaviour` verified — one defect found and fixed (ADR 52)
- [x] `840-reuse-over-native` verified — one defect found and fixed (ADR 51)
- [x] `npm run typecheck`, `graders:selftest`, `setup:check` green after changes
- [x] `agent-eval status` confirms `810`/`860` results survive the edits

**Confirmed `860` re-run.** All four arms `pass@1 100%`, `pass^k` yes, quality
`1.00 ±0.00`, every delta `0.00`. Cost $2.68. The drift gate now reads as a gate:
any future regression shows up as movement away from a flat 1.00 rather than as
noise around 0.86. Per-arm: `cc-both` 150.3s / 12.7 turns / $0.78;
`cc-component-builder` 134.5s / 11.0 turns / $0.72; `cc-design-tokens` 146.8s /
10.3 turns / $0.67; `cc-none` 141.1s / 9.7 turns / $0.51.

**D-64 — `840`'s reuse check was passing on a JSDoc comment.** `/\bIcon\b/`
matched `/** Icon identifier rendered before the action label. */`, copied from
the schema's own field description. Worse than weak: the component-builder MCP
prescribes copying descriptions into JSDoc, so the MCP arms would have been
handed the one assertion the task exists to make informative. See ADR 51.

**D-65 — the better answer would have failed the old check.** `Button` accepts an
`icon` prop and renders the icon itself, so `<Button label={actionLabel}
icon={actionIcon} />` is the idiomatic composition — and contains no standalone
`Icon` token. Requiring a literal `<Icon>` would have scored the more idiomatic
solution as non-reuse. The replacement accepts both spellings.

**D-66 — `832`'s `defaultOpen` check tested a declaration, not a behaviour.**
`expect(source).toMatch(/defaultOpen/)` is satisfied by destructuring the prop.
An implementation that accepted `defaultOpen` and ignored it — the exact
flash-of-wrong-state defect being targeted — passed. Now asserted against the
rendered HTML from the harness's own runtime report. See ADR 52.

**D-67 — both defects produced plausible numbers, not broken ones.** Neither
would have surfaced from reading results: `840` would have reported reuse that
did not happen, `832` would have reported a correctly-hydrated default that was
never rendered. Unlike D-54 and the `@use` break, these fail _silently upward_.
That is the argument for hand-solving every fixture before buying it: the
failures that survive a results read are exactly the ones that flatter the
system under test.

**D-68 — four states, not two.** ADR 50 asked for solved and unsolved. `840`
needed two more: an implementation exhibiting the anti-pattern the task names
(confirms the eval discriminates at all), and the loophole case suggested by the
assertion's own shape (confirms it discriminates for the right reason). The
loophole case is where both defects were caught.

## Phase 1.11 — `812` bought; leak surface characterised

- [x] **D-69** `bem` capped at 0.75 in all twelve `812` trials — component-side
      check scored against a file the diff task forbids touching. Third instance of
      the D-48 family. Fixed by dropping the check when the component is withheld
      but present in `discover(trial)`. Re-graded free (D-50); quality shifted
      uniformly, all deltas unchanged. (ADR 54)
- [x] **D-70** Root-caused the `812` staging leak: `.mcp.json` in the agent's
      working directory carries the absolute path to `/tmp/.agent-eval-mcp/…`, so
      moving the servers out of the workspace never removed the stumble. Not
      fixable for stdio servers — the agent's user must read what it executes.
      (ADR 55)
- [x] **D-71** Established that no leak fix is free: `guardVariantVersion()`
      covers `DENY_WEB_RESEARCH`, `SETUP_VERSION`, staged packages and the probe,
      throws without `--force`, and `--force` stops prior results being reused.
      The leak is a between-campaign change. (ADR 55; wording corrected by D-117
      — nothing is deleted, the re-buy is what costs)
- [x] **D-72** Decided _not_ to re-buy `812`'s two invalid arms (~$23): leaked
      and counted trials have identical vitest outcomes and identical grader
      profiles (σ = 0.00). (ADR 56)
- [x] **D-73** Found that `812` discriminates on the `_{slug}-tokens.scss`
      convention, not on token values — one assertion decides all twelve trials.
      The design-tokens result on `812` is the `token-conformance` delta (+0.33),
      not pass@1. (ADR 57)
- [ ] **D-74** Reconcile `token-conformance` with `812`'s `withoutVarFallbacks()`
      — the grader counts `var(--x, #hex)` fallbacks as literals, the eval permits
      them. Free to fix and re-grade. (ADR 58)
- [ ] Buy `840`, then `832` (human). Expect leak attrition on both; the control
      is detection-and-exclusion, not prevention.
- [x] Between campaigns: move MCP servers to host-side HTTP transport so no
      server files exist in the sandbox. (ADR 55) — done, D-114

## Phase 1.12 — `840` bought; capability matrix complete but for `832`

- [x] **D-75** `840` bought, $68.01, 12/12 trials counted, zero exclusions.
      `component-builder` 66.7% pass@1 / 0.98 quality; `both` 0.0% / 0.97;
      `design-tokens` 0.0% / 0.82; `none` 0.0% / 0.73.
- [x] **D-76** Verified `840` is not defective: `component-builder` scored 15/15
      twice. The failure distribution is structured, not random. (ADR 59)
- [x] **D-77** `design-tokens`' failing-assertion set on `840` is exactly
      `cc-none`'s minus "styles use design tokens rather than literal colour
      values" — single-assertion isolation of the tokens server. (ADR 59)
- [x] **D-78** Established that `cc-both`'s 0% pass@1 on `840` is noise (~1.4σ,
      three distinct 14/15 misses) and must not be reported as a regression.
      (ADR 59)
- [x] **D-79** Across all four bought tasks, `cc-both` never beats
      `cc-component-builder` on pass@1 while costing 1.5–4.7× more.
      `component-builder` alone leads quality/extra-$ in every non-saturated task.
      (ADR 59)
- [x] **D-80** Zero leaks on `840` confirms the leak is task-correlated, not a
      flat attrition rate. (ADR 60)
- [ ] Buy `832` (human, ~$65) — completes the capability matrix and is the only
      task whose primary axis is client behaviour.
- [ ] **D-74** Reconcile `token-conformance` with `812`'s `withoutVarFallbacks()`.
      Free to fix and re-grade.

## Phase 1.13 — `832` bought; capability campaign complete

- [x] **D-81** `832` bought, $54.77, 12/12 counted, zero exclusions.
      `component-builder` 100% pass@1 / 1.00 quality; `both` 100% / 0.97;
      `design-tokens` 0% / 0.73; `none` 0% / 0.63.
- [x] **D-82** `schema-validity` docked all twelve `832` trials for `content`, a
      property the fixture itself declares as required under
      `additionalProperties: false`. Fourth instance of "grading what the agent did
      not author". Fixed via `readShipped()`; re-graded free. (ADR 61)
- [x] **D-83** Capability matrix complete, 20/20 cells, $245.94 retained spend.
      (ADR 62)
- [x] **D-84** `design-tokens` produces pass@1 +0.0% on all four non-saturated
      tasks while moving `token-conformance` +0.33…+0.46 — a correctness tool, not
      a completion tool. (ADR 62)
- [x] **D-85** `both` never beats `component-builder` alone on pass@1 or value
      in any task. (ADR 62)
- [x] **D-74** Settled `token-conformance` vs `812`'s `withoutVarFallbacks()`.
      The design system uses 149 `var()` fallbacks, all token→token, and **zero**
      literal-colour fallbacks. The grader is correct; the _eval_ is the lenient
      outlier. No grader change. Fix `812`'s assertion next campaign — changing
      `EVAL.ts` now would move fingerprints. (ADR 63)
- [ ] Phase 2 (2.1–2.12), carrying the standing static-inspection / Storybook
      requirement. Item 1.9 (`stories.ts` grader) deferred here.
- [x] Between campaigns: host-side HTTP transport (ADR 55); component-builder
      client-behaviour template peer-dep fix (ADR 46 freeze now lifted).
      — both done, D-113 / D-114

## Phase 2.1 — static artifacts working end to end (zero spend, complete)

Fourteen files were written unverified in the previous sitting. Building and
opening them found four defects, all in the new code, none of which a code read
would have caught (D-67 again: they failed silently _upward_).

**D-86 — `storySort` cannot be a `const`.** Storybook statically parses
`preview.tsx`; a referenced array fails the build with "unsupported". Inlined.

**D-87 — every story threw `ReferenceError: React is not defined`.** The
package `tsconfig.json` had no `jsx` setting, so esbuild used the classic
runtime. Set `"jsx": "react-jsx"`.

**D-88 — the component rendered empty.** `pickDefaults()` returned only
`{ defaultOpen: false }`, because a `*Defaults` module carries configuration,
not content — `summary` and `content` are the caller's job. The report was
about to show a working component as a blank box, which is the most misleading
thing a review artifact can do. Fixed with `placeholderArgs()`, deriving a
stand-in for each unfilled required prop from that prop's own schema
`description`, and labelling it "placeholder" on the Provenance page so no
reader mistakes harness scaffolding for agent output.

**D-89 — the component rendered completely unstyled.** Its SCSS compiled and
injected correctly (verified: a `<style>` carrying
`.dsa-disclosure { --dsa-disclosure--gap: var(--ks-spacing-xs); … }`), but
**no fixture ships a `--ks-*` layer**, so every reference resolved to nothing.
The host now injects `packages/design-system/src/token/{branding-tokens.css,
tokens.css}` ahead of the trial's own styles, disclosed as host-supplied.
`--ks-border-radius-card` now resolves to `8px`.

D-89 is the more interesting one, because the missing layer is not a report
bug. In-sandbox, `token-conformance` has been rewarding token references that
**cannot resolve to a value in the environment the agent was given**. Shipping
the layer into the fixtures is now queued for the rebuild, and would let the
report drop its ambient workaround.

**D-90 — `skipLibCheck` hid a broken import and degraded every story to `any`.**
~25 type errors across the story files. A probe (`const y: number = manifest`
under `@ts-expect-error`) reported "Unused '@ts-expect-error' directive",
proving `manifest` was `any`. Cause: **inside an ambient `declare module`
block, a relative specifier resolves against the module name, not the
file** — so `import type { TrialManifest } from "../manifest"` silently
resolved to nothing, and `skipLibCheck: true` suppressed the error. The inline
form `import("../manifest").TrialManifest` fixed all but one.

Generalises: **a clean typecheck can mean nothing was checked.**

### Verified

- `pnpm report build <arm>/<eval>/run-N` — 6.42s, 7.5 MB per trial, 7 stories.
- **The produced component renders, is styled by its own SCSS against the DS
  token layer, and is genuinely interactive**: `aria-expanded` flips on mouse
  click and back on keyboard `Enter`. The vendored `define.js` installs a
  `MutationObserver`, so anything Storybook renders is hydrated automatically —
  the enabler for the whole phase, now confirmed rather than assumed.
- **Graceful degradation**, on `cc-none/832/run-1`: an off-contract
  `Disclosure.tsx` is still found by role and rendered, Provenance labels it
  "off contract", Graders shows `component-contract 0.54` with the failing
  check, Output carries the full 9-failure vitest dump. Zero console errors on
  both a passing and a failing trial.
- 7.5 MB × 60 trials ≈ 450 MB, nearly all of it an identical Storybook runtime
  — 2.8 should dedupe it, and 2.10 matters sooner than expected.

## Phase 2.2 — folding in the postponed Phase 1 learnings (zero spend)

Unblocked by the decision to run a second campaign: fixture and `EVAL.ts`
changes move fingerprints, which no longer costs anything.

- [x] **Fixture Storybook type shim** (ADR 64). `types/storybook.d.ts` in all
      five fixtures, `"include": ["src", "types"]`. Verified by reproducing the
      one affected trial from its retained project: `tsc` exits 1 with TS2307
      before, 0 after, no other diagnostic. `allowJs: true` preserved in
      810/832/840 and still absent in 812/860.
- [x] **`812` colour assertion corrected** (ADR 65, closing ADR 63).
      `withoutTokenFallbacks()` replaces `withoutVarFallbacks()`. Unit-checked
      in four states; checked against all twelve real `812` stylesheets, where
      it fails exactly `cc-none` and no MCP arm; then run for real — 10/10 pass
      on `cc-both`'s project, 2/10 fail with `cc-none`'s stylesheet swapped in.
      The second failure was unplanned and is the useful part: the same literal
      fallback loophole was being used for **lengths** too
      (`gap: var(--dsa-space-1, 4px)`), and one false comment was hiding both.
- [ ] Ship the `--ks-*` token layer into the fixtures (D-89) — **blocked on a
      design decision, see D-91 below**
- [ ] Bump fixtures to React 19, to match the workspace and the report host
- [x] Move MCP servers to host-side HTTP transport (ADR 55) — needs a
      `SETUP_VERSION` bump — done, D-114
- [x] Fix `get-client-behavior-template`'s undeclared `@kickstartds/core` peer
      dependency (ADR 46); per D-30 `get-storybook-template` has the same shape
      of defect — done, D-113
- [ ] Stories grader (item 1.9) — now meaningful, since fixtures accept stories

Regression gates after both changes: `build:evals` ok ×5, `typecheck` ok ×5,
`graders:selftest` — all five graders still agree with the design system.

**Next free decision number: D-91.**

## D-91 — shipping the token layer would collapse the `design-tokens` arm

Queued from D-89, stopped before doing it. `token-conformance`'s `known-tokens`
check scores referenced names against a registry of real design-system tokens:

```ts
const known = referenced.filter(
  (name) =>
    registry.semantic.has(name) ||
    registry.branding.has(name) ||
    registry.component.has(name) ||
    name.startsWith(prefix),
);
```

Knowing the valid `--ks-*` names is the entire measured contribution of the
`design-tokens` MCP — it is the check that moved in every task
(+0.43 / +0.33 / +0.46 / +0.46) and essentially the only one.

Ship `tokens.css` into the fixture and `cc-none` can `grep` the answer. The arm
difference would compress toward zero, and the campaign would no longer measure
what it was built to measure.

So this is not a mechanical fix. Two coherent positions:

**(a) Ship it.** The real repository _does_ contain the token layer, so a
fixture without one is unrealistic, and an agent that reads the tokens off disk
is doing the sensible thing. If the arm difference then disappears, that is a
finding, not a defect — and a sharper version of campaign finding #2
("`design-tokens` never flips a task"): the MCP may be supplying what the
workspace already supplies. It would also fix D-89 properly and let the report
drop its ambient-token workaround.

**(b) Don't ship it.** Keep the fixture deliberately token-blind so the arms
stay separable, and treat the missing layer as a rendering concern only — the
report host already supplies it, and `token-conformance` validates names
host-side against the real design system either way.

A third option worth costing: ship the layer **and** add a task whose value is
not name recall (e.g. choosing the _right_ token for an intent, where the names
are all available but only one is correct). That preserves realism without
making the arm difference vacuous — and per D-32, buying power with tasks
rather than runs is the better spend anyway.

Not decided here; it changes what the second campaign measures.

**Decided (D-92): option (c) — ship the layer, and add a task whose value is
not name recall.**

Both halves are done.

The layer is synced into all five existing fixtures by `build:evals`, from
`packages/design-tokens-mcp/tokens/` — the same directory `token-conformance`
grades against, so a fixture cannot drift from the thing it is scored by in
either direction. 12 files, 248 KB, 1,457 semantic `--ks-*` and 65
`--ks-brand-*`. `componentToken/` is deliberately excluded: those are the design
system's own `--dsa-*` partials, which for a task whose job is to write one
would be the answer key. Because the sync runs before `fixtureDigests()`, the
layer is covered by the baked digests like any other shipped file, so an agent
that rewrites the token layer to make its own values "known" is visible for what
it did.

The new task is `811-token-intent`, described in ADR 66.

- [x] **2.16 — `811-token-intent` fixture.** Sixth task. A `Stat` component
      whose stylesheet is _fully tokenised and wrong_: three encoded design
      rules violated using nothing but real, greppable token names. Passes the
      ADR 53 four-state gate (five states, in fact — see ADR 66).

- [x] **2.17 — the results site is served, not just built (D-93).** `2.11`
      asked for "a Kamal static site behind shared JWT auth", which reads like
      nginx — the model `deploy-design-system.yml` already uses. It could not
      be. The gate is `@kickstartds/shared-auth`, a Node library, so the choice
      was an nginx `auth_request` sidecar or the Express pattern the Design
      Tokens Editor already runs. Express won: one secret, one issuing script,
      five services, and no second thing to configure. `server/index.ts` is
      ~150 lines and adds a `connect-src 'none'` CSP, because the tree it
      serves is sixty Storybooks full of code no human reviewed — which is the
      _point_ of the artifact, and therefore something the server has to assume
      rather than wish away.

      The other thing 2.11 got wrong by omission: this image cannot be built
      from source. Results are the output of paid runs. The deploy sequence is
      populate-then-ship, and `results/.gitkeep` is tracked so the `COPY`
      succeeds on a fresh clone rather than failing the build.

## D-113 — the component-builder templates taught two things that do not compile

Both defects were recorded during Phase 1 and frozen until the campaign
finished. ADR 46 found `get-client-behavior-template` handing the agent a
`.client.js` that imports `@kickstartds/core`, a package the template never
tells it to declare; D-30 found `get-storybook-template` with the same shape.
The freeze is lifted, so both are fixed.

**Checked the prevalence before prescribing anything** — lesson (ac). The design
system has 13 `.client.js` files. Eleven import `@kickstartds/core` and use
`extends Component` with `define(identifier, Class)`; two do not. In
`packages/design-system/package.json`, `@kickstartds/core` is a **peer** and dev
dependency, never a runtime one, which is exactly why an agent copying the
template into a fresh fixture ends up with an unresolvable import.

`get-client-behavior-template` now opens with a **Prerequisite** section: check
that `@kickstartds/core` resolves, and if it does not, either add it to
`dependencies` or use the new standalone variant — a plain `export default
class` with a bound handler and a `destroy()`, which is what the two
non-`Component` files in the design system already look like. It also names the
failure mode it must not produce: moving the behaviour into React. That is what
the agent actually did when the import failed, and it is the one answer the task
is designed to rule out. The `allowJs: true` requirement is stated in the same
place, because D-54 established that a strict `tsconfig` was waiting behind the
missing package.

The same pass corrected a second, quieter error: the template taught
`useKsComponent` as the way to wire client behaviour to React. Six of the design
system's eight interactive components use a bare side-effect import; two use
`useKsComponent`. The template was teaching the minority pattern as the only
one. It now leads with the majority and explains when the other applies.

`get-storybook-template` gained a **Prerequisites** section listing the four dev
dependencies and — the part that matters — the two **build-generated** files a
stories file imports, `{kebab}.schema.dereffed.json` and `{kebab}-tokens.json`.
When they are absent the instruction is now explicit: do not write a stories
file. Emitting one anyway produces TS2307 on four imports, which is a compile
failure the agent caused by following its own tool.

Verified by rendering both templates through the built handlers and reading the
output. `pnpm --filter component-builder-mcp build` is clean.

**Neither change is free.** `component-builder`'s build is hashed into
`variantVersion`, so every result on both MCP arms is now stale by construction.
That was always true of this fix and is the reason it waited for a campaign
boundary.

## D-114 — the servers moved to the host; nothing MCP now enters the sandbox

ADR 55 root-caused `812`'s two `RUN INVALID` arms and concluded the leak was not
fixable for a stdio server: `.mcp.json` sits in the agent's working directory
and names an absolute path, and the agent's own user has to be able to read what
it executes. D-70 established the diagnosis, D-71 established that no fix is
free. Both servers already support Streamable HTTP, so they now run on the host
and the sandbox receives a URL.

**What was removed.** The upload loop, the in-sandbox `npm install` of each
staged package, the vendored-dependency ordering that D-26 cost a matrix to get
right, the `mv` out of the workspace, and the stdio probe. `setupVariant()` is
about a third of its former length. No server file, and in particular no
`design-tokens-mcp/tokens/` directory, exists anywhere in the container.

**How the sandbox reaches the host.** Not `host.docker.internal`: the
framework's docker backend hardcodes `HostConfig: { AutoRemove: true }` and
exposes no hook for `ExtraHosts`, so on Linux that name does not resolve. The
container's default gateway _is_ the bridge, and the bridge is the host, so the
address is read out of `/proc/net/route` — little-endian hex, hence the byte
reversal — rather than by shelling out to `ip`, which `node:24-slim` does not
ship. Ports are 8791 and 8792, deliberately not 8080, which is both servers'
own default and the likeliest port to already be taken.

**Lifecycle.** `ensureHostServer()` starts a server on first use, memoises it by
name, waits on `/health`, and kills everything on process exit. The servers are
stateless, so one instance serves every trial in a run. A port collision or an
unbuilt server surfaces as a readiness timeout before a container is provisioned.

**Staging did not go away, only uploading did.** `stageVariant()` still reads and
hashes `dist/`, `tokens/` and `rules/`, because that hash feeds
`variantVersion()` and the servers are the system under test. A token re-sync
from the design system has to invalidate the `design-tokens` arm whether or not
the files travel.

**The probe now checks more than it used to.** It runs inside the container and
POSTs `tools/list` to the exact URL Claude Code will use, so it covers the host
process, the bridge and the HTTP transport in one shot — where the old probe
only proved a local file could be executed.

**The leak detector kept its job and gained a new one.** `MCP_RUNTIME_DIR_NAME`
and `MCP_UPLOAD_DIR` no longer exist in the sandbox, but the detector still
watches for them: a future change that reintroduces staging without
reintroducing detection would be silent, and silence is how D-26 cost a full
matrix. It also now matches the endpoint shape `http://<ip>:<port>/mcp`. That is
the one residual channel — an agent can `curl` the URL from `.mcp.json`, or POST
raw JSON-RPC to it, and get the servers' answers without a single call appearing
as a tool use. It is a strictly smaller hole than the old one, because it yields
what the tools yield rather than the token files themselves, but an arm that was
fully informed by its MCP while appearing never to have reached it is exactly the
confound this grader exists to catch.

**Verified against real containers, at zero spend.** `pnpm setup:check both`
passes ten assertions, including two new negative ones — no server tree in the
workspace, and none beside it either — and `pnpm setup:check none` passes the
baseline path. Before that, the host lifecycle was checked on its own: both
servers start and answer `tools/list` (10 tools and 28 tools respectively).
`tsc --noEmit` and `build:evals --check` are clean, all 20 evals `ok`.

`SETUP_VERSION` is now `"6-host-http-transport"`, and `PROBE_SOURCE` changed
too, so `guardVariantVersion()` will throw on the next run of every experiment.
That is correct and expected: the next campaign needs `--force`. Phase 1's
numbers stay readable in `results/` and in the published report; they are simply
no longer comparable to what comes next, which D-71 established was the price of
this fix from the start. (Wording corrected by D-117 — `--force` does not delete
the prior results, it only stops them being reused.)

## D-115 — `812` was asking where the variants live, not whether they differ

The fingerprint was already broken by D-113 and D-114, so two changes that had
been deferred purely because they were not worth invalidating a matrix on their
own became free. This is the first of them.

`812`'s check named `the variants remain visually distinguishable` read only
`alert.scss`. A solution that declared `.dsa-alert--success`, `--warning` and
`--danger` in `_alert-tokens.scss` — overriding the component tokens there and
consuming them from the base rule — failed it. That split is defensible; it is
arguably the more idiomatic reading of the token-layer convention, which is the
very thing this eval is about. The check now concatenates the stylesheet and the
partial before matching.

This was recorded during 3.3 as a latent false negative and deliberately left
alone, on the grounds that no Phase 1 arm had tripped it and the fix was not
worth a re-buy. That reasoning expires the moment the fingerprint moves for
other reasons, and the entry under 3.3 that says it was "recorded here rather
than loosened" is now superseded: it has been loosened.

**The widening does not cost the check its teeth**, which is the only thing that
matters when relaxing an assertion. Verified in both directions on a real
fixture: moving all three modifier blocks out of `alert.scss` and into the
partial passes (it would have failed before), and deleting them from both files
fails on exactly this test, 1 failed / 9 passed. Lesson (ad) — a gate state that
passes may be testing nothing — applies with double force to a loosened gate,
because loosening is the one edit whose failure mode is silent success.

The separate half of D-74, `withoutTokenFallbacks()`, turned out to have been
applied to the eval source already under ADR 63; only the grader-side leniency
census was outstanding, and it is documented there. D-115 covers the false
negative alone.

## D-116 — the fixtures were on React 18 while everything that renders them is on 19

Second free change. All 20 fixture manifests pinned `react` and `react-dom` at
`^18.3.1`, `@types/react` at `^18.3.12` and `@types/react-dom` at `^18.3.1`. The
workspace is on React 19.2.1 — design system and website both — and so is the
report host that builds the Storybook every graded trial is inspected in.

So every trial's component was authored and typechecked against React 18 types
and then mounted, for the artefact a human actually looks at, under React 19.
Nothing observed in Phase 1 is attributable to this, and it is not the kind of
gap that produces a dramatic failure — 18 and 19 agree on everything these
components use. It is the kind that produces a slow one: `forwardRef` is
deprecated in 19, `@types/react` 19 is stricter about `ReactNode`, and an agent
asked to write idiomatic code is being graded by a toolchain that disagrees with
the design system it is being told to imitate. The fixture is supposed to be a
small honest copy of the real thing.

All four pins moved to the workspace's versions: `^19.2.1`, `^19.2.1`,
`^19.2.7`, `^19.2.3`. The two vendored `@kickstartds/ds` manifests were left
alone — their `"react": ">=18"` is a peer range that already admits 19.
`@testing-library/react` stayed at `^16`, which is the React 19 line. No other
devDependency moved.

**The risk here was one-directional and had to be checked.** If any _shipped_
fixture file failed to typecheck under the stricter types, `toolchainReport`
assertions would start failing for something the agent did not do — lesson (i),
and the most expensive class of eval bug there is. So all 20 fixtures were
re-gated with their gold references applied: 20/20 pass, 251 assertions, no
typecheck regressions. `tsc --noEmit`, `build:evals --check` and
`assertFixtureHygiene()` are clean.

Both changes move `EVAL.ts` and every fixture manifest, so they land inside the
same `--force` the transport work already required. That was the point of doing
them now: the next campaign pays the re-buy once.

## D-117 — `--force` was never destructive, and the Haiku campaign needs its own experiment names

Prompted by asking how coupled the next campaign is to the half-finished
calibration session. Two things came out of checking rather than assuming, and
the first is a correction to something written here three decisions ago.

**`--force` deletes nothing.** It appears in exactly one place in the package —
`lib/experiment.ts:407` — where it downgrades `guardVariantVersion()` from a
throw to a marker rewrite. The only `rmSync` calls in `lib/` and `bin/` are in
`prune-results.ts` (explicit, `--apply`-gated) and a tmpdir cleanup in
`download-results.ts`. The guard's own error message says "re-run with `--force`
to discard them", and that wording was copied into D-114, ADR 76 and ADR 80 as
if it meant the files. It means the framework's _reuse_ of cached results. The
re-buy is real; the corpus is not at risk. Every prior campaign stays on disk
under its own timestamp.

This matters because the wrong version of it is the kind of belief that makes
you prune defensively or delay a campaign to protect data that was never in
danger — and it was load-bearing in the decision to batch D-115 and D-116.

**Calibration is almost entirely decoupled from campaigns**, by deliberate
design that predates the question. Labels live in `calibration/labels.json`,
committed, outside `results/`, keyed by `${rubric.id}:${sha256(material)[0..16]}`
— never by a results path. So they survive pruning, re-buys and rubric edits.
The one real coupling is that the _candidate pool_ is rebuilt from the results
tree, so the 143 unlabelled candidates need Phase 1's results to stay on disk.
The threat to the calibration session is `results:prune --apply`, not `--force`.

**The footgun found on the way.** All four experiment definitions hardcode
`name: "cc-<variant>-sonnet-high"`, and the results path is built from that
name, while the model comes from `PRIMARY_MODEL` / the `EVAL_MODEL` env
override. So `EVAL_MODEL=haiku pnpm run:capability` writes Haiku trials into
`results/cc-*-sonnet-high/`, mixing two models in one tree under a name that
names the wrong one. Nothing would error. The report would aggregate across
both, the calibration pool would silently gain Haiku material inside the sonnet
corpus, and the only surviving evidence of which model produced a trial would be
the `model` field inside each `result.json`.

The Haiku campaign therefore needs four new experiment files with
`name: "cc-<variant>-haiku-high"`. A pleasant consequence: a new experiment name
has no `.variant-version` marker, so `guardVariantVersion()` writes one and
returns — the campaign does not need `--force` at all. Passing it anyway is
harmless now that the semantics are known.

Lesson (am): a directory name that encodes a variable the code does not read
from it is a lie waiting for the second value — the moment a second model, arm
or version exists, check whether the path distinguishes them or only claims to.

## D-118 — the grading loop was optimised, and the Haiku arms exist

Three changes to the thing that is currently the bottleneck. 3.6 needs 15–20
labels per rubric before agreement is measurable at all (at 4 labels the rate
can only be 0/25/50/75/100%, so "≥80%" is not expressible), and the cost of
each label is human attention.

**Syntax highlighting in `pnpm calibrate`.** `lib/judge/highlight.ts` tokenizes
with the Prism already vendored in `prism-react-renderer` for the report host —
no new dependency — and paints ANSI. Each section of `judgedMaterial()` is
highlighted with the grammar its own path implies, because a single item
routinely mixes TSX, SCSS and JSON. `.scss` is deliberately highlighted as
`css`: the bundled Prism has no SCSS grammar, and these stylesheets are custom
properties, `var()`, `@use` and BEM selectors with none of the SCSS constructs
that would show the difference. This matters more than cosmetics for
`token-reasoning`, where the question is which token names appear where, and
token names now render in a colour distinct from the properties around them.

Colour is off when stdout is not a TTY, and honours `NO_COLOR`. That is not
politeness: the grading loop's only automated test drives it through a pipe, and
its input handling was written specifically to survive that.

**A pick list for the note.** `lib/judge/reasons.ts` carries nine recurring
diagnoses, every one transcribed from the notes on the first ten labels rather
than derived from the rubrics — a pick list only saves time if it says what the
grader was already going to type. The tally is in the file. On a non-`pass` the
list is offered, the selection is joined with `", "`, and a free-text prompt
always follows and lands last, because the residue is where the new information
is; a picker that made the residue awkward would quietly collapse every
diagnosis into one of nine.

The list is shared across rubrics, not split by one, because the notes are not:
"doesn't use JSON Schema for TypeScript interface generation" was written under
`design-intent` and under `code-idiom`, and the token-file complaint under
`design-intent` and `token-reasoning`. No label contains a comma, since the
join would otherwise be ambiguous to read back off `--report`.

Verified by driving the loop through a pipe: three picked reasons plus a typed
addition composed into one comma-joined note, correctly ordered. **The label
that test wrote was then reverted** — it was a fabricated verdict on material
nobody read, and a calibration set is exactly the artefact where one invented
row is worse than none.

**Four Haiku experiments.** `cc-{none,design-tokens,component-builder,both}-haiku-high`,
mirroring the Sonnet four. `DefineExperimentOptions` gained an optional `model`
so the file name and the model can no longer disagree (ADR 82) — previously the
model came only from `PRIMARY_MODEL`, i.e. from `EVAL_MODEL` in the caller's
shell, which would also have retargeted the Sonnet files in the same session.

Two things worth knowing before the campaign. `ModelTier` is `string` in the
framework, so `"haiku"` typechecks by virtue of being text, not because anything
validated it; it reaches the CLI as `--model haiku`, exactly as `sonnet` does
today. And a new experiment name has no `.variant-version` marker, so these four
do not need `--force`.

## D-119 — the token partial was found and then dropped, and the cache did not care

Raised from the grading chair: a `812-restyle-with-tokens` pair showed only
`alert.scss`, and the question was whether that was deliberate. The withholding
of the untouched `AlertComponent.tsx` was. The absence of `_alert-tokens.scss`
was not.

`discoverGraded` returns the token partial as `found.tokens`, separately from
`styles`, because the deterministic graders want the two apart. `judgedMaterial`
pushed `component`, `styles` and `schema` and never asked for `tokens`. On the
trial that surfaced it:

| file                 | `--ks-*` references |
| -------------------- | ------------------- |
| `alert.scss`         | 0                   |
| `_alert-tokens.scss` | 24                  |

The main sheet forwards `--dsa-*` names and nothing else. So `token-reasoning` —
the rubric whose whole question is which semantic token was chosen, on the task
the code comments call _"the one task in the suite that is purely about token
choice"_ — was shown a file containing none of the choices. This is the same
blind spot as D-115, which taught the deterministic grader to read the partial;
only half of it got fixed then.

It was not pure oversight, which is the more useful part. The judge's system
prompt already carried _"schemas, token partials and generated types routinely
exist without appearing here… never fault the author for the absence of a
file"_. The gap was known and papered over with an instruction not to notice it,
rather than closed. **A prompt that tells the judge to ignore a missing file is
an admission that the file should have been there.**

Fixed by emitting `found.tokens` after `styles` for the three styles-including
rubrics, and by loosening the `requires: ["styles"]` test to accept either file,
since an agent may legitimately put everything in the partial. Verified: the
`812` `token-reasoning` item now carries two sections and 24 visible `--ks-*`
references, and 72 of 180 candidate items — 24 per styles rubric — gain the
partial.

### The cache had a grandfather clause, and it was load-bearing

Material is what a calibration label is keyed on, so the fix orphaned 5 of the
16 labels recorded so far; 11 still match. That was the expected bill. The
unexpected one was the dry run: **`pnpm judge --all` reported 0 calls to make.**

`promptHash` (D-101) exists precisely to catch "the criterion is unchanged but
the material is not", and it was doing nothing, because 180 of the 228 stored
rubric results predate the field and the freshness check read:

```ts
previous.promptHash === undefined || previous.promptHash === promptHash(...)
```

with the justification _"those are trusted, since the prompts they were formed
from are known to match"_. True when written. Falsified by the edit above, and
silently — the exact failure D-101 was built to prevent, reintroduced by its own
escape hatch. Missing hash now means stale. _I cannot check_ and _it matches_
are different claims, and conflating them here produces a judge verdict formed
from material the human calibrating against it never saw.

Re-judging all 180 is now required before 3.7's agreement number means anything:
**estimated $15.87**, against a historical actual of roughly half the estimate
($7.63 for 192 calls in campaign 1). Not spent — the user's call, as always.

Grading may continue in the meantime. Labels are keyed on the corrected material
and the loop is blind at decision time; only the post-verdict _"judge said…"_
feedback line reads the stale cache, and it is feedback, not input.

Lesson (an): a hash that is allowed to be absent is not a check, it is a check
with an opt-out — and the entries that predate it are exactly the ones most
likely to have drifted.

Lesson (ao): when a prompt instructs the reader not to hold something against
the author, ask why it is missing rather than how to phrase the apology.

## D-120 — the judge estimator is right by cancellation, not by accuracy

**Superseded in its numbers by D-121:** every dollar figure below is drawn from
our own `costUsd`, which was priced from a table that turned out to be 3× too
high. The _structural_ finding — that the estimate is two large opposing errors
rather than one accurate one — survives, because both sides scale together. Read
the ratios, not the amounts.

The D-119 re-judge ran. 180 calls, **estimated $15.87, actual $9.21** — 58% of
estimate. That looks like a safely conservative estimator. It is not; it is two
large errors pointing in opposite directions, and the one that dominates today
will not dominate at a different output length.

|           | estimated  | actual    |
| --------- | ---------- | --------- |
| input     | $6.42      | $7.63     |
| output    | $9.45      | $1.58     |
| **total** | **$15.87** | **$9.21** |

**Output is charged at `MAX_TOKENS`.** `estimateCost` bills 700 output tokens
per call because that is the cap set on the response. The rubrics ask for "two
sentences at most" and get ~116 tokens, so the assumption overshoots **6×**, and
at $75/M output that single line is $7.87 of imaginary spend — more than the
entire gap.

**Input is underestimated.** `estimateTokens` is `chars / 4`, which is generous
for prose and wrong for code and token names: `token-reasoning` estimated ~16.1k
input and actually consumed 23.5k, 46% more. Across the run input came in 19%
over estimate. So the estimator is not conservative on the axis that scales with
the material — the axis a growing suite moves.

**Prompt caching is doing its job.** 2,208,774 input tokens cost $7.63, an
effective **$3.45/M against a $15.00/M list price — 77% served from cache.**
That is the `cachedContext()` split (ADR: token names and the reference corpus
kept out of the per-trial string so the prefix matches) paying for itself, and
it is the strongest argument against ever assembling the shared block into the
per-trial prompt for convenience.

Per call this run was **$0.0512**, against $0.0397 in campaign 1 — 29% dearer,
because `token-reasoning` now carries the token partial (D-119) and it is
already the most expensive rubric at $0.0697/call.

Cumulative judge spend is now **$19.40** ($10.19 before this run). Note that the
`costUsd` summed across `judge.json` files is $10.68, which is _not_ cumulative
spend: the cache stores one entry per (trial, rubric), so a re-judge overwrites
the previous cost rather than adding to it. The only place historical judge
spend exists is this document.

Not fixed, deliberately: correcting the output term would make the estimate
smaller, and an estimate that reads low is worse than one that reads high when
its only job is to decide whether to press the button. Recorded so the number is
read as a ceiling rather than a forecast.

Lesson (ap): an estimate that lands close is not thereby validated — decompose
it before trusting it, because two errors that cancel at one scale will not
cancel at the next.

## D-121 — we were reading our own arithmetic and calling it the bill

The billing dashboard says the D-119 re-judge cost **$2.89**. We recorded
**$9.21**. The whole of D-120 was an analysis of a number we had computed
ourselves, and the check that settled it took one look at an invoice.

`PRICE` in the judge was `{ input: 15, output: 75, cachedInput: 1.5 }`. That is
**Claude Opus 4.1**, retired. The judge is pinned to `claude-opus-4-5-20251101`,
which lists at **$5 / $25 base, $6.25 cache write, $0.50 cache read** — exactly
one third, across every column. $9.21 / 3 = $3.07 against $2.89 billed; the
residual 6% is dashboard timing plus the fact that our formula had no cache-write
term at all and billed cache creation as plain input, which errs the other way.

The reason nobody looked is written directly above the constant:

> Per-million-token prices, for the estimate printed before spending only.
> Wrong prices here produce a wrong estimate and nothing else; no score, gate
> or report depends on them.

That was false when written. `costUsd` on every cache entry is computed from the
same table, and since the cache holds one entry per (trial, rubric) it is the
only record of what judging has cost. The comment did not merely fail to warn —
it argued against the check, and it held for three campaigns.

**Corrected figures.** Divide every previously reported judge cost by three:

|                               | as recorded | actual           |
| ----------------------------- | ----------- | ---------------- |
| campaign 1 (192 calls)        | $7.63       | ~$2.54           |
| cumulative through campaign 3 | $10.19      | ~$3.40           |
| D-119 re-judge (180 calls)    | $9.21       | $2.89 (invoiced) |
| **cumulative judge spend**    | **$19.40**  | **~$6.29**       |

**Not affected: the $245.94 campaign figure.** Agent trials are priced by a
separate table in `lib/report/cost.ts`, whose Sonnet and Haiku rows are correct.
Its Opus row carried the same stale 4.1 prices, but nothing in the matrix has
ever run on Opus, so no campaign number moved. Fixed anyway — a wrong row in a
table nobody exercises is a trap armed for whoever exercises it first, and the
Haiku campaign is about to exercise the row beside it.

**Cost of the fix: nothing.** Prices are not part of `promptHash`, so the dry run
still reports 0 calls to make. Stored `costUsd` values are left as written rather
than rewritten in place; the conversion is ÷3 and it is recorded here.

Lesson (aq): a self-reported cost is a hypothesis. Reconcile it against the
invoice once, early, before it becomes the basis of a decision — ours had been
wrong since the first judge call, and nothing downstream could ever have caught
it, because every consumer of the number read the same wrong table.

Lesson (ar): "nothing depends on this" is a claim about the code and it decays
like any other. A comment that explains why something need not be checked is
load-bearing exactly to the extent that people believe it.

## D-122 — the calibration disagreements were a bug report, and two of them were about us

At 32 labels the agreement read `design-intent` 69%, `token-reasoning` 75%,
`code-idiom` 82%. All eight disagreements ran one direction — human `fail`,
judge `pass` — with no `pass→fail` anywhere. A systematic offset is a defect,
not sampling noise, and it turned out to be two independent ones.

**The judge was instructed to forgive what the human was failing.** Every human
fail reason was _misplacement_: tokens declared inline instead of in the
partial, prop types hand-written instead of generated, the client identifier
defined inline instead of imported, behaviour in React state instead of the
client bundle. The last paragraph of the judge's SYSTEM prompt said "Never fault
the author for the absence of a file", and the judge obeyed it while visibly
noticing the problem — "though it lacks schema.json and token files that
reference components include", verdict pass. The rule is right for a file that
was withheld and wrong for content sitting in a file you can read: `--dsa-*`
declarations in `alert.scss` are proof they are not in `_alert-tokens.scss`, and
that inference needs no invisible file. The prompt now separates the two.

**And two of the human labels were wrong.** Both `860-restraint` fails cited
hand-written prop types. The fixture ships `export interface TagProps`, and the
brief says "Tag is shipped and in use across several projects, so keep the change
to what the audit actually reported". The correct move was to leave them alone;
had the agent regenerated them the eval would have failed it for breaking
restraint. The label punished the agent for obeying the brief.

The cause is shared: `judgedMaterial` shows whole files, so on an edit task
neither the judge nor the human can see which lines the agent wrote. We guarded
the _graders_ against scoring unauthored work three times (ADR 41, ADR 54,
ADR 61) and never once guarded the _readers_. Files with a fixture baseline are
now headed `MODIFIED FIXTURE` and followed by the changed region. On the trial in
question that region is one line out, five in — the `aria-label` fix and nothing
else.

**Effect on the numbers: unknown, and deliberately not claimed.** Re-keying the
material orphaned 10 of 32 labels, all on diff tasks, and agreement "rose" to
80/83/83%. That is a selection effect — the disagreements lived on diff tasks, so
dropping diff-task labels dropped the disagreements — measured against judge
verdicts that predate the prompt fix. It is not evidence of anything until the
re-judge runs (~$3).

## D-122b — SCSS nesting: guidance that nothing measured

The design system nests elements and modifiers under the block with `&`. Among
the 58 component stylesheets that have any element or modifier rule, **50 do**;
the 8 that do not are almost all form fields. `get-scss-template` in the
component-builder MCP emits `&__header`, `&--primary`, `&:hover`. The exemplars
shown to the judge — `button`, `breadcrumb` — nest.

Adoption in generated code, measured across the matrix:

| arm                    | stylesheets nesting |
| ---------------------- | ------------------- |
| `cc-none`              | 17/35 — 49%         |
| `cc-design-tokens`     | 9/33 — 27%          |
| `cc-component-builder` | 19/33 — 58%         |
| `cc-both`              | 14/30 — 47%         |

Component-builder buys 9 points over baseline, against the 2–12× it delivers on
things the suite scores. `cc-both` again lands below component-builder alone.
The `design-tokens` arm suppresses nesting to 27% and we have no explanation, so
none is offered.

Nothing scored it. `bem.ts` mentioned nesting only in a comment about top-level
selectors, and the eval assertions accept both dialects on purpose — the D-115
fix matches `(?:\.dsa-alert--|&--)` precisely so formatting cannot move a token
verdict. Correct locally, and the aggregate effect was that flat SCSS cost an
agent nothing anywhere in the suite. `code-idiom` should have caught it and did
not, while passing at 82%.

The objection to grading it was that the suite avoids formatting. That objection
does not survive `code-idiom`'s own wording — "ignore formatting a formatter
would fix" — because no formatter converts `.dsa-tag__label` into `&__label`.
This is idiom, and it was in scope and unmeasured.

Added as `bem-nesting`: a ratio, so one nested block cannot buy a pass for an
otherwise flat sheet; omitted entirely when a stylesheet has no elements or
modifiers to nest; and counting only selectors the author added, since two of our
own gold references (`811`, `812`) are flat edits of flat fixtures and must not be
penalised for the fixture's dialect. Verified: both add zero new flat selectors,
so the check is omitted for them, and `graders:selftest` puts `bem` at mean 0.94
against the real design system, floor 0.70.

Lesson (as): a disagreement list is a bug report on the measuring apparatus
before it is a fact about the thing measured — and the bug may be in the human
half. Read the reasons, not just the rate.

Lesson (at): guidance that nothing measures does not survive contact with a
model's prior. The MCP stated the house style, the exemplars demonstrated it, and
adoption still sat near half in every arm — because flat BEM dominates training
data and nothing in the suite ever charged for it.

Lesson (au): when a reader is shown a whole file on an edit task, they will grade
the parts they were handed. Authorship guards belong on every consumer of the
material, not only on the graders.

## D-123 — the judge was reading the brief and the human was guessing at it

Raised from the calibration seat: a `860-restraint` pair showed `TagComponent.tsx`
as a `MODIFIED FIXTURE` with inline prop types and a one-line `aria-label`
change, and the obvious question was whether the untouched props are a fail —
followed by "is there a reason the prompt is not logged?"

There was not. `design-intent` sets `include.prompt`, and `judgePrompt` appends
`section("The brief the author was given", brief)` — but to the _prompt_, not to
the _material_, and `bin/calibrate.ts` printed `item.material` and nothing else.
So the judge read the task and the human inferred it from the diff. The rubric's
own criterion says "Judge the candidate against them **and against the brief**",
which the human could not do.

Agreement between two graders holding different evidence is not a measurement of
the rubric. It caps below 100% by construction, and every disagreement it
produces is unfalsifiable — you cannot tell a rubric defect from an information
defect.

The brief is now printed, gated on `rubric.include.prompt`. Withheld where the
judge does not get it either: handing the human _more_ breaks the comparison as
thoroughly as handing them less.

Shown, never keyed. `labelKey` is `rubric.id` plus `sha256(material)`, and the
brief stays out of `material`, so this cost zero labels — unlike the D-122
material change, which orphaned ten. The original reason for keeping the brief
out of the material was sound and is still in force: it keeps labels alive across
rubric edits (calibration.ts note 2). The mistake was letting a decision about
the _key_ silently decide the _display_.

**Post-re-judge agreement**, 23 surviving labels, actual spend **$3.13** against
a $5.53 estimate — the corrected price table holds and the residual 1.77× is the
`MAX_TOKENS` output assumption alone, exactly as D-120 decomposed it:

| rubric            | agreement | n   | kappa |
| ----------------- | --------- | --- | ----- |
| `code-idiom`      | 86%       | 7   | 0.70  |
| `design-intent`   | 80%       | 10  | 0.60  |
| `token-reasoning` | 67%       | 6   | 0.43  |

`token-reasoning` fell from 75%, and the confusion matrix now shows a `pass→fail`
and a `fail→unknown` where before it was one-directional. That is the D-122
prompt fix working as designed — the judge stopped forgiving misplacement — and
it has overshot on at least one pair. At n=6 none of this is decidable. The
labels to prioritise are `token-reasoning`.

Lesson (aw): when two graders are compared, diff what each was shown before
diffing what each concluded. An evidence asymmetry masquerades as rubric
disagreement and is invisible from the agreement rate alone.

Lesson (ax): a constraint on what may be _keyed_ is not a constraint on what may
be _displayed_. Ours quietly became one, and the interface inherited a rule that
was only ever about cache invalidation.

**Next free decision number: D-124.**

## D-124 — calibration made portable, and multi-rater

Asked whether the calibration workflow could be a hosted site so more people
could grade. It can, and the reason to do it is not throughput.

**n=1 is not a small sample, it is an unreadable instrument.** 3.7 sets an 80%
human/judge agreement target. With one grader, a miss is either a judge defect
or that person being idiosyncratic, and the number cannot distinguish them —
so iterating rubric wording against it fits the judge to one reviewer rather
than to the design system. Human/human agreement is the ceiling: if two
qualified people agree 70% on a rubric, an 80% target is not strict, it is
unreachable, and the rubric is asking about something the design system has not
decided. `token-reasoning` sitting at 67% is currently uninterpretable for
exactly this reason.

Three things were in the way, and only one of them was the UI.

**The questions were not portable.** `candidates()` walks `results/` — 113 MB,
gitignored, prunable, on one machine. Everything else about hand-grading
already travelled: labels are committed, keyed by a hash of the material, and
survive both rubric edits and a rebuilt results tree. But a calibration question
is three strings — material, criterion, brief — so `bin/export-calibration.ts`
writes them to `calibration/bundle.json`: **153 items, 0.8 MB**, committed. The
judge's verdict is deliberately not in it; a verdict on screen before labelling
is an anchor.

**The store was single-writer.** `labels.json` was one map, so two graders meant
a git conflict per line. Now one file per rater under `calibration/labels/`,
unioned by `readRaters()` — independent opinions merge as a union, which is what
they are. `labels.json` is still read, as a rater in its own right: the first 38
labels predate attribution and moving them would rewrite the provenance of the
only hand-grading the project has. `readLabels()` pools to a modal verdict per
key, the same rule already used for the judge's repeated answers, and pooled
notes are concatenated because on a disagreement the note is the diagnosis.

**There was nowhere to send anyone.** `/calibrate` now runs on the existing
results host — same container, same JWT gate, same Kamal config. It reads the
bundle and never touches `results/`, so the image ships questions without
answers. Rater identity is the JWT subject, never inferred: two people sharing
a name reports as agreement, which is worse than no data. Labels persist on a
volume and come home via a per-rater download link.

Two things the implementation had to get right, both because of what the
material is. Rater names become filenames, so they are allow-listed
(`/^[a-z0-9][a-z0-9_-]{0,63}$/`) rather than escaped — `?rater=../../pwned` is
rejected, verified. And the material is agent-authored HTML and JavaScript being
shown to a reviewer on an origin holding their session cookie, so it arrives as
JSON and is placed with `textContent`; nothing untrusted goes near `innerHTML`.

`--report` now prints the ceiling, and says so plainly when there isn't one:

```
One rater (julrich) — no ceiling on the numbers above.
  Share the queue: pnpm calibration:export, then /calibrate on the results host.
```

Verified end to end against a running server: traversal rejected, brief withheld
on `code-idiom` and present on `design-intent`, label round-trip written and the
queue advanced, and the pairwise ceiling maths exercised with a planted
disagreement (removed afterwards). Existing agreement numbers are byte-identical
across the store refactor.

Lesson (ay): a measurement with one instrument has no error bar. Before tuning
anything against an agreement rate, ask what the two graders would score against
each other — if that is unknown, the rate is a number and not yet evidence.

Lesson (az): portability is usually one dependency, not a rewrite. Hand-grading
was portable in every respect except that the questions were computed from a
gitignored directory, and 0.8 MB of derived JSON removed the constraint that had
capped the project at a single rater.

### Follow-up: the page as something you actually read on

Three changes after using it, all in `server/calibrate.ts`.

**Syntax highlighting.** The CLI has had it since D-118 and the web queue was
plain grey — on `token-reasoning`, where the question is which `var()` a
declaration reaches for, that is a real handicap. A small lexer covers
tsx/ts, scss, json and md, switching per section on the file extension in the
`=====` header. It emits **nodes** — `span.textContent` and text nodes — never
`innerHTML`, which is the whole difficulty: highlighting is the one feature
whose obvious implementation is "turn this string into markup", and the string
is agent-authored code on an origin holding the reader's session cookie. Done
this way a hostile file is a cosmetic question, not a security one.

The page is now `String.raw`, because a template literal containing regular
expressions eats every backslash on the way out — the comment rule would have
reached the browser as three bare slashes. Under `String.raw` what is written
is what the browser parses, at the cost of one escape: template strings are
matched via `\x60`.

**The controls are a flyout.** They were at the end of the material, which on a
long file means noticing something at line 200 and having to scroll past
everything to record it — which is how it gets forgotten instead. Diagnoses and
the note now live in a bottom sheet toggled from a fixed dock (`d`, `Esc` to
close), with the verdict buttons alongside so nothing requires reaching the
bottom. The dock shows a count of ticked diagnoses while the sheet is closed,
so the state is legible without opening it.

**Responsive to 400px.** Verified in a 400×780 frame: no horizontal overflow,
12.5px → 11.5px code, keyboard hints dropped from the dock, and the diagnosis
rows tightened so 11 of 13 fit without scrolling the sheet (6 before the
tightening). Below 640px the sheet also takes more of the viewport, because
thirteen two-line rows with the note underneath is otherwise a scroll inside a
scroll.

Verified in a browser rather than by reading: all four grammars produce the
expected classes (including the backtick rule), the flyout opens by key and by
click, the count tracks, and the queue check wrote no label file.

Numbers were already printed beside each row to match the CLI, which made them
read as shortcuts before they were any — so they are now. Digits tick rows while
the panel is open, and because thirteen entries mean two-digit numbers exist, a
digit cannot be acted on the moment it arrives: `1` is both a diagnosis and the
first half of `12`. Digits land in a buffer that flushes on a 450 ms timer, and
the timer only runs when it has to — at thirteen entries only `1` can begin a
longer number, so every other digit commits instantly and the wait is the
exception. The row a half-typed number points at is highlighted and scrolled
into view, so a pending `1` is distinguishable from a dropped keystroke.

Digits are ignored while the panel is closed: a diagnosis silently ticked behind
a closed panel is worse than one that was never offered. Escape cancels a
pending number before it closes anything, and closing the panel or pressing a
verdict key drops it. The keydown guard had to stop excluding all `input`
elements — clicking a row focuses its checkbox, which would have killed the
shortcuts after the first click — so it now excludes text entry only.

Verified by driving the real page under jsdom (the browser tool was down), ten
cases: closed-panel digits ignored; `3` commits with no wait; `1` waits and
highlights row 1; `12` commits on the second digit; a lone `1` commits on the
timer; `19` falls back to `9` rather than swallowing it; Escape cancels the
number then closes; digits survive a focused checkbox; digits typed into the
note are not shortcuts; and the pending number is dropped by both `d` and `p`.
Probe script and the labels it wrote were deleted; queue back to 23/130.

### Follow-up: the queue is shared

Policy change, and a bug it exposed. The hosted queue skipped only _your own_
labels, on the reasoning that overlap between raters is the measurement. With
130 pairs unanswered that is the wrong trade: a second grader's sitting spent on
an already-answered pair buys a statistic instead of coverage.

The queue now skips anything **any** rater has answered — which is the rule
`bin/calibrate.ts` always applied, so the terminal and the browser had been
quietly disagreeing about what "remaining" means. The bug: the host never read
the legacy `calibration/labels.json` at all, so it would have re-asked all 23
pairs that already have an answer. A fresh grader now starts at 130, not 153,
and the header reads shared progress (`24 of 153 graded · 0 by you`).

Rater names stay, because they were doing two jobs and only one is being
dropped: attribution and conflict-free writes are needed the moment two people
label at once, regardless of whether anyone computes agreement. Duplicate
verdicts from a race are stored rather than rejected — the reading work is
already done, and it is a free overlap datapoint.

Verified against a running server: fresh rater 153 → 130; a label written as
`alice` removed the pair from `bob`'s queue and moved shared progress to 24;
probe file deleted and the count returned to 23.

The ceiling is deferred, not abandoned — labels are keyed by material hash and
permanent, so a later overlap campaign inverts one filter and everything
collected meanwhile still counts. Until then, human/judge agreement is a pooled
number across whoever graded and inherits the spread between them; quote it with
that caveat. `--report` now says so instead of treating a missing ceiling as a
fault.

## D-125 — the pick list, re-read against itself

First revision of `REASONS` since it was transcribed from the opening ten
labels. At 38 labels it can be checked against its own use rather than against
the notes it came from.

**Nothing was removed.** Every original entry was picked at least twice
(`schema-types` and `react-behaviour` seven times each), so the transcription
held up — the list was not padded with plausible-sounding rules nobody invokes.

**Reordered by observed use**, which is free in a way that is worth stating: the
number a grader types is positional and never stored, only `label` is written
into a note, and `id` exists so a reordered diff stays readable.

**Editing an existing label is _not_ free, though adding is** — and the file
previously said only the second half. A stored note contains a copy of the
sentence, not a reference to it, so rewording an entry strands every note that
used it, and the entry then reads as unused the next time the tally is taken.
The nine originals are therefore unchanged, not because they could not be
phrased better. Verified after the edit: 37 of 78 stored fragments still resolve
against the list, exactly as before.

**Four additions**, taken from the free text people kept typing _alongside_
their picks — the same evidence that produced the list originally:
`no-defaults` (3 sightings — defaults and `deepMergeDefaults`),
`inline-classnames` (2 — hand-rolled `cx` instead of the classnames library),
`callback-props` (1 — `onAction` on a static component definition), and
`wrong-token-prefix` (1 — tokens declared under an invented `ksd` namespace,
which `wrong-prefix` does not cover because that entry is about class names).
The two single sightings clear the bar `wrong-filename` and
`hardcoded-fallbacks` cleared when the file was written.

**Not added: SCSS flatness**, despite `bem-nesting` now grading it (D-122b). In
38 labels nobody has mentioned it once — including on the `812` pairs, where a
stylesheet is the entire material. That is evidence it is not something this
grader says, and an entry invented from a rubric rather than transcribed from a
note is the failure the file's own rule exists to prevent. It earns a line when
it appears in free text.

Lesson (ba): a menu assembled from what people said is only still that if it is
re-derived from what they say. Check a pick list against its own usage before
extending it — the entries nobody picks are the ones that were invented.

## D-126 — the labels are retired, and the instrument that spoiled them is fixed

Prompted by the grader's own suspicion that they had been rating "stuff not
relevant to the task being rated". Auditing the 23 addressable labels against
the criterion each was filed under confirms it, and localises it:

| rubric            | written reasons on topic |
| ----------------- | ------------------------ |
| `code-idiom`      | 6 / 6                    |
| `token-reasoning` | 3 / 3                    |
| `design-intent`   | **0 / 7**                |

Every `design-intent` reason is a code-idiom observation — file naming,
generated prop types, `classnames`, `deepMergeDefaults`, React state instead of
the client bundle. None is about what that rubric asks: markup structure, how
variants and states are expressed, whether a reviewer would recognise the file
as one of these. `token-reasoning` scores 3/3 only generously; two of its three
notes are really file-structure and class-naming complaints that happen to
contain the word "token".

This makes `design-intent`'s 80% agreement worthless rather than reassuring. It
is the agreement rate of two graders answering different questions — a number
that says nothing about the rubric whatever its value.

**Two mechanisms produced it, both in the tool.**

The pick list was rubric-blind: 13 diagnoses spanning three rubrics offered in
full for every question, including options unanswerable from the material shown
(`token-reasoning` is given only a stylesheet and a token list, and was still
offered `wrong-filename` and `schema-types`). And the criterion was stated once
at the top of the page, then scrolled away behind hundreds of lines of material
— so the verdict was given with the question off screen. `design-intent` and
`code-idiom` also show nearly identical material (the brief is the only
difference), so nothing in the material itself cues which is being asked.

Worse, it fed itself: the pick list was transcribed from the notes, so
off-rubric notes became options, and options made off-rubric notes easier to
write. This file's own D-125 entry defends the unscoped list on the grounds that
"the notes do not respect the rubric boundary" — the observation was right and
the conclusion inverted it.

**Retired, not deleted, and not filtered.** `calibration/labels.json` →
`calibration/labels.retired-2026-08-11.json`. `calibration/` is untracked, so a
delete would be unrecoverable, and the file is evidence about the instrument —
it is what the table above is computed from. Keeping the on-topic subset was
rejected: selecting labels by whether they look defensible is selection on the
measured quantity, and would bias the retained agreement upward. 23 of 153 with
130 to grade anyway is a cheap redo; a permanently caveated mixed-provenance
label set is not.

**The fix, so the redo does not drift the same way.** `Reason` gains
`rubrics: string[]`, and `reasonsFor(rubric)` scopes the list in the CLI, the
web UI, and `resolveReasons()`. The panel now repeats the rubric label as a
sticky "Asking:" line directly above the diagnoses, where the verdict is
actually given.

What the tagging exposes: `design-intent` has **one** entry, because in 38
labels nobody has yet written a design-intent observation. That gap is the
finding and is left visible — the panel says the list is transcribed and this
rubric earns its entries from free text — rather than filled by invention, which
is the rule D-125 established.

Verified: `reasonsFor` gives design-intent 1, token-reasoning 4, code-idiom 8,
api-design 2 (never served — ungated and `requires: ["schema"]` unmet, which is
why `callback-props` could only ever have been picked under a rubric not asking
about the API). `resolveReasons("5", "code-idiom")` resolves;
`resolveReasons("5", "token-reasoning")` returns it as invalid. Served page
renders 8 rows for a `code-idiom` item with "Reads like the rest of the
codebase" in the panel, and the digit shortcuts range-check against the scoped
list (`9` ignored). Queue reset to 0/153; `--report` degrades to "No labels yet".

Lesson (bb): an agreement rate between two graders answering different questions
is not a weak measurement, it is not a measurement. Audit what the humans wrote
against what they were asked before trusting the rate they produced.

Lesson (bc): a pick list transcribed from notes will reproduce whatever bias
produced the notes, and then reinforce it. Vocabulary is not neutral — offering
an answer is a hint about the question.

## D-127 — the reference components were judge-only

Asked why `812-restyle-with-tokens` under `code-idiom` shows no brief, and on
what basis the judge answered. The brief is correct — `code-idiom.include` has
no `prompt`, deliberately: the question is whether the code reads like the
codebase, which is settled against the references and not against the task. But
tracing what the judge _did_ get turned up a second asymmetry, larger than the
one D-123 fixed.

`buildPrompt()` is criterion + brief + material. `cachedContext()` is a separate
system block holding the reference components (13 KB) and, for
`token-reasoning`, the 1457 semantic token names (54 KB). It is separate because
it is identical across every trial and therefore cacheable. Nothing in the
calibration path ever called it — `candidates()` builds an item from
`judgedMaterial()` alone. D-123 found the brief half of this and stopped.

So on the pair in question the judge compared against `ButtonComponent` and
`BreadcrumbComponent` and the grader compared against nothing, while reading a
criterion that says "the reference components are the local idiom — they define
what 'like the rest of the codebase' means here" and "judge the candidate
against them". Three of four rubrics are affected; `code-idiom` and
`design-intent` are two of the three calibrated ones.

This is very likely a contributing cause of D-126 rather than an independent
bug. A reader told to compare against an exhibit that is not on the page does
not abstain — they compare against the conventions they already carry. The
conventions this reader carries are the kickstartDS ones, and the retired
design-intent notes are made of exactly that: file naming, generated prop types,
`classnames`, `deepMergeDefaults`. Every one of those is a true statement about
the design system and none of them is visible in the material.

**Fix.** `Bundle` gains `context: Record<rubricId, string>` from
`cachedContext()`. The session route sends only the current rubric's block — the
map holds every rubric's and the token list alone is 54 KB. The page renders it
under the material in a `<details>`, collapsed, with the open state held across
items so expanding it is a decision made once. The CLI prints the reference
corpus in full and, for `tokenNames`, a one-line pointer with the count: 1457
names are looked up rather than read, and dumping them before every pair pushes
the criterion off screen, which is the failure D-126 exists to stop.

Shown, never keyed. `material` still decides `labelKey`, so this costs no
labels — and there are none to cost, which is why it is worth doing now rather
than after 153 pairs have been graded without it.

**Verified.** `npx tsc --noEmit` clean. `calibration:export` → 153 items, 0.9 MB
(up from 0.8), `context` carrying 13 KB for `design-intent`/`code-idiom`/
`api-design` and 54 KB for `token-reasoning`. Driving the served page under
jsdom, the first pending pair is `812-restyle-with-tokens` / `code-idiom`: 13 KB
delivered, block visible, collapsed, 398 lines, no live nodes, summary reads
"Also shown to the judge — Reference components from the design system, for
comparison", and `ButtonComponent` is present. The CLI prints the corpus.

Lesson (bd): a cache is an optimisation to the caller and a hiding place to
everyone else. Material split out for a cheaper prompt is still material, and
the split is invisible at the point where someone asks what the judge saw.

### Follow-up: the reference block arrived unhighlighted

Both renderers pick a grammar from the section header, and both only knew one
kind of header. `judgedMaterial()` separates files with `===== path =====`;
`referenceCorpus()` separates the exemplars it concatenates with
`----- slug/file -----`, nested inside a single prose-titled section. A prose
title has no extension, so the whole corpus fell through to `plain` — four
hundred lines of TSX and SCSS delivered as one grey slab, in the block whose
entire purpose is to be compared against, line by line, with the material.

Widened to `/^(?:=====|-----) .+ (?:=====|-----)$/` in both, which is the same
concept in both places: a header line names a file and switches the grammar.

Fixing the CLI half turned up a second, older defect. `languageOf()` took the
text after the last dot in the title, and since D-122 a title may carry the
authorship annotation — `alert.scss (MODIFIED FIXTURE — not written from
scratch)` yields `scss (MODIFIED FIXTURE …)`, which is not a grammar. Every
modified-fixture section in the suite had been printing unhighlighted in the
terminal, and the effect was invisible because unhighlighted is exactly what a
missing grammar is supposed to look like. The browser was never affected: its
`langOf()` regex-tests the whole header, which is now what both do.

Verified: corpus through the CLI highlighter paints all 7 sub-headers and 3226
colour sequences, up from none; stripping the escapes reproduces the input
byte-for-byte; a synthetic D-122 header now highlights. On the served page the
reference block renders 8 headers (1 section + 7 files), 564 tokens across 8
grammar classes, `textContent` identical to what the API sent. The material pane
is unchanged at 152 tokens and still shows the D-122 diff sections.

Lesson (be): a renderer that falls back silently makes its own bugs look like
the absence of anything to render.

### Follow-up: two columns above 1500px

One column put the question and the answer in series: criterion, brief,
references, then material. The references are the exhibit two of the three
criteria tell the grader to compare the material against, and comparing them
meant scrolling one way and then the other, holding a `ButtonComponent` prop
signature in memory across four hundred lines. On a 1920 screen that was being
done inside a 62rem column with a third of the width unused.

Split at `min-width: 1500px` into `#context` (task, criterion, brief,
references) and `#evidence` (material), `1fr / 1.15fr` — material gets the wider
side because it is the longer lines. Below the breakpoint the grid does not
apply and the same elements stack in the same order, so the phone layout D-124
built is untouched.

`#context` is sticky and scrolls internally. Material is routinely ten times
longer, so a left column that scrolled with the page would leave the criterion
off screen for most of the reading, which is the D-126 failure with an extra
step. The reference block open is 8000px, so without `overflow: auto` the
sticky column would be taller than the viewport and stop sticking at all.

Two heights have to be known to place it, and both are set by their contents —
the header by the rater's name and the progress line, the dock by its buttons.
`setChrome()` measures both into `--head`/`--dock` on load, after each item, and
on resize. The task heading moved inside the left column rather than spanning
both, because a spanning row pushes the sticky column one heading below the
header at scroll 0 while its height is computed for the stuck position, and the
difference lands behind the opaque dock — which looks the same as content that
is not there.

**Verified** in a 1920×1080 iframe against the served page: two columns at
829/953px, side by side, single column at 1400 and 900 with `position: static`.
`--head` 47px and `--dock` 64px, both measured. Column bottom clears the dock in
all three states — collapsed at scroll 0 (432 vs 1016), reference expanded (994
vs 1016), and stuck after scrolling 1200px (974 vs 1016) — and scrolls
internally when expanded. Stuck top is 47px, exactly the measured header, with
the criterion still on screen. The diagnoses flyout still opens over the grid.

## D-128 — the labels were never anywhere durable

Asked how the ratings sync, and the honest answer was that they do not. The
store is flat JSON — `calibration/labels/<rater>.json`, keyed by material hash —
and `readRaters()` unions the directory by filename, which is a good design that
had no path into the repository. `git ls-files calibration` was empty and so was
`git check-ignore`: the hand-grading was neither tracked nor ignored, it was
just sitting there. On the host it lived in a Docker volume, which survives a
deploy and nothing else, and which `pnpm judge` cannot read. The retrieval
procedure was a `docker cp | tar x` incantation in a YAML comment.

For an artefact bought with hours of a reviewer's attention — and one that has
already been thrown away once, in D-126 — that is the wrong amount of ceremony.

**Committed, with the questions ignored.** `calibration/bundle.json` is 926 KB,
derived from the results tree and rebuilt by `calibration:export`, so it is
ignored. `labels/` is tracked, `.gitkeep` included so the directory exists in a
fresh checkout, and `labels.retired-2026-08-11.json` goes in too: it is the
evidence for D-126 and deleting it would leave that entry asserting something
unverifiable.

**`pnpm labels:pull`** (`bin/pull-labels.ts`) reads the volume over ssh —
`docker cp …/. -` into a tar on stdout — and merges into `calibration/labels/`.
Two `execFile` calls rather than one `ssh … | tar x` string, because the host
comes from an environment variable and has no business reaching a shell as text;
the remote half is a constant, with `head -1` on the container lookup because a
deploy briefly runs two and `docker cp` would otherwise be handed two ids.
`--from <dir>` merges files saved through the "download my labels" link instead,
for anyone without ssh to the host, and `--dry` reports without writing.

The merge is per _label_, not per file. The same person grades on a laptop
against a checkout and on a phone against the deployment, so `julrich.json`
exists in both places holding different answers and copying either over the
other silently destroys a session. Keys are material hashes, so the maps union;
the only real conflict is the same key answered twice, settled by `labelledAt`,
newest wins. Nothing is ever removed — a key that is local and not remote is a
label graded here and not yet pushed, which is the normal state of the file.

**Verified** against a constructed local/remote pair covering all four cases:
local-only kept, remote-only taken, newer-local kept, newer-remote taken; `1
new, 1 newer, 1 already held`. `--dry` left the file byte-identical. A second
pass reports `0 new, 0 newer, 3 already held` and writes nothing, so pulling
twice is a no-op rather than a way to lose work. Missing host names the three
ways out. `git add -n` under `calibration/` adds the retired labels and the
`.gitkeep` and nothing else; `bundle.json` resolves to the new ignore rule.

Lesson (bf): "it is on the server" is a statement about where something is, not
about whether it still exists. A volume that outlives deploys and dies with the
host is the same as no backup for anything that cannot be regenerated — and
hand-grading is the one artefact here that cannot.

### Follow-up: "download my labels" was 401 on the deployment

Every request the page makes goes through `url(path)`, which appends `?rater=`
when the gate is up. The export link was a static `href` written into the markup
and was therefore the only thing on the page that did not — and it is also the
only request the _browser_ issues rather than `fetch()`, so it was the one place
the pattern could be forgotten without anything else breaking. `raterOf()` found
no query, no cookie, and answered `{"error":"no rater"}`.

Set in `load()` from the same `url()` every fetch uses, and hidden until then: a
link that is only ever wrong is worse than no link.

The failure also locates the deployment. `raterOf()` prefers the JWT subject
whenever `MCP_JWT_SECRET` is set, and session and export share it — so with auth
on, export cannot fail while the page works. That it did means the deployed site
is running open, which the deploy config warns against in as many words, on a
tree that carries full agent transcripts. Flagged separately; not a code change.

**Verified** against the running server in both modes. Open: the old bare href
reproduces `401 {"error":"no rater"}` exactly, the rendered href is
`/calibrate/api/export?rater=probe` and returns 200 with
`attachment; filename="probe.json"`. Authed, with a throwaway secret and token:
the href stays bare — correct, the subject comes from the cookie — the header
resolves the rater to `probe`, export returns 200, and the API still 401s
without the cookie.

Lesson (bg): `PAGE` is a `String.raw` literal, so a backtick anywhere inside it,
including in a comment, ends the page. `server/` is excluded from tsc and runs
under Node's type stripping, so the only thing that catches it is starting the
server — `typecheck` passes on a file that cannot be imported.

### D-129 — the judge was never shown any client behaviour

Found while calibrating: `832-client-behaviour` is the one task in the suite
whose subject is the client-behaviour convention, and no rubric could see a
client file. `discoverGraded()` finds it — the deterministic `client-behaviour`
grader reads it — and `judgedMaterial()` assembled component, styles, token
partial, schema, and dropped it. Verified on `cc-both-sonnet-high/832/run-1`,
where the agent wrote `js/Disclosure.client.js` and all three calibrated rubrics
were handed `DisclosureComponent.tsx`, `disclosure.scss` and
`_disclosure-tokens.scss`.

It survived because the system prompt's "behaviour implemented with React state
shows it is not in the client bundle" is a real inference that does real work —
ADR 86 found that exact observation among the retired `design-intent` notes. It
is one-sided: it catches the wrong answer and is blind to the right one, so
scores moved on failure and stayed flat on success. `design-intent` 0.85/0.85/
0.90, `code-idiom` 0.85/0.90/0.90, and not one reason string mentions the file.

`code-idiom` was worse off still — its references are supposed to _define_ the
idiom, and `parts()` listed no client file while neither exemplar had one to
list. Both sides of the comparison empty.

Fixed as ADR 87: `include.client` on `design-intent` and `code-idiom`,
`judgedMaterial()` pushing every discovered client file through the same
`authored()` gate, and `gallery` added to the exemplars with
`${Pascal}.client.js` added to `parts()`. Not `section`, whose client directory
holds `spotlight.client.js` and `spotlight` is a target.

**Verified.** Both rubrics now receive `js/Disclosure.client.js`;
`token-reasoning` deliberately does not. `860-restraint`, which ships a working
`Tag.client.js` and asks for it to be left alone, still shows nothing — the
authorship gate drops untouched files. Corpus is now 12 sections, 30,712 chars,
gallery contributing 16,814. `typecheck` and `graders:selftest` clean.

**Outstanding:** the corpus lives in the shared cached context, so this
invalidates `design-intent` and `code-idiom` on every trial. `judge --all` (dry)
reports 120 calls to make against 60 already answered — the 60 survivors are
`token-reasoning`, the only rubric taking no exemplars — at **$3.81**. Not run;
spending is the operator's. Any human labels already recorded on `832` pairs are
keyed to material that no longer matches and will need re-grading.

Also noticed, and fixed as D-130 below: `parts()` looked for
`_${slug}-tokens.scss` and `breadcrumb`'s partial is `breadcrumb-tokens.scss`,
without the underscore.

Lesson (bh): an inference that lets a judge reach the right verdict without the
evidence is not a substitute for the evidence, and it hides the gap better than
absent material would. This is the third time `judgedMaterial()` has dropped a
file `discover()` had already found (D-115, D-119, D-129): discovery returning a
field and the judge being shown it are different facts, and only one of them
shows up in the output.

### D-130 — the corpus asks for roles, not filenames

`parts()` listed one spelling per file and `existsSync` dropped anything else.
`breadcrumb`'s token partial is `breadcrumb-tokens.scss`; the list asked for
`_breadcrumb-tokens.scss`. Both spellings are in the design system today and
neither is wrong, so the corpus had been showing three of that component's four
files since the day it was written, with nothing to indicate it — and the file
it was missing is the one carrying the token layering that `design-intent` and
`code-idiom` are meant to compare against.

Each entry is now a list of accepted spellings for one role, first match wins.
A role may legitimately be absent — `button` has no client behaviour — but it
can no longer be _missed_ for being spelled the other legal way.

**Verified.** Corpus is 13 sections / 31,221 chars, with
`breadcrumb/breadcrumb-tokens.scss` present. `typecheck` clean. The re-judge
estimate is unchanged at 120 calls / $3.81 — the corpus was already invalidated
by D-129, so this rides along for free if run in the same pass.

Lesson (bi): a lookup by exact filename is a silent filter wearing a helpful
face. `existsSync().filter()` cannot tell "this component has no token partial"
from "this component spells it differently", and it reports both as nothing.

### D-131 — "by you" counts the queue, not the file

Follow-on from D-129. Re-keying orphans every label formed against the older,
narrower material, which is the design working: the pair returns to the queue
and the stale answer stops being consulted. The progress line did not say so.
`done` was `bundle ∩ answered` and had already dropped the orphans; `mine` was
`Object.keys(readLabels(rater)).length`, straight off disk, and had not. So a
rater who had graded three pairs that then re-keyed read `0 of 153 graded · 3 by
you` and reasonably concluded something had broken.

Nothing had. `mine` is now intersected with the bundle, the same rule as `done`.

Two things this exposed that are worth stating plainly, because both look like
bugs and neither is:

- **Labels survive a redeploy, and must.** They live in the
  `ruhmesmeile-agent-eval-labels` volume, mounted over `calibration/labels/`.
  Re-exporting the bundle and rebuilding the image cannot clear them — the
  Dockerfile is explicit that labels written through the web app must not be in
  the image or the next deploy would replace them. Seeing old labels after a
  rebuild is the volume doing its job.
- **Orphans never contaminate a number that matters.** `agreement()` iterates
  candidates and looks up `labels[key]`, so a label with no live pair is
  unreachable rather than miscounted. They stay in the rater's file as a record
  of work that no longer answers anything, which is the same reason
  `legacyRater()` exists.

**Verified.** Fresh `bundle.json` (15:44) postdates the D-129/D-130 edits
(15:25–15:31), so the export did carry them. `/calibrate/api/session` on the
rebuilt bundle: 153 total, 153 remaining, `done` 0, `mine` 0. `server/` is
outside `tsconfig`, so it was syntax-checked with `node --check` instead.

Lesson (bj): two counters on one line under two different rules is a bug even
while both are individually correct, and the one that will be believed is the
one with the reader's name on it.

### D-132 — a reset route, archiving rather than deleting

Asked for directly, and the gap was real: the volume is what makes labels
survive a deploy, and it was also what made them impossible to undo without a
shell on the host. `POST /calibrate/api/reset` takes `scope` (`"orphans"` or
`"all"`) and `confirm` (the caller's own rater name), moves the matching labels
to `calibration/labels/retired/`, and touches nobody else's file. See ADR 88
for why each of those three is load-bearing.

`"orphans"` exists for exactly the D-129 situation — labels stranded when the
material under them widened — but it is not wired to the UI, because since
D-131 an orphan is neither counted nor consulted and clearing it is tidying.
The header link runs `"all"`.

**Verified**, end to end against the real bundle. Route: label written →
`done=1 mine=1 remaining=152`; bad scope 400; wrong `confirm` 400; missing
rater 401; `"orphans"` against a live label removed 0; `"all"` removed 1,
archive on disk with the key in it; queue back to `remaining=153`, which also
confirms `answered()` does not see the `retired/` subdirectory; a second reset
on an empty file is a no-op rather than an error. UI: Cancel changes nothing,
wrong name surfaces the server's message and leaves the label, the real path
reports `1 archived to retired/probe-…json` and the queue reloads.

Two things the browser found that review would not have:

- **`prompt()` is not universally available.** The first implementation used
  it; VS Code's embedded browser throws `prompt() is not supported`. Replaced
  with a `<dialog method="dialog">`, which is better anyway — Enter submits the
  first button (Cancel) and Escape closes with no value, so a grader's reflexes
  after an hour of `p`/`f`/`u` all resolve to "no".
- **The global shortcut handler kept listening behind the modal.** It already
  ignored keystrokes aimed at an input, so typing a name was safe, but clicking
  the dialog's background and then pressing `p` would have passed the item
  underneath. It now returns early while the dialog is open — returning, not
  preventing, so Escape still reaches the dialog.

Escape could not be confirmed here: the embedded Electron browser swallows it
before the page sees it, same class of artefact as the missing `prompt()`.
`CloseWatcher` is present and nothing in the page calls `preventDefault` on it,
so this is the harness rather than the code — worth one press in a real browser
on the next deploy.

Lesson (bk): the guard on a destructive control is not only the confirmation in
front of it. Everything the page was already listening for is still listening
while that confirmation is on screen.

Lesson (bl): `server/` is outside `tsconfig` _and_ its page is a string, so
neither `typecheck` nor any test sees it. Both bugs above were found by opening
the thing and clicking it, which is the only tool that works on this file.

### D-133 — reasons are ids, sentences are a dictionary

Asked for, and overdue. A label stored the picked sentences verbatim, which
made rewording an entry destructive — `reasons.ts` admitted the nine originals
were frozen "for that reason and not because they could not be phrased better".
A list transcribed from what people say is a list that will be rephrased; a
store that punishes rephrasing freezes the first draft and then that draft gets
mistaken for a considered one.

Labels now store `reasons: ["schema-types"]`. Sentences live in
`calibration/reasons.json` and are resolved on the way out. `note` narrows to
the residue the pick list had no entry for, which is exactly the material new
entries get transcribed from — so the tally that decides what earns a line is
now mechanical rather than a grep. See ADR 89 for why the dictionary is JSON in
`calibration/` rather than an array in `lib/`.

Two side effects worth naming. The **rubric scope is now enforced on write**,
not just when rendering the list — an id belonging to another rubric is dropped
by the server, which is what makes the scope a property of the store rather
than a UI convention. And **rewording no longer needs a re-export**: the image
copies `calibration/` but not `lib/`, so the hosted grader reads the dictionary
directly instead of the copy that used to be frozen into `bundle.json`.

**Verified.** Dictionary served from disk (13 entries); a submission mixing a
valid id, another rubric's id, a non-existent id and a number stored exactly
the valid one; the 8 existing labels migrated to 6 recovered ids plus residue,
with the all-prose design-intent label correctly recovering nothing; rewording
`react-behaviour` changed both the served list and `describeLabel()` output for
a label stored under the old wording, with no re-export and no label file
touched. `bin/migrate-labels.ts` is idempotent (second run: 0 migrated) and
should be re-run after any `labels:pull` that predates the redeploy.

**The Docker volume is left alone, deliberately.** The deployed server reads
only _keys_ out of label files — `answered()` unions `Object.keys`, and nothing
on that page displays a note — so prose in the volume changes nothing there.
Nor can a later pull undo the migration: `merge()` overwrites only when
`labelledAt` is strictly newer, and migrating does not touch it, so re-pulling
the unmigrated volume counts those keys as already held. The one real gap is
that the deployment keeps _writing_ prose until it is redeployed, which
`migrate-labels.ts` closes after the next pull. No push was added; the pull
script is explicit that the volume "is not a backup", and a second writer to it
would make it authoritative for something it was never meant to hold.

**The correlation is in.** With 180 verdicts cached, `design-intent` and
`code-idiom` agree on 47 of 60 trials, and all 13 disagreements point the same
way: `design-intent=pass, code-idiom=fail`. There is no trial where
design-intent fails and code-idiom passes. On this corpus design-intent's fails
are a strict subset of code-idiom's — it is a coarser version of the same
question, which is what showing two rubrics near-identical material predicts.
It still separates the arms cleanly (cc-none fails almost everywhere, cc-both
nowhere), but that separation is already carried by code-idiom. Deciding what
to do with it — re-scope by narrowing its `include`, or retire it — is D-134's
business, and it is cheap either way because grading is retroactive.

**Still open, and the reason this came up:** `design-intent` has one entry, and
two sittings have now answered it entirely in code-idiom vocabulary. The
distinction as written is real — code-idiom is conventions you could link a rule
for, design-intent is shape you could not — but the two rubrics are shown almost
identical material (the only difference in `include` is the brief), so the
question arrives twice. The correlation above says the judge cannot tell them
apart either. Whichever way that gets resolved, widening design-intent's
`rubrics` tags to borrow code-idiom vocabulary would have made the two
identical by construction and destroyed the evidence — which is why it was not
done.

Lesson (bm): a store that makes a name expensive to change will freeze the
first draft of that name. Store the identifier; look up the prose.

### D-134 — design-intent no longer sees the stylesheet

Acting on the correlation in D-133. `design-intent`'s `include` drops `styles`,
leaving `{ prompt, client, exemplars }`, and its criterion is rewritten to
match — a rubric shown less than its question needs fills the gap rather than
abstaining (D-102), so narrowing the material without narrowing the question
would have been the worse of the two states.

The new criterion names what it wants judged (markup structure, what was made
configurable, how variants and states are expressed, whether this is the right
kind of component), says the stylesheet is withheld on purpose, and carries the
one-line test that separates the two rubrics: **if your objection disappears
once every identifier is renamed, it is not an objection this rubric wants.**
That is the sentence to grade by. `client` stays — where behaviour lives is
shape, not naming, and withholding it is one-sided (D-129).

**Effects.**

- Calibration items: **153 → 141**, design-intent **51 → 39**. Twelve trials
  were distinguishable only by their stylesheets and now dedupe into one
  question each. Twelve fewer hand-gradings, and the finding restated as
  arithmetic.
- One label orphaned by the re-key: the design-intent fail whose note was
  entirely free text. Left in place rather than retired — unreachable by
  `agreement()`, and the clearest surviving evidence of the problem.
- Sixty cached design-intent verdicts invalidated (criterion hash _and_ prompt
  hash). The other three rubrics keep their caches. No agent re-run: grading is
  retroactive.

**To pick up:** `pnpm judge --all` for the dry cost, then `--apply`. Then check
the same cross-tab again — if design-intent still never fails alone, the
material was not the problem and the rubric should be retired rather than
narrowed a second time.

Lesson (bn): when two measurements agree more than they should, look at what
each is shown before looking at what each is asked. Wording is what you control;
material is what actually arrives.

### D-135 — the re-judge result: vocabulary separated, verdicts did not

**The headline number first, corrected.** A cross-tab read straight out of
`judge.json` said n=60. It is n=48. Twelve trials — all of
`812-restyle-with-tokens` — no longer have an askable design-intent, and their
cached verdicts are pre-narrowing. Corrected:

| design-intent / code-idiom | trials |
| -------------------------- | ------ |
| pass / pass                | 25     |
| fail / fail                | 12     |
| **pass / fail**            | **11** |
| fail / pass                | **0**  |

Still zero. Design-intent's failures remain a strict subset of code-idiom's.

**But the reasoning did separate, and that is the finding.** Design-intent now
argues shape — "composition of smaller components (Button, Headline, Icon,
Text), variant expressed via closed enum, client behaviour in a separate file" —
and passes trials that code-idiom fails for the wrong class prefix, a missing
`_*-tokens.scss` partial, and props declared inline instead of imported from
generated types. Those are two different objections in two different
vocabularies. Before D-134 they were the same sentences.

So the earlier diagnosis was wrong in an interesting way. Design-intent was not
a copy of code-idiom; the corpus does not contain a shape failure that is not
also an idiom failure. Sonnet gets the shape right and the conventions wrong, so
the coarser question never fires first. Leakage is reduced, not gone: `no
deepMergeDefaults` and `props declared inline` still appear in design-intent's
fail reasons, and both are code-idiom entries (`no-defaults`, `schema-types`).

**Design-intent is now unaskable on twelve trials.** On a restyle the agent
authors only the stylesheet — component and schema are unmodified fixtures that
`authored()` drops — so with `styles` withheld there is no material and the
rubric is skipped. Honest (a restyle contains no shape work) and consistent with
`requires` on `api-design` (D-100), but _emergent_: it holds because the file
set comes out empty, not because anything declares that design-intent needs
authored component source. Worth declaring if a future restyle task also touches
the TSX.

**No code fix needed for the stale entries.** `lib/graders/judge.ts` filters
`cache.results` through `buildPrompt` before scoring and `calibration.ts` builds
candidates from `judgedMaterial`, so both already ignore them. Reports are
clean. The contaminated reading was the ad-hoc script's.

**Open, and it is a scoring decision rather than a technical one:**
design-intent is still `calibrated: true`, so a signal that never fires
independently gets a second vote in the composite. Setting it to `false` keeps
the column and its now-distinct reasoning visible while stopping the
double-count — which is the exact case the flag was written for. The counter-
argument is that this corpus is five tasks and one model, and the rubric may
earn its weight the moment a weaker model starts getting shapes wrong; the Haiku
campaign is the cheap test. Not changed pending a call.

Lesson (bo): a cache keyed by rubric is a superset of what is currently asked,
and stays a superset silently. Every consumer in this codebase filters it back
down through `buildPrompt`; the one that forgot was a throwaway script, which is
where that filter is easiest to omit and hardest to notice missing.

#### Amendment — the empty cell is the prediction, not the defect

D-135 read "design-intent never fails alone" as redundancy. Reading the two
rubrics' prose side by side says otherwise.

Where both fail (12), design-intent objects to: React `useState` for dismissal
instead of a client-bundle class wired via `useKsComponent`; raw SVG `<use>`
instead of the design system's `<Icon>`; no Context/Provider seam; no
`forwardRef`; and, once, `aria-expanded={defaultOpen}` baked as a static value
that never updates on interaction. Where only code-idiom fails (11), it objects
to: the client file in a `js/` subdirectory; a `ksd-` prefix instead of `dsa-`;
a missing `_*-tokens.scss` partial; `:root` instead of scoping tokens to the
component class; a hand-rolled `cx`; an import from `@kickstartds/ds` instead of
`@kickstartds/base/lib/*`.

Both lists are conventions. Neither is a law of nature, and the search for a
category of judgement that is "not idiom" was always going to come up empty —
that is what "does it look like a kickstartDS component" could never answer.
What separates the lists is not subject matter but **repair cost**. Everything
in the second is fixed by moving a file or a find-and-replace. Nothing in the
first is: you cannot rename your way from `useState` to a client bundle, and the
`aria-expanded` case is not a divergence at all but a component that does not
work.

Under that reading the pair is a three-tier ladder — fine (25), needs editing
(11), needs rewriting (12) — and an empty `fail/pass` cell is not evidence of a
copy, it is the reading's central prediction. A rubric whose failures are a
strict subset of another's is exactly what nesting looks like.

This is post-hoc and is recorded as such. It is also falsifiable: one trial with
design-intent failing where code-idiom passes refutes it outright. The Haiku
campaign is the test — a weaker model should produce more `fail/fail` and still
no `fail/pass`.

Two things it does not excuse. The leak is real and now runs **both** ways:
`deepMergeDefaults`, "props interface defined inline" and "no `HTMLAttributes`
spread" appear under both rubrics, and code-idiom cites the Context/Provider
pattern in four of its eleven solo failures — a rewrite-grade objection raised
by the rubric that is supposed to own cheap ones. And the composite still adds
the two as equal votes, which under the ladder reading prices a rewrite and a
rename the same.

**The earlier recommendation to set `calibrated: false` is withdrawn**, pending
Haiku. Retiring a rubric from scoring because it never fires alone is the wrong
move if never firing alone is what it is supposed to do.

**Proposed, not yet done — separate the two by repair cost rather than by
topic.** Every attempt so far has tried to split them by subject matter, and
each one has failed the same way, because they genuinely share subjects.

1. Rewrite both criteria around the question a maintainer actually asks: would
   this need **rewriting** (design-intent) or **editing** (code-idiom). That is
   mutually exclusive by construction in a way "shape versus naming" never was,
   and it settles the Context/Provider tug-of-war on principle rather than by
   taste.
2. Tell code-idiom explicitly to ignore anything that would require rewriting
   the component — the mirror of the renaming test design-intent already
   carries. Today only one of the two rubrics is told where its edge is.
3. Declare design-intent's dependency instead of leaving it emergent:
   `requires: ["component"]`, the machinery `api-design` already uses for
   `schema`. `812` then reads as deliberately out of scope rather than as a
   rubric that silently found nothing.
4. Encode the falsification in `report`: any `fail/pass` between the two is a
   loud failure, not a row in a table. That is what turns a post-hoc story into
   a claim that can break.
5. Report the pair as a tier rather than as two independent scores.

(1) and (2) re-key every cached verdict for both rubrics and cost a re-judge of
each; (5) is a scoring-model change. None are free, so none are taken here.

### D-136 — design-intent gets a vocabulary, and the page says which rubric it is

D-134 gave design-intent its own question and D-135 showed it now argues in its
own terms. The pick list did not follow: it offered exactly one entry
(`react-behaviour`), against eight for code-idiom. A rater who sees one plausible
box and seven blank lines writes prose, and the prose they write comes from the
rubric they have vocabulary for. The single design-intent label collected so far
is all free text, which is the same failure in advance.

Seven entries added, each drawn from something the judge has actually said or
the criterion actually names, and each surviving the criterion's own test —
rename every identifier in the candidate and the objection is still there:
`reimplements-primitive`, `not-overridable`, `monolithic`, `open-variant`,
`no-forward-ref`, `styling-props`, `wrong-kind`. Design-intent now offers eight,
matching code-idiom.

`styling-props` is tagged for `api-design` as well, on the same grounds as
`schema-types` being tagged twice: what a component fixes rather than exposes is
genuinely both a shape decision and an API decision. That is the only new dual
tag, and dual tagging stays the exception — it is the mechanism that lets a
verdict be explained in another rubric's words, which is what the scoping is for.

The page now prints the rubric **id** next to both the heading and the diagnosis
list. The label was already shown and is a sentence; the id is the word the
checklist, the ADRs and `reasons.json` all use, so it is the one that connects a
diagnosis to everything written about it. Its hover text is the first paragraph
of the criterion already printed underneath — every criterion opens with the
one-line version of itself, so no second description was written and none can
drift out of step with the first.

Deploying this needs nothing exported: `reasons.json` is read per request. It
does need a deploy, since `calibration/` is baked into the image.

### D-137 — the nesting claim is encoded, design-intent declares what it needs, and no diagnosis is both

Three changes falling out of the D-135 amendment, all free and all retroactive.

**The prediction is now checked.** If `design-intent` and `code-idiom` differ by
repair cost rather than by subject, they are a severity ladder, and a candidate
cannot be foreign in construction while being flawless in convention —
`design-intent: fail` with `code-idiom: pass` cannot occur. It has not occurred
in 48 comparable trials. That is either a real invariant or a coincidence in one
model's output, and the difference between the two is whether anyone would
notice it breaking. `NESTED` in `rubrics.ts` names the pair, `checkNesting()`
compares the cached verdicts, and `pnpm judge` prints the result on every run —
dry included, since the point of encoding a prediction is that nobody has to
remember to look for it. A violation prints the offending addresses and exits
non-zero. Verdicts are still written first: the judging succeeded, the claim is
what failed.

Only trials where **both** rubrics are currently askable are compared. That is
the whole of lesson (bo): the first version of this cross-tab, written by hand
an hour earlier, counted twelve stale verdicts and got the answer wrong.

**`design-intent` now declares `requires: ["component"]`.** Withholding the
stylesheet (D-134) already made it unaskable on all twelve
`812-restyle-with-tokens` trials, because the component and schema there are
unmodified fixtures that `authored()` drops and the material came out empty. The
outcome was right — a restyle contains no construction to judge — but it held by
accident of one task's file set. The next task that edits a stylesheet _and_
touches the component would have had this rubric grading a shape nobody changed.
`requires` widens to `Array<"styles" | "schema" | "component">` and the check
sits beside the two that were already there. Cost: nothing. `buildPrompt` already
returned `null` for those trials, so no cache key moved and the dry run reports
0 calls outstanding.

**No diagnosis may be tagged both `design-intent` and `code-idiom`.** Asked how
`react-behaviour` could be both, the honest answer is that it cannot. The two
rubrics differ by what it costs to be wrong, so a diagnosis belongs to exactly
one: fixed by moving a file or a find-and-replace, or needing the component
rewritten. React state where a client bundle belongs is not something you rename
your way out of, so the entry is design-intent's alone. Tags spanning _other_
pairs stay — `schema-types` is code-idiom and `api-design`, `styling-props` is
design-intent and `api-design` — because those are different axes rather than two
points on one. D-136 called dual tagging "the exception"; it is now the exception
everywhere except across this pair, where it is a contradiction.

One stored label is affected: a `code-idiom` verdict whose four picks are
`schema-types`, `react-behaviour`, `wrong-filename`, `no-defaults`. Left as it
is. The id still resolves in reports, only the checkbox stops rendering, and
re-saving that pair would drop it — which is the correct outcome and worth
seeing happen rather than migrating away. It is also the cleanest evidence for
the change: the one time `react-behaviour` was picked by a human, it was picked
under the rubric that is not supposed to be asking about it, alongside three
diagnoses that are all genuinely convention. That is the bidirectional leak from
the amendment, showing up in a human label rather than a judge's.

**Lesson (bq):** an invariant nobody has written a check for is a description of
the data you happened to look at. The check is what turns it into a claim.

### D-138 — both criteria rewritten around repair cost, and the check changes meaning

The labels went first, because they are not hashed and cost nothing: "Is shaped
like a component of this design system" and "Reads like the rest of the
codebase" are the same sentence twice, and a rater reading them back to back
learns nothing about which one to care about more. Now "Built like this design
system — differences need a rewrite" and "Written like this codebase —
differences need an edit": subject first, cost second, parallel, so the ladder is
visible before the criterion argues for it.

The criteria had three faults, all of them the same fault seen from different
sides.

**`code-idiom` was asking about shape.** Its second paragraph said to compare
"naming, file structure, class-name scoping, **how props are threaded**, and how
the stylesheet is organised". How props are threaded is design-intent's — its
own criterion names "behaviour threaded through props where the references keep
it in the client bundle" as its example of a wrong shape. The two criteria
contradicted each other in writing, and that phrase is the most likely licence
for the Context/Provider objections in 4 of code-idiom's 11 solo failures. It is
replaced by the things that actually turned up in those failures: file names and
placement, imports, class prefixes, missing companion files, stylesheet and
token organisation.

**`code-idiom` had a floor and no ceiling.** "Ignore formatting a formatter would
fix, and ignore anything already covered by lint" bounds it from below. Nothing
bounded it from above, so every rewrite-grade objection was in scope. It now has
both bounds, and the upper one is explicit about why: raising a rewrite here
does not count it twice, it makes this measurement a copy of the other one.

**design-intent's test was narrower than the rule it stood for.** "Renaming a
file, a class or an import would settle" covers renames, but not _moving_ a file
(the `js/` case) or _adding_ a missing tokens partial — both code-idiom solo
failures, and both fair game for design-intent as written. The test is now the
cost itself rather than one instance of it, and it survives moving files as well
as renaming identifiers.

**What this costs, and what it costs that is not money.** 108 calls, $3.40,
measured by the dry run rather than estimated. Human labels are untouched —
`labelKey` is rubric plus material hash, deliberately not the criterion.

The part that is not money: `checkNesting` no longer tests what it was written
to test. Told to ignore anything needing a rewrite, code-idiom can hardly
produce the inversion, so the check moves from _is the ladder real_ to _do the
rubrics stay in their lanes_. Both are worth watching; only the first was
interesting. The evidence for the ladder is therefore fixed at what it was
before this decision — 48 comparable trials, no inversion, under criteria that
never mentioned cost — and it does not get stronger from here. Those verdicts
are archived at `results/judge-pre-d138.tar.gz` (60 files, 32K) because the
re-judge overwrites them per rubric and that run cannot be reproduced once the
criteria have changed.

Sequenced before calibration on purpose. Grading against a cache that answered
the previous question spends the scarce resource — human attention — on an
instrument already known to be miscalibrated.

**Lesson (br):** fixing an instrument invalidates the experiment that showed it
was broken. That is not a reason to leave it broken; it is a reason to write
down what the old instrument measured before replacing it, and to stop quoting
the check as evidence for the thing it no longer tests.

### D-139 — the ladder is refuted, on the first run, by the trial it said could not exist

108 calls, $3.40, and one inversion:
`cc-both-sonnet-high/840-reuse-over-native/run-1`.

> **design-intent, fail.** "The component manually instantiates its client
> behaviour class inside a `useEffect` hook rather than using the design
> system's `define(identifier, Class)` pattern that auto-registers the component
> for declarative hydration, as seen in the Gallery reference. This
> fundamentally changes how interactive behaviour is wired and would require
> rewriting the behaviour integration approach."
>
> **code-idiom, pass.** "The component follows the design system conventions:
> correct file naming pattern, `dsa-` class prefix, token partial with `_`
> prefix, context/provider pattern, forwardRef usage, and stylesheet
> organisation. Minor deviation is placing client JS in a `js/` subdirectory
> rather than alongside the component file as in Gallery, but this is a
> reasonable organisational choice rather than a dialect violation."

Conventionally flawless, structurally foreign. That is the cell D-135's
amendment said could not be occupied, argued cleanly from both sides, and the
reasoning holds up on reading.

**Why it only appeared now, which is the actual finding.** The subset relation
was an artefact of the contamination it was inferred from. Old `code-idiom` was
told to judge "how props are threaded" and cited Context/Provider in 4 of its 11
solo failures — it was partly grading shape, so it failed wherever design-intent
failed, and the nesting was the leak showing up as structure. D-138 confined each
rubric to its own repair-cost band and they came apart on the first run. That is
D-134's stated goal reached: two measurements rather than one and a coarser copy
of it.

Note the shape of this. D-138 predicted the rewrite would make the check
tautological — code-idiom is now explicitly told to ignore rewrite-grade
objections, so an inversion should have been near-impossible by construction. It
happened anyway. A refutation that survives the instrument being biased against
it is worth more than one that does not.

**What changes.** The invariant is retired rather than defended. `NESTED` becomes
`PAIRED`, `checkNesting` becomes `checkDivergence`, and the CLI prints the count
and the addresses instead of exiting non-zero. The alarm existed for "this cannot
happen"; it happens, we know why, and leaving it in place would fail every future
run on a legitimate result. What remains is worth printing on its own merits — a
candidate that clears every mechanical convention check and is still built wrong
is exactly the case the deterministic graders cannot reach, and the reason there
is a judge at all. "Competent but foreign" is now a reported class, currently 1
of 48.

Guarding against the obvious failure mode: this is not the check being defanged
because it gave an inconvenient answer. The answer is convincing, and the
response to a refuted claim is to retire the claim, not the evidence. Both
rubrics keep `calibrated: true` — the result strengthens them.

**One bug, visible in the run's own output.** The per-trial summary printed
`design-intent=pass` beside all twelve `812` trials in a run that never asked
design-intent about them. `judgeTrial` returns the whole cache, the CLI printed
it unfiltered, and the narrowed rubric's pre-D-134 answers read exactly like
fresh ones. Third sighting of the same superset (D-135, then this file's own
cross-tab, now the CLI). An exported `askable(trial)` is now the single place
that answers "which rubrics have material here", and everything reporting
verdicts to a human goes through it.

**Lesson (bs):** a measurement that agrees with another may be agreeing about
something it was not supposed to be looking at. The two rubrics did not converge
because the work made them converge; one of them was reading the other's
material. Separation is evidence of independence only once you have checked that
both were confined to their own question.

### D-140 — the reason dictionary had drifted from the criteria it serves

D-138 rewrote two criteria and nothing checked whether the pick list a human
grades with still matched them. Auditing all twenty entries against the current
text, one rubric was badly served:

- `invented-tokens` — **removed.** The `token-reasoning` criterion's second
  paragraph says "the deterministic graders already checked that every token
  referenced exists ... you are judging _choice_, not validity", and
  `tokenConformance` does compute exactly this, by name, against the real
  registry. The chip invited a human to fail a trial the deterministic score
  had already docked.
- `hardcoded-fallbacks` — **removed**, same side of the same line. A `var()`
  fallback is mechanics.
- `wrong-token-prefix` — **retagged `code-idiom`.** It is `wrong-prefix`'s twin,
  a find-and-replace over a naming convention, filed under tokens because it has
  "token" in the name.
- `callback-props` — **gained `design-intent`**, whose criterion names it in as
  many words: "behaviour threaded through props where the references keep it in
  the client bundle". It had only `api-design`, which is ungated and unaskable
  across the whole suite, so the diagnosis was unreachable from any rubric
  actually being asked.
- `open-variant` — **gained `api-design`**; both criteria name closed variant
  sets, and these are different axes rather than one rubric borrowing the
  other's subject.
- `wrong-placement` — **added**, `code-idiom`. Transcribed from the judge's own
  verdict on the D-139 trial: "placing client JS in a `js/` subdirectory rather
  than alongside the component file". `wrong-filename` is about what a file is
  called; the criterion has always asked about both — "file names and where
  files are placed" — and the list had a chip for one half.

That leaves `token-reasoning` with a single chip, `no-component-tokens`. The
count is the finding, not a problem to fix by topping it back up: the list had
become a validity checklist under a semantics heading, and one honest entry is
worth more than four that point elsewhere. If real semantic complaints show up
in free text during calibration, they earn lines then.

**Two entries were considered and refused.** A chip for a missing companion
file, and any replacement for the removed token chips, would both have been read
out of a criterion rather than transcribed from something a person wrote — the
exact move this file's SCSS-flatness paragraph (D-122b) declines. A pick list
derived from the rubric stops being evidence about what humans notice and
becomes a second copy of the rubric, which is how the last three sessions'
worth of contamination got in.

**Two labels violated an invariant nobody was checking.** `no-forward-ref` and
`styling-props`, both added in D-136, contained commas — and notes from several
raters are joined with `", "` when rendered, which is why the file forbids them.
Reworded; labels are not stored, so this costs nothing. Same shape as D-139's
display bug: a rule stated in a doc comment, obeyed by everything written before
it, quietly broken by the additions that came after.

**Stored labels are left alone**, per D-137. Three carry the dropped ids —
`token-reasoning:6b80b94501b0bbd0` (`810-atom-from-schema/run-3`, fail) is
justified by all four token chips, three of which the rubric does not grade;
`44346fbf0c04f659` by `invented-tokens` plus `no-component-tokens`; and a
`code-idiom` label on `832-client-behaviour/run-1` carries the free-text note
"invented design system token" under a rubric with no token chip at all. The ids
still resolve in reports, only the checkboxes stop rendering, and re-saving would
drop them silently. They are also the evidence for this edit, which is the better
reason to keep them.

Free: labels and reason ids are not hashed, no verdict is re-keyed, no call is
made. Verified 19 entries, zero design-intent+code-idiom duals, zero commas,
zero duplicate ids, typecheck clean.

**Lesson (bt):** when you fix an instrument, the things calibrated _against_ that
instrument are now out of date too, and they will not announce it. The criteria
and the pick list are one artefact in two files with nothing tying them
together — D-138 changed one and left the other pointing at the previous
version for two sessions.

**Superseded — see the footer at the end of this document.**

## D-141 — the calibration came back, and the disagreements clustered

All 60 trials labelled by hand across three rubrics — 141 pairs, not the
representative sample the plan asked for. Agreement: `design-intent` 34/39
(87%, κ 0.75), `code-idiom` 37/51 (73%, κ 0.41), `token-reasoning` 35/51
(69%, κ 0.46). Overall 106/141.

The rate was the least useful number in the report. The 35 disagreements
reduce to **one cause per rubric**, each visible in the judge's own prose:

- `token-reasoning` is asked whether token choices are semantically apt and is
  shown the token list, so it checks whether the tokens _exist_. Eleven of its
  fourteen misses are existence-checking wearing a semantics label.
- `code-idiom` produced ten `pass→fail` misses; **eight were the same
  objection** — that a client file under `js/` is misplaced. The corpus held
  exactly one client file, `Gallery.client.js`, flat. The judge generalised one
  sample into a rule.
- `design-intent` was the lenient one, and the only rubric with zero
  `pass→fail`. Its misses are all the judge excusing something.

One rater, so none of this carries an error bar (D-125, ADR 85). Free.

**Lesson (bu):** when a judge and a human disagree, read the list, not the rate.
Thirty-five disagreements were three causes; the percentage said none of that.

## D-142 — the corpus gained a second client-file placement, and paid for it

The `js/` objection was a **sampling defect in the evidence, not a fault in the
question**, so it was repaired in the corpus rather than the criterion. The
design system does both placements — eight client files flat, five under `js/` —
and `roles()` could only spell the flat one, so it dropped the other silently
for every component that used it. Same class as D-130's missing underscore.

`nav-toggle` joins the exemplars, `EXEMPLARS` becomes `{ dir, slug }` because
its directory is `nav-main`, and the client role accepts both spellings, flat
first. `section` was considered and refused: it is threaded through with our
answer to the `spotlight` eval — a prop, a `--spotlight` modifier, four
`--dsa-section__spotlight--*` tokens, a schema field, and a client file that
lazy-imports `initSpotlight`. Corpus is now 17 files, ~9.2k tokens.

Cost $3.48 for 108 calls; `token-reasoning`'s 60 verdicts were untouched because
its criterion sets `exemplars: false`. **The result was exactly zero-sum:**

| rubric            | before        | after         |
| ----------------- | ------------- | ------------- |
| `code-idiom`      | 73% (κ 0.41)  | 82% (κ 0.65)  |
| `design-intent`   | 87% (κ 0.75)  | 74% (κ 0.49)  |
| `token-reasoning` | 69%           | 69%           |
| overall           | **106 / 141** | **106 / 141** |

`code-idiom` moved exactly as diagnosed — `pass→fail` fell 10 → 2 and the `js/`
cluster vanished. `design-intent` paid one-for-one, its `fail→pass` misses
doubling 5 → 10, and the judge names the cause itself: _"like NavToggle does"_,
_"nav-main shows this is an acceptable variant"_. Both comparative rubrics read
one corpus, so it is one lever with opposite signs.

**Lesson (bv):** shared evidence is a shared control surface. Widening a corpus
to cure one rubric's false strictness loosens every rubric that reads it.

## D-143 — both instruments confabulate, and the seams get a grader

Two errors, one per instrument, verified in source:

- `cc-component-builder/840/run-1` — the human chip says defaults are not
  merged. Line 77 is `deepMergeDefaults(defaults, props)`. **The label is wrong.**
- `cc-both/840/run-2` — the judge lists `deepMergeDefaults` among conventions
  satisfied. `grep -c` returns 0. **The judge confabulated.**

So the agreement rate was never judge accuracy; it is agreement between two
fallible raters, and driving it to 100% was never the right target.

Four predicates were proposed for a grader and **two were refused after reading
the fixtures**: `classnames` is not a dependency of any eval, and
`deepMergeDefaults` is not in the vendored core. Both would have scored the
sandbox rather than the agent. No fixture ships `*Props.ts` or `*Defaults.ts`
either — there is no generator in there — so "use the generated defaults" was
never an askable question.

`lib/graders/authoring-seams.ts` grades the spelling-neutral residue instead:
`props-module`, `defaults-module`, and `identifier-seam` (only where the target
requires client behaviour). Validated against the real design system before
being trusted — **mean 0.95 across 68 components**, floor 0.85 in the self-test.
That guard is the point: a grader that scores the reference badly is encoding a
convention that does not exist.

It separates the arms perfectly, which the rubric it came from never did:

| eval                    | both | component-builder | design-tokens | none |
| ----------------------- | ---- | ----------------- | ------------- | ---- |
| `810-atom-from-schema`  | 0.89 | 0.94              | 0.17          | 0.17 |
| `832-client-behaviour`  | 1.00 | 1.00              | 0.17          | 0.17 |
| `840-reuse-over-native` | 0.89 | 1.00              | 0.17          | 0.17 |
| `860-restraint`         | 0.17 | 0.17              | 0.17          | 0.17 |

Zero overlap. The flat 0.17 is `props-module=0, defaults-module=0,
identifier-seam=0.5` — **in eighteen trials without the Component Builder MCP,
not one agent ever split props or defaults into a module.** `860` is flat
everywhere because leaving the fixture alone is the correct answer, and `812`
authors no component at all; both are correct non-signals. Caveat: this may
partly measure template-following, since the MCP hands out that structure.

Free — grading is host-side and retroactive (D-50), so no agent re-ran and no
judge call was made.

**Lesson (bw):** both instruments confabulate about facts they are not shown.
**Lesson (bx):** a chip can penalise the sandbox rather than the agent.

## D-144 — every reason anyone gave is mechanical

A sweep of all 141 labels against the grader check ids, before spending anything
on a re-judge. It found no mispriced labels. It found that **the pick list has
no non-mechanical entries in use at all.**

- `code-idiom` — 84 chip-uses across seven chips. **All seven are now
  deterministic** (`component-contract`, `authoring-seams`, `bem`,
  `style-placement`).
- `design-intent` — 39 uses across four chips; 33 are `purity`
  (`no-react-state`, `context-overridable`, `provider-export`, `forward-ref`),
  which were graded deterministically the entire time.
- `token-reasoning` — all four chips map onto `token-conformance`.
- The five genuinely judgment-shaped chips — `monolithic`, `open-variant`,
  `styling-props`, `wrong-kind`, `callback-props` — were **never used once**.
- Twenty-one labels carry free text. Every clause in it is mechanical too
  ("component token defined inline", "invented semantic `--dsa` token"). Five
  fails carry no justification of any kind.

So the obvious test: predict the verdict from graders alone, with a deliberately
unfitted rule — every applicable check must be perfect or the trial fails.

| rubric            | graders vs human | judge vs human |
| ----------------- | ---------------- | -------------- |
| `design-intent`   | **95%** (38/40)  | 74%            |
| `token-reasoning` | **77%** (36/47)  | 69%            |
| `code-idiom`      | 65% (33/51)      | **82%**        |
| overall           | **78%** (107/138) | 75%            |

The free instrument matches the $3.48-per-round one. `design-intent` — the
rubric whose existence has been doubted since D-108 — is the one graders nail,
and `purity` had been answering it all along. `code-idiom` scores worst because
it aggregates four graders under an all-must-pass rule, so it has the most
chances to trip. **29 of the 31 misses are `human=pass, graders=fail`**: the
rule wants a tolerance, not more evidence. Tuning that threshold on these
labels would be fitting to them, so it waits for out-of-sample material.

`inline-classnames` retired from `reasons.json` per the D-140 precedent — the
dictionary entry goes, stored labels keep the id. Free; reason ids are not
hashed and no verdict is re-keyed.

**Lesson (by):** check what a rater actually _said_, not what the rubric claims
to ask. An answer sheet made only of mechanical chips makes every rater
mechanical, and then the expensive instrument is buying agreement on questions a
`grep` settles.

## D-145 — the fourth re-judge, and an instruction that only half took

$5.63, 168 calls, nothing cached: the first measurement of the three sharpened
criteria, each of which now names the settled mechanical objections and tells
the judge they are already counted.

```
Agreement — 104/141 overall
  ✗ design-intent       77%  (30/39)  kappa 0.54  [not scored]
  ✗ token-reasoning     65%  (33/51)  kappa 0.37  [not scored]
  ✓ code-idiom          80%  (41/51)  kappa 0.61
```

The judge did **not** collapse to uniform pass, which was the risk of telling it
to stop citing the easy things. But the instruction only half took: roughly 57
of 67 fails still cite grep-able facts. The pattern is consistent and one-sided
— when the judge wants to _pass_ it defers ("this is checked by deterministic
graders", "deterministic graders cover that separately"), and when it wants to
_fail_ it forgets. Exclusion by instruction buys compliance exactly where
compliance costs nothing.

All nine `design-intent` misses are the human citing a mechanical chip and the
judge correctly declining it. Those labels are stale by construction: they were
written against a criterion that no longer asks the question they answer. This
is D-126 recurring — fixing an instrument invalidates what was calibrated
against it (lesson br) — and it means the 77% is not a measurement of the new
criterion at all.

A verdict-store audit turned up a hygiene problem while counting: 12
`design-intent` verdicts for `812-restyle-with-tokens` from before
`requires: ["component"]` existed. Calibration filters them correctly (39 pairs,
not 51); anything reading `judge.json` directly does not. The cause is that
`criterionHash` covers the criterion _text only_ — not `requires`, not
`include` — so a gating change leaves superseded verdicts looking current. They
are left in place deliberately, as evidence for D-146.

**Lesson (bz):** an instruction telling a judge to ignore what it can already
see is obeyed when it wants to pass and forgotten when it wants to fail. If an
objection must not count, remove the evidence for it or remove the rubric — do
not ask nicely.

**Lesson (ca):** a verdict cache keyed on criterion text alone survives a gating
change, so verdicts the current configuration would never buy still look
current.

## D-146 — the one rubric that looked worth the money was making it up

`api-design` came out of D-145 looking like the only rubric earning its price:
the only stored verdicts whose objections no grader could reach, all of them
about the schema-to-props contract rather than about spelling. Four were quoted
as the case for promoting it. Three actions followed, in order — promote it,
grade what could be graded, then deal with `token-reasoning`. The first two
inverted each other.

**It has no material, and that is correct.** `pnpm calibrate` reports zero
candidates: `requires: ["schema"]` and every fixture ships the schema with a
brief saying to leave it alone, so the agent never authors one. The 48 verdicts
are fossils from before the gate existed. The doc comment saying so was accurate
and the claim that it was stale was wrong.

**`schema-conformance` (1.6) built to catch what the fossils described** — the
schema is the one part of the task that is not the agent's opinion, and nothing
checked whether it was implemented. Mention-based on purpose: a property counts
as implemented if its name appears in the component's TypeScript sources, which
is weak in the safe direction, because a grader must not invent violations.

It scores **1.00 on 67 design-system components and 1.00 on all 36 applicable
trials** — no discriminating power whatsoever. That reads as a broken check
until you use it as an oracle on the four quoted objections:

| the fossil verdict said                                   | the schema it was shown says                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| omits `actionUrl`, "non-functional as a link"              | `headline, message, variant, actionLabel, actionIcon, dismissLabel` — no `actionUrl` |
| flattens a `cta` object into `actionLabel`/`actionIcon`    | already flat; there is no `cta`                                          |
| renames `label`→`summary`, `body`→`content`, "breaking the contract other teams depend on" | declares `summary` and `content` — the component was faulted for conforming |
| `content: string` against the schema's `format: markdown`  | `{"type": "string"}`; no `format`                                        |

**Four for four, each inverted in the direction of an objection.** The grader is
not blind; there was nothing there. This is D-102 one step worse: there the
judge invented a schema it had never been seen, here it contradicted one sitting
in its own prompt. The rubric stays gated and the fossils stay on disk, cited
from `rubrics.ts`, because deleting them would make this entry unverifiable.

**`token-reasoning` retired.** Over 60 calls it produced the verdict it was
written for exactly once, and it was a good one —
`--ks-text-color-primary-interactive` "is semantically meant for interactive
text elements, not decorative icons", naming two better tokens. The other 21
fails restate `token-conformance` in prose, 11 calls returned `unknown`, it
never cleared calibration (69%, kappa 0.37), and it failed self-consistency
outright: **0 of 1 repeated components answered the same way**, so identical
code drew opposite verdicts. It had already been narrowed by instruction this
round and the narrowing did not take (lesson bz). A second wording is not worth
60 calls a round against a measured reliability of zero. Verdicts and labels
stay; reinstating means restoring the object and re-judging.

That leaves one scored rubric, `code-idiom`, at 80% / kappa 0.61 — and D-144
already showed graders beat the judge on two of the three it was measured
against. The judge is now a minority instrument by evidence rather than by
policy.

**Lesson (cb):** a rubric deferred for lack of material may still have a full
store of verdicts from before it was deferred. Check the store, not the doc
comment — and check what the store says against the artefact, not against how
convincing it reads.

**Lesson (cc):** a judge fabricates most fluently about the artefact it has been
shown, because that is where it has the vocabulary to be specific. Confabulation
looks like detail.

**Lesson (cd):** a grader that finds nothing has still measured something. Zero
variance on both the reference and the trials is a finding about the corpus, and
it is the only thing that can adjudicate a judge's claim about the same facts.

---

## D-147 — four instruments repaired before a single Haiku result was read

Opening the Haiku campaign surfaced four separate faults, none of which
announced itself as one. In order of discovery:

**The wedged marker.** A trial killed at the 1200s ceiling left a zero-byte
`results/cc-none-haiku-high/.variant-version` behind. `guardVariantVersion`
tested only `existsSync`, so it read `previous` as the empty string, never
matched, and refused every subsequent run of that experiment — reporting "was
last run against a different MCP build" while its own drift summary admitted it
could not attribute the change. The documented escape was `--force`, on an
experiment that had never produced a result to discard. An empty marker now
counts as absent, and writes are staged through a temp file and renamed, since
`writeFileSync` is not atomic and a kill mid-write is how the file came to
exist.

**The ceiling.** Raised 1200s → 1800s. Both previous ceilings were sized against
Sonnet observations, which is the wrong reference for a cheaper model: it does
not do less work, it takes more turns to do the same work, so wall clock moves
opposite to price.

**The invisible run.** The harness now writes `results/{arm}/{model}/{timestamp}/`
where the Sonnet campaign wrote `results/{arm}/{timestamp}/`. `listRuns` read
direct children of the experiment directory, took `haiku` for a timestamp, read
the timestamp below it as an eval name, found no `summary.json`, and skipped it.
Nothing errored: `pnpm cost` printed the same 60-trial Sonnet total it had
printed *before* the run. A run is now identified by its path below the
experiment, sorted by timestamp so the model segment cannot reorder which result
resolves as current.

**The double count.** The billing page said $1.19; `pnpm cost` said $2.54. Claude
Code writes one JSONL line per *content block*, not per message — a reply with
some text and three tool calls is four lines, each carrying a copy of the same
`message.usage` for the whole reply. One transcript had 12 assistant lines over
5 distinct message ids. Deduplicated on `message.id`, the same run reconstructs
at $1.12, and two later runs at $1.27 vs $1.32 and $2.82 vs $2.88 billed — 2–6%.

The correction was not a constant factor and could not have been scaled out.
Blocks per message is a function of how many tools the agent called, so the
arms that called MCP tools were inflated hardest — in the direction that
flattered the conclusion. The whole cost dimension moves:

| | as reported in D-121 | corrected |
| --- | --- | --- |
| Sonnet campaign total | $223.26 | **$91.99** |
| cc-both vs cc-none | 3.7× | **2.47×** |
| 810 mean per trial | $5.69 | $1.91 |

MCP overhead is real and roughly half what we said it was. The 3.7× figure must
not survive into the PRD.

**Lesson (ce):** a guard that tests only for a file's existence trusts that the
file was fully written. A crash mid-write converts a safety check into a
permanent block, and the block is worded as though the data were wrong rather
than absent.

**Lesson (cf):** a tool that silently returns the same answer after new data
arrives is indistinguishable from a tool that is working. The layout change
produced no error anywhere — only an unchanged total, which is exactly what a
correct tool would print if nothing had run.

**Lesson (cg):** an instrument built on our own arithmetic stayed wrong for a
full campaign because nothing external ever contradicted it. One line from a
billing page falsified it in a single comparison. Every reconstructed
measurement needs one ground truth it cannot produce itself.

---

## D-148 — Haiku never called a single MCP tool, in 24 trials

Batch 1: `810-atom-from-schema` and `860-restraint`, four Haiku arms, three runs
each. Every arm returned the identical result — 810 at 0/3, 860 at 3/3 — which
is what prompted looking past pass/fail.

`810` is the eval that discriminates hardest for Sonnet: 0% at baseline, 67%
with the component-builder MCP. On Haiku it is 0% in all four arms, and the
grader's confound detector explains why:

> excluded — confounded: an MCP variant that never called an MCP server — this
> trial measures the baseline, whatever its score says

A census of `tool_use` blocks confirms it across the batch:

| arm (810) | trials | with real MCP calls | total calls |
| --- | --- | --- | --- |
| cc-component-builder-sonnet | 12 | 8 | 71 |
| cc-both-sonnet | 9 | 6 | 185 |
| cc-design-tokens-sonnet | 9 | 6 | 157 |
| cc-none-sonnet | 18 | 0 | 0 |
| **all four Haiku arms** | **24** | **0** | **0** |

The servers were reachable and the tools were offered: the tool catalogue in
each Haiku transcript lists all ten `mcp__component-builder__*` names. Sonnet,
under the same setup, called them 71–185 times. So this is a model behaviour,
not a plumbing failure — Haiku was handed the tools and never reached for them.

Two consequences. The three MCP Haiku arms are, behaviourally, four copies of
the baseline, and `pnpm grade` correctly marks their 810 runs invalid rather
than reporting a null result. And the arms still did not cost the same:

| arm | 6 trials |
| --- | --- |
| cc-none-haiku | $1.12 |
| cc-component-builder-haiku | $1.27 |
| cc-both-haiku | $1.34 |
| cc-design-tokens-haiku | $1.48 |

Up to 32% more for zero calls. Advertising a server enlarges the system prompt,
and that is billed on every turn. **An MCP server costs money before it is
useful, and continues to if it is never useful.**

Cost reconciliation for the batch: $5.21 reconstructed against $5.39 billed,
versus a $9.60 projection — 46% under, because a model that never calls a tool
and gives up early is cheap. Which is the trap: cost per *trial* rewards
failure. Cost per *successful* trial is the only honest cross-model figure, and
on 810 Haiku has no denominator at all.

**Lesson (ch):** a string match on a transcript finds the tool catalogue as
readily as a tool call. Both contain the tool's name; only one is evidence. Read
`tool_use` blocks, never `grep`. This was asserted here as a finding — that
Haiku "called the MCP exhaustively and ignored what it returned" — before the
grader's own confound detector, which had already got it right, was consulted.

**Lesson (ci):** when every arm of an experiment returns the same number, treat
it as a claim that the manipulation did not happen, not as a result about the
manipulation.

**Lesson (cj):** a variant's *label* is not its treatment. `cc-both-haiku-high`
is only a both-MCP trial if an MCP was called, and the harness cannot enforce
that — it can only report it afterwards, which is why the confound class exists
and why it must be read before the scores.

## D-149 — the tools were never loaded: Claude Code defers MCP by default

D-148 established that Haiku called no MCP tool in 24 trials and left the
question open. The answer is not about Haiku.

Every transcript in the corpus — Haiku and Sonnet alike, byte-for-byte the same
shape — carries this on line 4:

```json
{ "type": "attachment",
  "attachment": { "type": "deferred_tools_delta",
                  "addedNames": ["…", "mcp__component-builder__get-scss-template", "…"] } }
```

`deferred_tools_delta` means the model was handed the tools' **names** and not
their definitions. It cannot call one until it calls `ToolSearch` to load it.
Claude Code's documented default (`ENABLE_TOOL_SEARCH`, unset):

> Unset, Claude Code defers all MCP tools by default. […] `false` loads all
> tools upfront.

A census of `ToolSearch` against MCP calls across all 84 trials:

| arm | trials | with ToolSearch | searches | with MCP calls |
| --- | --- | --- | --- | --- |
| cc-both-sonnet-high | 30 | 18 | 45 | 15 |
| cc-component-builder-sonnet-high | 33 | 21 | 39 | 17 |
| cc-design-tokens-sonnet-high | 30 | 18 | 39 | 15 |
| cc-none-sonnet-high | 39 | 3 | 3 | 0 |
| cc-both-haiku-high | 6 | 0 | 0 | 0 |
| cc-component-builder-haiku-high | 6 | 0 | 0 | 0 |
| cc-design-tokens-haiku-high | 6 | 0 | 0 | 0 |
| cc-none-haiku-high | 6 | 0 | 0 | 0 |

The search is the gate. Where it fires, calls follow (18→15, 21→17, 18→15);
where it does not, they never do; the baseline searched three times and
correctly found nothing. Haiku searched zero times in 24 trials.

So the finding in D-148 is real but misattributed. Haiku did not decline to use
the servers — it was never told they were usable in the form a tool call
requires. And the consequence runs backwards through the whole campaign: **every
number to date measures tool *discovery*, not MCP value.** Roughly 40% of the
Sonnet MCP-arm trials (12/30, 12/33, 12/30) never searched, and are baseline
trials wearing an MCP label. The deltas we have priced are a blend of "does the
MCP help" and "does the model go looking".

**Decision.** `setupVariant()` now writes `env: { ENABLE_TOOL_SEARCH: "false" }`
into `.claude/settings.local.json`, alongside the `enableAllProjectMcpServers`
flag already proven to take effect there. `SETUP_VERSION` moves to
`7-tools-upfront` and the regime is a named part of the variant hash, so no
result from the deferred era can be reported as current. Deferral is a
context-window optimisation; at ten tools we are nowhere near needing it, and
"the variant has the MCP available" should mean the model can call it.

The deferred regime is kept, not discarded — `EVAL_TOOL_SEARCH=1` restores it.
"Will a model discover a server nobody instructed it to use?" is a legitimate
and arguably more realistic question than "does the server's content help",
but it is a *different* question and the two cannot share an arm. If that gets
its own campaign, it needs its own variant.

`mcpToolsWereDeferred()` (`lib/graders/mcp-usage.ts`) now reads the attachment
directly, and `collect.ts` distinguishes "never called" from "never callable" in
the confound reason. Re-grading the corpus — free, host-side, D-50 — reclassifies
12 trials immediately. This is the check that makes the setting falsifiable: if
`ENABLE_TOOL_SEARCH` silently fails to apply, the next run says so instead of
quietly producing another campaign's worth of mislabelled baselines.

One caveat worth carrying: the bundle gates `toolSearchReminder` (how often the
model is nudged to search) behind remote feature flags. Whether a model searches
was never purely a property of the model — it is partly a server-side setting
that can change under us between runs. That alone disqualifies the deferred
regime as the default for a drift gate.

### Confirmed against a real run

`EVAL_ONLY=810-atom-from-schema pnpm eval cc-component-builder-haiku-high
--force`, three trials, $1.51 billed. The guard fired first and refused the run
until `--force` — which is the guard working: `--force` is documented as "ignore
fingerprints, re-run everything" and deletes nothing, so the deferred-era trials
remain on disk under their own timestamps as the evidence for D-148.

| | deferred | upfront |
| --- | --- | --- |
| `deferred_tools_delta` in transcript | yes | no |
| `ToolSearch` calls | 0 | 0 — nothing left to search |
| MCP calls per trial | 0, 0, 0 | 2, 1, 5 |
| passed | 0/3 | **3/3** |
| quality | — | 0.98, 0.99, 0.97 |

All three opened on `get-ui-building-instructions`; `mcp-usage/consulted-first`
fires on each. The eval Haiku could not pass at all, it now passes every time,
and the only thing that changed is whether the tool definitions were in the
context. **This is the first honest measurement of MCP value in the campaign.**

Two graders still bite with the server present, and those findings are now about
the MCP's *content* rather than its absence: `token-conformance` 0.80 (component
tokens referencing `--ks-brand-color-scale-1` and `-3` directly, skipping the
semantic layer) and `authoring-seams` 0.83 (no shared identifier tying the
component to its client bundle). The token violation is the design-tokens
server's subject, not the component-builder's, which makes `cc-both` the cell
that matters.

What must **not** be read out of this: Haiku's 3/3 against Sonnet's 67% on the
same eval and the same server. Sonnet's figure comes from the deferred regime
where a third of its trials never searched. Comparing them compares a working
arm against a half-broken one. No model comparison survives D-149 (see D-150).

Cost reconciliation: $1.38 reconstructed against $1.51 billed, 9% under — wider
than the 2–6% band the dedup fix was validated at, and worth watching rather
than acting on. Per trial the arm went from $0.35 to $0.46, and gained a
denominator: three passes instead of none. Cheap failure is still failure.

**Lesson (ck):** a tool the model can see the *name* of is not a tool it can
call. Availability has stages, and a harness that verifies only the earliest one
— server connects, names arrive — will certify an arm that cannot work.

**Lesson (cl):** the mechanism was already written down in our own code.
`mcp-usage.ts` documented ToolSearch, in prose, months before this analysis;
`grep` found that comment while looking for the answer and it was read as an
aside. Search the codebase's *explanations*, not just its identifiers, before
concluding a behaviour is unexplained.

**Lesson (cm):** two models producing different results is not yet a finding
about the models. Here it was a finding about a default that treats them
identically and that only one of them happened to route around.

## D-150 — Haiku-only, and the target is the full 20 × 4 matrix

84 trials and $96.40 were spent in the deferred regime. They are not wasted —
they are the evidence for D-148 and D-149, and they remain a valid measurement
of *tool discovery*. They are not a measurement of MCP value, and nothing in the
PRD may cite them as one.

Every campaign conclusion that rests on an MCP-versus-baseline delta is
withdrawn pending re-run. That is: the 810 discrimination (0% → 67%), the
per-arm cost multiples, and every Haiku figure in D-148 except the fact that it
never called a server.

**Sonnet is out of scope.** The cross-model comparison is not the question we
are paying to answer, and re-running Sonnet upfront would have been the single
largest line in the budget — 60 trials at roughly 3× Haiku's token prices. The
Sonnet corpus stays on disk, superseded, and every Sonnet figure in this
document is now a deferred-regime figure that must not be compared to anything.

The goal is **complete Haiku coverage: 20 evals × 4 arms × 3 runs = 240 trials.**
Full coverage is the deliverable, so the staging below is about *ordering*, not
about omitting cells. Every stage ends with the matrix closer to complete and
none of them is optional.

### What the estimate rests on

One upfront eval. `810` on `cc-component-builder-haiku` cost $0.46 per trial,
up from $0.35 deferred — a 1.3× rise that also converted three failures into
three passes, and passing costs turns. The deferred per-arm figures underneath
it are the costs of an agent that gave up early, so they understate in a
direction we cannot size. Against Haiku's known spread — `860-restraint` at
$0.02–0.14, `840-reuse-over-native` the heaviest at roughly $0.7 per trial once
scaled off Sonnet — the honest range for 240 trials is **$85–175**, and it comes
from a single data point. Re-estimate after Stage 2, when there are 120 real
ones.

### Stages

| stage | scope | trials | estimate | buys |
| --- | --- | --- | --- | --- |
| 0 ✅ | `810` × cc-component-builder | 3 | $1.51 actual | the regime works |
| 1 | `810` × the other three arms | 9 | $4–6 | first honest four-arm delta |
| — | *checkpoint: is `cc-both` fixing the token layer?* | | | |
| 2 | all 20 evals × `cc-none` and `cc-both` | 120 | $40–85 | the bracket |
| — | *checkpoint: re-estimate per-trial cost from 120 real upfront trials* | | | |
| 3 | all 20 evals × `cc-component-builder` and `cc-design-tokens` | 120 | re-estimate | attribution; matrix complete |

Stage 1 answers the question Stage 0 raised: `cc-component-builder` alone left
`token-conformance` at 0.80 with direct branding-layer references. If `cc-both`
does not fix that, the design-tokens server is not doing the one job its arm
exists to test — and that is worth knowing for $5 before $150 is committed.

Stage 2 runs the two arms that **bracket** the effect. `cc-none` and `cc-both`
bound the total MCP contribution on every eval at once: an eval where they do
not separate has no MCP effect for the single-server arms to attribute. That
ordering does not remove Stage 3 — full coverage is the goal — but it means
Stage 3 is bought already knowing which cells carry the finding and which are
confirmatory, and it produces a publishable four-arm story for `810` plus a
whole-suite baseline-versus-everything result before the halfway point.

Stage 3 closes the matrix. `cc-design-tokens` is the arm with no upfront data at
all and the largest deferred context overhead (32% above baseline for zero
calls, D-148); it is also the arm most likely to move `token-conformance`, which
is the grader still failing with the component-builder server present.

### Commands

```bash
# stage 1
EVAL_ONLY=810-atom-from-schema pnpm eval cc-none-haiku-high --force; \
EVAL_ONLY=810-atom-from-schema pnpm eval cc-design-tokens-haiku-high --force; \
EVAL_ONLY=810-atom-from-schema pnpm eval cc-both-haiku-high --force

# stage 2 — all 20 evals, one arm per invocation
EVAL_EXTRA_EVALS=1 pnpm eval cc-none-haiku-high --force; \
EVAL_EXTRA_EVALS=1 pnpm eval cc-both-haiku-high --force

# stage 3
EVAL_EXTRA_EVALS=1 pnpm eval cc-component-builder-haiku-high --force; \
EVAL_EXTRA_EVALS=1 pnpm eval cc-design-tokens-haiku-high --force
```

One experiment per invocation, joined by `;` — the CLI declares `<experiments...>`
variadic but runs only the first and exits non-zero when evals fail (D-117).
`--force` is required until each experiment has run once under `7-tools-upfront`,
and is non-destructive.

**There is no spend guard.** The PRD's "hard budget guardrail of $40 per full
run (D6); the harness aborts when exceeded" is not implemented — not in
`agent-eval.config.ts`, not in `lib/`, not in the framework. A Stage 2 or 3
invocation is 60 trials in one unattended command, which at the top of the range
is around $42, and nothing will stop it. Until a guard exists, split a sweep
with `EVAL_ONLY` and read `pnpm cost` between chunks if the number matters.

Wall clock is the other unbudgeted resource: three trials of `810` ran
concurrently in 288s, so 60 trials at that concurrency is roughly 1.5 hours per
arm, and the full 240 is most of a working day.

### The checks that gate each stage

Before spending on the next stage, on the trials just bought:

1. `deferred_tools_delta` absent from every transcript. If present,
   `ENABLE_TOOL_SEARCH` did not apply and the stage is void — stop.
2. `mcpToolCallCount > 0` on every MCP-variant trial, and zero on `cc-none`.
   The second is the one that invalidates deltas if it breaks.
3. `pnpm grade` reports no `confounded` exclusions. `mcpToolsWereDeferred()`
   now names the cause in the reason string.
4. Reconstructed cost within ~10% of the billed figure.

**Lesson (cn):** a superseded corpus is not a worthless one, provided what it
actually measured is written down at the moment it is superseded. The 84 trials
answer "will a model find a server nobody pointed it at" — a question we did not
know we were asking, and would now have to pay for deliberately.

**Lesson (co):** a guardrail that exists only in a PRD is not a guardrail. D6's
"$40 hard budget, the harness aborts when exceeded" has been cited in planning
for months and is implemented nowhere. It was found by looking for it, not by it
firing — which is the only way an absent safety net is ever found.

---

## D-151 — Stage 1: the bracket holds, and the report was billing us twice

Stage 1 bought the three remaining Haiku arms on `810-atom-from-schema`, 3 runs
each, with tools loaded upfront. All four arms cleared the D-150 gate: no
`deferred_tools_delta` in any transcript, and `cc-none` made zero MCP calls
while the MCP arms made them.

| arm | pass@1 | quality | $/trial | mcp calls/trial |
| --- | --- | --- | --- | --- |
| `cc-none` | 0% | 0.63 ±0.07 | $0.43 | — |
| `cc-design-tokens` | **run invalid** | (0.69 unscored) | $0.51 | **0** |
| `cc-component-builder` | 100% | 0.98 ±0.01 | $0.50 | 2.7 |
| `cc-both` | 100% | 0.99 ±0.01 | $0.63 | 6.3 |

The headline is an economic one, which is the point of G2: the
component-builder server converts a 0% pass rate into 100% for **16% more money
per trial**. `cc-both` adds a further 26% on top of that for +0.01 quality —
though see the per-grader note below, because the average hides what it bought.

### `cc-design-tokens` made zero calls with the tools in context

This is a different zero from D-148's. The tools were loaded — no deferral — and
Haiku declined to call them, three times out of three. Instead it read and
grepped: 12–21 `Read` and 31–41 `Bash` calls per trial.

Two hypotheses were tested and one survives:

- **Rejected — component-builder refers the agent onward.** `cc-both` called
  design-tokens 5× in run-1 and never in runs 2–3, so it looked like the
  instructions server might be the entry point. It is not: the
  component-builder MCP's source contains no reference to the tokens server, by
  grep. Run-1 was variance.
- **Supported — the repo is staged, so token values are greppable.** The tokens
  server's payload is *values*, and values are on disk. The component-builder
  server's payload is *conventions*, which are not on disk in that form. An
  agent with filesystem access has no reason to pay a tool call for the first
  and every reason to pay one for the second.

The grader's exclusion reason — "this trial measures the baseline, whatever its
score says" — is now independently confirmed rather than merely asserted: the
excluded trials scored 0.69 and FAIL, inside the baseline's 0.63 ±0.07.

Open, and deliberately not decided here: whether this is a finding about the
tokens server, or about `810` failing to pose a question only that server can
answer. `816-typography-pairing` and `817` are the evals that would separate
those, and both are in Stage 2/3. Deciding it now, from one eval, would repeat
lesson (cm).

### The report was inflating every cost figure by ~2.2×

`pnpm grade` reported $3.28 for the three `cc-component-builder` trials.
`pnpm cost` reconstructed $1.38. Anthropic billed **$1.51**.

D-147 found this exact bug — Claude Code writes one JSONL line per *content
block*, and every line of a message repeats that message's `usage` verbatim —
and fixed it in `bin/cost.ts`. It left the same summation live in
`lib/eval-harness/harness.ts`, whose `agent-transcript-meta.json` is what
`efficiencyOf()` reads, which is what the report's `costOf()` prices. So the
instrument nobody looks at was corrected and the instrument that produces every
headline number in the PRD was not.

Fixed by recomputing tokens and turns host-side in `lib/graders/efficiency.ts`,
deduplicated on `message.id`. Host-side because grading is retroactive and free
(D-50): every trial already bought is repriced without re-running anything. The
same fix in the sandbox summariser would have corrected only future trials.

`toolCalls` is deliberately *not* deduplicated. One block per line means the
per-line count of `tool_use` blocks is already right; deduplicating on
`message.id` and taking the first line's blocks reads 49 tool calls as 3. The
same transcript shape requires opposite treatment for two different quantities,
which is why this is written down.

Validation after the fix, against the invoice:

| | before | after | billed |
| --- | --- | --- | --- |
| `cc-component-builder` × `810` × 3 | $3.28 | **$1.50** | **$1.51** |

Turns fell with it — 104 → 64.3 on `cc-both`, and every turn count in every
report before this is roughly double the truth.

The error is not a constant and cannot be divided out of the historical
figures: blocks per message is a function of how many tools the agent called, so
**the MCP arms were inflated hardest** — in exactly the direction that flatters
the conclusion "MCPs are expensive". Every cost and turn comparison in the
campaign so far was biased against the thing under test.

### What `cc-both` actually bought

The +0.01 average is not the story. `cc-component-builder` alone leaves
`authoring-seams` at 0.83 and `token-conformance` at 0.80; `cc-both` scores
1.00/0.99, 0.83/0.99, 1.00/1.00 across its three runs. The second server closes
the two gaps the first one leaves, on the runs where it is used at all — while
being the server that, alone, gets ignored entirely.

**Lesson (cp):** fixing a bug in one instrument is not fixing the bug. D-147
wrote the mechanism down correctly, found it in the tool it was holding, and
never asked what else summed the same file. The question after any measurement
fix is "what else reads this?", and it has to be asked with `grep`, not memory.

**Lesson (cq):** check the direction of a measurement error before deciding it
is small. A 2.2× inflation that lands preferentially on the treatment arm is not
noise, it is a thumb on the scale — and this one pointed at the conclusion we
were most likely to want to believe.

**Lesson (cr):** an agent will not pay for information it can grep. A server
whose value is *data already in the repo* competes with `Read`; a server whose
value is *conventions not written anywhere* does not. This is a claim about what
belongs in an MCP, not about which model is lazy.

**Next free decision number: D-152.**



