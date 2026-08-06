# UI Generation Eval Implementation Checklist

Tracks progress for building the UI generation eval loop in `packages/agent-eval`.
See [ui-generation-eval-prd.md](../prd/ui-generation-eval-prd.md) for the full PRD and [adr-ui-generation-eval.md](../../adr/adr-ui-generation-eval.md) for architectural decisions.

**Status:** P0 complete — clean baseline measured (web-research control verified). Ready for P1.
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

- [ ] 1.1 Implement `lib/assertions/component-contract.ts` — the 4-file component contract
- [ ] 1.2 Implement `lib/assertions/purity.ts` — no React state, `forwardRef`, Context-overridable
- [ ] 1.3 Implement `lib/assertions/token-conformance.ts` — known tokens only, no hardcoded values, correct layer references
- [ ] 1.4 Implement `lib/assertions/schema-validity.ts` — JSON Schema validity, dereference, prop generation, specific naming
- [ ] 1.5 Implement `lib/assertions/bem.ts` — BEM naming, namespaced to the component block
- [ ] 1.6 Implement `lib/assertions/ds-reuse.ts` — DS components over hand-rolled native elements
- [ ] 1.7 Implement `lib/assertions/style-placement.ts` — no self-imported SCSS, registered in `index.scss`
- [ ] 1.8 Implement `lib/assertions/toolchain.ts` — build, typecheck, lint from inside `EVAL.ts`
- [ ] 1.9 Implement `lib/assertions/stories.ts` — story exists, renders, play function passes
- [ ] 1.10 Implement `lib/assertions/a11y.ts` — axe, 0 critical/serious violations
- [ ] 1.11 Implement `lib/assertions/mcp-usage.ts` — tool call counts, ordering, context tokens (transcript-based)
- [ ] 1.12 Implement `lib/assertions/negative-usage.ts` — `none` variant asserts zero MCP tool calls
- [ ] 1.13 Implement `lib/assertions/quality.ts` — weighted composite score, versioned weights
- [ ] 1.14 Implement `lib/report/collect.ts` — normalized Outcome record + local failure classifier (§7.5)
- [ ] 1.15 Implement `lib/report/metrics.ts` — quality/cost/time/efficiency aggregation with baseline deltas
- [ ] 1.16 Add experiments for the remaining 2 MCP variants (`component-builder`, `design-tokens`)
- [ ] 1.17 Author 4 more evals to reach 5 total
- [ ] 1.18 Run the full 4-variant core matrix, record actual per-trial cost
- [ ] 1.19 Revisit D6 (budget) and D9 (runs per task) against measured cost

## Phase 2: Static Artifacts

**Exit criterion:** G4 — a historical run is fully inspectable from a static URL.

- [ ] 2.1 Implement `lib/report/build-report-storybook.ts` — build a Storybook per trial from `run-N/project/`
- [ ] 2.2 Implement `templates/report-docs/Summary.stories.tsx`
- [ ] 2.3 Implement `templates/report-docs/Conversation.stories.tsx` — transcript with expandable MCP tool calls
- [ ] 2.4 Implement `templates/report-docs/Graders.stories.tsx` — per-assertion pass/fail + raw output
- [ ] 2.5 Implement `templates/report-docs/Source.stories.tsx` — generated files, syntax highlighted
- [ ] 2.6 Configure `storySort` ordering: Summary → Conversation → Graders → Build → Typecheck → Lint → A11y → Source
- [ ] 2.7 Capture story screenshots as review artifacts
- [ ] 2.8 Implement the results index site (experiments × timestamps × tasks, headline metrics, baseline deltas)
- [ ] 2.9 Implement the `open <experiment>/<timestamp>/<eval>/run-N` command
- [ ] 2.10 Implement retention pruning (last 10 per experiment + pinned baseline runs — D10)
- [ ] 2.11 Add `config/deploy-agent-eval-results.yml` — Kamal static site behind shared JWT auth (D7)
- [ ] 2.12 Implement `results:download` script (CI artifact retrieval, idempotent merge)

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
- [ ] 4.6 Implement the hard budget guardrail ($25/run — D6) with abort
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

| Trial | Component            | Styles                        | Client behaviour | Duration | Web research |
| ----- | -------------------- | ----------------------------- | ---------------- | -------- | ------------ |
| 1     | `BadgeComponent.tsx` | `badge.scss`                  | none             | 1026.9s  | no           |
| 2     | `badge.tsx`          | `badge.scss`                  | none             | 304.4s   | no           |
| 3     | `BadgeComponent.tsx` | `badge.scss`, `_badge-vars.scss` | none          | 609.9s   | 2 searches, 19 fetches |

Failing in all three: `{Name}Component.scss` naming, `.client.ts` existence, purity (React state used for dismiss), `forwardRef`, client-side dismiss, design tokens instead of literal colours. Only "the provided schema is left untouched" passes. Every trial also produced files the contract does not describe — `index.ts`, `badge.test.tsx`, `typing.ts`, `BadgeProps.ts`.

The baseline has large, consistent headroom on exactly the dimensions the MCP servers address, and the failure set is stable across trials while the *route* to it is not — which is why `runs: 3` and `earlyExit: false` matter.

Transcript-derived, per trial: 45–94 assistant messages, 37k–89k output tokens, 2.2M–5.7M cache-read tokens, 0 MCP tool calls (as expected for `none`, and the first real evidence for the P1 `negative-usage` grader).

**D-8 — the baseline was reaching the internet for kickstartDS source.** Trial 3 searched for kickstartDS component conventions and fetched the docs site plus raw `TagLabelComponent.tsx` and `tag-label.scss` from the GitHub `next` branch. That is the knowledge the Component Builder MCP encodes, so the control was partially self-serving — and intermittently, which inflated variance in quality, cost and time simultaneously (609.9s with research vs 304.4s without). `setup()` now writes `permissions.deny: ["WebSearch", "WebFetch"]` for every variant. New ADR Decision 16. Enforcement under `--dangerously-skip-permissions` is unverified; item 0.21 checks the tool histogram, and the fallback is a `PreToolUse` hook.

**D-9 — `variantVersion` now covers all of `setup()`, not just staged packages.** The baseline stages nothing, so its package hash is constant and a change to the deny list would have been invisible to the Decision 9 guard — stale results would have been reused as if the control had never changed.

**Confirmed — D-7 was not premature.** Trial 1 took 1026.9s. Under the old 900s ceiling it would have been killed and its spend lost.

**Confirmed — transcript capture works.** `found: true` on all three trials, sourced from `/home/node/.claude/projects/-home-sandbox-workspace/<uuid>.jsonl`. Note the mismatch that defeated upstream: `HOME` is `/home/node` while the workspace is `/home/sandbox/workspace`.

**Resolved — 0.21 verified.** Third run (`2026-08-06T19-02-52.634Z`), 0/3, mean 310.7s. `toolCalls` across the three trials was `Bash`/`Read`/`Write`/`Edit` only — no `WebFetch`, no `WebSearch`, and no denial messages either, so the tools appear to be withheld from the toolset rather than blocked at call time. `--dangerously-skip-permissions` does not override `permissions.deny`; the `PreToolUse` fallback is not needed.

### Reference baseline (clean, `2026-08-06T19-02-52.634Z`)

This is the number P1 deltas should be measured against — the earlier two runs are contaminated and should not be cited.

| Trial | Component | Styles | Client | Duration | Asst msgs | Output tokens |
| ----- | --------- | ------ | ------ | -------- | --------- | ------------- |
| 1 | `badge.tsx` | `badge.css` | none | 259.3s | 33 | 44,419 |
| 2 | `Badge.tsx` | `badge.css` | none | 395.9s | 55 | 54,730 |
| 3 | `badge.tsx` | `badge.css` | none | 276.8s | 47 | 36,009 |

Still 0/3, but the failure profile got **worse and more consistent** once the web was closed: all three now emit plain `.css` rather than `.scss`, and the `{Name}Component` suffix disappeared entirely. That is the honest baseline — trial 3 of the previous run had been reproducing kickstartDS naming because it had read our source off GitHub. Mean duration also dropped from 647.1s to 310.7s, so the earlier timing numbers were measuring research, not generation.

All three trials again produced `index.ts` and a `badge.schema.json` re-emission; `mcpToolCallCount: 0` throughout.

**D-10 — the deny list does not cover Bash, and the sandbox has network.** Trials installed packages from the npm registry (`npm view jsdom`, `npm install -D jsdom @testing-library/react`, `react-dom@18.3.1`). Nothing fetched kickstartDS — the only `kickstartds` strings in the transcripts come from our own prompt and the fixture's `$id`, and run 1 searched the filesystem for a kickstartDS package and found none — so the control held in practice. But `npm pack @kickstartds/components` is not blocked in principle. Not worth closing yet: the registry is also how the agent gets a working toolchain, and P1 compiles against the real design system anyway. Revisit if a transcript ever shows a kickstartDS fetch.

**D-11 — the agent reads the harness runner.** All three trials opened `__agent_eval__/run.mjs`. It contains the CLI invocation, not the graders, so no assertion leaked — `EVAL.ts` is still withheld as verified earlier. Worth re-checking if upstream ever moves grading detail into that file.
