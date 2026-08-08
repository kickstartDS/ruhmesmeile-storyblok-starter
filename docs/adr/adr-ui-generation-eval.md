# ADR: UI Generation Eval Loop

**Date:** 2026-08-06
**Status:** Accepted
**Deciders:** Jonas Ulrich
**Related:** [ui-generation-eval-prd.md](../internal/prd/ui-generation-eval-prd.md), [ui-generation-eval-checklist.md](../internal/checklists/ui-generation-eval-checklist.md)

---

## Context

We ship two MCP servers — Component Builder MCP (7 read-only tools) and Design Tokens MCP (29 tools) — whose entire purpose is to make an AI agent better at producing kickstartDS UI. We have no evidence that either works. We cannot attribute quality to a specific server, cannot price the context they consume, and cannot detect when generated-UI quality drifts because a model provider shipped a silent update.

This ADR records the architectural decisions behind `packages/agent-eval`, a private workspace package implementing a controlled eval loop across four dimensions: quality, cost, time, efficiency.

## Decision 1: Build on `@vercel/agent-eval` rather than a bespoke harness

**Options considered:**

1. **Bespoke harness** — build trial execution, sandboxing, transcript capture, and result storage ourselves
2. **Port Storybook's original `eval/` harness** — the artifact-rich trial runner from `storybookjs/mcp@main`
3. **`@vercel/agent-eval`** — MIT-licensed harness with sandboxing, fingerprinting, transcript o11y, agentic judge, results playground
4. **A generic LLM eval framework** (Braintrust, Promptfoo, etc.)

**Chosen: Option 3 — `@vercel/agent-eval`**

**Rationale:**

- Agent evals need sandboxed multi-turn execution with filesystem side effects. Generic prompt-eval frameworks (option 4) model single-shot request/response and do not fit.
- Result fingerprinting and reuse is a substantial amount of non-obvious work that we would otherwise reimplement badly (option 1).
- Failure classification, transcript o11y (`toolCalls`, `filesRead`, `shellCommands`, `totalTurns`), and the agentic judge are exactly the primitives our four dimensions need.
- Storybook themselves migrated from option 2 to option 3, so the migration path has been walked by a team with a very similar problem shape.
- MIT license, no vendor lock at the harness level.

**Trade-offs accepted:**

- We inherit upstream's opinions, including the fingerprinting model and its blind spots (see Decision 9).
- Upstream is young; breaking changes are likely. Mitigated by pinning the dependency.

## Decision 2: A separate private workspace package, not a folder inside `design-system`

**Options considered:**

1. **`packages/design-system/eval/`** — colocated with the thing under test
2. **`packages/agent-eval/`** — its own private workspace package
3. **A separate repository**

**Chosen: Option 2 — `packages/agent-eval`, `private: true`**

**Rationale:**

- The eval loop depends on `component-builder-mcp` and `design-tokens-mcp` as well as `design-system`. Colocating it under any one of them is wrong.
- The design system is published to npm; eval fixtures, results, and API keys have no business in its `files` list or its build graph.
- A separate repository would lose workspace linking, meaning we could no longer trivially test _the MCP code in the current commit_ — which is the entire point of the quality gate.
- Auto-discovered by the existing `packages/*` glob; no workspace config change needed.

**Trade-offs accepted:**

- Excluded from Changesets releases, so version coordination with the packages it tests is manual.

## Decision 3: Fixture project over a real design-system checkout

**Options considered:**

1. **Run the agent inside `packages/design-system`** — maximum realism, zero fixture drift
2. **Generated fixture project** with `@kickstartds/design-system` installed as a packed tarball
3. **Generated fixture project** with `@kickstartds/design-system` installed from npm, pinned to the workspace version

**Chosen: Option 3 — generated fixture, design system from npm at the workspace version**

**Rationale:**

- Trial isolation. Anthropic documents agents cheating via leftover state; a real checkout hands the agent a `git log` and an `src/components/` full of correct answers to whatever we just asked it to build.
- Reproducibility. A fixture is deterministic; a working tree is not.
- Sandbox size. The monorepo is large; a minimal consumer project is not.
- The design system is published publicly, so a tarball buys nothing a pinned version does not — and a tarball is awkward to move into the sandbox, where `Sandbox.writeFiles()` only accepts UTF-8 strings.
- Pinning to the version in `packages/design-system/package.json` keeps the fixture in lockstep with the tokens `design-tokens-mcp` was synced from at build time. Pinning to `latest` would let the MCP and the fixture drift apart and quietly bias the token-conformance graders.

**Trade-offs accepted:**

- Unreleased design-system changes are not covered: an eval run tests the last published version, not the working tree. Acceptable, because what we are grading is the _MCP servers_, which are staged from the working tree (Decision 6).
- The fixture is a maintained artifact that must track design-system changes, or evals will grade against a stale contract.
- Slightly less realistic than a real repository setup.

## Decision 4: Docker-only sandboxing with direct provider keys

**Options considered:**

1. **Vercel AI Gateway + Vercel Sandbox** — CI parallelism, unified billing, and automatic failure classification
2. **Docker everywhere + direct provider keys** — no vendor account, no gateway billing layer

**Chosen: Option 2 — Docker everywhere, direct keys**

**Rationale:**

- No additional vendor relationship or quota to manage for a package that is internal-only.
- Local and CI environments become identical, removing a whole class of "works locally" discrepancies.

**Trade-offs accepted:**

- **`@vercel/agent-eval`'s automatic failure classification is unavailable** — it requires `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`. Without it, a rate-limited trial is indistinguishable from a genuine model failure, which would poison a quality gate. Mitigated by Decision 5.
- CI parallelism is bounded by runner capacity, so wall-clock rather than spend becomes the binding constraint on matrix size.

## Decision 5: Local failure classifier replacing gateway classification

**Chosen:** implement a classifier in `lib/report/collect.ts` producing `timeout` / `infra` / `model`.

- **`timeout`** — trial hit the configured timeout with no terminal agent message.
- **`infra`** — transcript carries provider/network/sandbox error signatures (rate limit, 5xx, connection reset, image pull failure, MCP server failed to start), or the fixture failed to install before the agent's first turn.
- **`model`** — everything else: the agent finished and the graders failed it.

Only `model` failures count toward pass rates and the gate. `infra`/`timeout` trials retry once, then appear in the report as excluded-with-reason rather than silently dropped. A run with >20% non-model failures is marked **invalid** and may not update a baseline.

**Rationale:** a quality gate that cannot distinguish "the model got worse" from "npm was down" will be muted within two weeks, and a muted gate is worse than no gate.

**Trade-offs accepted:** signature matching is heuristic and will need maintenance as providers change error formats.

## Decision 6: MCP servers over stdio from the workspace build

**Options considered:**

1. **Deployed HTTP endpoints** — tests exactly what external users hit, including JWT auth and network behavior
2. **stdio launchers from a workspace build inside the sandbox**

**Chosen: Option 2 — stdio**

**Rationale:**

- Hermetic trials: no network flakiness, no auth failures, no deployment lag between committing an MCP change and measuring it.
- A quality gate must test the code in the current commit. Hitting a deployed endpoint tests whatever was last deployed, which is a different question.

**Trade-offs accepted:**

- The deployed HTTP surface (auth, transport, CORS) goes unexercised. A `-hosted` variant is deferred as a later smoke test, not a gate.

## Decision 7: Repo-local agent instructions excluded from every variant

**Options considered:**

1. **Instructions as a matrix axis** (`none` × `copilot-instructions.md`) — answers "do MCPs beat a good prompt?"
2. **Instructions always on** — matches our real-world default
3. **Instructions always off**, in every variant including the baseline

**Chosen: Option 3 — always excluded**

**Rationale:**

- Consumers of the design system have wildly different local setups. Folding ours into the measurement produces numbers that describe _our repository_ rather than the MCP servers' built-in capability.
- Option 1 doubles the matrix cost and muddies attribution — the thing the whole package exists to provide.
- The `none` baseline becomes a genuinely context-free agent, so every point of lift is attributable to an MCP server.

**Trade-offs accepted:**

- **Baseline scores will look bad, by construction.** The interesting quantity is the gap, not the floor. This must be restated in every report or the numbers will be misread.
- The measured delta is an **upper bound** on real-world MCP lift, since actual consumers carry some local context.
- Requires active enforcement: a `fixture-hygiene` pre-trial check fails the run if any agent-instruction file (`copilot-instructions.md`, `AGENTS.md`, `.cursorrules`, agent config) is present. Leakage would lift the baseline and shrink every measured delta — silently, and in the direction that makes our own servers look worse.

An instructions-vs-MCP study remains interesting, but as a separate one-off experiment, never as a variable inside the core matrix.

## Decision 8: Deterministic-first grading, with a pinned judge capped at 15%

**Options considered:**

1. **LLM judge as primary grader** — flexible, fast to author
2. **Deterministic graders as primary**, judge as a minority contributor
3. **Deterministic only** — no judge at all

**Chosen: Option 2 — deterministic-first**

Composite weighting (versioned in `lib/assertions/quality.ts`):

```
quality = 0.40 * deterministic_contract   (contract, purity, token, schema, bem, ds-reuse, placement)
        + 0.25 * toolchain                (build, typecheck, lint)
        + 0.20 * runtime                  (stories render, play fns, a11y)
        + 0.15 * judge                    (mean of pinned rubric dimensions)
```

**Rationale:**

- Most of the kickstartDS contract is mechanically checkable: four named files, no React state, known token custom properties, valid JSON Schema, BEM, DS components over native elements. Checking these with a language model would be slower, costlier, and less reliable than checking them with a parser.
- A judge is still needed for the genuinely subjective 15%: is the chosen token _semantically_ right, is the schema a sensible public API, does the code read like the rest of the design system.
- Capping the judge at 15% bounds the damage when it drifts.

**Judge rules:** one isolated call per rubric dimension; the judge model is **pinned** (changing the pin is a versioned, changelog-worthy event that invalidates fingerprints); judges get an explicit "Unknown" escape hatch; never `.not.toSatisfyCriterion` — negative checks use the deterministic `toContainText` form; ≥80% agreement with hand-grading on a ≥20-trial calibration set before the judge counts toward a gate.

**Trade-offs accepted:**

- Deterministic graders encode the contract as we understand it today; contract changes require grader changes.
- Scores are only comparable within one weighting version.

## Decision 9: Computed variant-version guard for unfingerprinted `setup()`

**Context:** `@vercel/agent-eval` fingerprints eval files plus `agent`, `model`, `scripts`, `timeout`, `earlyExit`, and `runs`. It does **not** fingerprint `setup()` or `editPrompt()`, because functions are not hashable.

Our MCP staging lives entirely in `setup()`. Rebuild an MCP server, re-run the experiment, and the framework happily reuses results produced by the _previous_ build — no error, no warning, last week's numbers reported as this week's.

Two findings narrowed and reshaped the original plan:

1. **Result reuse is scoped per experiment name.** `scanReusableResults()` only scans `results/<experimentName>/`, and each MCP variant is its own experiment file. Variants can therefore never cross-contaminate each other; the hazard is confined to one experiment across MCP rebuilds.
2. **A `variantVersion` config field is impossible.** `validateConfig` parses through a `zod` object schema, which strips unknown keys. Any extra field is silently discarded before it reaches the fingerprint.

**Options considered:**

1. Hand-maintained `variantVersion` smuggled into a fingerprinted config field — **impossible**, see above
2. Always pass `--force` in CI — correct but discards legitimate reuse, and does nothing locally
3. External guard: hash the staged payload ourselves and refuse to run on mismatch

**Chosen: Option 3.** `defineExperiment()` hashes every file it will upload (plus versions and resolved dependency specs), writes it to `results/<experiment>/.variant-version`, and throws on mismatch with an explicit instruction to re-run with `--force`.

**Rationale:**

- It is computed, so it cannot be forgotten — the failure mode the original hand-maintained approach was exposed to.
- It fails at config load, before a sandbox is provisioned and before any spend.
- It converts a silent correctness bug into a loud, actionable error.

**Trade-offs accepted:**

- The marker lives under gitignored `results/`, so CI always starts clean and the guard is effectively a local-developer protection. That is where the hazard actually is.
- Detecting `--force` by inspecting `process.argv` is crude, but the CLI exposes no hook for a config module to read resolved flags.

## Decision 10: Static per-trial Storybook artifacts

**Options considered:**

1. **Numeric results only** — `summary.json` plus a metrics dashboard
2. **Results + raw project snapshots** — inspectable, but requires local setup to view
3. **Results + a built Storybook per trial**, containing both the generated component and the run report rendered as stories

**Chosen: Option 3**

**Rationale:**

- A generated component can typecheck, lint, build, and still be wrong: wrong token layer, wrong BEM structure, React state smuggled in, a native `<button>` where our `Button` belongs, an a11y trap. Somebody has to look at it.
- Storybook's original `eval/` harness solved this well — each trial rendered its own report (summary, transcript, build/typecheck/lint output, source) as stories, ordered `Summary → Conversation → Graders → Build → Typecheck → Lint → A11y → Source`. Reviewers could interact with the produced UI in the same browser tab as the evidence of how it was produced.
- Requires `copyFiles: 'all'`, which is therefore mandatory rather than a default.

**Trade-offs accepted:**

- Storage. Storybook reports 20–40 MB per run; a built Storybook per trial adds more. Bounded by a retention policy (last 10 runs per experiment plus pinned baseline-setting runs), with older Storybooks rebuildable on demand from the retained `project/`.
- Build time per trial.

## Decision 11: Spend is a human decision

**Chosen:** full matrix runs are label-gated (`ci:eval`, `ci:extra-models`) or manually dispatched — never auto-triggered on push. A hard **$40/run** budget guardrail aborts the run. `pnpm eval:dry` prints the projected task × variant × run plan and estimated spend before anything executes. A nightly single-variant regression run acts as the cheap drift tripwire.

**Rationale:** matrix × tasks × runs multiplies fast, and an eval loop that quietly bills against every push will be deleted rather than fixed. Storybook operates a broader suite at ~$30–45/run with a $75 cap.

**Amended after P1 (2026-08).** The original figure was $25, chosen before any per-trial cost existed. P1 measured `cc-both` at **$29.71 for a single-eval matrix** — the tightest possible run already broke the cap, so the number described nothing achievable. Raised to $40.

Two caveats worth stating plainly:

- **The cap is not enforced.** Checklist 4.6 is unimplemented, so nothing aborts. Today the only real protections are `pnpm eval:dry` and human attention. Raising the number changes policy, not behaviour.
- **It is a per-experiment-run cap, not a campaign cap.** A five-eval matrix is ~$310 across four arms; no per-run ceiling constrains that total. Chunking (Decision 35) is what makes the campaign affordable, not this cap.

**Explicit operational rule:** applying eval CI labels and dispatching eval workflows is a human decision. Agents must never do it; agents validate locally with `EVAL_ONLY`, one experiment at a time.

## Decision 12: Post-run `scripts` disabled; validation lives in `EVAL.ts`

**Chosen:** `@vercel/agent-eval`'s post-run `scripts` mechanism is disabled by default. Build, typecheck, and lint are executed from inside `EVAL.ts` via our own assertion helpers.

**Rationale:** Storybook found sandbox flakiness in post-run scripts produced more failures than actual agent mistakes. Running validation through our own helpers lets a tooling hiccup be classified as `infra` (Decision 5) rather than counted as a model failure.

**Trade-offs accepted:** more code in our assertion layer; slower per-trial validation than a batched script phase.

## Decision 13: Stage MCP servers as files, vendoring workspace dependencies

**Context:** the sandbox has no access to the host filesystem, and `Sandbox.writeFiles()` accepts only UTF-8 strings — so a packed tarball cannot be transferred. Both MCP servers compile to plain JS and ship text-only data (JSON/CSS/SCSS).

A first implementation uploaded `dist/` (plus `tokens/` and `rules/` for `design-tokens-mcp`) and ran `npm install --omit=dev`. It failed immediately: both servers depend on `@kickstartds/shared-auth` via `workspace:*`, which is `private: true` and exists on no registry.

**Options considered:**

1. Publish `@kickstartds/shared-auth` to npm — changes a deliberate privacy decision to serve a test harness
2. Bundle the MCP servers before staging — adds a build step and obscures which code actually ran
3. Vendor workspace dependencies alongside the server and reference them as `file:` deps

**Chosen: Option 3.** `lib/mcp/stage.ts` walks the dependency graph, stages each workspace dependency under `.mcp-servers/_vendor/<name>/`, and rewrites the specifier to a relative `file:` path. Recursion handles transitive workspace dependencies; a `seen` set handles diamonds.

**Rationale:**

- The staged tree is the real built output, so a failure in the sandbox is a real failure of the code under test.
- No changes to any package's publishing posture.
- npm installs the transitive dependencies of `file:` deps automatically, so only the servers themselves need an install step.

**Trade-offs accepted:**

- Staged `package.json` files must carry each dependency's **real** package name — npm installs a `file:` dependency under the name in its own manifest, so a synthetic name would break resolution. This is load-bearing and easy to break.
- Only text file extensions are uploaded. A future MCP server shipping binary runtime data would need a different mechanism, and would fail loudly rather than silently — by design.

## Decision 14: MCP wiring via `.mcp.json`, not a CLI flag

**Context:** the PRD assumed the harness would pass MCP configuration to the agent on the command line. It does not. `buildClaudeCodeCliArgs()` emits only `--print`, optionally `--allowedTools WebSearch,WebFetch`, optionally `--model`, always `--dangerously-skip-permissions`, optionally `--effort`, and the prompt. There is no MCP flag to hook into.

**Chosen:** `setup()` writes the two files Claude Code reads from the project root — `.mcp.json` declaring each staged server, and `.claude/settings.local.json` containing `enableAllProjectMcpServers: true`.

**Rationale:**

- Project-scoped MCP servers are otherwise gated behind an interactive trust prompt, which a `--print` run can never answer. Without the settings file the servers are declared but never started, and the variant would silently degrade into the baseline — producing a plausible-looking null result.

**Trade-offs accepted:**

- Agent-specific. Adding a non-Claude agent to the matrix (D2 defers this) requires a second wiring path.
- `.claude/` inside the sandbox is exactly the kind of file Decision 7 bans from fixtures. It is written by `setup()` rather than committed, contains no guidance, and is only written for variants that actually have servers to enable — the baseline sandbox never receives it.

## Decision 15: Capture the agent transcript ourselves, from inside `EVAL.ts`

**Context:** the first real baseline run (`cc-none-sonnet-high`, 3 trials) produced no transcript at all — `result.json` carried only `{status, duration, model, outputPaths}`, `observedModel` was null, and neither `transcript.json` nor `transcript-raw.jsonl` was written. `@vercel/agent-eval` captures the Claude Code transcript in `captureClaudeTranscript()`, which reads exactly one path — `~/.claude/projects/<cwd-with-slashes-as-dashes>/*.jsonl` — and is best-effort by design: every failure returns `null` without a warning. The runner env sets `USER=user` and `LOGNAME=user` but never `HOME`, and workspace relocation only happens on Vercel sandboxes, so the path the runner derives and the path the CLI actually writes to are not guaranteed to agree in a Docker sandbox.

Three of the four dimensions this package measures — cost, efficiency, and MCP usage — are read out of the transcript. A silent null there is not a cosmetic gap; it removes the ability to answer G2 at all, and the P1 MCP-usage and negative-usage graders have nothing to assert against.

**Chosen:** capture the transcript ourselves, in-sandbox, from `EVAL.ts`. The block searches every plausible home root (`$HOME`, `os.homedir()`, `/root`, `/home/sandbox`, `/home/user`, `/home/node`) for the exact per-project directory first, then falls back to the newest `*.jsonl` anywhere under a `.claude` directory. It writes `agent-transcript.jsonl` (raw) and `agent-transcript-meta.json` (source path, roots searched, byte count, and a derived summary: observed model, assistant message count, token totals split by input/output/cache-read/cache-write, a full tool-call histogram, and the `mcp__*` subset) into the workspace root.

**Rationale:**

- `captureGeneratedFiles()` runs _after_ validation and collects via `git add . && git diff HEAD --name-status`, so untracked files written by `EVAL.ts` are picked up and land in `run-N/project/`. This satisfies G4 (static inspectable artifacts) and the explicit requirement that every run keep its transcript of communication.
- The derived summary means P1 graders never re-parse 800 KB of JSONL, and the `mcp__*` histogram is precisely the signal the MCP-usage and negative-usage graders need. Verified against real Claude Code transcripts: `mcp__storybook-docs-mcp__get-documentation: 12` extracted cleanly alongside token totals.
- Owning the capture removes a silent dependency on upstream best-effort behaviour that has already failed us once.

**Trade-offs accepted:**

- **It lives in `EVAL.ts`, duplicated per fixture, on purpose.** `TEST_FILE_PATTERNS` is the hard-coded list `['EVAL.ts', 'EVAL.tsx', 'PROMPT.md']`; only those files are withheld from the agent. A shared helper module would be uploaded with the fixture, telling the agent we read its tool calls — an observer effect on the very metric being measured. Duplication is the lesser evil until there are enough fixtures to justify generating the block.
- Nothing in the block asserts. A missing transcript is an infrastructure failure and must never be scored as a model failure, so it degrades to a meta file recording which paths were searched.
- Adding the block changes the eval-directory content fingerprint, invalidating cached results once.

## Decision 16: Deny `WebSearch` and `WebFetch` in every variant

**Context:** the first run with working transcripts (Decision 15) exposed something the earlier, transcript-less run had hidden. One of three no-MCP baseline trials issued 2 web searches and 19 fetches, and what it fetched was the kickstartDS design system itself: `kickstartds.com/docs/guides/examples/components/button/`, the GitHub contents API for `packages/components/base/source`, and raw `TagLabelComponent.tsx` / `tag-label.scss` from the `next` branch.

A control that can download the design system our MCP servers encode is not a control. It closes precisely the gap the experiment exists to price, and it does so intermittently — one trial in three — so it inflates variance in every dimension at once: that trial ran 609.9s versus 304.4s for the trial that stayed offline.

**Chosen:** `setup()` writes `.claude/settings.local.json` for **every** variant, including the baseline, with `permissions.deny: ["WebSearch", "WebFetch"]`.

**Rationale:**

- The question is "do our MCP servers help?", not "can a model find our docs on the internet?". Those are different experiments and only one of them is this package's brief.
- Determinism. The eval doubles as a regression gate against model drift (G5), and a gate whose inputs include live web content cannot attribute a regression to the model. GitHub `next` moving under us would read as a quality drop.
- Denied in **all** variants, not just the baseline. If web research stayed enabled for MCP variants, a trial could substitute a fetch for an MCP call and the attribution would be wrong in the other direction.
- The `mcp__*` histogram and the full `toolCalls` histogram in `agent-transcript-meta.json` make compliance free to verify: `WebFetch` and `WebSearch` must simply be absent.

**Trade-offs accepted:**

- **Enforcement is unverified.** The harness always passes `--dangerously-skip-permissions`, documented as "bypass all permission checks". Deny rules are expected to take precedence, but this has not been confirmed. `DENY_WEB_RESEARCH` carries a note; the next run's tool histogram settles it, and the fallback is a `PreToolUse` hook, which is enforced independently of permission mode.
- This makes the baseline weaker than a real-world agent, which would have internet access. That is the point of a control, but it means baseline numbers must be read as "the model's own knowledge", not "what a developer would get today". An explicit web-research-enabled variant can be added later as a separate axis if that comparison is wanted.
- Decision 14's trade-off note said the baseline sandbox never receives a `.claude/` directory. It does now. The file still contains no guidance of any kind — only `enableAllProjectMcpServers` (inert with no servers declared) and the deny list — so Decision 7's ban on leaked instructions is intact.
- `setup()` is invisible to the framework's fingerprint, and the baseline stages no packages, so the staged-package hash alone would not have changed when the deny list did. `variantVersion` now hashes the deny list alongside the staged packages, so the Decision 9 guard trips correctly.

### Amendment to Decision 16 (verified 2026-08-06)

`permissions.deny` survives `--dangerously-skip-permissions`. Three trials of
`cc-none-sonnet-high` produced tool histograms containing only `Bash`, `Read`,
`Write` and `Edit`. There were no denial messages either, which suggests the
denied tools are withheld from the advertised toolset rather than rejected at
call time. The `PreToolUse` hook fallback is therefore not needed.

Two residual notes:

- The deny list governs Claude's own web tools, not `Bash`. The sandbox has
  network access and trials do use it to install a toolchain from npm
  (`jsdom`, `@testing-library/react`, `react-dom`). Nothing has fetched
  kickstartDS this way — the only `kickstartds` strings in the transcripts come
  from our prompt and the fixture's `$id` — but `npm pack @kickstartds/*` is not
  blocked in principle. Closing it would also break toolchain installation, and
  P1 links the real design system in deliberately, so this stays open and
  monitored rather than fixed.
- The agent reads `__agent_eval__/run.mjs` in every trial. That file carries the
  CLI invocation, not the graders, so no assertion leaks. Re-check if upstream
  moves grading detail into it.

Closing the web also changed what the baseline _is_: mean duration fell from
647.1s to 310.7s and output quality dropped (plain `.css`, no `{Name}Component`
suffix in any trial). The pre-deny runs were partly measuring retrieval of our
own published source, so they are superseded and should not be cited as
baseline.

---

## Decision 17 — Graders run on the host, over the captured snapshot

**Context.** The PRD assumed graders would live beside the fixture and be
imported by `EVAL.ts`. They cannot. Upstream withholds exactly three basenames
from the agent — `EVAL.ts`, `EVAL.tsx`, `PROMPT.md` — and uploads everything
else in the eval directory into the workspace. A `lib/assertions/` folder
shipped alongside the fixture would be readable by the agent under test, which
is a rubric leak: the model would be graded on a rubric it had just read.

**Decision.** Graders are host-side TypeScript in `packages/agent-eval/lib/graders/`,
run by `pnpm grade` against the `project/` snapshot the harness captures after
each run. `EVAL.ts` keeps only the in-sandbox gate (and any future toolchain
checks that genuinely need to execute code, written out as a report JSON — the
same pattern already used for transcript capture).

**Consequences.**

- Re-grading historical runs is free. This is not a nicety: it is the only
  reason the contract bug in Decision 18 cost nothing instead of three more
  paid trials. Any grader change can be validated against every run ever made,
  at zero spend.
- The harness's own pass/fail (`EVAL.ts`) and our quality score are now two
  different numbers. Both are reported. `pass@1` remains the gate; the quality
  score is what deltas are computed on, because a binary gate cannot show that
  a variant got _closer_ to the contract.
- Graders can read things the sandbox cannot — notably the real token registry
  in `packages/design-tokens-mcp/tokens/`, which is how `token-conformance`
  distinguishes an invented `--space-3xs` from a real `--ks-spacing-*`.

## Decision 18 — The contract is measured from the design system, not from instructions

**Context.** The P0 rubric asserted `{Name}Component.scss` and
`{Name}Component.client.ts`. Measured across the 68 components of
`@kickstartds/design-system`, **neither pattern occurs even once**. Both were
copied from `.github/copilot-instructions.md`, which is wrong on those two
lines. Measured conformance:

| Rule                                 | Conformance                |
| ------------------------------------ | -------------------------- |
| `{Pascal}Component.tsx`              | 68/68                      |
| `{slug}.scss` (kebab-case)           | 61/61 of styled components |
| `{slug}.schema.json`                 | 67/68                      |
| component imports its own stylesheet | 61/61                      |
| `.dsa-` block in styles              | 58/61                      |
| `_{slug}-tokens.scss`                | 41/68                      |
| `{Pascal}.client.js` (root or `js/`) | 7/68                       |

Two consequences followed. The reported 0/3 baseline was partly a rubric
artifact — trials were penalised for output that was closer to correct than the
rubric was. Worse, the MCP variants would have been penalised for following
their own guidance, since the Component Builder MCP teaches the _real_
convention. The measured delta could have come out negative for reasons that
have nothing to do with the MCP's value.

**Decision.** Every structural rule is derived from the design system by
measurement, and `pnpm graders:selftest` grades the real 68 components with the
same graders on every change. Floors are set below 100% — the reference
implementation is not uniformly conformant, and a grader that demanded
perfection of it would be demanding perfection of nothing that exists.

**Consequences.**

- `style-placement` is the **inverse** of the PRD's wording. The PRD said
  components must not import their own SCSS (true for the website package's
  local components); in the design system all 61 styled components do import it.
  We grade the design system's rule, because that is what the fixture is.
- Two checks are fixture-only and are skipped when grading the reference
  (`schema-untouched`, which presumes a supplied schema, and the stray-file
  penalty's stricter reading).
- `.github/copilot-instructions.md` should be corrected; it currently misleads
  Copilot in this repository on every component it touches.
- Fixing `EVAL.ts` changes the eval-directory hash and therefore the
  fingerprint. Re-running the baseline is a spend decision for a human
  (Decision 11); the corrected quality scores for the existing trials are
  available already, host-side, for free.

## Decision 19 — Absent quality dimensions are dropped, not scored zero

**Context.** The composite weights `0.40 contract / 0.25 toolchain / 0.20
runtime / 0.15 judge` assume four working dimensions. Toolchain graders need a
fixture that installs the real design system, and the judge is P3.

**Decision.** Dimensions with no applicable grader are excluded and the
remaining weights renormalised. Every report prints `WEIGHTS_VERSION`, the
dimensions actually counted, and their renormalised weights.

**Consequences.** Scores are comparable only within a weights version, and the
report says so on every run. Scoring absent dimensions as zero would have
compressed every variant toward the same low number — precisely destroying the
deltas the package exists to measure.

## Decision 20 — the fixture ships a toolchain, never the design system

**Context.** The first three baselines ran against a fixture with only React,
TypeScript and Vitest installed. Every trial wrote `badge.css` instead of
`badge.scss`, and the transcripts show why: _"using only plain CSS since Sass
isn't installed"_. Two graders were scoring a fixture defect as a model defect.

**Decision.** Fixture provisioning is decided per eval, in that eval's
`package.json`. The framework's agent definition already runs `npm install` in
the workspace before the agent starts, so declaring a dependency is the whole
mechanism — no `setup()` step is involved.

`810-atom-from-schema` declares the toolchain a real kickstartDS package has:
`sass`, `jsdom`, `react-dom`, `@testing-library/react`, `axe-core`, `typescript`,
`vitest`. It does **not** declare `@kickstartds/design-system`, because a Badge
is an atom — it composes nothing. Evals whose task _requires_ composition (a
card that needs a Button, a form that needs Inputs) must declare the design
system, or the task is impossible and `ds-reuse` has nothing to measure. The
`delegatedElements` field on each grader target already encodes this per eval.

**Rationale.** These are two different kinds of missing input. A compiler is
table stakes: withholding it tests whether the agent can guess its environment,
which is not the question. The component library is the answer key — 68 worked
examples of exactly the conventions the MCP servers exist to transmit. Install
it and the MCP delta collapses toward zero for a reason that says nothing about
the servers.

**Consequences.** All baselines predating this change are retired; they measured
a different environment. The cold/warm split is now a property of the _task_
rather than a global policy: atom evals stay cold and measure whether the agent
knows the conventions, composition evals ship the design system and measure
whether the agent finds and reuses what already exists. Both are real questions;
they are simply different ones, and the report must not average them without
saying so.

`SETUP_VERSION` feeds `variantVersion` because `setup()` is invisible to the
framework's fingerprint. Fixture `package.json` needs no such guard — it lives
in the eval directory, which the framework already hashes.

## Decision 21 — dimensions that need execution are graded in two halves

**Context.** Decision 17 put grading on the host so it can be re-run for free
and so the rubric never leaks to the agent. Toolchain and accessibility do not
fit: one needs a compiler, the other a DOM, and neither can be derived from a
file snapshot.

**Decision.** `EVAL.ts` — which is withheld from the agent — executes them
in-sandbox and writes `toolchain-report.json` and `runtime-report.json`. The
host graders read those files out of `run-N/project/` and do the scoring.

**Rationale.** This keeps the two properties that matter. The rubric stays
hidden, because the reports record raw observations (`tsc` output, axe violation
ids) rather than scores. Re-grading stays free, because reweighting or fixing a
grader only re-reads the JSON. A shared in-sandbox helper file would have been
readable by the agent; `EVAL.ts` is not.

**Consequences.** Report generation never throws — a missing report grades as
not-applicable, since it means the sandbox never reached the reporting step,
which is infrastructure rather than the model. Only the toolchain assertions
gate validation; a11y is scored but non-gating until the P2 Storybook harness
gives it a fairer render context.

## Decision 22 — an MCP run must prove it used MCP, in setup and in the transcript

**Context.** The first full matrix produced a clean, plausible result: +0.18
quality for the MCP variants, consistent across three arms, with sensible cost
ratios. It was worthless. The MCP tools were never exposed to the agent; it
found the staged servers in its own working directory, read `dist/tools.js`,
and called the handler functions directly with
`node -e "import('./handlers.js')…"`. One `design-tokens` trial simply `cat`-ed
`tokens/component-token-catalog.json` — the answer key for `token-conformance`,
which then scored 1.00.

Nothing in the pipeline objected, because every individual number was real. The
`mcp-usage` diagnostic did report _"configured but never called"_ in 9/9 runs,
but it was diagnostic by design (Decision 12: grade the product, not the path),
so it carried no weight and excluded nothing.

**Decision.** Three layers, because no single one is sufficient:

1. **Setup-time liveness probe.** `lib/mcp/probe.mjs` speaks JSON-RPC to each
   staged server over stdio at the exact path `.mcp.json` will name, and
   requires a non-empty `tools/list`. Runs before the agent, so a dead server
   costs a container start rather than an experiment.
2. **Servers run outside the workspace.** Uploads still land in `.mcp-servers/`
   — the docker backend extracts every tar at the container workdir, so there
   is no alternative — and are then moved to a sibling directory. This removes
   the _stumble_; it does not make the servers unreachable, and is not intended
   to.
3. **`confounded` failure class.** A non-baseline trial that either touches the
   staging path or records zero MCP calls is excluded from every aggregate.

**Why the third layer is the load-bearing one.** `--dangerously-skip-permissions`
is always passed, so no permission rule stops a read, and `find /` locates the
servers wherever they are. Prevention is not achievable; detection is. Making
this a _validity_ condition rather than a low score is the key move — a
confounded trial usually looks good, and the failure mode is silent inclusion,
not a visible error.

**Consequence.** `FailureClass` gains `confounded`, which `metrics.ts` and
`grade.ts` already exclude by keeping only `model` and `none`. Re-grading the
first matrix now reports `0 counted, 3 excluded — RUN INVALID` for all three MCP
arms, with the offending command quoted. The baseline is untouched at 0.52.

**Rejected: HTTP transport with the source deleted.** Both servers support
`MCP_TRANSPORT=http`; starting them in `setup()` and then `rm -rf`-ing the
directory would leave nothing on disk to read, since a running process survives
unlinking. This is the only genuinely airtight option and remains open. It was
not taken now because it adds a detached background process, port allocation,
and a readiness wait to `setup()` — three new silent-failure modes, introduced
while fixing a silent failure. Detection first; airtightness once the protocol
is known to work at all.

**Unresolved: why the tools were never exposed.** Probed locally, both servers
answer `initialize` and `tools/list` correctly, so the builds are sound. The
claude-code agent definition sets no `--allowedTools` and its `configFiles()`
returns `[]`, so neither filtering nor clobbering explains it. `.mcp.json` and
`enableAllProjectMcpServers` were both present and correct in the captured
project. The next run will answer this: the probe isolates the server half, so
a failure that survives it is Claude Code's side of the wiring.

## Decision 23 — setup is rehearsed against a real container before any spend

**Context.** Decision 22 closed with an unresolved question: why Claude Code
never exposed the MCP tools. The honest answer turned out to be that it had
nothing to expose. Both servers import `@kickstartds/shared-auth` at module
load; the vendored copy's own dependency (`jsonwebtoken`) was never installed,
because `setupVariant()` installed only packages with an entry point. npm links
`file:` dependencies rather than copying them, and Node resolves from a
symlink's realpath — so the vendored code searched `_vendor/node_modules` and
`/tmp/node_modules`, never the server's `node_modules` where npm had put it.
Both servers exited before `initialize`.

Every observed symptom of D-26 follows from that: no tools registered,
`ToolSearch` returning "No matching deferred tools found", and an agent
reasonably concluding it should read the source instead.

**The real defect is not the missing dependency.** It is that `setup()` had
never been executed except as part of a paid run, so its first failure was
observable only in the wreckage of a completed matrix. `--dry` does not help; it
previews fingerprints and never provisions a sandbox. `--smoke` deletes its own
results (D-23). Neither exercises `setup()` in a way anyone can inspect.

**Decision.** `createSandbox` is exported from the harness, so `setupVariant()`
can be driven directly. `bin/setup-check.ts` provisions the same image the
harness uses, runs the real setup path, and asserts: the upload directory is
gone from the workspace, the servers live outside it, `.mcp.json` points at
absolute paths under the runtime directory, each entry point exists, the probe
cleaned up, and the deny list is in place. The probe inside `setup()` covers
`tools/list`. Cost: one container start.

It is a **precondition for spending money**, not a test — run `pnpm setup:check`
before any matrix.

**Two consequences of building it.** It failed on its first two runs, and both
failures were real. Relocation to a sibling of the workspace is impossible —
the sandbox user does not own `/home/sandbox` — so servers now run from
`/tmp/.agent-eval-mcp`; the parent directory is not load-bearing because
`stagingLeakOf()` keys on the directory name. And the missing dependency above.

**It must not import an experiment file.** `defineExperiment()` writes the
`.variant-version` marker at module load, so importing one here would satisfy
the guard that is supposed to demand `--force` on the next real run. It calls
`stageVariant()` and the now-exported `setupVariant()` directly instead.

**What it still cannot prove.** That Claude Code exposes a live server's tools to
the agent. That remains observable only in a transcript — which is why the
Decision 22 detection layer stays regardless of this one passing.

## Decision 24 — reading the servers invalidates a trial; listing them does not

**Context.** Decision 22 excluded any trial whose transcript mentioned the
staging directory in a tool input. That was the right rule for D-26, where the
agent `cat`-ed `dist/tools.js` and executed the handlers as a library because no
MCP tools existed. With the servers actually running (Decision 23), the same
rule excluded two of three trials for one `find` each — issued by agents that
had already made all nine MCP calls and consulted MCP first. One described it as
"Explore vendor kickstartDS directories for reference examples": it was looking
for the design system to copy from, and found `jsonwebtoken`.

**Decision.** Classify the access instead of flagging its existence.

- **`read`** — content came out. A content-emitting verb (`cat`, `head`, `sed`,
  `grep`, `node`, …) applied to a staging path, a `cd` into the tree, or
  `-exec`/command substitution touching it. Also any `Read`/`Grep` tool call,
  and any shape not recognised. Still `confounded`; still excluded.
- **`list`** — paths came out and nothing else: `find`, `ls`, `Glob`. Reported
  as `mcp-usage/no-staging-enumeration` and **counted**.

Classification is per shell segment, not per command string, because
`find <dir> | head -50` pipes a _path list_ into `head` — a whole-string scan
for content verbs would call that a read. A verb only counts when it is applied
to the staging path itself. `cd <dir> && …` counts unconditionally: everything
after it is relative to the tree, which is how the first matrix was compromised.

**Why this is not a weakening.** Attribution measures what influenced the
output. A directory listing of an auth library feeds no grader. The intent to
find something to copy is real and is still reported on every affected trial —
it just no longer destroys the measurement. Unknown tool shapes default to
`read`, so the failure direction remains conservative.

## Decision 25 — a missing module is only infrastructure when the fixture is missing it

**Context.** `Cannot find module` was a blanket infra signature, so a trial was
deleted for `TS2307: Cannot find module '@storybook/react-vite'` in
`Badge.stories.tsx` — a file the agent wrote, importing a package it chose.

**Decision.** TS2307 is a `model` failure. A genuinely under-provisioned sandbox
surfaces as Node's runtime `ERR_MODULE_NOT_FOUND`, never as a TypeScript
diagnostic in the agent's own source.

**Why it matters more than the one trial.** The component-builder MCP hands out
a Storybook template, and the fixture cannot compile the result. That is a cost
of using the MCP, appearing only on MCP arms, and the old rule silently deleted
the evidence. Provisioning Storybook (item 1.9, also required by the standing
static-inspection goal) will resolve the underlying mismatch; until then it is
visible as a `toolchain` penalty rather than a vanished trial.

## Decision 26 — MCP reached through a subagent still counts as reached

**Context.** In the first valid matrix, `cc-component-builder` run-2 was
excluded as _"an MCP variant that never called an MCP server"_. It had. The
agent resolved four tools via `ToolSearch`, then spawned a subagent and asked it
to call them and _"report back their FULL raw output"_. Claude Code runs that
nested conversation separately, and it never reaches the session transcript:
every record we capture carries `isSidechain: false`. The counter saw zero and
the exclusion rule scored a well-informed trial as if it were the baseline.

**Decision.** Delegation is detected by its one visible trace — the subagent's
prompt names `mcp__server__tool` identifiers — and counts as reaching MCP. The
trial keeps its quality score. It is withheld from the MCP call and MCP token
means, because those numbers really are unknown for it, rather than folded in
as a zero that would understate the arm's cost.

**Why the split matters.** Quality and cost fail differently here. We know the
agent got the instructions, so its output is attributable; we do not know how
many calls it took, so the cost is not. Averaging in a zero would have made the
component-builder arm look cheaper than it is, in the same breath as making it
look like it had not used its MCP at all.

**Direction of the old error.** It deleted a _successful_ MCP trial, so it bit
only the MCP arms and only when they worked well enough to delegate. Left in
place it would have understated exactly the effect the matrix exists to
measure.

## Decision 27 — price a trial from cache traffic, not output tokens

**Context.** The harness recorded token counts and duration but never money, so
every cost claim in this project was made in output tokens. Measured on the
first valid matrix, a `both` trial spends 13.0M cache-read and 712K cache-write
tokens against 134K output. At Sonnet list prices output is $2.01 of a $9.90
trial. "MCP costs 4× more" was the output ratio; the real ratio is 7.08×.

**Decision.** `lib/report/cost.ts` prices all four token classes from a static
per-family table and every `Outcome` carries a `cost` breakdown. Aggregates
report mean cost per counted trial _and_ total spent including excluded trials —
a confounded trial is billed exactly like any other, so budgeting from the
counted mean understates any run that had to throw work away.

**Why static prices.** This is a planning estimate, not an invoice. A live
pricing lookup would add a network dependency to a report that must run offline
against archived results, and the provider's own billing remains authoritative.
The table is keyed by model _family_ so a point release does not silently fall
through to the wrong tier.

**What it changed immediately.** Ranking arms by quality alone put `both` first.
Ranking by quality per extra dollar puts `component-builder` first by 3.7×, and
shows the `design-tokens` increment costing ~$319 per quality point — a
difference that is, separately, inside the noise floor (D-32).

## Decision 28 — `EVAL.ts` is generated, because a shared helper would leak

**Context.** By the fifth eval the ~400-line harness — transcript capture,
component discovery, sass compilation, jsdom+axe rendering — was going to be
copy-pasted five times. The obvious fix is a helper module imported by each
`EVAL.ts`.

That fix is not available. `TEST_FILE_PATTERNS` in `@vercel/agent-eval` is
hardcoded to `['EVAL.ts', 'EVAL.tsx', 'PROMPT.md']` and matched by **basename**
(`sandbox.js`, `splitTestFiles()`). Everything else in a fixture directory is
uploaded into the sandbox. A `harness.ts` sitting next to `EVAL.ts` would be
readable by the agent under test, telling it that we count MCP tool calls and
hash the files it must not touch — an observer effect on the exact metrics we
are trying to measure.

**Decision.** Keep the harness in `lib/eval-harness/harness.ts`, keep each
eval's assertions in `lib/eval-harness/sources/<name>.ts`, and bundle the two
into `evals/<name>/EVAL.ts` with esbuild via `pnpm build:evals`.

Generated output is **committed on purpose**: `computeFingerprint` hashes the
eval directory as it sits on disk, so the artifact has to be the thing that was
fingerprinted. `pnpm typecheck` runs `build-evals --check` and fails on stale
output.

## Decision 29 — fixture hygiene now fails on assertion sources, not just prompts

**Context.** The first cut of D-28 put `eval.src.ts` inside the fixture
directory. That is precisely the leak D-28 exists to prevent — it would have
handed the agent the assertions it is graded against and quietly invalidated
every number produced afterwards. It was caught by re-reading `splitTestFiles()`,
not by any check we had.

**Decision.** `assertFixtureHygiene()` gained `FORBIDDEN_PATTERNS`
(`eval.src.ts`, `harness.ts`) and now scans fixture roots for them.
`defineExperiment()` calls it at module load, so a stray copy fails at config
load — before a sandbox is provisioned and before any money is spent.

**The general rule.** Only `EVAL.ts`, `EVAL.tsx` and `PROMPT.md` are withheld
from the sandbox. Anything else added to a fixture is agent-visible input.
Treat that as the default and justify each file against it.

## Decision 30 — vendor a design-system slice rather than install the real one

**Context.** `ds-reuse` returned `notApplicable` in every trial of the first
matrix (D-20): the fixture had nothing to reuse, so preferring `<button>` over
`Button` cost nothing. Installing `@kickstartds/design-system` would fix that
and bring a Rollup build, a token pipeline, an icon sprite and a 74-component
surface into every sandbox install.

**Decision.** `840-reuse-over-native` vendors a four-component slice (`Button`,
`Icon`, `Headline`, `Text`) as `@kickstartds/ds` via `file:vendor/kickstartds-ds`,
authored in plain `createElement` JS so it needs no transform from
`node_modules`. Verified to resolve and import in a clean install.

**The prompt does not name the components.** It asks the agent to "compose the
way the design system composes larger components out of smaller ones". Listing
them would pre-encode the grader in the prompt, which PRD §10 forbids — and
would measure instruction-following rather than whether an MCP leads an agent to
discover what already exists.

## Decision 31 — one eval measures restraint, not capability

**Context.** Every eval so far rewards producing more. Nothing penalises an
agent that rewrites a working stylesheet, adds dependencies, or "improves"
untouched files. That is a real and expensive failure mode, and stacking MCPs is
exactly the configuration most likely to trigger it — `both` already burns 3.98×
the output tokens of baseline for +0.02 quality.

**Decision.** `860-restraint` ships `Tag` complete and correct except for one
seeded defect (axe `button-name`, critical). The eval scores the fix _and_ the
blast radius: schema, client behaviour and token partial are hash-pinned, and
the component directory must gain no unrequested files.

The stylesheet is asserted by surviving selectors rather than by hash, because a
visually-hidden accessible name legitimately needs a new rule. Pinning it would
score the correct fix as a violation.

`requiresClientBehaviour` stays `true` here and is `false` for `812`: in both
cases the target is the file that _should already exist and be left alone_.

## Decision 32 — validate every eval in both directions before spending on it

**Context.** PRD §10 says a task scoring 0% across 100 trials is broken rather
than hard. Discovering that after a $310 matrix is the expensive way to learn it.

**Decision.** Each new eval was run against (a) the fixture as shipped and (b) a
gold implementation written in `/tmp`, using the recorded-run replay procedure.
Both directions must behave before the eval is allowed into a matrix. Gold
implementations are never committed to the fixture (PRD §10).

This caught three assertions that were wrong in ways no amount of code review
would have surfaced:

- **`812` demanded a `.dsa-alert--info` selector.** `info` is the base state and
  has no modifier. The assertion also required flat selectors, so idiomatic
  `&--success` nesting would have failed a correct answer.
- **`812` scored `var(--ks-color-positive, #059669)` as a hardcoded colour.**
  Fallbacks are the design system's own convention; the check now collapses
  `var()` calls innermost-first before looking for literals.
- **`860` passed its accessible-name assertion on the broken fixture**, because
  the label matched a `data-remove-label` attribute rather than an accessible
  name. The assertion is now scoped to the `<button>` subtree.

Each of those would have produced confident, wrong numbers.

---

## 33. A matrix is assembled across runs, not read from one

**Context.** A full five-eval matrix is ~$310. That is bought in chunks, which
means no single run directory ever contains the whole matrix: the framework only
executes evals whose fingerprint changed, and — verified in
`@vercel/agent-eval/dist/lib/housekeeping.js` — it dedupes across timestamps with
"newest wins" per `(eval, fingerprint)` key. Reused results are **not** copied
forward into the new timestamp.

`bin/grade.ts` used `latestRun()`. Grading a chunked campaign would therefore
have reported only the last chunk, silently, and looked complete while doing it.

**Decision.** Grading resolves the matrix rather than reading a directory.
`resolveMatrix()` walks timestamps newest-first and takes the first result seen
per eval — mirroring the framework's own dedupe rule so the two cannot disagree.
An explicit timestamp still pins a historical run; the default is `resolved`.

Verified by reproducing the recorded 810 matrix exactly through the new path.

## 34. `contentFingerprint` is the comparability invariant

**Context.** Chunked buying introduces a failure mode that does not exist in a
single run: arms can be measured against _different versions of the same eval_.
The numbers still line up in a table, and the table is meaningless.

**Decision.** `lib/report/matrix.ts` treats `contentFingerprint` — which covers
eval files only, not agent/model config — as the invariant that must agree across
arms. `matrixIntegrity()` reports two distinct properties:

- **complete** — every arm ran every eval
- **comparable** — every arm that ran an eval ran the _same_ eval

These are deliberately separate. An incomplete matrix is a budget state; a
non-comparable one is a correctness failure. Grading prints `NOT COMPARABLE` with
the divergent evals named, and lists cells not yet run. Results predating
`contentFingerprint` are reported as unknown rather than assumed matching.

## 35. Chunking is scoped by eval, not by editing config

**Context.** `agent-eval run` has no per-eval filter (`--help` confirms:
experiments only). Chunking therefore needs the eval list narrowed at config
level, and hand-editing config between chunks is exactly the kind of drift the
variant guard exists to catch.

**Decision.** `EVAL_ONLY=<name[,name]>` narrows `evals` at config load. It is
safe with respect to caching because the eval list is not part of
`computeFingerprint` — narrowing cannot invalidate results for the evals that do
run.

An unknown name is fatal, listing what is available. Silently matching nothing
would look like a finished chunk; silently matching everything would spend the
whole budget. Both are worse than stopping.

**Chunk by eval, not by arm.** Running one eval across all four arms completes
whole rows, so the campaign can stop at any checkpoint and still hold a complete,
comparable matrix over the evals bought so far. Chunking by arm yields a ragged
matrix that is worthless until the last chunk lands.

## 36. Only a real run may advance the drift marker

**Context.** `--force` is accepted by commands that spend nothing (`--dry`,
`status`). Because `guardVariantVersion()` runs at config load, merely loading a
config under `--dry --force` stamped the results as current while they were still
from the old build — destroying the signal the guard exists to raise. This was
found by triggering it accidentally while testing `EVAL_ONLY`, and the affected
marker had to be restored by hand.

**Decision.** The marker advances only when `run` is present and `--dry` is not.
Advancing on a real run stays correct, because that run discards the cached
results it is stamping over.

**Corrected immediately.** That predicate was wrong. The CLI's primary form is
`agent-eval <experiment>` with **no subcommand at all** — `run` is only needed for
multiple experiments — so `argv.includes("run")` would have meant a real run never
advanced the marker, and every later invocation demanded `--force` forever. The
rule is now an inversion: advance unless this is `--dry`, `--smoke`, or a
read-only subcommand (`status`, `refingerprint`, `playground`, `init`).
`--smoke` is excluded because it deletes only its own results, so advancing on it
would stamp everything it did _not_ re-run as current.

Verified by simulating `process.argv` rather than invoking the CLI: `--force`
advances, `--dry --force` and `--smoke --force` do not.

## 37. Variant drift is attributed to a named input

**Context.** `pnpm status` reported all four arms — including `none`, which
stages no MCP packages — as built against a different variant. A single opaque
digest could not say why, and the likely culprit (`lib/mcp/probe.mjs`) is
untracked, so it could not be diffed either.

**Decision.** `variantVersion` is now composed from named parts (`staged`,
`settings`, `probe`, `setup`), and the marker records the per-part breakdown.
On drift the guard names which inputs moved. Markers written before this change
say so explicitly rather than guessing.

**Campaign rule.** `probe.mjs`, `SETUP_VERSION`, `DENY_WEB_RESEARCH` and all eval
fixtures are frozen for the duration of a matrix. Touching any of them
invalidates every arm, and mid-campaign that means re-buying completed chunks.

## 38. The generator formats its own output

**Context.** `bin/build-evals.ts` wrote raw esbuild output; the repo formatter
then reformatted the committed `EVAL.ts` (168 diff lines on `810`). Every
`--check` reported STALE forever, and the fix each time was to regenerate, which
the formatter promptly undid.

**Decision.** `bundle()` runs prettier before writing. The generator and the
formatter now agree, so `--check` means what it says.

## 39. Untouched-file digests are generated, never pasted

**Context.** `860` and `812` assert that files the task should not touch come
back byte-identical, by comparing a sha256 against a constant pasted into the
eval source. One of `860`'s three constants was stale. All four arms failed the
eval, 11/12 tests passing, on `the component token partial is left untouched` —
while every one of the twelve trials had in fact left the file untouched. The
agents showed perfect restraint and were failed by a typo in the answer key.

A pasted digest is unfalsifiable from the inside: once it rots, a _correct_
result and an over-edit are indistinguishable, and the eval reports the wrong
one. PRD §10 already says a task that cannot pass is broken rather than hard.

**Decision.** `bin/build-evals.ts` walks each fixture's `src/`, hashes every
file, and injects the map into the generated `EVAL.ts` via esbuild
`define: { __FIXTURE_DIGESTS__ }`. Evals read it through `shipped(relPath)`,
which throws on an unknown path. The expected digest and the shipped file are
now the same artifact and cannot drift.

Only `src/` is walked: `package.json` and `tsconfig.json` are legitimately
rewritten by an agent installing a dependency, and hashing them would fail
honest work.

**Consequence.** The define only substitutes where the symbol is referenced, so
`810`, `832` and `840` regenerate byte-identically and their fingerprints — and
the results already bought against them — survive the change.

## 40. Confounding is a per-eval property, not a global rule

**Context.** "An MCP variant that never called an MCP server measures the
baseline" (Decision 26) excluded all nine MCP-arm trials of `860` and marked
three arms `RUN INVALID`. But `860` is a one-line accessible-name fix. Opening a
token catalogue to write an `aria-label` is precisely the over-engineering the
eval exists to penalise, so declining to call a server is the _correct_ answer,
not a missing measurement.

The rule was written for `810`, where the servers are the treatment and ignoring
them genuinely voids the trial. Applied globally it makes restraint evals
unmeasurable in exactly the arms they are meant to discriminate.

**Decision.** `Target.mcpUseExpected` carries the policy per eval. `confound()`
consults it before excluding a zero-call trial. True for the build and restyle
tasks (`810`, `812`, `832`, `840`); false for `860`.

**Consequence.** Re-grading the existing chunk-1 results moves `860` from
`0 counted, 3 excluded` to `3 counted, 0 excluded` in all three MCP arms, with
no new spend. The genuine confound — `810`'s two `design-tokens` trials reading
the answer key off disk — is untouched.

## 41. Composite quality is the wrong metric for a diff task

**Context.** All twelve `860` trials scored quality `0.86 ±0.00`, with
byte-identical grader detail: the same four literal colours, the same unknown
tokens, the same `exports TagProvider` purity failure. The whole-component
graders are scoring the _shipped fixture_, which every arm correctly left alone;
the agent only touches an `aria-label`. The dimension has zero discriminating
power here and is close to meaningless as designed.

**Status: resolved by ADR 47.** The signal `860` actually carries is in blast
radius (the vitest assertions), turns and cost — where the arms do differ. The
chosen option was to scope the content graders to the files the agent actually
edited, rather than to drop composite quality for these evals.

## 47. Diff-style evals grade only the files the agent edited

**Context.** ADR 41 left open how to score a task that ships a working component
and asks for a small change. Verified against the recorded runs: in `860` every
arm edits exactly one file, adding one `aria-label` to `TagComponent.tsx`, and
leaves the stylesheet, token partial, schema and client file byte-identical.
Every grader that judged those four files was scoring the fixture's authoring.

**Decision.** Add `Target.diffTask`, true for `812` and `860`. A second
discovery view, `discoverGraded()`, hides any file whose content came back
byte-identical to the checked-in fixture; the seven content graders use it and
report `n/a`, which the existing mean already redistributes. `component-contract`
deliberately keeps the raw view — "are the right files present" stays a fair
question when the fixture supplied them, and it is what catches an agent that
renames or deletes something it was asked to leave alone.

**Consequence, and a second instance of the same bug.** Scoping alone first made
`860` _worse_ — 0.86 to 0.76 — because `client-behaviour` read "no client file in
the graded set" as three hard failures. The agent was being given 0.00 for
correctly not rewriting a working file: the same defect as the `860` digest and
the zero-call confound, for the third time. Fixed by returning `n/a` when the
fixture ships client behaviour and the agent left it alone. `860` now reads
`0.88 ±0.00` in all four arms, `810` is unchanged, and the selftest still agrees
with the design system.

**Residual, since fixed.** `860` kept a `purity 0.50` from the fixture's own
`TagComponent.tsx`, which never exported `TagProvider`. That was a real
deviation from house style in the fixture, not agent behaviour; ADR 49 corrects
it.

## 48. `@use "name-tokens.scss"` is the house form

**Context.** `860`'s stylesheet lost half of `style-placement` on the check
"stylesheet pulls in the token partial with `@use`", which it appears to satisfy
with `@use "tag-tokens";`. The grader requires the extension.

**Decision.** The grader is correct and the fixture is the outlier: the design
system writes `@use "button-tokens.scss";` in 47 components and the bare form in 3. Leave the regex alone.

**Consequence.** Worth recording because the first instinct was to call this a
grader bug, by analogy with the digest and confound defects. It was not. "The
grader punishes correct behaviour" is now a frequent enough failure mode that it
needs checking against the design system rather than assumed — which is what
`graders:selftest` exists for, and it passes.

## 49. A drift gate's fixture must be exemplary, not merely plausible

**Context.** With ADR 47 in place `860` read `0.88 ±0.00`. The missing 0.12 was
entirely the fixture's own authoring: `TagComponent.tsx` was a bare `forwardRef`
with no Context indirection and no `TagProvider`, and `tag.scss` used the rare
bare `@use` form (ADR 48). A gate that reads 0.88 when nothing is wrong has no
headroom to distinguish "unchanged" from "slightly worse".

**Decision.** Rewrite the fixture in the measured house form —
`TagContextDefault` → `TagContext` → `Tag` → `TagProvider`, copied from
`DividerComponent.tsx`, one of the 14 of 68 components that export a Provider —
and add the `.scss` extension to the `@use`.

**Constraints the change had to respect, all verified before spending.** The
assertion is `toContain('@use "tag-tokens"')`, so the extension is still a
match. `no unrequested files` pins the component directory to five entries, so
the props stay inline rather than moving to `TagProps.ts`. `no dependencies are
added` pins the manifest to react and react-dom, so the `classnames` the real
Divider uses is out. And the runtime probe resolves `moduleUnderTest[pascal]`,
so the `Tag` export had to keep its name.

**Verified in a scratch copy:** `npm install` and `tsc --noEmit` exit 0,
`sass.compile` with the harness's own load paths succeeds, the component renders
the same markup, `TagContext.Provider` genuinely swaps the implementation, and
axe still reports `button-name` — the task remains a real fix and did not become
self-solving.

**Cost.** Invalidates `860`'s twelve paid trials; ~$2.90 to re-buy. Accepted:
`860` is the drift gate every later phase leans on, and a gate that cannot read
1.00 on a correct run is not worth the runs already spent on it.

## 50. Verify a fixture by running its own `EVAL.ts`, not by reading it

**Context.** The ADR 49 change was checked by installing, typechecking,
compiling the stylesheet and rendering the component in a scratch copy — with
`EVAL.ts` deleted. All of that passed. The paid run then failed 4/4 arms on a
single assertion: `expect(styles).toContain('@use "tag-tokens"')`. The literal
carries a **closing quote**, so `@use "tag-tokens.scss";` does not contain it.
The assertion had been read and declared safe without being executed. Quality
read 1.00 in every arm; only pass@1 collapsed. Cost: $2.91.

**Decision.** The assertion now matches `'@use "tag-tokens'`, up to the token
name, which still catches a rewrite without pinning one `@use` spelling.

**Decision, more importantly.** A fixture change is verified by running the
generated `EVAL.ts` twice in a scratch copy: once against a hand-solved fixture,
which must pass every assertion, and once against the shipped fixture, which
must fail on exactly the assertions the task is about. `860` now does both —
12/12 solved, and 2 failures unsolved (`the reported violation is gone`, `the
remove control has an accessible name`). vitest needs a throwaway config, since
`EVAL.ts` does not match the default `include` and `--include` is not a CLI flag.

**Consequence.** Reading an assertion is not verifying it. Every prior fixture
failure in this campaign was found by spending money; this one was too, and it
did not need to be.

## 42. `860` is a regression gate, not a capability discriminator

**Context.** With the digest fixed, `860` passes 100% in all four arms,
`pass^k yes`, quality `0.86 ±0.00`, and every delta against baseline is zero:
cost `0.95`–`1.01×`, turns `1.00`–`1.09×`. PRD §10 calls a task that saturates
across all variants exhausted as a capability measure.

**Decision.** Keep `860` in the matrix, but read it as a drift gate rather than
a comparison. At ~$0.24/trial it is the cheapest eval by an order of magnitude,
and a _fall_ from 100% is exactly the response-drift signal the PRD asks for.

**It also carries one real result.** MCP availability does not induce
over-engineering on a small diff: all three MCP arms declined to call a server
and matched baseline cost. That negative finding is worth stating explicitly,
because "MCPs make agents gold-plate trivial work" is the obvious prior.

## 43. The component-builder MCP prescribes a runtime the fixtures do not ship

**Context.** `810` has never passed — 0/12 trials across two rounds and $61.54 —
and always on the same three assertions: the `{Name}.client.js` contract, purity,
and dismissal being client-side rather than React state.

`get-client-behavior-template` returns `import { Component, define } from
"@kickstartds/core/lib/component"` and `useKsComponent` from
`@kickstartds/core/lib/react`. No fixture depends on `@kickstartds/core` — not
`810`, `812`, `832`, `840` or `860`. The best trial in the matrix (`cc-both`,
quality 0.97) documented the problem in its own source:

> This design system normally drives interactivity through a separate
> client-behavior module wired up via `@kickstartds/core`; that package isn't
> part of this package's dependencies, so dismissal is handled with local state
> instead of the usual pure-render + vanilla-JS split.

The agent consulted the MCP, found the prescribed runtime absent, and abandoned
the pattern — losing purity and client-behaviour, the two dimensions the MCP
exists to improve.

The bar is not literally unreachable: `860`'s shipped `Tag.client.js` is plain
vanilla JS with document-level delegation and no `@kickstartds/core` at all, and
that shape satisfies every assertion. So the fixture demonstrates one convention
while the MCP teaches another, and `810` — being build-from-scratch — ships no
example to imitate.

**Decision.** Add `@kickstartds/core` to the fixtures before buying `832` and
`840`, so the eval measures whether an agent can follow the MCP's guidance
rather than whether the fixture happens to permit it. `810` is already stale
(D-49) and re-bought regardless, so it absorbs the change for free.

**Consequence, and a product finding.** This is also a genuine result about the
MCP: its client-behaviour template assumes a peer dependency without saying so,
and agents respond by discarding the pattern wholesale rather than adapting it.
Worth feeding back to `component-builder-mcp` independently of the eval — see
D-30, which found the same shape of defect in its Storybook template.

## 44. `@kickstartds/core` is vendored into the fixtures, not depended on

**Context.** Implementing ADR 43 needed `Component`, `define` and
`useKsComponent` resolvable inside a fixture. The real package pulls 12 runtime
dependencies — `esbuild`, `sass`, `del`, `fs-extra`, `fast-glob` among them —
and declares peers `@storybook/types@^7.0.5` and
`storybook-design-token@3.0.0-beta.3`. npm 7+ auto-installs peers, so every
trial would pay that download and could fail on the beta.

**Decision.** Vendor a minimal, dependency-free ESM equivalent at
`evals/<name>/vendor/kickstartds-core/`, wired in as
`"@kickstartds/core": "file:vendor/kickstartds-core"`. This copies the pattern
`840` already uses for `@kickstartds/ds`. It duplicates per fixture rather than
sharing, because fixture directories are uploaded to the sandbox whole.

The vendored surface matches what the MCP template actually imports:
`lib/component` exports `Component` (with `onDisconnect`), `define` and `uid`;
`lib/react` exports `useKsComponent` and `createProvider`. `define()` hydrates
matching elements immediately and observes the DOM for later ones, so the
behaviour is real rather than a stub — verified in jsdom.

**Consequence.** The fixture no longer resembles the published package byte for
byte. That is acceptable because every `client-behaviour` assertion is static —
the file exists, is non-empty, and calls `addEventListener`. The vendored module
exists so the agent's chosen pattern compiles and runs, not so the eval can
execute it.

## 45. The fixtures were blocking the pattern twice over

**Context.** With the vendored package in place the prescribed pattern still
failed to compile: `import { identifier } from "./js/Badge.client"` raises
TS7016 under a strict `tsconfig` with no `allowJs`. The real design system sets
`allowJs: true` (and `strict: false`) and does exactly this import in
`GalleryComponent.tsx`, `NavMainComponent.tsx` and others.

**Decision.** Add `allowJs: true` to `810`, `832` and `840`. Leave `strict: true`
alone — it is a stricter bar than the real package, but it does not block the
convention.

**Consequence.** Two independent fixture defects were suppressing the same
behaviour, and only the first was visible from the transcripts. The agents'
stated reason — the missing package — was true but incomplete; an agent that had
vendored the package itself would have hit the compile error next. This is the
clearest argument yet for D-51's rule: before reading a 0% pass rate as a
capability signal, reproduce the task's happy path by hand.

## 46. The MCP itself stays frozen for the rest of the campaign

**Context.** ADR 43 identifies a real defect in
`get-client-behavior-template`. Fixing it is a one-line documentation change in
`packages/component-builder-mcp/src/handlers.ts`.

**Decision.** Do not fix it during this campaign. The MCP servers are the system
under test; changing one mid-campaign makes chunks bought before and after
incomparable. Record the defect, buy the remaining chunks against the current
servers, fix afterwards.

**Consequence.** Fixture edits are subject to the same freeze in principle, but
the changes above touch only `810` (already stale, D-49) and `832`/`840` (never
bought). `812` and `860` are untouched, so `860`'s paid results survive —
confirmed by `agent-eval status`, which no longer lists it.

## 51. An assertion satisfied by a doc comment measures nothing

**Context.** ADR 50's method was applied to the three fixtures that had never
been run, before buying them. `840`'s reuse check read:

```ts
expect(source).not.toMatch(/<svg[\s>]/);
expect(source).toMatch(/\bIcon\b/);
```

A hand-solved, idiomatic implementation passed it. Grepping for why turned up a
single match — and it was not code:

```
23:  /** Icon identifier rendered before the action label. */
```

That JSDoc is copied verbatim from the schema's own `description` for
`actionIcon`, and copying field descriptions into JSDoc is exactly what the
component-builder MCP's templates prescribe.

**Consequence.** The check was not merely weak, it was _biased toward the arms
under test_: the MCP tells agents to copy descriptions, so MCP arms would have
earned a free pass on the one assertion `840` exists to make informative, while
baseline arms could fail it. That inflates the measured MCP benefit on the task
built to fix D-20 — a confound of the same family as the zero-call one, and
undetectable from the score.

**Decision.** Strip comments before any check that reads a component as source,
and accept either spelling of icon reuse — the `Icon` component directly, or the
`icon` slot of a design-system component that renders one. `Button` takes an
`icon` prop and is the more idiomatic composition of the two, so requiring a
literal `<Icon>` would have punished the better answer:

```ts
const source = withoutComments(read(FILES.component));
expect(source).not.toMatch(/<svg[\s>]/);
expect(source).toMatch(/<Icon[\s/>]|(?<![\w-])icon=[{"']/);
```

Verified in three states: idiomatic solution 15/15; hand-rolled natives fail
exactly 4; and the loophole case — JSDoc retained, no design-system icon — now
fails, where it previously passed.

**Generalisation.** Prose is not code, in either direction. A positive check on
raw source can be satisfied by a comment; a negative check on raw source can be
tripped by one. Both are wrong.

## 52. Assert against rendered output when the prop name proves nothing

**Context.** `832`'s initial-state check read `expect(source).toMatch(/defaultOpen/)`,
under a comment explaining that "`defaultOpen` has to reach the markup". It does
not test that. The prop name appears in the destructuring of any component that
merely _declares_ it, so an implementation that accepted `defaultOpen` and then
ignored it passed — which is precisely the flash-of-wrong-state defect the
assertion was written to catch.

**Decision.** Render instead. `renderProps` now sets `defaultOpen: true`, and the
assertion reads the harness's runtime report:

```ts
const report = await harness.writeRuntimeReport();
expect(report.rendered).toBe(true);
expect(String(report.html)).toMatch(/aria-expanded="true"/);
```

Verified: the house solution still passes 15/15, and patching it to hardcode
`aria-expanded={false}` now fails exactly this one test, where the old form
passed.

**Consequence.** Rendering the disclosure open also gives the a11y probe an
expanded panel to inspect rather than a `hidden` subtree that axe skips, so the
change buys a little coverage as well. The general rule: when a check is about
behaviour, a prop _name_ in source text is evidence of nothing — the harness
already renders the component, so use it.

## 53. Pre-verification is cheap; blind buying is not

**Context.** Three fixtures were about to be bought for roughly $180 against a
history of four fixture defects discovered only after paying for them: `810`'s
two stacked blockers ($61 for a 0% arm that was measuring the fixture),
`860`'s digest drift, and `860`'s `@use` assertion ($2.91 for a run in which
every arm scored 1.00 and every arm failed).

**Decision.** Every fixture is hand-solved and run locally before it is bought,
in four states where applicable: unsolved, solved, and — for tasks that name an
anti-pattern — an implementation exhibiting that anti-pattern, plus any loophole
case suggested by the assertion's shape.

**Result.** `812` clean (10/10 solved; 4 targeted failures unsolved). `832` one
defect (ADR 52). `840` one defect (ADR 51), plus confirmation it does discriminate
the native-HTML anti-pattern it was built for. Cost: zero. Both defects were of
the kind that produce a _plausible_ number rather than an obviously broken one,
so neither would have been caught by reading the results.

**Consequence.** This is now a gate, not an option. Fixture edits are free until
the moment a fixture is bought and frozen; after that they are unaffordable. The
window to get a fixture right is before it has ever been run.

## ADR 54 — A grader that reads a file the task forbids touching will punish the correct answer

`bem` scored exactly 0.75 in all twelve trials of `812`, in every arm, with the
same sub-check failing: `component renders the dsa-alert class`.

`812` is a diff task. Its `EVAL.ts` asserts `AlertComponent.tsx` comes back
untouched, so `discoverGraded()` correctly withholds it, so `bem` read
`""` and `"".includes("dsa-alert")` failed. Every agent was penalised 0.25 for
obeying the task.

This is the third instance of the same family: D-48 (`client-behaviour` scoring
0.00 on `860`), the `860` `@use` assertion, and now `bem`. The shape is always
the same — a check written for a from-scratch task, reused on a diff task,
where _absence_ means _correctness_ rather than _failure_.

`bem` is a styles grader with one component-side check, which is why it escaped
the earlier sweep: the grader itself is applicable, only one of its four checks
is not. The fix drops that single check rather than nulling the grader:

```ts
const componentWithheld = !found.component && !!discover(trial).component;
```

**Rule:** on a diff task, every check must be asked whether an untouched file is
evidence of failure or evidence of compliance. A grader being applicable does
not make all of its checks applicable.

Re-grading is host-side and retroactive (D-50), so this cost nothing. Corrected
`812` quality: `cc-none` 0.90 → 0.93, `design-tokens` 0.95 → 0.99,
`component-builder` 0.95 → 0.99, `cc-both` 0.96 → 1.00. The shift is uniform,
so every delta is unchanged — the defect was depressing absolute scores, not
biasing the comparison.

## ADR 55 — The staging isolation is undone by the file that registers the server

Two of four arms on `812` came back `RUN INVALID` (>20% non-model failures)
because agents read the staged design-tokens server's own data files:

```
/tmp/.agent-eval-mcp/design-tokens/tokens/componentToken/button-tokens.scss
/tmp/.agent-eval-mcp/design-tokens/tokens/font-token.scss
```

`lib/mcp/variants.ts` moved the servers to `/tmp` to "remove the stumble" and
relies on the leak detector for the guarantee. The stumble was not removed:
`.mcp.json` sits in the agent's working directory and contains the absolute
path.

```json
{
  "mcpServers": {
    "design-tokens": {
      "command": "node",
      "args": ["/tmp/.agent-eval-mcp/design-tokens/dist/index.js"]
    }
  }
}
```

One `ls ..` from there reaches `tokens/`. For a stdio server this is not
fixable by hiding the path — the agent's user must be able to execute the
server, so it must be able to read it. Filesystem permissions cannot separate
them because the server runs as the same user. The only structural fix is to
stop shipping the files into the sandbox at all: run both servers on the host
in HTTP mode (both already support `MCP_TRANSPORT=http`) and register a URL
instead of a path.

**There is no free version of this fix.** `DENY_WEB_RESEARCH`, `SETUP_VERSION`,
the staged-package hash and the probe source all feed `guardVariantVersion()`,
which throws unless `--force`, and `--force` discards prior results. Any change
that closes the leak invalidates every result bought so far. Bypassing the
guard by not bumping `SETUP_VERSION` is exactly the silent staleness the guard
exists to prevent, and is not an option.

**Consequence:** the leak cannot be fixed mid-campaign. It is a between-campaign
change, and the current campaign runs to completion with detection-and-exclusion
as the control.

## ADR 56 — Leak exclusion is bookkeeping; check whether the leak changed the answer

`812`'s two invalid arms are less alarming than the label suggests. Vitest
outcomes were identical across leaked and clean trials:

| arm                    | run-1                          | run-2                         | run-3                         |
| ---------------------- | ------------------------------ | ----------------------------- | ----------------------------- |
| `cc-design-tokens`     | 1 failed \| 9 passed (counted) | 1 failed \| 9 passed (leaked) | 1 failed \| 9 passed (leaked) |
| `cc-component-builder` | 10 passed (counted)            | 10 passed (counted)           | 10 passed (leaked)            |

Grader profiles were identical too — σ = 0.00 in both arms. Re-buying to raise
n from 1 to 3 on a zero-variance measurement buys almost nothing, so `812` is
**not** re-bought.

The leak also carries a finding of its own. The leaked reads were of
`button-tokens.scss` and `divider-tokens.scss` — component token partials.
Handed the design system's own examples of the convention, the design-tokens
arm _still_ did not produce `_alert-tokens.scss`, and still failed. The
convention has to be told, not discovered.

**Rule:** `RUN INVALID` says the sample is not clean, not that the conclusion is
wrong. Compare excluded against counted trials before spending on a re-buy.

## ADR 57 — `812` discriminates on structure, not on token values

`812` was authored to strip authoring work away and leave "only the question the
tokens MCP exists to answer: which token replaces this literal". It does not.

Across all twelve trials exactly one assertion decides pass/fail:
`per-component styling hooks are exposed as a token partial` — does
`_alert-tokens.scss` exist. Both component-builder arms create it and pass;
`design-tokens` and `none` do not and fail. That is a file-layout convention,
which is component-builder's territory.

On the question `812` meant to ask, design-tokens does deliver:
`token-conformance` +0.33 (design-tokens), +0.33 (both), +0.26
(component-builder) — a materially better showing than `810`'s. The baseline
left all sixteen fixture hexes in place as `var(--invented-name, #hex)`
fallbacks and invented token names wholesale.

So `812` reports two things at once and its pass@1 headline reports the wrong
one. `pass@1 +100%` for component-builder is real but is not evidence about
token lookup; the `token-conformance` delta is the design-tokens result, and it
is positive.

**Rule:** a task isolates what its _failing_ assertion tests, not what its
prompt is about. Before authoring, ask which single assertion will flip, and
confirm it belongs to the capability under test.

## ADR 58 — `token-conformance` and `812`'s own assertions disagree about `var()` fallbacks

`812`'s `EVAL.ts` deliberately permits `var(--token, #hex)` fallbacks via
`withoutVarFallbacks()`, because that is house style. The `token-conformance`
grader counts the same fallbacks as literal colour values — `cc-none` was
reported as "16 literal(s)" for a stylesheet that passed the eval's own colour
assertion.

Same file, opposite verdicts. This is not currently biasing anything, because
the arm that leans on fallbacks fails `812` for an unrelated reason, but the
two must be reconciled before either number is quoted. Deferred, not dismissed:
graders are retroactive, so it can be settled at zero cost.

## ADR 59 — `840` isolates the two servers cleanly; `cc-both` is never better than `component-builder` alone

`840` is the first task where every grader reports and where the two servers'
contributions separate without interpretation:

| arm                    | failing assertions (of 15)                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `cc-none`              | 9 — naming, DS composition, button, heading, icon, purity, ref, client-side dismiss, literal colours |
| `cc-design-tokens`     | 8 — _the same list minus literal colours_                                                            |
| `cc-component-builder` | 0, 0, 1                                                                                              |
| `cc-both`              | 1, 1, 1 (three different assertions)                                                                 |

The design-tokens arm's failure set is `cc-none`'s with exactly one assertion
removed. It fixes token correctness and nothing else — the same finding `810`
and `812` reported, here visible without arithmetic.

**`cc-both`'s 0% pass@1 is sampling noise, not a regression.** Three runs at
14/15, each tripping a different assertion, against `component-builder`'s 2/3:
~1.4σ on an all-or-nothing gate at n=3, with quality 0.97 vs 0.98. It must not
be quoted as evidence that adding the tokens server degrades output.

What is not noise is the cost. Across all four tasks `cc-both` never exceeds
`cc-component-builder` on pass@1, and pays for the privilege:

| eval  | cb $/trial | both $/trial | cb quality/extra-$ | both quality/extra-$ |
| ----- | ---------- | ------------ | ------------------ | -------------------- |
| `810` | $5.26      | $9.67        | **0.105**          | 0.045                |
| `812` | $1.43      | $6.76        | **0.110**          | 0.011                |
| `840` | $4.58      | $8.36        | **0.164**          | 0.045                |
| `860` | $0.24      | $0.26        | 0.000 (saturated)  | 0.000 (saturated)    |

`component-builder` alone is the best value in every non-saturated task, by
2–10×. The plausible mechanism is attention budget: on `840` `cc-both` made
19.3 MCP calls over 109 turns against `component-builder`'s 8.3 over 95, and
its three misses are all lapses in structural rules it demonstrably knows.

**Rule for reporting:** pass@1 at n=3 cannot separate arms that differ by one
assertion. Quote quality and per-grader deltas for arm comparison; quote pass@1
only where the gap is a whole failure mode (as with `cc-none`).

## ADR 60 — The staging leak is task-correlated, as predicted

`840` produced **zero leaks and zero exclusions** across all twelve trials, with
only three benign enumerations. `812` produced three leaks and invalidated two
arms.

This confirms ADR 55/57: agents raid `/tmp/.agent-eval-mcp` when the task is
_itself_ a lookup problem and the staging directory visibly contains the
answers. Authoring tasks do not trigger it.

The consequence is that expected attrition is not a flat rate to be
over-provisioned against — it is a property of the task. Token-lookup tasks
need the host-side HTTP transport (ADR 55) before they can be trusted at n=3;
authoring tasks are fine as they stand.

## ADR 61 — Do not grade what the fixture handed the agent

`schema-validity` returned 0.75 in all twelve `832` trials, in every arm, always
on `no vague property names — vague: content`.

`content` is declared by the fixture's own `disclosure.schema.json`, which ships
with `"required": ["summary", "content"]` and `additionalProperties: false`. No
agent could rename it without failing the eval. The module's own docstring says
the schema "is supplied and must not be edited" — the `specific-names` check
contradicted its own premise and scored the fixture author.

Fixed by grading only property names the agent introduced, via a new
`readShipped()` helper in `trial.ts` that exposes the fixture's copy of any
file:

```ts
const supplied = fixtureProperties(trial, found.schema);
const vague = properties.filter(
  (name) => VAGUE_PROPERTY_NAMES.has(name) && !supplied.has(name),
);
```

Corrected `832` quality: `none` 0.61 → 0.63, `design-tokens` 0.71 → 0.73,
`both` 0.95 → 0.97, `component-builder` 0.98 → **1.00**. Uniform, so deltas are
unchanged.

**This is the fourth instance of one bug.** D-48 (`client-behaviour` on a
diff task), the `860` `@use` literal, ADR 54 (`bem`'s component check), and now
this. The general form: _a check scores content the agent did not author_ —
either because the task forbids touching it, or because the fixture supplied it.

**Standing rule for every new grader check:** name the artefact being scored and
answer "did the agent write this, and was it free to write it differently?" If
either answer is no, the check measures the fixture.

## ADR 62 — Capability campaign complete: what the five tasks say

20/20 cells. Quality by arm (corrected):

| eval                      | none | design-tokens | component-builder | both |
| ------------------------- | ---- | ------------- | ----------------- | ---- |
| `810` atom from schema    | 0.64 | 0.69          | 0.93              | 0.96 |
| `812` restyle with tokens | 0.93 | 0.99†         | 0.99†             | 1.00 |
| `832` client behaviour    | 0.63 | 0.73          | **1.00**          | 0.97 |
| `840` reuse over native   | 0.73 | 0.82          | 0.98              | 0.97 |
| `860` restraint (control) | 1.00 | 1.00          | 1.00              | 1.00 |

† arm invalid on `812` (staging leak, ADR 55/56).

Efficiency — quality per extra dollar over baseline:

| eval  | design-tokens | component-builder | both  |
| ----- | ------------- | ----------------- | ----- |
| `810` | 0.009         | 0.105             | 0.045 |
| `812` | 0.010         | 0.110             | 0.011 |
| `832` | 0.035         | **0.216**         | 0.092 |
| `840` | 0.025         | 0.164             | 0.045 |

Four findings, each holding across every task that can report on it:

1. **`component-builder` is the value leader in all four non-saturated tasks**,
   by 2–12×, and carries the lowest cost multiplier of any MCP arm
   (1.52–2.11× baseline).
2. **`design-tokens` never flips a task.** pass@1 delta is +0.0% on `810`,
   `812`, `832` and `840` — four for four. Its contribution is real but
   confined to one axis: `token-conformance` +0.43 / +0.33 / +0.46 / +0.46.
   It is a correctness tool, not a completion tool.
3. **`both` never beats `component-builder` alone** on pass@1 or on value, in
   any task, while costing 1.5–7.2× baseline against `component-builder`'s
   1.5–2.1×. The tokens server adds cost and attention load on top of an arm
   that has already solved the task.
4. **`860` stayed saturated in all four arms** across the entire campaign —
   every delta 0.00. The restraint control never drifted, which is what makes
   the other four numbers trustworthy.

`832` is the strongest single cell: `component-builder` at 1.00 ±0.00 quality
and 100% pass@1 for 1.67× baseline cost.

**Reporting caveats that must travel with these numbers:** `812`'s two invalid
arms (ADR 56), `812` discriminating on structure rather than values (ADR 57),
`cc-both`'s `840` 0% being noise (ADR 59), and the unresolved
`token-conformance` / `withoutVarFallbacks()` disagreement (ADR 58).

## ADR 63 — When a grader and an eval disagree, ask the design system

`812`'s `EVAL.ts` strips `var(--token, #hex)` fallbacks before looking for
literal colours, on the assumption that they are house style.
`token-conformance` counts them as literals. Same file, opposite verdicts
(ADR 58).

Settled by measuring the design system itself across all 68 components:

| pattern                      | occurrences |
| ---------------------------- | ----------- |
| `var(--x, <literal colour>)` | **0**       |
| `var(--x, var(--y))`         | 149         |

The house style is token→token fallback — precisely the branding → semantic →
component layering the architecture describes. A literal fallback appears
nowhere. `token-conformance` is calibrated correctly (selftest mean 0.95 over 61
components); `812`'s eval is more permissive than the system it grades, and
`cc-none` cleared its colour assertion by writing exactly the pattern the DS
never uses.

**No grader change.** The fix belongs in `812`'s assertion, and cannot be made
mid-campaign: touching `EVAL.ts` moves the fingerprint and discards the bought
results. Deferred to the next campaign.

The generalisation: when a grader and an eval contradict each other, neither is
authoritative. **The reference implementation is.** Measure it before editing
either — the disagreement itself is evidence that one of them was written from
memory rather than from the code (ADR 51's lesson, arriving from a new
direction).

## ADR 64 — Fixtures must not typecheck-fail code the toolchain told the agent to write

The component builder's `get-storybook-template` hands out

```ts
import { Meta, StoryObj } from "@storybook/react-vite";
```

and the design system documents 68 of 68 components with a story file
(`@storybook/react-vite` ×56, `@storybook/react` ×2). Writing a story is the
house convention, and an MCP arm is explicitly told so.

No fixture had Storybook installed. So an agent that followed the convention it
was handed took a `tsc` failure for it:

| eval / arm                             | run   | outcome | quality | toolchain |
| -------------------------------------- | ----- | ------- | ------- | --------- |
| `810` / `cc-component-builder`          | run-1 | pass    | 0.84    | 1.0       |
| `810` / `cc-component-builder`          | run-2 | fail    | 0.69    | 1.0       |
| `810` / `cc-component-builder`          | run-3 | fail    | 0.58    | **0.5**   |

`run-3`'s `toolchain-report.json` carried exactly one error:

```
src/components/badge/Badge.stories.tsx(1,32): error TS2307:
Cannot find module '@storybook/react-vite' or its corresponding type declarations.
```

That was the only toolchain failure in the arm, and its whole cause. One trial
in sixty — small, but the direction of the bias is the problem: it docks the
arm that was given the template, for using it. **The fixture was penalising its
own omission** — the eighth instance of the ADR 54 / ADR 61 family.

**Decision:** ship a permissive ambient `types/storybook.d.ts` in all five
fixtures, declaring `Meta` and `StoryObj` for both specifiers, with
`"include": ["src", "types"]`.

Rejected alternatives:

- _Install Storybook into the sandbox._ Far too heavy for a per-trial `npm
  install`, to satisfy a type-only import.
- _Exclude `*.stories.tsx` from typecheck._ Hides real errors, and forecloses
  the planned stories grader (checklist 1.9).

The shim is deliberately inert: it asserts nothing about story quality, no task
prompt mentions stories, and **writing no story at all remains equally fine.**
It removes a penalty; it does not create an incentive.

Verified by reproducing `run-3` from its retained project: `npx tsc --noEmit`
exits 1 with the TS2307 above before the shim, and exits 0 after it, with no
other diagnostic appearing.

## ADR 65 — `812`'s colour assertion, corrected (closes ADR 63)

ADR 63 established the fix and deferred it. The campaign is over and the next
one rebuilds everything, so the fingerprint cost is now zero and it is applied.

`withoutVarFallbacks()` collapsed **every** `var()` before looking for literals,
so `var(--ks-color-positive, #059669)` scored clean. It is replaced by
`withoutTokenFallbacks()`, which collapses a `var()` only when its fallback is
itself a token — leaving a literal in a fallback slot to be caught.

Behaviour, unit-checked in all four states of ADR 68:

| input                                | verdict |
| ------------------------------------ | ------- |
| `var(--dsa-x, var(--ks-y))`          | clean   |
| `var(--a, var(--b, var(--c)))`       | clean   |
| `var(--ks-x)`                        | clean   |
| `var(--ks-color-positive, #059669)`  | caught  |
| `var(--ks-bg, rgba(0,0,0,.5))`       | caught  |
| `color: #fff`                        | caught  |

Then checked against all twelve real `812` stylesheets from the campaign:

| arm                    | old assertion | new assertion |
| ---------------------- | ------------- | ------------- |
| `cc-none` (3 runs)     | pass          | **fail**      |
| `cc-design-tokens`     | pass          | pass          |
| `cc-component-builder` | pass          | pass          |
| `cc-both`              | pass          | pass          |

Perfect discrimination: it fails exactly the arm that used the loophole and
nothing else. This is the check that mattered — a stricter assertion that also
failed the MCP arms would have been a broken task, not a fixed one (ADR 53).

Finally the regenerated `EVAL.ts` was run for real: 10/10 pass against
`cc-both`'s run-1 project; swapping in `cc-none`'s stylesheet fails 2 of 10 —
the colour assertion **and** the length assertion, since that trial hardcoded
`gap: var(--dsa-space-1, 4px)` and three font sizes the same way. The same
loophole was being used for lengths, and the same one-line premise was hiding
both.

The lesson is ADR 51's, once more: the discarded comment asserted that "the
design system's own token partials carry fallbacks exactly like that." No one
counted. It was false, and it cost a whole campaign's worth of one arm's colour
scoring.

## ADR 66 — a task that survives the token layer being visible

Shipping the `--ks-*` layer into the fixtures (D-92, option (c)) makes every
valid token name greppable from inside the sandbox. That is the honest thing to
do — the real repository has the layer — but it also removes the one thing the
Design Tokens MCP was measurably supplying. `known-tokens` is the check that
moved in every task of the first campaign (+0.43 / +0.33 / +0.46 / +0.46), and
it rewards knowing names. Names are now free.

`820-token-intent` is the other half of that decision: a task whose value is
not name recall.

### What it measures

The design system encodes *rules* that its token names do not reveal. Three of
them, all served by the tokens MCP via `get_design_rules`:

| rule                  | the defect in the fixture                             |
| --------------------- | ----------------------------------------------------- |
| `color-semantic-layer` | `--ks-color-primary` on component text                |
| `typography-pairing`  | `--ks-font-size-display-l` + `--ks-line-height-copy-l` |
| `font-family-roles`   | `--ks-font-family-display` on an interface-sized label |

Every token in that table exists, is spelled correctly, and resolves. Nothing
in the fixture is hardcoded and there is not a single literal to replace, so
this is not 812 in a different costume: 812 asks *is this a token*, 820 asks
*is this the right token*. Both questions have the same 1,522 candidate names
in front of them; only the second one is still hard once you can `grep`.

`--ks-color-primary` reads like exactly the token a component should use. It
is a primitive, meant for building the semantic layer and not for direct use.
`--ks-line-height-copy-l` pairs with a display-sized figure to give it a 1.5
line-height where it wants 1.15. An agent that can ask the server is told this.
An agent that cannot has to already know the system.

### The prompt names no rules

It describes symptoms a designer would report — "the vertical rhythm is visibly
off", "they don't follow when the theme changes" — and never says *category*,
*primitive* or *semantic layer*. Naming the rules would hand the baseline arm
the answer and measure nothing, the same failure mode as an answer key in the
fixture (ADR 17).

### Five states, not four

ADR 53 requires the fixture be hand-solved and run locally before it is bought.
This one was run in five, because the interesting failure is a new one:

| state          | stylesheet                                    | result           |
| -------------- | --------------------------------------------- | ---------------- |
| unsolved       | as shipped                                    | 2 failed / 7 ok  |
| solved         | correct categories, semantic colours          | **9 passed**     |
| loophole       | awkward declarations deleted                  | 1 failed / 8 ok  |
| anti-pattern   | tokens replaced with literals                 | 3 failed / 6 ok  |
| **wrong intent** | right layer, right pairs, `--ks-text-color-copy` on the display figure | 1 failed / 8 ok |

The unsolved run names all four mixes with their selectors and all three
primitives, which is the evidence that the block parser works rather than the
assumption that it does (lesson (d)).

The fifth state is why `categoryOf()` covers `--ks-text-color-<category>` and
not just size, line-height and family. A first draft checked only the latter
three, and "right names, right pairing, wrong category of colour" passed it —
a defect that fails silently *upward* (D-67), invisible in any results read.
The tokens MCP's own rule includes `textColorPattern`; the assertion now does
too.

### Not by deletion

Every intent assertion above passes on an empty file, so a positive requirement
carries the anti-vacuous load: at least three font-size, three line-height and
three colour tokens must survive, and the two trend modifiers must keep
distinct, tokenised colours. Without it, deleting the awkward declarations is a
perfect score — the loophole state of D-68, and the reason that state is run.

### Scoring shape

`TARGETS["820-token-intent"]` is `diffTask: true`, `requiresClientBehaviour:
false`, `mcpUseExpected: true` — structurally 812's sibling. The component and
schema ship correct and are digest-pinned; the stylesheet is the only thing the
agent may touch.

`defineExperiment()` defaults `evals` to `"*"`, so this joins all four arms
automatically. Every fixture change this session moves fingerprints, so the
second campaign requires `--force` regardless.

---

## ADR 67 — Screenshots are the review artifact; the Storybook is the appeal

Phase 2 could already answer "what did `cc-none` score on `810`". It could not
answer "what did that *look like*", and the second question is the one a
designer asks first. Sixty trials is also too many to open by hand, so the
built Storybooks were, in practice, unopened.

So `report build` now also writes `run-N/screenshots/component.png`, and
`pnpm report:index` lays those out as a grid: one row per arm, one thumbnail per
trial, green border for a pass, red for a fail, each linking to the full
Storybook for that trial. The picture is the summary; the Storybook is where you
go when the picture raises a question.

### Why a real browser and a real server

Two things ruled out cheaper options. Storybook's iframe fetches its own JSON
index, so `file://` fails on same-origin — hence `lib/report/serve.ts`, a
root-confined static server on port 0. And the produced components are React
with client behaviour; only an actual browser tells you whether they render.
`playwright-core` was added as a devDependency; the browsers were already in
`~/.cache/ms-playwright`.

Screenshots are captured inside a `try/catch` so that a screenshot failure never
costs the built report, and `--no-screenshots` skips them entirely.

### Two defects, both found by looking at the output

`page.evaluate` given a *string* evaluates it rather than calling it. The first
`COMPONENT_BOX` was a bare arrow function, so it returned unserialisable and
every screenshot silently fell back to a viewport shot annotated *"the component
rendered nothing with a layout box"* — a note indistinguishable from a genuine
empty render. It is now an IIFE, and the docstring says why, because this is
D-67's shape again: a defect that fails silently *upward*.

Then `#storybook-root` turned out to be the wrong anchor. Its first child is
`.rp-stage`, a full-width block, so a badge came out as a 1200×250 picture of
mostly nothing. The measurement now starts at `.rp-stage` and takes the union of
its children's boxes, since a component may render several roots.

Neither was visible in the code. Both were obvious in the PNG — lesson (d),
twice in one afternoon.

### The index lives in `results/`

`results/index.html`, not `results/../index.html` or a separate `site/`
directory. Every link it emits is then a working relative path — into a trial's
`storybook-static/index.html`, into its `screenshots/component.png` — which
means the same tree works from `file://`, from `pnpm serve:results`, and from
the deployed container with no URL rewriting anywhere. The deployment (ADR 69)
is a single `COPY` because of this.

---

## ADR 68 — A pruner that can delete a result you are currently reporting is not a pruner

D10 asked for "keep the last 10 per experiment, plus pinned baselines". Written
literally — sort the timestamps, drop all but the newest ten — that is wrong
here, and quietly so.

Timestamps in this harness differ **per arm and per run-batch**. `resolveMatrix()`
may legitimately resolve `810` to a batch from three weeks ago because that task
has not been re-run since, while five newer batches exist for other tasks. The
newest ten directories are therefore *not* the set the reports currently point
at, and a literal implementation eventually deletes a paid-for trial that the
index is linking to.

`bin/prune-results.ts` has three safety properties, in increasing order of how
much they matter:

1. **Dry-run by default.** `--apply` is required to delete anything. The default
   invocation prints what would go, with sizes.
2. **Explicit pins.** `results/<experiment>/.pinned`, one timestamp per line,
   `#` for comments. This is the D10 baseline-pinning mechanism.
3. **Implicit pins.** Every timestamp `resolveMatrix(experiment)` currently
   resolves is protected, whether or not anyone remembered to pin it.

```ts
const eligible = runs.filter((run) => !pinned.has(run) && !current.has(run));
const doomed = eligible.slice(0, Math.max(0, eligible.length - keep));
```

Verified at `--keep 3` against `cc-component-builder` (11 runs, 5 current): it
proposed removing three. A naive implementation would have proposed eight,
including runs the index links to.

### The same asymmetry, in `results:download`

`bin/download-results.ts` merges CI artifacts into the local tree and **never
overwrites** an existing `<experiment>/<timestamp>`. CI owns the trial; this
machine owns everything derived from it — the built Storybooks, the screenshots,
the index. Overwriting would silently discard locally-built reports to replace
them with bytes that are, by construction, identical apart from what is missing.

Both branches were run: 14 present → `0 added, 14 already present`; one run
renamed to a future timestamp → `added`, `13 already present`.

Run directories are located **structurally** rather than by path convention —
any `summary.json` sits at `<experiment>/<timestamp>/<eval>/summary.json`, so
the run directory is two levels up. Artifact layouts change; that invariant is
the harness's own.

---

## ADR 69 — Publishing a tree of agent-authored HTML

Exit criterion G4 is "a historical run is fully inspectable from a static URL".
The tree that satisfies it is unusual in two ways, and both show up in the
deployment.

**It cannot be built.** Every other image in this repo compiles from source.
This one is the output of paid model runs; no compiler reproduces it, and CI
does not have it either unless `results:download` has put it there. So the
Dockerfile copies `packages/agent-eval/results/` in as a late, cache-busted
layer, and the deploy sequence is explicitly *populate, then ship*:

```
pnpm --filter agent-eval report build --all
pnpm --filter agent-eval report:index
kamal deploy -d agent-eval-results
```

(`results/.gitkeep` is tracked precisely so the `COPY` has something to copy on
a fresh clone; an unpopulated deploy is an empty site, not a build failure.)

**It is untrusted by construction.** The reports exist to run code a model
wrote, unreviewed, sixty times over. That is the feature — a component that does
not render is a *result*. But it means the site serves scripts nobody has read,
so `server/index.ts` sets a CSP with `connect-src 'none'` and
`form-action 'none'`. Storybook's own bundle needs `'unsafe-inline'` and
`'unsafe-eval'`, so the script directives cannot be tightened; the network
directives are what actually contain the untrusted code. Reviewing a result is
never an act of trust in the thing being reviewed.

### Why Express rather than nginx

`deploy-design-system.yml` serves static Storybook from nginx, which would have
been the obvious model. But D7 requires the shared JWT gate, and the gate is
`@kickstartds/shared-auth` — a Node library. Rather than an nginx `auth_request`
sidecar, this follows the pattern the Design Tokens Editor already established:
Express, a token-paste form, an `httpOnly` cookie, `verifyToken()` on every
request. One secret (`MCP_JWT_SECRET`), one issuing script, five services.

Auth degrades gracefully in the usual way: with no secret set the site is open,
so local use needs no setup. `/health` is deliberately outside the gate, since
the orchestrator has no token.

Verified against a live server: `/health` 200 unauthenticated, `/` 401 without a
cookie, 200 with a JWT issued by `scripts/issue-token.mjs`, 401 with a malformed
one, nested `storybook-static/index.html` and `screenshots/component.png` both
200, and `/../package.json` 404.

### Two things the image build taught, both only by running it

**The container has no devDependencies.** `agent-eval`'s dev tree is Storybook,
Vite and a Playwright browser driver — the machinery for *producing* reports,
none of which serving them requires. Installing `--prod` cuts the image to
400 MB (of which 113 MB is the current results tree). Node 24 strips types
natively, so the server runs from `server/index.ts` with plain `node` and the
runtime needs no TypeScript either: no build step, and therefore no build output
that can drift from its source.

**`--prod --filter agent-eval` is not enough.** It links `@kickstartds/shared-auth`
as a workspace package without installing *its* dependencies, so the container
built cleanly, started, and died on `Cannot find package 'jsonwebtoken'`. Worth
naming precisely because of what the failure mode is: the gate was not open, it
was absent — an auth library that cannot load is a service that cannot start,
which is the safe direction, but only by luck. Both packages are now named in
the filter.

Neither was visible in review. The image built, the config parsed, the
Dockerfile read correctly. Running it is what found them — lesson (d), a third
time.

**Verified against the built image:** `/health` 200 unauthenticated, `/` 401
without a cookie and 200 with a JWT, a trial's `storybook-static/index.html` and
`screenshots/component.png` both 200.

**One more, from the config rather than the image:** `MCP_REVOKED_TOKENS` was
originally listed under `env.secret`. Kamal requires every named secret to exist
in `.kamal/secrets`, and no other service declares that one — so naming an
opt-in feature would have failed the deploy outright. It is dropped, with a
comment saying why, rather than added to `.kamal/secrets` as an empty string
nobody would later recognise.

---

## ADR 70 — The first full `report build --all` found two host defects, not agent ones

Building all sixty reports for the first time crashed on trial four with
`Rollup failed to resolve import "@kickstartds/ds"`, which reads exactly like an
agent inventing a package. It was the opposite. `@kickstartds/ds` is the
vendored design-system slice that `840-reuse-over-native` exists entirely to
make agents reuse; the trial had solved the task. Its screenshot, once it built,
is a correctly styled banner with a working dismiss control.

### The alias was written for the package that broke first

`trial-plugin.ts` aliased exactly one vendored package, `@kickstartds/core`,
hardcoded by name — because a trial has no `node_modules` (only `project/` was
ever captured) and that was the import that failed first, back when the plugin
was written. `840` declares two `file:` dependencies. The second was never
wired, so *every* trial that solved that task correctly was unbuildable, and the
error blamed the agent for it.

The fix reads the trial's own `package.json` and aliases every `file:` or
`link:` dependency to its on-disk directory. Naming packages was the defect;
naming the *mechanism* is the fix, and it covers whatever a future fixture
vendors without anyone remembering to come back here.

This is the reporting equivalent of ADR 64: an artifact that makes correct
agent work look broken is worse than one that fails outright, because the
failure is legible and the misattribution is not.

### A batch must survive its worst member

The crash also cost the fifty-six trials that had not been reached, and the
three already built had to be rebuilt from the start of the batch. `build --all`
now collects failures, names them at the end, and exits non-zero — the same rule
already applied to screenshots, and for the same reason: the artifact is the
point, and one trial's problem is a finding about that trial. The index already
renders an unbuilt trial as a "not built" placeholder, so a failure degrades to
a visible gap rather than a missing run.

Both defects needed sixty real builds to surface; three hand-picked trials had
not touched either path.

---

## ADR 71 — `connect-src 'none'` was verified with a client that does not enforce CSP

The deployed reports loaded a Storybook shell and then failed:
`NetworkError when attempting to fetch resource`, from Storybook's manager
fetching `index.json` to discover its stories. The header blocking it was ours.

ADR 69 argued the reports should be allowed to run agent-written code and reach
nothing, and `connect-src 'none'` is the literal reading of that. It is also
wrong twice over. Storybook is a client-rendered application that fetches its
own index at runtime, so `'none'` does not restrict a hostile trial, it disables
the viewer. And `form-action 'none'` blocked the login form from posting to
`/login` — the gate could never have been passed in a browser.

Both were "verified" with curl, which does not enforce CSP. The check confirmed
the header was present and said nothing about whether the page worked, which is
lesson (d) — reading an assertion is not verifying it — in the one form that
survives a careful review: the test ran, passed, and tested the wrong thing.

`'self'` preserves the property that actually matters. The threat is
agent-written code calling out to somewhere we do not control; a same-origin
request reaches a static file server whose only POST route exchanges a token the
caller already holds. Re-verified in a browser: index loads, all seven stories
resolve, the trial's component renders with its tokens.

Anything user-facing behind a header, a cookie or a policy is now verified
through a browser. Two of the three defects in this results server were invisible
to the tool it was tested with.
