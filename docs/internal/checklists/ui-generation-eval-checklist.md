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

- [ ] 3.1 Expand the task suite to 20–30 evals across the `8xx` ranges
- [ ] 3.2 Author `86x` negative/restraint tasks
- [ ] 3.3 Add `REFERENCE/` gold implementations (never mounted into the sandbox)
- [ ] 3.4 Implement the LLM judge rubrics — one isolated call per dimension
- [ ] 3.5 Pin the judge model in `agent-eval.config.ts`
- [ ] 3.6 Hand-grade ≥20 trials as the calibration set
- [ ] 3.7 Measure judge/human agreement; iterate rubrics until ≥80%
- [ ] 3.8 Enable the judge's 15% weight in the composite score
- [ ] 3.9 Add the second agent to the matrix (D2)

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
- [ ] Fix `get-client-behavior-template` — **after** the campaign (ADR 46)

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
      throws without `--force`, and `--force` discards prior results. The leak is a
      between-campaign change. (ADR 55)
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
- [ ] Between campaigns: move MCP servers to host-side HTTP transport so no
      server files exist in the sandbox. (ADR 55)

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
- [ ] Between campaigns: host-side HTTP transport (ADR 55); component-builder
      client-behaviour template peer-dep fix (ADR 46 freeze now lifted).

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
- [ ] Move MCP servers to host-side HTTP transport (ADR 55) — needs a
      `SETUP_VERSION` bump
- [ ] Fix `get-client-behavior-template`'s undeclared `@kickstartds/core` peer
      dependency (ADR 46); per D-30 `get-storybook-template` has the same shape
      of defect
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

The new task is `820-token-intent`, described in ADR 66.

- [x] **2.16 — `820-token-intent` fixture.** Sixth task. A `Stat` component
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
