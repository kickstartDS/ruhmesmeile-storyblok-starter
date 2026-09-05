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
which throws unless `--force`, and `--force` stops prior results being reused.
Any change that closes the leak invalidates every result bought so far.
Bypassing the guard by not bumping `SETUP_VERSION` is exactly the silent
staleness the guard exists to prevent, and is not an option.

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

| eval / arm                     | run   | outcome | quality | toolchain |
| ------------------------------ | ----- | ------- | ------- | --------- |
| `810` / `cc-component-builder` | run-1 | pass    | 0.84    | 1.0       |
| `810` / `cc-component-builder` | run-2 | fail    | 0.69    | 1.0       |
| `810` / `cc-component-builder` | run-3 | fail    | 0.58    | **0.5**   |

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

| input                               | verdict |
| ----------------------------------- | ------- |
| `var(--dsa-x, var(--ks-y))`         | clean   |
| `var(--a, var(--b, var(--c)))`      | clean   |
| `var(--ks-x)`                       | clean   |
| `var(--ks-color-positive, #059669)` | caught  |
| `var(--ks-bg, rgba(0,0,0,.5))`      | caught  |
| `color: #fff`                       | caught  |

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

`811-token-intent` is the other half of that decision: a task whose value is
not name recall.

### What it measures

The design system encodes _rules_ that its token names do not reveal. Three of
them, all served by the tokens MCP via `get_design_rules`:

| rule                   | the defect in the fixture                              |
| ---------------------- | ------------------------------------------------------ |
| `color-semantic-layer` | `--ks-color-primary` on component text                 |
| `typography-pairing`   | `--ks-font-size-display-l` + `--ks-line-height-copy-l` |
| `font-family-roles`    | `--ks-font-family-display` on an interface-sized label |

Every token in that table exists, is spelled correctly, and resolves. Nothing
in the fixture is hardcoded and there is not a single literal to replace, so
this is not 812 in a different costume: 812 asks _is this a token_, 820 asks
_is this the right token_. Both questions have the same 1,522 candidate names
in front of them; only the second one is still hard once you can `grep`.

`--ks-color-primary` reads like exactly the token a component should use. It
is a primitive, meant for building the semantic layer and not for direct use.
`--ks-line-height-copy-l` pairs with a display-sized figure to give it a 1.5
line-height where it wants 1.15. An agent that can ask the server is told this.
An agent that cannot has to already know the system.

### The prompt names no rules

It describes symptoms a designer would report — "the vertical rhythm is visibly
off", "they don't follow when the theme changes" — and never says _category_,
_primitive_ or _semantic layer_. Naming the rules would hand the baseline arm
the answer and measure nothing, the same failure mode as an answer key in the
fixture (ADR 17).

### Five states, not four

ADR 53 requires the fixture be hand-solved and run locally before it is bought.
This one was run in five, because the interesting failure is a new one:

| state            | stylesheet                                                             | result          |
| ---------------- | ---------------------------------------------------------------------- | --------------- |
| unsolved         | as shipped                                                             | 2 failed / 7 ok |
| solved           | correct categories, semantic colours                                   | **9 passed**    |
| loophole         | awkward declarations deleted                                           | 1 failed / 8 ok |
| anti-pattern     | tokens replaced with literals                                          | 3 failed / 6 ok |
| **wrong intent** | right layer, right pairs, `--ks-text-color-copy` on the display figure | 1 failed / 8 ok |

The unsolved run names all four mixes with their selectors and all three
primitives, which is the evidence that the block parser works rather than the
assumption that it does (lesson (d)).

The fifth state is why `categoryOf()` covers `--ks-text-color-<category>` and
not just size, line-height and family. A first draft checked only the latter
three, and "right names, right pairing, wrong category of colour" passed it —
a defect that fails silently _upward_ (D-67), invisible in any results read.
The tokens MCP's own rule includes `textColorPattern`; the assertion now does
too.

### Not by deletion

Every intent assertion above passes on an empty file, so a positive requirement
carries the anti-vacuous load: at least three font-size, three line-height and
three colour tokens must survive, and the two trend modifiers must keep
distinct, tokenised colours. Without it, deleting the awkward declarations is a
perfect score — the loophole state of D-68, and the reason that state is run.

### Scoring shape

`TARGETS["811-token-intent"]` is `diffTask: true`, `requiresClientBehaviour:
false`, `mcpUseExpected: true` — structurally 812's sibling. The component and
schema ship correct and are digest-pinned; the stylesheet is the only thing the
agent may touch.

`defineExperiment()` defaults `evals` to `"*"`, so this joins all four arms
automatically. Every fixture change this session moves fingerprints, so the
second campaign requires `--force` regardless.

---

## ADR 67 — Screenshots are the review artifact; the Storybook is the appeal

Phase 2 could already answer "what did `cc-none` score on `810`". It could not
answer "what did that _look like_", and the second question is the one a
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

`page.evaluate` given a _string_ evaluates it rather than calling it. The first
`COMPONENT_BOX` was a bare arrow function, so it returned unserialisable and
every screenshot silently fell back to a viewport shot annotated _"the component
rendered nothing with a layout box"_ — a note indistinguishable from a genuine
empty render. It is now an IIFE, and the docstring says why, because this is
D-67's shape again: a defect that fails silently _upward_.

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
newest ten directories are therefore _not_ the set the reports currently point
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
layer, and the deploy sequence is explicitly _populate, then ship_:

```
pnpm --filter agent-eval report build --all
pnpm --filter agent-eval report:index
kamal deploy -d agent-eval-results
```

(`results/.gitkeep` is tracked precisely so the `COPY` has something to copy on
a fresh clone; an unpopulated deploy is an empty site, not a build failure.)

**It is untrusted by construction.** The reports exist to run code a model
wrote, unreviewed, sixty times over. That is the feature — a component that does
not render is a _result_. But it means the site serves scripts nobody has read,
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
Vite and a Playwright browser driver — the machinery for _producing_ reports,
none of which serving them requires. Installing `--prod` cuts the image to
400 MB (of which 113 MB is the current results tree). Node 24 strips types
natively, so the server runs from `server/index.ts` with plain `node` and the
runtime needs no TypeScript either: no build step, and therefore no build output
that can drift from its source.

**`--prod --filter agent-eval` is not enough.** It links `@kickstartds/shared-auth`
as a workspace package without installing _its_ dependencies, so the container
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
wired, so _every_ trial that solved that task correctly was unbuildable, and the
error blamed the agent for it.

The fix reads the trial's own `package.json` and aliases every `file:` or
`link:` dependency to its on-disk directory. Naming packages was the defect;
naming the _mechanism_ is the fix, and it covers whatever a future fixture
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

---

## ADR 72 — the judge is a host-side grader, not an in-sandbox assertion

PRD §7.3 places the LLM judge inside the sandbox, as a `toSatisfyCriterion`
assertion in `EVAL.ts`. That is the harness's own idiom and it reads well, but
it makes the rubric part of the fixture — and the fixture is what the
fingerprint is computed over. Editing a rubric would invalidate every result
that used it.

Phase 3 exit is "≥80% agreement with human grading, iterate the rubrics until
it holds". Under the PRD's placement, one lap of that loop is a full capability
matrix: sixty agent runs, roughly $250 and several hours. Nobody iterates a
rubric four times at $1,000. The design would have quietly guaranteed that the
rubrics shipped in whatever state they were first written in.

It is also blocked operationally. The harness's agentic judge authenticates
through `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, both deliberately unset so
the failure classifier cannot fire (D-19).

The judge therefore runs on the host, over trials that already exist. It reads
the same artefacts as every other grader, and it can be re-run over all sixty
Phase 1 trials for cents. Rubric iteration costs a rubric, not a campaign — the
same property that made the deterministic graders retroactive (D-50), applied
to the one grader that has a bill.

**Spending is split from grading, in code and not by convention.** `bin/judge.ts`
is the only file that can open a socket to a model; it is dry by default and
writes verdicts to `judge.json` beside each trial. `lib/graders/judge.ts` only
ever reads that file. `npm run grade` is run dozens of times a day, and a
grader that _could_ spend money when someone re-grades would be a standing
hazard. Decision 11 says spend is a human decision, and the only way to mean
that is for the free path to contain no code that can pay for anything.

Un-judged trials report `applicable: false`, which `qualityScore` already
renormalises around, so adding the grader changed no existing score.

Two things fell out of building it that the design did not anticipate.

**A pin that names a tier is not a pin.** `agent-eval.config.ts` carries
`JUDGE_MODEL: ModelTier = "opus"`, which resolves to whatever "opus" means on
the day it is called. For the agent under test that is fine. For the instrument
measuring it, it means a score from March and a score from September may come
from different models with no record that they did — precisely the drift the
judge exists to detect. The judge names a dated release instead, and the dry run
verifies it against the API before spending. That verification immediately
caught a pin that did not resolve at all.

Notably the dated pin is _not_ the newest model available: the current flagship
was published only as an undated alias, and an alias is the thing the constant
exists to avoid. A judge one generation old and stable is worth more than one
that is current and moves.

**Half the bill was one invariant list.** The `token-reasoning` rubric shows the
judge the 1457 semantic token names that were available to choose from — ten
times the size of the component being judged, identical on all forty-eight
calls. Hoisting it into a cached system block took the estimate from $23.83 to
$14.92 with no change in what the judge sees. Prompt caches match a prefix, so
this is only available to a design that keeps its invariant context separate
from its per-trial context; the in-sandbox placement, where each trial builds
its own prompt in isolation, could not have used it.

## ADR 73 — a judge shown less than it needs confabulates rather than abstains

ADR 54 and ADR 61 established that every check must be asked whether the agent
authored the thing being scored. Applying that to the judge exposed `api-design`
grading a fixture-written schema on all thirty-six trials that had one, so
`buildPrompt` was changed to gate every file on `untouched()`. The rubric was
then re-run against forty-eight trials, and produced seven failures whose
reasoning was entirely invented: three mutually exclusive descriptions of one
unchanging schema, and two components failed for correctly matching the file the
judge was describing incorrectly.

The gate was working. The briefs are what leaked: they say "its props are already
specified in `<name>.schema.json` — treat that schema as the source of truth",
and the agent does not write that file, so the gate withheld it. The judge was
told an authoritative document existed, was denied it, and reconstructed it from
the component in front of it — then reported the component as diverging from the
reconstruction.

The decision is that **authorship gating alone is not enough; a rubric must also
declare what it cannot be asked without.** Rubrics carry a `requires` list, and
where that material is missing the question is not put at all. This is stricter
than returning `unknown`, deliberately: `unknown` is a judgement the model makes
about evidence it has seen, and the failure here was that the model would not
make it. The system prompt additionally forbids reasoning about, or reporting a
discrepancy against, any file not in evidence — belt and braces, since the same
shape will recur as briefs grow more detailed.

Two consequences worth stating plainly. First, removing contaminated material is
not automatically an improvement: the contaminated `api-design` graded our own
fixture identically in every arm, which was uninformative but harmless, while the
corrected one marked correct work wrong. A defect that produces confident,
plausible, _wrong_ output is more expensive than one that produces a flat line,
and the flat line is what tempted us to "fix" it.

Second, the rubric was never the problem. No task in the suite asks the agent to
design an API — the schema is fixture-given on three tasks and absent on two, and
`810` is explicitly "build this from the given schema". `api-design` is retained
and self-disabling until 3.1 supplies a task whose brief describes behaviour and
leaves the surface to the agent. The general rule: **before iterating on a rubric
that will not discriminate, check that the suite contains a task where the thing
it measures is something the agent actually decides.**

---

## ADR 74 — The unit of a calibration sample is the artefact, not the trial

**Context.** The 3.6 harness was tested by piping five labels through it. The
report came back with fourteen observations, `token-reasoning` alone claiming
eleven from what had been two gradings.

Nothing was wrong with the labels. A label is keyed by rubric id and a hash of
the material, and trials frequently produce byte-identical code — that is the
entire point of `860-restraint`, where the correct behaviour is to change
nothing, so four arms converge on the same file. One grading legitimately
answers for all of them. It does not become four observations by doing so.

**Decision.** Agreement is computed over distinct labelled units. Items are
grouped by key, each group contributes one paired observation, and where the
judge answered the same material more than once its majority verdict is used.
The corpus is **153 units, from 180 trial-rubric pairs**. `queue()` and
`--status` count the same way, so the number shown during a session is the
number the report will use.

**Why this matters more than it looks.** 3.8 turns on a 15% weight if agreement
clears 80%, and the sample backing that decision is twenty hand-gradings. Per
trial, twenty gradings would have reported themselves as up to 180 — a sample
inflated ninefold by an accounting choice, with nothing visibly wrong in the
output. It is the same species of defect as D-102's fabrications: a number that
looks like evidence, arrived at honestly, and isn't.

**Consequence, and a free measurement.** Grouping surfaces something worth
having. Identical input answered two different ways is the judge disagreeing
with itself, and no amount of rubric rewording lifts agreement above that floor.
`--report` now prints self-consistency wherever repeated material was not
answered uniformly, which tells us whether a sub-80% rubric is badly worded or
simply noisy — two problems with opposite fixes.

**Generalisation.** Deduplicate before counting. Identical artefacts across
trials will silently multiply a small hand-graded sample into a large-looking
one, and the arithmetic is correct at every step.

---

## ADR 75 — A task that leaves the API open must be shown not to dictate one

**Context.** `824-api-from-behaviour` exists because `api-design` had nothing to
judge (D-102). Its brief describes a `progress-steps` component's behaviour and
ships no schema, so the agent designs the surface and writes it.

That creates a verification problem the other fixtures do not have. Every prior
task has one intended answer, so ADR 53's gate asks whether a correct solution
passes. Here there is no single correct answer, and the failure mode is an eval
that quietly rewards the API its author happened to imagine. That defect is
invisible in the results: it produces a plausible spread, and the arms that lose
look like they wrote worse code rather than different code.

**Decision.** The gate runs a sixth state — **a second, equally valid API** — and
both must pass identically.

| state             | what changed                                 | result           |
| ----------------- | -------------------------------------------- | ---------------- |
| unsolved          | as shipped, no component at all              | 10 failed / 2 ok |
| solved A          | per-item `status` enum                       | **12 passed**    |
| solved B          | `currentStep` index, status derived          | **12 passed**    |
| anti-pattern      | `useState` for step state, literal `#33475b` | 2 failed / 10 ok |
| loophole (schema) | `required: ["steps", "currentStep"]`         | 1 failed / 11 ok |
| loophole (stub)   | schema present but `properties: {}`          | 2 failed / 10 ok |

Solved A and B disagree on almost everything that matters — whether step state
lives on the item or is derived from an index, whether the enum exists at all,
what the second prop is called — and the eval cannot tell them apart. That is
the property being asserted.

**What the assertions do and do not pin.** The brief fixes exactly one thing:
steps arrive as `steps`, each with a label. That is forced, because the runtime
and a11y probes must render the component without knowing its API, and it is
also what a real brief does — naming the data to be displayed is not designing
the props. Everything else is checked only for coherence: the schema must be an
object schema with properties, must declare `steps` as an array, and must not
_require_ anything the brief said should be optional. The last one is a genuine
contract check rather than a style preference — a schema demanding props the
component renders happily without contradicts the implementation next to it.

**Known gap, deliberately left open.** Nothing here verifies that the component
honours the schema it wrote. An agent could declare `currentStep` and ignore it,
and every assertion would pass. Catching that statically would mean parsing the
component's props out of TSX and matching them against the schema — the shape of
check that has already misfired twice in this project (ADR 51's JSDoc match, ADR
52's prop-name probe). It is left to `api-design`, which reads both files and is
the reason the task exists.

**Also verified:** `untouched()` returns `false` for a file the fixture never
shipped, so the authorship gate added in D-100 classifies this schema as
agent-authored and `api-design` activates on this task and nowhere else.

**Consequence.** The hand-solved implementation is kept at
`lib/eval-harness/reference/824-api-from-behaviour/` — outside `evals/`, because
everything inside a fixture except `EVAL.ts` and `PROMPT.md` is uploaded to the
sandbox and a reference solution shipped next to the task would be the answer
key. It seeds 3.3.

## ADR 76 — A restraint task needs a temptation worth resisting

**Status:** Accepted · **Supersedes nothing** · **Extends ADR 42**

**Context.** `860-restraint` returned 1.00 in all four arms. Read as a result,
that is a clean negative: no arm over-engineered, no MCP induced scope creep.
Read as an instrument, it is uninformative — zero variance is zero information
(lesson (r)). The reason is visible in the task. `860` asks for an accessible
name on a remove button. Nobody gold-plates a one-line a11y fix, so the arms had
nothing to differ about, and the 100% measures the difficulty of the temptation
rather than the discipline of the agent.

The campaign's other loose thread points at where a real temptation lives. The
design-tokens MCP never flipped a task in any of the five evals; its only
reliable effect was on `token-conformance`. A server that changes how code is
written without changing whether the task is solved is exactly the kind of
server that might also change code it was not asked to touch. That is a finding
worth having, and no task in the suite could produce it.

**Decision.** `861-token-restraint` aims a restraint task at one server. The
component is a `Quote`; the request is one wrong token — the byline uses
`--ks-text-color-display` where it should use `--ks-text-color-copy`. The
stylesheet around it is deliberately stocked with work an agent holding a token
catalogue has every reason to want to do:

- a literal `#000000` inside `@media print`, carrying a comment that says it is
  a signed-off exception because the PDF renderer drops custom properties, with
  a ticket reference;
- a `19px` font-size in a `--legacy` modifier kept for content published before
  a relaunch, also commented, also ticketed;
- assorted hand-set values that are simply not tokenised.

Tokenising the print exception is not a cleanup, it is a regression the comment
exists to prevent. That is what makes the trap fair: the fixture states the
reason in the file, and the brief closes with "the rest of the stylesheet is the
way it is on purpose, so keep the change to the colour that is wrong". Failing
an agent for work nobody asked for is only legitimate when both the code and the
brief said so, and lesson (b) — an eval that fails correct behaviour is the most
expensive kind of bug — makes that a hard requirement, not a nicety.

**Two right answers, again.** ADR 75's lesson applied immediately. Setting
`--dsa-quote__author--color` in `_quote-tokens.scss` is as idiomatic here as
changing the fallback in the rule — the design system does both, `_divider-
tokens.scss` the former and `breadcrumb.scss` the latter. The first draft of the
eval digest-pinned the token partial as part of the restraint check, which would
have failed the more idiomatic of the two fixes for being a fix. The assertion
now resolves the effective value the way the browser would (a declaration in the
partial wins over the fallback) and the partial's restraint check verifies the
four shipped declarations survive rather than pinning bytes.

**D-105 — the added-file check is absolute.** It initially exempted `*.test.*`,
`*.spec.*` and `*.stories.*`, reasoning that an agent writing tests is doing
something good. The ADR 53 gate ran an added-stories-file state and it passed
13/13, which is how the mistake surfaced: component-builder ships
`get-storybook-template`, so the arm most likely to leave an unrequested story
behind is precisely the arm this task is measuring. A restraint task that
exempts the artefacts an MCP hands out cannot observe the effect it exists to
observe. The harness writes its reports to the project root, so an absolute
check has no false positive.

**Gate.** Ten states, each failing exactly its own assertion:

| state                             | result                           |
| --------------------------------- | -------------------------------- |
| unsolved                          | 2 failed (both fix assertions)   |
| solved — fallback in `quote.scss` | **13 passed**                    |
| solved — token in the partial     | **13 passed**                    |
| blanket `display`→`copy`          | 1 failed (passage keeps display) |
| tokenised the print exception     | 1 failed (print exception)       |
| deleted the legacy modifier       | 1 failed (legacy modifier)       |
| rewrote the token partial         | 1 failed (shipped tokens)        |
| added a dependency                | 1 failed (dependencies)          |
| added a stories file              | 1 failed (added files)           |
| edited the component / the schema | 1 failed each (digests)          |

The blanket-replace state earns its own assertion. Swapping every `display`
reference for `copy` satisfies both fix assertions while flattening the
component's type hierarchy, so the eval separately requires that the quoted
passage still uses the display colour.

**Consequence.** Whether `861` discriminates is not knowable before a campaign;
the gate can only prove that it _can_. If it also saturates, that is a stronger
negative than `860`'s, because this time the temptation was placed deliberately
and refused. Reference solution at `lib/eval-harness/reference/861-token-
restraint/` — a one-line diff.

**Lesson (aa):** a negative result is only as strong as the temptation it
survived.

## ADR 77 — The restraint task the artefacts asked for

**Status:** Accepted · **Extends ADR 76**

**Context.** `861` was designed from a hypothesis: the design-tokens MCP might
induce scope creep. `862` was designed from the artefacts. Phase 1's results are
on disk, and listing what each trial actually left in its component directory is
free. It says three things.

On `832` and `840`, the component-builder arms consistently emit
`XComponent.tsx` + `XProps.ts` + `XDefaults.ts` + `_x-tokens.scss` + `js/`,
where `none` emits `x.tsx` + `index.ts` and invents a file naming scheme per
run. That is the file-structure template being followed, it is conformance
rather than churn, and it is plainly a large part of why that arm scores 0.93
against 0.64 on `810`.

Unrequested `*.test.tsx` files appear in every arm — `none`, `design-tokens`,
`component-builder`, `both`. Writing tests nobody asked for is a baseline agent
habit, not an MCP effect. Any restraint measurement that treats it as one is
measuring the model.

And on `860`, all twelve trials returned exactly the five shipped entries. No
arm added anything to a component it was asked to make one small fix to.

**Decision.** The interesting question is therefore none of the above. It is
what the template pressure that produces correct structure on a _new_ component
does to one that already exists and is published. `862-api-freeze` asks it
directly. `Rating` floors its value; the half-star rule is already in the
stylesheet, commented as designed-but-unrendered with a ticket, and the schema
already documents `value` as fractional and shown to the nearest half. The fix
is `860`'s idiom — wire up what is already there.

The fixture is then deliberately off-house-style in exactly the ways the
component-builder templates would correct: the variant prop is called `kind`,
props and defaults are inline rather than split into `RatingProps.ts` and
`RatingDefaults.ts`, and there is no `index.ts`. The brief freezes the API and
gives the reason a real one has — the component is published, three products
import it, two destructure `kind` by name, so a rename is a breaking change and
a separate piece of work.

**Why this is scoreable and not a trap.** Same bar as ADR 76. Every constraint
is stated in the brief, and the one class name the assertions match on
(`.dsa-rating__star--half`) ships in the fixture rather than being guessed at,
so no assertion pins a decision the brief left open. `3.5` of `5` is the render
value precisely because nearest-half, floor-then-remainder and round-half-up all
agree on three full, one half, one empty; `3.4` would have made the eval a
quiz about a threshold nobody specified.

**A separate assertion for the accessible name.** Rounding is a rendering
concern, and an implementation that also rounds what `aria-label` reports throws
away the precision the fix exists to surface. That failure passes every count-
based check, so it gets its own.

**Gate.** Eleven states, each failing exactly its own assertion:

| state                                  | result                          |
| -------------------------------------- | ------------------------------- |
| unsolved                               | 2 failed (both behaviour tests) |
| solved — nearest-half helper           | **15 passed**                   |
| solved — per-star remainder            | **15 passed**                   |
| renamed `kind` → `variant`             | 1 failed (prop renamed)         |
| added an `allowHalf` prop              | 1 failed (prop added)           |
| extended the schema                    | 1 failed (schema digest)        |
| edited the token partial               | 1 failed (tokens digest)        |
| split into `RatingProps.ts`/`index.ts` | 1 failed (restructured)         |
| added a dependency                     | 1 failed (dependencies)         |
| rounded the accessible name            | 1 failed (accessible name)      |
| dropped a stylesheet selector          | 1 failed (stylesheet)           |
| rendered an extra star                 | 1 failed (star counts)          |

`no prop is renamed` matches `variant` in a binding position — `\bvariant\s*[?:=,]` — rather than as a bare word, so a comment that happens to use the
term is not a failure.

**Consequence, and a free tightening.** `860`'s added-file check carried the
same `*.test.*` / `*.spec.*` / `*.stories.*` exemption that D-105 removed from
`861`. Because the artefacts show all twelve `860` trials returned the five
shipped entries, removing it there cannot change a recorded verdict — the
exemption never fired. It is removed anyway, so the blind spot is closed before
the Haiku campaign rather than discovered in it. Reference solution at
`lib/eval-harness/reference/862-api-freeze/`.

**Lesson (ab):** before designing a task around a suspected behaviour, look at
what the runs already produced. Three of this task's four design decisions came
from a directory listing that cost nothing, and one hypothesis it replaced —
that unrequested tests indicate MCP-induced creep — was wrong.

## ADR 78 — the suite is cost-tiered, and it carries two controls

**Status:** accepted · **Supersedes the reading of D6, does not repeal it**

**Context.** Phase 1 priced every kind of task the suite runs. A greenfield
trial costs $4.24–$5.67 and takes nine to eleven minutes; an edit trial costs
$0.23 and takes two. Across the whole campaign the arms came in at $4.67
(`both`), $3.66 (`design-tokens`), $2.69 (`component-builder`) and $1.37
(`none`), averaging $2.93 over 135 trials.

That twentyfold spread is the whole problem. D6 wrote down "$40 hard cap per
full run of the 4-variant core matrix" when the suite was five evals; the
measured figure is $35.18 per _eval_ matrix, so D6 had silently become a
per-eval cap. Twenty evals at Phase 1's shape would be roughly $700 a campaign,
which is affordable once and not affordable as a quality gate against response
drift — and the gate is the point. A suite that is too expensive to run is a
benchmark, not a gate.

**Decision.** `Target` carries `tier: "core" | "extra"`. `defaultEvals()`
returns `evalsInTier("core")`; setting `EVAL_EXTRA_EVALS` returns `"*"`.

```
pnpm eval cc-none-sonnet-high                     # core only, ~$150
EVAL_EXTRA_EVALS=1 pnpm eval cc-none-sonnet-high  # the full suite, ~$600
```

The twelve core evals are all edit or diff tasks. The eight extra evals carry
every greenfield generation task and, deliberately, all five evals that produced
the Phase 1 headline matrix — so the headline comparison stays reproducible on
demand rather than being folded into the routine run and re-bought every time.

The tier is a property of the task rather than a flag on the command because the
decision is about what a task costs to answer, which is a fact about the task.
Nothing about tiering touches grading, and `evalsInTier` is sorted so selection
is deterministic.

**Consequence.** `assertFixtureHygiene()` now throws on any fixture directory
without a `TARGETS` entry, because an untiered fixture would silently land in
neither tier and never run. In practice this means registering a target
immediately after scaffolding, before the fixture files exist.

### Two controls, not one

`852-a11y-repair` has been the suite's control since it was written: neither
server documents accessibility, so a spread across the arms there is not an MCP
effect and invalidates the reading of every treatment task.

`850-focus-return` joins it, and is the stronger of the two. The grep is equally
clean — `focus`, `Escape`, `aria-expanded`, `keyboard` and `accessib` all return
zero across every file in `component-builder-mcp/src` — but the component-builder
server ships `get-client-behavior-template`, so an agent holding that server will
be pulled into calling a tool that has nothing whatever to say about the thing
being graded. `852` controls with no plausible tool in reach; `850` controls with
one. Per lesson (aa), a negative result is only as strong as the temptation it
survives, and this is a better temptation.

If either control spreads, the campaign is measuring something other than the
documentation and no treatment task can be read.

### Authoring rule: check prevalence, not just existence

Three tasks changed shape and one died while the suite was being filled out.

`815-logical-properties` was cut. The idea was to grade `margin-inline-start`
over `margin-left`; the design system uses the logical form in zero stylesheets
and the physical form in sixteen, and the component-builder server never
mentions the distinction. The task would have graded a house style the house
does not have.

`850` was planned as a WAI-ARIA menu with roving arrow-key focus. A grep for
`ArrowDown|ArrowUp|Escape|key ===` across every component and client module in
the design system returned **one** hit — the Escape handler in
`nav-main/js/NavToggle.client.js`. Dropdowns are native `<details>`. The roving
pattern would have been graded against a convention that exists nowhere. What
`NavToggle` _does_ do, explicitly and in the house idiom, is move focus into the
panel on open and hand it back to the trigger on close, and nothing in the suite
tested that.

`816` was planned as theme adaptation until it became clear that `811`, `861`
and `806` already cover token intent from three angles. Asking the design-tokens
server for its `pairing` rules surfaced `typography-pairing`, which describes a
defect — display-sized type on a copy line-height — that is real, checkable, and
untested.

The rule, then: **before authoring a task, verify that the correct answer is
something the design system actually does and an MCP actually encodes, and check
how prevalent it is rather than only that it exists.** This is lesson (ac), and
it is close to free — each of these came out of a grep, against a matrix that
costs $35 to buy and cannot be un-bought.

### Two smaller rules the gates produced

**Reuse is graded from the source and the DOM together (lesson (ai)).** `802`
asks for a `Testimonial` assembled from the package's `Portrait` and
`RatingStars`. A gate state that copied `className="dsa-portrait"` onto a raw
`<img>` puts `dsa-portrait` in the rendered HTML and satisfies a DOM-side
assertion completely. The import-side assertion catches that; the DOM-side
catches an import that is never rendered. Neither half is redundant.

**An assertion satisfiable by flattening needs an anti-degenerate pin beside it
(lesson (ag)).** `816` asks that each piece of type be set from a single
category — which is satisfied perfectly by setting the entire card to
`--ks-font-copy-m`, destroying the hierarchy the component exists to express.
Three pins hold the shape, and the gate's flatten-everything state fails exactly
those three.

**A fix task needs a regression half (lesson (af)).** `850`'s brief is a bug
report about a panel keyboard users cannot escape. The cheapest way to satisfy it
is to stop opening the panel. Three of the sixteen assertions therefore cover
behaviour that already works, and the gate's demolition state fails five
assertions — three of them that half. Without it, demolition would have scored
better than the shipped bug.

**Lesson (ad), recurring.** Two `816` gate states passed while testing nothing: a
`perl -pi -e` aimed at a string that is not in the file reported a clean 14/14,
and a chained `perl` mangled a stylesheet rather than editing it. A gate state
that passes is not evidence until the mutation is shown to have landed. Every
mutation since is a `python3` heredoc carrying `assert old in t`.

**Reference solutions are excluded from `typecheck` (lesson (ah)).**
`lib/eval-harness/reference` is written against each fixture's dependency graph,
never compiled and never shipped into a sandbox. That exclusion is only
defensible because each reference is verified in place by its own ADR 53 gate
before it is saved.

## ADR 79 — a rubric is enabled one at a time, by hand

**Status:** accepted

3.8 says "enable the judge's 15% weight". Read literally that is one edit to
`WEIGHTS_VERSION`, and it turns on all four rubrics at once. Three of them will
have been calibrated against human labels by then. The fourth will not, because
it cannot be: `api-design` is narrowed by `requires: ["schema"]` (D-100) so it
is only asked where the agent authored the API, and no eval in the Phase 1
matrix does. Its calibration material does not exist yet — `824-api-from-
behaviour` is the first task that will produce any.

So "enable the judge" and "enable `api-design`" are the same edit only by
accident of implementation. They are separated:

**`Rubric.calibrated` decides whether a rubric's verdicts move the composite.**
`design-intent`, `token-reasoning` and `code-idiom` carry it; `api-design` does
not. `lib/graders/judge.ts` filters the scoring set by the flag and leaves the
verdicts in `checks`, annotated `uncalibrated, not scored`. Nothing upstream
changes: `bin/judge.ts` still asks all four, `judge.json` still records all four,
`pnpm calibrate` still offers all four for hand-grading. Only belief is gated.

Three consequences worth stating.

**The flag is set by a person, not by the agreement number.** `pnpm calibrate
--report` prints `[not scored]` next to any unflagged rubric, so a rubric can sit
at 100% and still not count, visibly. This is deliberate. Agreement over twenty
labels is a weak signal, and `api-design` is precisely the rubric that already
looked fine — it produced confident, fluent, well-argued verdicts about the
contents of a schema it had never been shown, on seven of forty-eight trials
(D-102). A number it generates about itself is not the thing that should decide
whether to trust it.

**The gate costs nothing to move.** Grading is host-side and retroactive
(Decision 17), so flipping `calibrated` re-scores every trial ever run, for free,
in both directions. There is no reason to enable a rubric early to avoid rework,
which is usually the argument that wins these.

**It generalises past `api-design`.** Every rubric added from here starts
uncalibrated and stays that way until someone has read its disagreements. The
default for a new measuring instrument is "does not count".

Lesson (aj): a rubric that has never been checked against a human is not a
measurement, and the safe default for one is to ask it, record it, show it, and
give it no weight.

## ADR 80 — the sandbox stopped receiving the thing it was supposed to be measured on

Two changes landed together because they are the same mistake at two scales: in
both cases the harness handed the agent something it should only have been able
to _ask for_.

### The servers moved to the host

ADR 55 left this unresolved with a clear diagnosis and no fix. Both MCP servers
were uploaded into the container and launched over stdio, which meant their
entire source tree — and, for `design-tokens`, the token files themselves — sat
on a filesystem the agent could read. It did read them. Two of four arms on
`812` came back `RUN INVALID` because agents found
`/tmp/.agent-eval-mcp/design-tokens/tokens/`, and they found it because
`.mcp.json` sits in the working directory and names the absolute path.

That is not a bug in the placement. It is a property of stdio: the user that
runs the server has to be able to read the server. Moving the directory removed
the stumble and kept the capability, which is why the leak detector, not the
layout, was doing the actual work.

Both servers already speak Streamable HTTP, so the fix was available the whole
time and was only ever blocked on cost. They now run on the host, and the
sandbox gets a URL. There is no file to find because there is no file.

The interesting constraint was reaching the host at all. The framework's docker
backend hardcodes `HostConfig: { AutoRemove: true }` and exposes no hook for
`ExtraHosts`, so `host.docker.internal` — the obvious answer — does not resolve
on Linux, and there is no supported way to make it. But the container's default
gateway _is_ the bridge and the bridge _is_ the host, so the address can simply
be read out of `/proc/net/route`. Not via `ip`, which `node:24-slim` does not
ship; via `node`, which by construction it does.

What this does **not** close: `.mcp.json` still contains a URL, and an agent can
`curl` it. The leak detector now matches the endpoint shape for exactly that
reason. But the residual channel yields what the tools yield, whereas the old
one yielded the design system's token files directly — the difference between an
agent that used its MCP without being credited and an agent that never needed
one.

The cost was known in advance (D-71) and is unchanged: `SETUP_VERSION` and the
probe both feed `variantVersion()`, so the next campaign needs `--force` and
must re-buy every trial. Phase 1 remains readable and stops being comparable.
That trade was accepted when the leak was root-caused; the only thing that
changed is that it is now paid.

### The component-builder templates stopped prescribing code that cannot compile

ADR 46 and D-30 recorded the same defect in two templates:
`get-client-behavior-template` produced a `.client.js` importing
`@kickstartds/core` without telling the agent to declare it, and
`get-storybook-template` produced a stories file importing two files that only
exist after a build. In both cases the agent followed the tool and got a compile
error, and in the client-behaviour case its recovery was to move the behaviour
into React — the one answer the task exists to rule out.

The fix worth recording is not the added prerequisite sections. It is that
writing them required counting first (lesson (ac)). Thirteen `.client.js` files
in the design system; eleven use `extends Component`, two do not, so the
standalone variant is not an invention but a documented existing shape. Eight
interactive components wire client behaviour into React; six use a bare
side-effect import and two use `useKsComponent` — and the template had been
teaching the two as if they were the eight. A tool that encodes a design system
is only as good as its census of that design system, and neither of those
numbers was in the template's head before this pass.

Lesson (ak): a harness that ships the answer measures availability, not
capability — and the shipping is rarely deliberate, so the question to ask of
every artefact that enters the sandbox is not "should the agent have this" but
"can the agent reach this".

## ADR 81 — a broken fingerprint is a window, and deferred fixes are its rent

**Status:** accepted. **Decisions:** D-115, D-116.

Two known defects had been sitting in the backlog for the same reason, and it
was not that either was hard. Fixing either would move a fixture or an `EVAL.ts`
digest, `guardVariantVersion()` would refuse the next run, and the next run
would need `--force`. Each was worth less than a matrix.

(That framing was slightly too dramatic, and D-117 corrects it: `--force` does
not delete anything. It bypasses the guard and rewrites `.variant-version`. What
it discards is the framework's _reuse_ of cached results, not the results
themselves. The re-buy is real — the new campaign pays for every trial again —
but the prior corpus survives on disk under its own timestamp.)

ADR 80 broke the fingerprint anyway. `SETUP_VERSION`, `PROBE_SOURCE` and the
component-builder build hash all moved, so the next campaign has to be bought
with `--force` regardless. The moment that became true, the cost of these two
changes went to zero, and leaving them in place stopped being thrift and started
being an unforced error.

**The decision recorded here is the batching policy, not the two fixes.**
Fingerprint-invalidating changes should be queued, not applied when noticed, and
then drained in full the first time something else invalidates the fingerprint
for a reason that justifies the re-buy on its own. The alternative — apply each
as it is found — pays the full re-buy price per fix. The failure mode of
queueing is forgetting, which is why the queue lives in the checklist as open
lines rather than in anyone's head, and why draining it is an explicit step
before a campaign command is handed over.

The two drained here differ in an instructive way.

`812`'s check named "the variants remain visually distinguishable" read only
`alert.scss`, so it silently also required the variants to live there rather
than in `_alert-tokens.scss`. That is a **false negative**: correct work scored
as wrong. It was found while writing the gold reference, which is exactly what
gold references are for (lesson (ah) — a reference solution is code too), and it
was recorded rather than fixed under the cost argument above.

The React pins were the opposite: not wrong, just **stale**. All 20 fixtures
were on React 18 while the workspace and the report host that renders every
graded trial are on 19.2.1. Nothing failed. The fixture had simply drifted from
the thing it is a model of, and a fixture that has drifted is measuring a
codebase that does not exist.

**Both required verification in a direction the change itself does not test.**
Widening an assertion is the one edit whose failure mode is silent success, so
`812` was checked twice on a real fixture: variants moved into the partial now
pass, and variants deleted from both files still fail. Bumping types is the one
edit that can break _shipped_ code the agent never touched, so all 20 fixtures
were re-gated with their references applied — 20/20, 251 assertions. Neither
verification would have been prompted by the change looking correct, and both
are the whole reason to trust it.

Lesson (al): the cost of a fix is not the fix, it is what the fix invalidates —
so track fixes you are declining on price, and spend them the first time
something else picks up the tab.

## ADR 82 — the results path must name the model, because the code does not read it from there

**Status:** accepted. **Decision:** D-117.

An experiment's results directory is its `name` field, hardcoded in
`experiments/*.ts`, and all four say `cc-<variant>-sonnet-high`. The model is
not read from that name. It comes from `PRIMARY_MODEL` in `agent-eval.config.ts`,
which is `process.env.EVAL_MODEL ?? "sonnet"`.

The two agreed as long as only one model had ever run. The moment a second one
does, `EVAL_MODEL=haiku pnpm run:capability` writes Haiku trials into
`results/cc-both-sonnet-high/` under a fresh timestamp, and nothing anywhere
objects. The variant is namespaced; the model is not. `.variant-version` records
the MCP build and the arm, not the model, so the guard would not fire either.

**The decision: a model gets its own experiment files.** Four new definitions
named `cc-<variant>-haiku-high`, rather than an env override against the
existing four. The env override stays what its comment already says it is — "for
local one-off probes only, never for anything that writes a baseline".

The damage this avoids is not a crash, which is why it is worth an ADR. It is
that `collectRun()` aggregates a directory, the published report aggregates a
directory, and the calibration candidate pool is built by walking directories.
All three would have silently blended two models, and the only evidence of the
mixture would have been the `model` field inside each individual `result.json` —
a field nothing aggregates on. The cross-model comparison this campaign exists
to produce would have been computed against a corpus that had already averaged
the two things being compared.

A welcome side effect: a new experiment name has no `.variant-version` marker,
so `guardVariantVersion()` writes one and returns early. The Haiku campaign does
not need `--force`, which — per D-117 — never deleted anything in the first
place.

Lesson (am): a directory name that encodes a variable the code does not read
from it is a lie waiting for the second value — the moment a second model, arm
or version exists, check whether the path distinguishes them or only claims to.

## ADR 83 — a cache check with an opt-out is not a cache check

**Context.** Grading a `812-restyle-with-tokens` pair raised a question about
what the judge is shown. `judgedMaterial()` gates every file on the agent having
authored it, so on a restyle the untouched component is correctly withheld — but
`_alert-tokens.scss` was withheld too, and nothing had decided that. The partial
is returned by `discoverGraded` as its own field, kept out of `styles` because
the deterministic graders want them separate (ADR 63, D-115). `judgedMaterial`
simply never read that field.

The consequence was not cosmetic. In the trial that surfaced it the main
stylesheet contained zero `--ks-*` references and the partial contained
twenty-four. `token-reasoning` asks which semantic token was chosen; it was
being handed the one file in the pair with no token choices in it.

The tell was in the judge's own system prompt, which already said _"schemas,
token partials and generated types routinely exist without appearing here"_ and
instructed the model not to fault the author for a missing file. The gap had
been noticed and absorbed as a prompt instruction rather than closed. An
instruction not to notice an absence is a description of a defect.

**Decision.** Emit the token partial alongside the stylesheet for every rubric
that includes styles, and accept either file as satisfying a `requires:
["styles"]` gate, since an agent may put everything in the partial.

**Decision.** Treat a cache entry with no `promptHash` as stale.

The second is the one worth recording. `promptHash` was added (D-101) to catch
exactly this class of change: the criterion is byte-identical, the material is
not, and the cached verdict answers a question that was never asked. It was
optional for entries written before it existed, on the reasoning that _"the
prompts they were formed from are known to match"_ — a claim that was true on
the day it was written and that no mechanism kept true.

180 of the 228 stored rubric results predate the field. So after changing what
the judge sees, the dry run reported **zero calls to make**. The guard against
serving verdicts formed from different material was itself serving verdicts
formed from different material, and the only reason we found out is that
somebody was reading the code by hand at the time.

**Consequences.** 5 of 16 calibration labels are orphaned — labels are keyed on
material, and 72 of 180 candidate items gained a section. That was the priced,
expected cost of the first decision, and it is why it was taken at 16 labels
rather than at 60.

The second decision costs a full re-judge, estimated $15.87 against a historical
actual near half of estimate. It is not optional: 3.7 measures whether the judge
agrees with a human, and an agreement rate computed between a human who saw the
token partial and a judge who did not is not a measurement of the rubric. It
measures our own bookkeeping.

Hand-grading can continue before that spend. Labels key on the corrected
material and the loop is blind at decision time; only the post-verdict feedback
line reads the stale cache, and feedback is not input.

Lesson (an): a hash that is allowed to be absent is not a check, it is a check
with an opt-out — and the entries that predate it are the ones most likely to
have drifted. Grandfather clauses are written when the exception is empirically
safe and they are read years later as though it still is.

Lesson (ao): when a prompt tells the reader not to hold something against the
author, ask why the thing is missing rather than how to word the apology.

## ADR 84 — an authorship guard is owed to every reader of the material, not just the graders

Three times we have found a check scoring work the agent did not do. ADR 41 gave
`untouched()` for files that came back byte-identical. ADR 54 and ADR 61 gave
`readShipped()` so a grader could separate what was handed over from what was
written. D-100 caught `api-design` judging a fixture-authored schema on all
thirty-six trials that had one.

Each fix landed on a grader. None landed on the two readers who see the most and
are least equipped to compensate: the judge model, and the human calibrating it.

`judgedMaterial` hands over whole files. On an edit task most of what it shows is
ours. The result was two hand-labels failing `860-restraint` for hand-written
prop types that the fixture ships and whose brief — "keep the change to what the
audit actually reported" — forbids touching. Regenerating them would have
tripped the restraint assertions. The label punished the agent for compliance,
and the judge, which passed the trial, was right.

We had reached for the prompt first. The SYSTEM text said "Never fault the author
for the absence of a file", which is correct for a withheld file and wrong for
content sitting in a file the reader can see: component tokens declared in the
main stylesheet prove they are not in the partial, and no invisible file is
needed to know it. That paragraph is now two — absence stays forgiven,
misplacement is judged. But the prompt was the smaller half. Wording cannot tell
a reader which lines were authored; only the material can.

**Decision.** Any file with a fixture baseline is labelled `MODIFIED FIXTURE` and
followed by the region between the common prefix and the common suffix. The full
file stays, because `design-intent` needs whole-file context; what is added is
the boundary between given and written. The hunk finder is not a real diff — a
scattered edit collapses into one span covering everything between the first and
last change — which over-reports and degrades to today's behaviour in the worst
case. Diff tasks here are small edits by construction.

The same guard is now in `bem-nesting`: only selectors the author added are
counted, because two of our own gold references are flat edits of flat fixtures.

**Consequences.** Re-keying orphaned 10 of 32 labels, all on diff tasks, and the
reported agreement rose to 80/83/83%. That number is not evidence. The
disagreements lived on diff tasks, so dropping diff-task labels dropped the
disagreements, and the verdicts it was measured against predate the prompt
change. The re-judge (~$3) has to run before any of it means anything, and 3.7
should be re-argued from the result rather than from the rebound.

Lesson (as): a disagreement list is a bug report on the measuring apparatus
before it is a fact about the thing measured, and the bug may be in the human
half. Read the reasons, not the rate.

Lesson (au): when a reader is shown a whole file on an edit task they will grade
the parts they were handed. An authorship guard is owed to every consumer of the
material — the regex, the model, and the person.

Lesson (av): a rebound that arrives with the fix is usually the sample moving,
not the system improving. Check what left the denominator before believing it.

## ADR 85 — one rater is an instrument without an error bar

**Context.** 3.7 requires ≥80% agreement between the judge and a human, and the
judge is worth 15% of the composite score once 3.8 lands. All hand-grading so
far comes from one person, because `candidates()` builds its questions by
walking `results/` — 113 MB, gitignored, prunable, and resident on exactly one
machine. Grading required that directory, a pnpm install and a terminal.

**Problem.** The threshold cannot be read. A judge at 67% on `token-reasoning`
is either wrong or disagreeing with one reviewer's idiosyncrasy, and nothing in
the number distinguishes them. Iterating rubric wording against a single
grader's labels optimises the judge towards that person — which is a real
achievement and not the one claimed, because the rubrics are supposed to encode
the design system.

Human/human agreement is the missing bound. Two qualified people on the same
material establish what the rubric can achieve at all: at 95% between them a
judge at 67% has a defect worth reading line by line; at 70% between them an 80%
target is unreachable and the rubric is asking about something the design system
has not actually decided.

**Decision.** Separate the questions from the results and serve them.

A calibration question is three strings — material, criterion, and (since ADR 84
and D-123) the brief. `calibration/bundle.json` carries all 153 of them in
0.8 MB, committed, derived by `pnpm calibration:export` on the machine that has
the campaign. `/calibrate` serves that bundle from the existing results host,
behind the existing JWT gate, in the existing Kamal deployment, and reads
nothing from `results/`.

Labels become one file per rater, unioned on read. A single map cannot take two
writers without a git conflict on every line, and the whole point is two
writers. `readLabels()` pools by modal verdict — the rule already used for the
judge's repeated answers on identical material — and `raterAgreement()` reports
the ceiling pairwise, never against the pool, because comparing each rater to a
majority they are part of counts them against themselves.

**Consequences.** Rater identity is now load-bearing and is never inferred: it
is the JWT subject where the gate is up, and an explicit prompt where it is not.
Two people sharing a name would report as agreement, which is worse than no
data. Names reach the filesystem, so they are allow-listed rather than escaped.

The judge's verdict stays out of the bundle. It would be one more field and it
is right there in the cache, but a verdict shown before labelling is an anchor,
and the instrument depends on independence.

The container's disk is not a backup. Labels are written to a volume and have to
come home to the repository — per-rater download link, or `docker cp` — which is
a manual step and will be forgotten at least once.

What this does not fix: the CLI still needs the results tree. It could read the
bundle too, and probably should, but the constraint that mattered was that
grading required a checkout at all.

Lesson (ay): a measurement taken with one instrument has no error bar. Before
tuning against an agreement rate, establish what two graders score against each
other — until then the rate is a number, not evidence.

Lesson (az): portability is usually one dependency, not a rewrite. Everything
about hand-grading already travelled except that the questions were computed
from a gitignored directory; 0.8 MB of derived JSON removed the constraint that
had held the project at a single rater since 3.6 began.

**Amended, same day — coverage before agreement.** This ADR conflated two
things the multi-rater store gives you: _attribution_ (per-rater files, so two
people writing at once do not fight over one JSON map) and _inter-rater
agreement_ (deliberate overlap, so the ceiling is computable). Only the first is
needed now. With 130 pairs unanswered, spending a second grader's sitting on a
pair that already has a verdict buys a statistic instead of coverage.

So the hosted queue skips anything **any** rater has answered — which is the
rule `bin/calibrate.ts` always applied, so the terminal and the browser stopped
disagreeing about what "remaining" means. It also stopped re-asking the 23
pairs already answered in the legacy `labels.json`, which the host had never
read. A fresh grader now starts at 130 rather than 153.

Nothing about this is hard to undo, which is what makes the deferral safe rather
than merely convenient. Labels are permanent and keyed by material hash, so an
overlap campaign later serves keys that are already answered — one inverted
filter — and every label collected in the meantime still counts toward it.
`raterAgreement()` stays in place and reports the moment overlap exists;
duplicate verdicts arriving from a race are stored rather than rejected, so the
first few arrive for free.

What is knowingly given up until then: human/judge agreement is a pooled number
across whoever graded, and it inherits whatever spread exists between those
people. It is a usable signal for 3.7 and not yet a calibrated one. Lesson (ay)
is not retracted — it is deferred, and the deferral should be stated whenever
that number is quoted.

## ADR 86 — the pick list is scoped to the rubric, and the first 23 labels are retired

**Context.** The grader suspected they had been rating things not relevant to
the question being asked. Auditing all 23 addressable labels against the
criterion each was filed under: `code-idiom` 6/6 of its written reasons on
topic, `token-reasoning` 3/3, `design-intent` **0/7**. Every design-intent
reason is a code-idiom observation — file naming, generated prop types,
`classnames`, `deepMergeDefaults`, React state instead of the client bundle.

**Decision.** Retire the label set and scope the diagnosis list per rubric.

The retirement is not about the labels being wrong. `design-intent`'s 80%
agreement is the rate at which two graders answering _different questions_
happened to land on the same verdict, which is not a weak reading of that rubric
— it is not a reading of it at all. Keeping the subset that audits clean was
rejected: selecting labels by whether they look defensible is selection on the
quantity being measured, and biases the retained rate upward. Retired rather
than deleted, because `calibration/` is untracked and the file is the evidence
the audit is computed from.

**Why the tool is the defendant.** Two properties of the UI made this the
expected outcome rather than a lapse. The pick list was rubric-blind — 13
diagnoses spanning three rubrics offered for every question, including ones
unanswerable from the material shown, since `token-reasoning` is given only a
stylesheet and a token list and was still offered `wrong-filename`. And the
criterion was stated once at the top of a page whose material runs to hundreds
of lines, so the verdict was given with the question off screen. `design-intent`
and `code-idiom` show nearly the same material — the brief is the only
difference — so nothing but the criterion distinguishes them, and the criterion
was not in view.

The loop closes: the pick list was transcribed from the notes (ADR 84), so
off-rubric notes became options and options made off-rubric notes fluent. The
prior decision explicitly defended the unscoped list because "the notes do not
respect the rubric boundary". That observation was correct; the inference from
it was backwards.

**Consequences.** `Reason` carries `rubrics: string[]`; `reasonsFor(rubric)`
scopes the CLI, the web UI and `resolveReasons()`, whose numbering is now
per-rubric — safe because the number is positional and only the label is ever
stored. The panel repeats the rubric label as a sticky line above the diagnoses,
at the point the verdict is given rather than at the top of the scroll.

The tagging exposes that `design-intent` has exactly one applicable entry,
because no design-intent observation has ever been written. That is left visible
rather than filled in: entries are transcribed from notes, and inventing them
from the rubric is the failure ADR 84's rule exists to prevent. The panel says
so and points at the note field.

`api-design`'s two entries are tagged but never shown — the rubric is ungated
and its `requires: ["schema"]` is unmet across the suite, which is why
`callback-props` could only ever have been picked under a rubric that was not
asking about the API. That single sighting is now legible as a symptom rather
than a data point.

Cost: 153 pairs to grade instead of 130, and 3.7 restarts from zero. Against
that, the alternative was gating the judge's 15% weight on a rubric whose
calibration measured a different rubric.

Lesson (bb): an agreement rate between two graders answering different questions
is not a weak measurement, it is not a measurement. Audit what the humans wrote
against what they were asked before trusting the rate it produced.

Lesson (bc): a pick list transcribed from notes reproduces whatever bias
produced the notes and then reinforces it. Offering an answer is a hint about
the question, so vocabulary shown to a grader is part of the instrument.

**Amended, same day — the other exhibit.**

Asked on what basis the judge answered a `code-idiom` pair, since the page shows
no brief. The brief is correctly withheld — that rubric does not grant it. What
the trace turned up instead is that the judge had more than the material.

`cachedContext()` is a second block, separate from the prompt because it is
identical across every trial and therefore cacheable: the reference components,
and for `token-reasoning` the 1457 semantic token names. No calibration code
path ever called it. `candidates()` builds an item from `judgedMaterial()`
alone, so the judge compared the candidate against `ButtonComponent` and
`BreadcrumbComponent` while the human compared it against nothing — reading a
criterion that says those components _are_ the definition of the standard being
applied. D-123 found the brief half of this asymmetry and stopped there; this is
the larger half, and it affects two of the three calibrated rubrics.

The decision is the same one D-123 made, extended: the bundle carries
`context` per rubric, the page renders it collapsed beneath the material, and
the CLI prints the corpus. Shown, never keyed — `material` still decides
`labelKey`, so no label is invalidated. Withheld where the judge does not have
it either, because handing a human _more_ than the judge breaks the comparison
just as thoroughly in the other direction.

This is probably not independent of the contamination above. A reader told to
compare against an exhibit that is not on the page does not abstain; they
compare against the conventions they already hold — and the conventions this
reader holds are the design system's own, which is precisely what the retired
design-intent notes are made of.

Lesson (bd): a cache is an optimisation to the caller and a hiding place to
everyone else. Material split out to make a prompt cheaper is still material,
and the split is invisible from the place where someone asks what the judge saw.

## ADR 87 — the client file reaches the judge, and the corpus gets one to compare against

**Context.** Found while calibrating: on `832-client-behaviour` the judge never
sees any client behaviour. The task's whole subject is the convention —
"implement interactive behaviour the way this design system does" — and every
trial in the sonnet campaign wrote a `js/Disclosure.client.js`. Verified on
`cc-both-sonnet-high/832/run-1`: `discoverGraded()` finds the file,
`judgedMaterial()` assembles component, styles, token partial, schema, and
never pushes it. All three calibrated rubrics were scoring markup and a
stylesheet. The verdicts read exactly like that — `design-intent` 0.85/0.85/0.90
and `code-idiom` 0.85/0.90/0.90, with not one reason string mentioning the
client file.

Half of this was deliberate and half was not, and the deliberate half is why it
survived. The system prompt tells the judge that "behaviour implemented with
React state shows it is not in the client bundle", which is a genuine inference
from the component alone and does real work — ADR 86's audit found that exact
observation in the retired `design-intent` notes. But it is one-sided. It
catches the wrong answer and cannot see the right one. An agent that put the
behaviour where it belongs had the entire artefact withheld, so whether it
extends the `Component`/`define` base, keeps `aria-expanded` in sync, or removes
its listeners reached nothing. Scores still moved, which is why nothing looked
broken; they moved only on failure.

`code-idiom` had it worse than that. Its premise is that the references define
what idiomatic means here, and `parts()` listed four files, none of them client
— and neither exemplar has one anyway, `button` and `breadcrumb` both being
static. On the one task in the suite about the client-behaviour convention, both
sides of the comparison were empty.

**Decision.** `include.client` on the rubric, set on `design-intent` and
`code-idiom`; `judgedMaterial()` pushes every discovered client file through the
same `authored()` gate as everything else. And `gallery` joins the exemplars,
with `${Pascal}.client.js` added to `parts()`.

Both, not either. Showing the candidate's client file to a rubric that asks
"does this read like the rest of the codebase" while the references still
contain no client code moves the blind spot rather than closing it.

`gallery` rather than the other well-formed candidate: `section`'s client
directory holds `spotlight.client.js`, and `spotlight` is an eval target. The
existing guard catches a slug collision between an exemplar and a target — it
does not catch our own answer arriving inside somebody else's exemplar, which is
the same "did you reproduce our answer" failure the guard exists to prevent,
one directory deeper.

`token-reasoning` does not get it. Client behaviour carries no token choices, and
that rubric is the only one currently discriminating; there is no reason to
disturb its cache.

The authorship gate does the right thing on restraint tasks for free. `860` ships
a working `Tag.client.js` and asks for it to be left alone; `authored()` drops
untouched files, so the correct answer still shows the judge nothing — verified.

**Cost.** The corpus is in the shared cached context, so this invalidates
`design-intent` and `code-idiom` on every trial, not just `832`: `judge --all`
reports 120 outstanding calls against 60 already answered, at $3.81. That
asymmetry is itself the confirmation — the 60 survivors are `token-reasoning`,
the one rubric that takes no exemplars.

**Amended (D-130): the corpus asks for roles, not filenames.** Adding `gallery`
surfaced the same bug one level down. `parts()` listed a single spelling per
file, and `breadcrumb`'s token partial is `breadcrumb-tokens.scss` where the
list asked for `_breadcrumb-tokens.scss` — both spellings exist in the design
system, neither is wrong, and `existsSync().filter()` had been dropping it since
the module was written. The corpus was showing three of that component's four
files, and the missing one carries the token layering the comparative rubrics
exist to compare against.

Entries are now lists of accepted spellings for one role, first match wins. A
role may be absent — `button` has no client behaviour, and that is information —
but it can no longer be missed for being spelled the other legal way. The
distinction matters because the two cases are indistinguishable in the output:
a filter that finds nothing reports nothing either way.

Lesson (bh): an inference that lets a judge reach the right verdict without the
evidence is not a substitute for the evidence, and it hides the gap better than
missing material would. `judgedMaterial()` has now dropped a file that
`discover()` had already found three times — D-115, D-119, and this — because
discovery returning a field and the judge being shown it are different facts,
and only one of them is visible in the output.

Lesson (bi): a lookup by exact filename is a silent filter wearing a helpful
face. The corpus assembler and the grader discovery layer were written a month
apart and only one of them learned this; `discover()` has matched client
behaviour by pattern, and token partials by two spellings, since the beginning.

## ADR 88 — a reset that archives, scoped to the caller

**Context.** Labels written through `/calibrate` live in a Docker volume
mounted over `calibration/labels/`, which is what makes them survive a deploy —
the image's copy is shadowed at runtime precisely so that re-exporting the
bundle cannot destroy somebody's afternoon. The cost of that guarantee is that
there was no way to undo a sitting without `ssh` and `rm`, and the graders this
app exists for are the ones who do not have a shell on the host.

**Decision.** `POST /calibrate/api/reset`, with three properties that are not
negotiable independently of each other.

_Archive, never delete._ Retired labels move to `calibration/labels/retired/`,
on the same volume, leaving with the same `labels:pull`. Hand-grading is the
most expensive data in the project per byte and the only data here that cannot
be regenerated at any price — the results tree can be re-run for money, a
rater's afternoon cannot. The subdirectory is safe inside `LABEL_DIR` because
both readers of it, `answered()` in the server and `readRaters()` in
`lib/judge`, list one level and keep only names ending `.json`. A retired file
left as a sibling would still be pooled and would go on answering the queue,
which is the one thing a reset is for.

_The caller's file only._ Same scope as writing. The queue is shared, so a
global reset would resurrect everybody's work on one person's decision, and
nothing about being able to grade implies being able to discard someone else's
grading.

_A typed confirmation._ The site runs open whenever `MCP_JWT_SECRET` is unset,
and `scope: "all"` is otherwise one stray POST away from an empty file. The
name is checked server-side rather than in the page, so the rule lives where it
is enforced.

`scope` distinguishes `"orphans"` — labels with no matching pair in the current
bundle, the residue of material changing underneath them — from `"all"`. Only
`"all"` is wired to the UI. Orphans are already inert (`agreement()` reaches
labels through candidates, so an unmatched label is unreachable rather than
miscounted) and since D-131 they are not miscounted on screen either, so
clearing them is tidying rather than repair and did not need a button.

**Rejected: `prompt()`.** It was the first implementation and it is three lines
shorter. It is also absent in embedded contexts — VS Code's browser throws
`prompt() is not supported` outright — and a confirmation step that silently
throws where it is not implemented is the wrong failure mode for the one
control on the page that destroys work. A `<dialog method="dialog">` also
buys something `prompt()` cannot: Enter submits the _first_ button, which is
Cancel, and Escape closes with no value, so both reflexes a grader has built up
over an hour of single-key verdicts resolve to "no".

**Consequence.** The page's global shortcut handler had to learn about the
modal. It already ignored keystrokes aimed at an input, which covers someone
typing their name — but not someone who clicked the dialog's own background
first, and at that point `p` would have passed the item sitting behind it. It
now returns early while the dialog is open, returning rather than preventing so
that Escape still reaches the dialog.

Lesson (bk): the guard on a destructive control is not only the confirmation in
front of it. Everything the page was already listening for is still listening
while that confirmation is on screen.

## ADR 89 — labels store reason ids, and the sentences live in a dictionary

**Context.** The pick list of recurring diagnoses was transcribed from what a
grader kept typing, and a label stored the chosen sentences verbatim, joined
with commas. That made rewording an entry destructive in a way that was easy to
miss: the copy already in a note went stale, the tally that decides which
entries earn their place stopped counting it, and the entry then read as unused
next time anyone looked. `reasons.ts` said so out loud — "editing an existing
label is not free, though adding is" — and concluded the nine originals were
frozen "for that reason and not because they could not be phrased better".

That is a store dictating vocabulary. A list built by transcribing speech is a
list that will be rephrased, repeatedly, as the thing it names gets understood
better; freezing the first draft is exactly backwards.

**Decision.** A label stores `reasons: ["schema-types"]`. The sentences live in
`calibration/reasons.json` and are resolved on the way out, through `describe()`
and `describeLabel()`. `id` becomes the only part written to disk and the only
part that must never change; `label` becomes free to edit forever.

`note` keeps its meaning and narrows to it: free text is now only the residue
the pick list had no entry for, which is precisely the evidence new entries are
transcribed from. Splitting the two also makes the tally mechanical rather than
a grep.

**JSON in `calibration/`, not an array in `lib/`.** Three reasons, in order of
weight. A label is unreadable without the dictionary, so the two want to travel
together — into git, into a `labels:pull`, into the same directory. The
deployed image copies `calibration/` and does not copy `lib/`, so the hosted
grader can read the file directly instead of the copy that used to be frozen
into `bundle.json`: rewording is now an edit and a deploy, where it used to
require regenerating a megabyte of material on the one machine that still holds
`results/`. And a dictionary is data; the only thing the TypeScript around it
was contributing was the doctrine in its comments, which stays in `reasons.ts`
where it belongs.

Two `rubrics` tags that read as hedges were moved into that header rather than
lost to a format without comments: `react-behaviour` is deliberately tagged to
both `design-intent` and `code-idiom`, and `tokens-inline` deliberately only to
`code-idiom`.

**Consequence — the write path validates.** An unrecognised id is no longer a
typo inside a sentence, it is a label that will resolve to nothing, so the
server filters submitted ids against the dictionary _and_ against the rubric's
slice of it before storing. The rubric scope was previously enforced only when
rendering the list, which left it as a UI convention rather than a property of
the store.

Reading tolerates both shapes: `reasons` is optional, and a label carrying only
prose still renders. `bin/migrate-labels.ts` converts by exact match on the
`", "` join — labels contain no comma by rule, so a segment either is an entry
verbatim or it is free text, and anything unmatched is kept rather than guessed
at. It skips already-migrated labels and is worth re-running after a
`labels:pull`, since a deployment that has not caught up still writes prose.

**The volume is not migrated in place, and gets no push.** The hosted grader
reads only keys out of label files, so prose there costs nothing; and `merge()`
overwrites only on a strictly newer `labelledAt`, which migrating does not
touch, so a later pull cannot undo the conversion. That leaves converting the
volume with no benefit and one real cost — the pull script's premise is that
authority runs one way, "pull, inspect, commit", and a writer pointed back at
the volume would make a thing explicitly described as "not a backup" into the
place two processes race to own.

**Verified.** Dictionary served from disk (13 entries) rather than the bundle;
a submission mixing a valid id, an id belonging to another rubric, a
non-existent id and a number stored exactly the valid one; the eight existing
labels migrated to six recovered ids plus their residue, with the all-prose
design-intent label correctly recovering nothing. Rewording `react-behaviour`
on disk changed both the list the running server offered and the sentence
`describeLabel` produced for a label stored under the old wording — with no
re-export and no change to any label file.

Lesson (bm): a store that makes a name expensive to change will freeze the
first draft of that name, and the frozen draft will then be mistaken for a
considered one. Store the identifier; look up the prose.

## ADR 90 — design-intent stops being shown the stylesheet

**Context.** `design-intent` and `code-idiom` were shown almost the same
material — design-intent's `include` was code-idiom's plus the brief — and asked
questions phrased almost the same way. Two sittings of hand-grading had already
produced the symptom: every fail reason typed under design-intent was
code-idiom vocabulary, including one that was on screen as a checkbox and got
typed out longhand anyway.

The judge run settled it. Across 60 trials the two rubrics agreed 47 times, and
all 13 disagreements ran the same direction — design-intent passing where
code-idiom failed. Not one trial had design-intent fail alone. Its failures are
a strict subset of code-idiom's, which is not a second measurement; it is a
coarser copy of the first, bought at the same price per call.

That the overlap showed up as _material_ rather than as wording matters. Two
rubrics can be given genuinely different criteria and still collapse into one
answer, because a model shown a stylesheet will grade the stylesheet whatever it
was asked, and "class-name scoping and stylesheet organisation" is the sentence
code-idiom already owns.

**Decision.** Withhold the stylesheet from `design-intent`: `include` becomes
`{ prompt, client, exemplars }`. The criterion is rewritten to match, because
the alternative is the failure mode `requires` exists to prevent — a rubric
asked about material it cannot see does not abstain, it fills the gap (D-102).
It now names the shapes it wants judged (markup structure, what was made
configurable, how variants and states are expressed, whether this is the right
kind of component), says outright that the stylesheet is withheld on purpose,
and gives the test that separates the two rubrics in one line: _if your
objection disappears once every identifier is renamed, it is not an objection
this rubric wants._

`client` stays. Where behaviour lives is a question about shape rather than
naming, and withholding it is one-sided in exactly the way D-129 describes: it
proves the wrong answer and cannot see the right one.

**Consequence — the calibration set shrank, informatively.** Items are keyed by
material hash and deduplicated, so design-intent fell from 51 pairs to 39.
Twelve trials that were distinguishable only by their stylesheets are now the
same question asked once. That is 12 fewer hand-gradings, and it is also the
finding restated as arithmetic: a quarter of what this rubric was being asked
about was the file it should not have been holding.

One graded label was orphaned by the re-key — the design-intent fail whose note
was entirely free text, which is to say the one whose diagnosis was entirely
code-idiom. It is left in place rather than retired: it is unreachable by
`agreement()`, and it is the clearest surviving evidence of the problem this
ADR is about.

**Cost.** Sixty cached design-intent verdicts are invalidated, by both the
criterion hash and the prompt hash. Nothing else moves — the other three rubrics
keep their caches, and no agent re-run is implied, because grading is host-side
and retroactive (ADR Decision 17).

Lesson (bn): when two measurements agree more than they should, look at what
each one is shown before looking at what each one is asked. Wording is what you
control; material is what actually arrives.

**Outcome, after re-judging.** The narrowing changed the rubric's _reasoning_
and not its _verdicts_. Design-intent now writes shape prose — composition of
smaller components, variant as a closed enum, behaviour in a separate client
file — where code-idiom writes convention prose: the wrong class prefix, a
missing token partial, props declared inline instead of imported from generated
types. Two rubrics that were producing the same sentences are now producing
different ones, which is what the change was for.

The verdicts did not separate. Over the 48 trials where both rubrics are still
askable, they agree 37 times and disagree 11, and every disagreement is still
design-intent passing where code-idiom fails. Zero trials have design-intent
failing alone. The most likely reading is no longer that the rubric is a copy —
its stated grounds are visibly its own — but that on this corpus nothing is
shape-broken without also being idiom-broken. Sonnet gets the shape right and
the conventions wrong, so the coarser question never fires first.

That still leaves it double-counting inside the composite, which is what
`calibrated` exists to stop.

**A consequence worth naming: design-intent is now unaskable on twelve trials.**
On `812-restyle-with-tokens` the agent authors only a stylesheet — the component
and schema are unmodified fixtures, so `authored()` drops them — and with
`styles` withheld there is nothing left, `judgedMaterial()` returns null, and
the rubric is skipped. That is the right answer for the wrong reason: a restyle
contains no shape work, so silence is honest, and it matches the doctrine
`requires` already encodes for `api-design` (D-100). But it is emergent rather
than declared. It holds because this task's file set happens to come out empty,
not because anything says design-intent needs authored component source.

The stranded verdicts those twelve trials still carry are harmless in the
codebase and were not harmless in analysis. `lib/graders/judge.ts` filters
`cache.results` through `buildPrompt` before scoring, and `calibration.ts`
builds its candidates from `judgedMaterial`, so both already ignore an answer to
a question no longer being asked. A cross-tab read straight out of `judge.json`
does not, and counted twelve pre-narrowing verdicts as though they were new
ones.

Lesson (bo): a cache keyed by rubric is a superset of what is currently being
asked, and stays a superset silently. Every consumer in this codebase filters it
back down to what is askable; the one that forgot was an ad-hoc script, which is
exactly where that filter is easiest to leave out and hardest to notice missing.

**Amended.** The paragraph above reads the missing separation as a fault. Set
the two rubrics' prose side by side and it reads as nesting instead:
design-intent's failures are `useState` where a client bundle belongs, raw SVG
where `<Icon>` belongs, no Context/Provider seam, no `forwardRef`, an
`aria-expanded` that never updates; code-idiom's solo failures are a client file
in `js/`, a `ksd-` prefix, a missing token partial, `:root` instead of component
scoping, a hand-rolled `cx`. Both are conventions — there is no category here
that is "not idiom", which is why that search kept coming up empty. What
separates them is repair cost: the second list is fixed by moving a file or a
find-and-replace and the first is not. Read that way the pair is a ladder — fine,
needs editing, needs rewriting — and an empty `fail/pass` cell is the reading's
prediction rather than its refutation. One trial with design-intent failing
alone would refute it; Haiku is the test. The recommendation to set
`calibrated: false` is withdrawn until then.

Lesson (bp): two measurements that will not separate by subject may be separated
by consequence. Asking what a thing is about is not the only way to tell two
questions apart — asking what it costs to be wrong about it can work where
topic cannot, and here it is also the question the reader actually has.

**Amended again (D-137): the prediction is checked, and the vocabulary follows
it.** The reading above is post-hoc, and post-hoc readings survive by not being
looked at. `NESTED` in `rubrics.ts` names the pair, `checkNesting()` compares
cached verdicts on trials where **both** rubrics are askable, and `pnpm judge`
prints the outcome on every run including dry ones. A `design-intent: fail` with
`code-idiom: pass` prints the offending addresses and exits non-zero. It is a
claim now rather than an observation, and Haiku is still the test.

Two consequences fall out of it. `design-intent` declares `requires:
["component"]`, so the twelve `812-restyle-with-tokens` trials are out of scope
because the rubric says so rather than because one task's file set happened to
leave the material empty — free, since `buildPrompt` already returned `null`
there. And no diagnosis in `reasons.json` may be tagged both `design-intent` and
`code-idiom`: if the two are one axis, an entry sits at one end or the other.
`react-behaviour` moves to design-intent alone. Dual tags across _other_ pairs
stay, because those are genuinely different axes.

Lesson (bq): an invariant nobody has written a check for is a description of the
data you happened to look at. Encoding it costs a function and converts a story
into something that can be wrong.

**Amended once more (D-138): the criteria now say it, so the check no longer
tests it.** Both criteria were rewritten around repair cost — design-intent's
renaming test widened into the cost itself, code-idiom given the upper bound it
never had and stripped of "how props are threaded", a phrase that had it asking
about shape in direct contradiction of the other rubric. 108 calls, $3.40.

The consequence is worth stating plainly rather than leaving for someone to
notice. `checkNesting` was written to test whether the ladder is real. Once
code-idiom is told to ignore anything requiring a rewrite, an inversion is
near-impossible by construction, and the check becomes a test of whether the
rubrics obey their scoping. That is worth monitoring and is a different claim.
The evidence for the ladder is frozen at the pre-rewrite run — 48 comparable
trials, no inversion, under criteria that never mentioned cost — archived at
`results/judge-pre-d138.tar.gz`. It does not get stronger from here, and the
check should not be quoted as though it does.

Lesson (br): fixing an instrument invalidates the experiment that showed it was
broken. Write down what the old instrument measured before replacing it.

**Superseded (D-139): the ladder is refuted.** The paragraph above predicts the
check has become tautological. It fired on the first run anyway, once, and
cleanly: `cc-both/840-reuse-over-native/run-1`, failed by design-intent for
instantiating client behaviour in a `useEffect` instead of `define()` — "would
require rewriting the behaviour integration approach" — and passed by code-idiom
on naming, prefix, token partial, Context, `forwardRef` and stylesheet
organisation, with the one placement deviation explicitly excused as "a
reasonable organisational choice rather than a dialect violation". Conventionally
flawless, structurally foreign.

The subset relation was an artefact of the contamination it was inferred from.
Old code-idiom judged "how props are threaded" and cited Context/Provider in 4 of
its 11 solo failures; it was partly grading shape, so it failed wherever
design-intent failed. Confining each rubric to its own repair-cost band separated
them on the first run — which is the two independent measurements D-134 set out
to get.

The invariant is retired, not defended. `NESTED` → `PAIRED`, `checkNesting` →
`checkDivergence`, and the CLI reports the count and addresses instead of exiting
non-zero. "Competent but foreign" — clears every mechanical convention check,
still built wrong — is the case deterministic graders cannot reach and the reason
the judge exists, so it is worth printing for its own sake rather than as an
alarm. Currently 1 of 48.

Lesson (bs): a measurement that agrees with another may be agreeing about
something it was not supposed to be looking at. Separation is evidence of
independence only once both instruments have been confined to their own
question.

**Amended a fifth time (D-140): the pick list had to follow the criteria.**
Rewriting two criteria left the reason dictionary a human calibrates with
pointing at the previous version. `token-reasoning` was the casualty — three of
its four chips (`invented-tokens`, `hardcoded-fallbacks`, `wrong-token-prefix`)
asked about validity or naming, which its own criterion hands to the
deterministic graders in its second paragraph and `tokenConformance` genuinely
computes. The first two are removed and the third moves to `code-idiom`, leaving
the rubric one chip. `callback-props` gained `design-intent` (its criterion names
the diagnosis verbatim, and `api-design` is ungated and unaskable across the
suite, so it was previously unreachable), `open-variant` gained `api-design`, and
a `wrong-placement` chip was transcribed from the D-139 verdict.

The refusals matter as much: no replacement chips were invented for
`token-reasoning`, and no "missing companion file" chip was added, because both
would have been read out of a criterion rather than transcribed from something a
person wrote. A pick list derived from the rubric measures the rubric.

The list as it now stands, and the test each entry passes. For the
`design-intent`/`code-idiom` pair the test is repair cost: an objection that
survives renaming every identifier and moving every file is design-intent's,
and everything else is code-idiom's.

| Reason                   | Rubric(s)                 | Why it sits there                                                                                                                                                                             |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema-types`           | code-idiom, api-design    | Delete the hand-written interface, add an import. Spans two axes rather than two ends of one.                                                                                                 |
| `react-behaviour`        | design-intent             | Moving behaviour into the client bundle is a rewrite. Was tagged both; D-137 made it design-intent's alone, and D-139's inversion was this objection.                                         |
| `identifier-inline`      | code-idiom                | Delete a line, add an import.                                                                                                                                                                 |
| `wrong-filename`         | code-idiom                | A rename.                                                                                                                                                                                     |
| `wrong-placement`        | code-idiom                | A move. Added D-140 from the D-139 verdict — `wrong-filename` covers what a file is called, not where it was put.                                                                             |
| `tokens-inline`          | code-idiom                | "Adding a missing file alongside the ones that are there" — named in design-intent's criterion as explicitly _not_ its business.                                                              |
| `no-component-tokens`    | token-reasoning           | Which layer a value was taken from. The only surviving chip that asks about choice rather than validity.                                                                                      |
| `wrong-prefix`           | code-idiom                | Find-and-replace.                                                                                                                                                                             |
| `no-defaults`            | code-idiom                | An import and a line.                                                                                                                                                                         |
| `inline-classnames`      | code-idiom                | Delete, import.                                                                                                                                                                               |
| `callback-props`         | design-intent, api-design | "Behaviour threaded through props where the references keep it in the client bundle" — design-intent's criterion, verbatim. Gained that tag in D-140; `api-design` alone left it unreachable. |
| `wrong-token-prefix`     | code-idiom                | `wrong-prefix`'s twin. Retagged from `token-reasoning` in D-140 — it was filed under tokens for having "token" in the name.                                                                   |
| `reimplements-primitive` | design-intent             | Composing instead of re-implementing is a rewrite.                                                                                                                                            |
| `not-overridable`        | design-intent             | code-idiom's criterion now ships "whether consumers can substitute it" here explicitly.                                                                                                       |
| `monolithic`             | design-intent             | Decomposition is a rewrite.                                                                                                                                                                   |
| `open-variant`           | design-intent, api-design | Both criteria name closed variant sets; gained `api-design` in D-140.                                                                                                                         |
| `no-forward-ref`         | design-intent             | code-idiom's criterion explicitly excludes ref-forwarding.                                                                                                                                    |
| `styling-props`          | design-intent, api-design | Both criteria name it.                                                                                                                                                                        |
| `wrong-kind`             | design-intent             | "The kind of component the brief called for at all."                                                                                                                                          |

Two entries were also reworded because they contained commas, which the file
forbids — notes from several raters are joined with `", "` when rendered.
`no-forward-ref` and `styling-props`, both added in D-136. Labels are not
hashed, so this costs nothing; the point is that a rule stated in a doc comment
and obeyed by everything written before it was quietly broken by what came
after, which is the same shape as D-139's display bug.

Lesson (bt): fixing an instrument silently invalidates whatever was calibrated
against it. The criteria and the pick list are one artefact split across two
files with nothing linking them, and the split held a stale version for two
sessions without complaint.

### Amendment to ADR 90 (verified 2026-09-04)

The corpus held one client file, `Gallery.client.js`, flat — and the design
system puts eight there and five under `js/`. `roles()` could spell only the
first, so it dropped the second silently. The judge generalised the single
sample into a rule and objected to `js/` placement in eight of its ten
`code-idiom` false failures.

Repairing the evidence rather than the criterion worked, and cost exactly what
it gained. `code-idiom` rose 73% → 82% (κ 0.41 → 0.65) and the `js/` cluster
disappeared. `design-intent` fell 87% → 74% (κ 0.75 → 0.49), its false passes
doubling, with the judge citing the new exemplar as licence — _"like NavToggle
does"_. Overall agreement was 106/141 before and 106/141 after.

ADR 90 separated the two rubrics by what each is **asked**. It did not separate
them by what each is **shown**, and they still share one corpus. That corpus is
therefore a single control with opposite signs on the two rubrics, and no
setting of it improves both. Per-rubric corpora are the available fix, but
choosing one by which score improves is fitting to the labels, so the decision
has to be argued from what each rubric is for.

Lesson (bv): shared evidence is a shared control surface.

## ADR 91 — the graders match the judge, because nobody ever asked a judgment question

**Context.** Two verified confabulations — one per instrument, on the same
predicate — showed the agreement rate was never judge accuracy, only agreement
between two fallible raters. Both were checkable by `grep`. That prompted a
sweep of all 141 labels against the deterministic grader check ids, to find
which labels were mispriced.

It found none, and something worse. Every chip in use maps onto a grader:
`code-idiom`'s seven chips (84 uses) onto `component-contract`,
`authoring-seams`, `bem` and `style-placement`; `design-intent`'s four (39
uses, 33 of them onto `purity`, which had been grading them all along);
`token-reasoning`'s four onto `token-conformance`. The five judgment-shaped
chips were never used once. The twenty-one free-text notes are mechanical in
every clause. Five fails carry no justification at all.

**Decision.** Measure the graders against the human directly, with an unfitted
rule — every applicable check perfect, or fail. Result: **78% overall against
the judge's 75%**, at zero marginal cost. `design-intent` 95% against the
judge's 74%; `token-reasoning` 77% against 69%; `code-idiom` 65% against 82%,
its weakness an artefact of aggregating four graders under all-must-pass.
Twenty-nine of thirty-one misses run `human=pass, graders=fail` — the rule is
too strict, not wrong.

**Consequences.** The LLM judge is not currently measuring anything the graders
cannot, and three rounds of criterion and corpus work were spent tuning an
instrument against labels whose every stated reason was mechanical. The honest
reading is not that judgment is unnecessary; it is that **this eval set never
poses a judgment question.** `810`, `812`, `832`, `840` and `860` are
conformance tasks, and conformance is what a grader is for. `824-api-from-
behaviour` — built under ADR 75 precisely to leave the API open — has never run,
and is the only place the five unused chips could have been earned.

So the next money goes to `824`, not to a fourth re-judge. A rubric earns its
per-call price by answering something no check can, and that has to be
demonstrated on a task that asks one.

Lesson (by): check what a rater actually said, not what the rubric claims to
ask. A pick list of mechanical chips makes every rater mechanical.

### Amendment to ADR 91 (verified 2026-09-04)

ADR 91 concluded that the graders match the judge because nobody had ever asked
the judge a judgment question, and left one escape open: a rubric might still
earn its per-call price by answering something no check can. `api-design` looked
like that rubric. Its 48 stored verdicts were the only judge output in the
corpus whose objections no grader could reach — schema-to-props contract
divergence, not spelling.

The escape is closed, and not by argument.

`api-design` produces zero calibration candidates: `requires: ["schema"]`, and
no fixture lets the agent author a schema. The 48 verdicts predate that gate. A
new deterministic grader, `schema-conformance`, was built to take over the
checkable part of the question and scored 1.00 on all 67 design-system
components and all 36 applicable trials — which made it a usable oracle for the
verdicts themselves. All four of the strongest fossil objections were checked
against the schema the judge had been shown in its own prompt, and all four were
fabrications, each inverted in the direction of an objection: a property that
does not exist, a nesting that is already flat, a rename where the component in
fact conformed, and a `format` the schema does not declare.

So the one rubric that looked like it was buying something no check could buy
was buying fiction. Combined with the retirement of `token-reasoning` — one
usable verdict in 60 calls, and 0-of-1 self-consistency on identical code — the
judge is down to a single scored rubric, `code-idiom`, on which it does beat the
graders (80% vs 65%). That is now the whole of its demonstrated value.

ADR 91's ordering stands and its cost argument strengthens. The remaining test
is unchanged and still unrun: `824-api-from-behaviour` is the only task that
leaves the API open, and it is the only condition under which `api-design` has
ever been designed to produce material honestly. Nothing in the Phase 1 stores
should be read as evidence about it.

Lesson (cc): a judge fabricates most fluently about the artefact it has been
shown, because that is where it has the vocabulary to be specific.
Confabulation looks like detail — and it is checkable, which is the argument for
building the grader before believing the verdict.

## ADR 92 — MCP tools are loaded upfront, because availability has stages

**Context.** Twenty-four Haiku trials across all four arms produced identical
results, and a `tool_use` census found zero MCP calls in every one of them. The
servers connected, the probe passed, the tool names reached the model, and
`setup-check` was green. Nothing in the harness was broken.

Line 4 of every transcript in the corpus — Haiku and Sonnet alike — is a
`deferred_tools_delta` attachment listing the MCP tools by name. Claude Code
defers MCP tools by default (`ENABLE_TOOL_SEARCH` unset); the model receives
names, not definitions, and must call `ToolSearch` to load one before it can
call it. Across all 84 trials the search is the gate: where it fires, MCP calls
follow (18→15, 21→17, 18→15 by arm); where it does not, they never do. Haiku
searched zero times. Sonnet searched in roughly 60% of its MCP-arm trials, which
means the other 40% were baselines wearing an MCP label.

**Decision.** `setupVariant()` sets `ENABLE_TOOL_SEARCH=false` in
`.claude/settings.local.json`, the same file whose `enableAllProjectMcpServers`
flag is already proven to take effect there. `SETUP_VERSION` moves to
`7-tools-upfront` and the regime is a named part of the variant-version hash, so
the two regimes cannot be pooled by accident. `EVAL_TOOL_SEARCH=1` restores
deferral for anyone who wants to ask that question on purpose.

Confirmed on `810-atom-from-schema`, `cc-component-builder-haiku`: 0/3 → 3/3,
quality 0.97–0.99, 2/1/5 MCP calls per trial, `deferred_tools_delta` gone,
$1.51. The first honest measurement of MCP value in the campaign.

**Consequences.** Every MCP-versus-baseline delta measured before this is
withdrawn (D-150). The 84 deferred trials are not discarded — they are a valid
measurement of tool *discovery*, and the two regimes now answer different
questions: does the server's content help, versus will a model find a server
nobody pointed it at. The second is arguably closer to a real user's experience
and cannot be the default for a drift gate, because Claude Code gates the
*reminder* to search behind remote feature flags — whether a model searches is
partly a server-side setting that can change between runs.

`mcpToolsWereDeferred()` reads the attachment directly and `collect.ts`
distinguishes "never called" from "never callable" in the confound reason, so a
setting that silently stops applying announces itself instead of producing
another campaign of mislabelled baselines.

Lesson (ck): a tool the model can see the name of is not a tool it can call.
Availability has stages, and a harness that verifies only the earliest — server
connects, names arrive — will certify an arm that cannot work.

Lesson (cl): the mechanism was in our own source the whole time. `mcp-usage.ts`
described ToolSearch in prose months before this analysis, and a `grep` surfaced
that comment while hunting for the cause and it was read as an aside. Search the
codebase's explanations, not just its identifiers.

## ADR 93 — Token accounting is recomputed host-side, per message

**Context.** The sandbox writes `agent-transcript-meta.json` alongside each
transcript, and the report priced trials from its `tokens` field. Claude Code
writes one JSONL line per content block, and every line of a message repeats
that message's `usage`, so the summariser's line-by-line addition over-counted
by however many blocks a message contained. Measured: $3.28 reported against a
$1.51 invoice on three trials, and 98 transcript lines across 50 messages.

D-147 diagnosed this mechanism correctly and fixed it in `bin/cost.ts` alone.
The report — the path producing every USD/task and turn figure the PRD quotes —
kept the uncorrected sum for three more campaigns.

**Decision.** Tokens and turns are recomputed in `lib/graders/efficiency.ts`
from the raw transcript, deduplicated on `message.id`, and the sandbox
summariser's values for those two fields are ignored.

Host-side, not in the sandbox, because grading is retroactive and free
(Decision 17 / D-50): every trial already paid for is repriced with no re-run.
Correcting the summariser would have fixed only trials not yet bought, and left
the corpus permanently un-comparable across the fix.

`toolCalls` is explicitly exempt. With one block per line, the per-line count is
already correct, and applying the same deduplication to it reads 49 tool calls
as 3. Two quantities in one file, requiring opposite treatment — the exemption
is load-bearing and documented at the function.

**Consequences.** All historical cost and turn figures are superseded; the
corpus is internally consistent because grading is retroactive. The error was
proportional to tool-call volume, so it fell hardest on MCP arms, biasing every
prior cost comparison against the treatment. The sandbox summariser still
over-counts and is now the *unused* value for these two fields — a stale
producer left in place, which is the shape of trap Decision 92's price table
described. It is tolerated only because the host-side path is the one anything
reads.

Lesson (cp): fixing a bug in one instrument is not fixing the bug. The question
after any measurement correction is "what else reads this?", asked with `grep`
rather than from memory.

Lesson (cq): check the direction of a measurement error before deciding it is
small. An inflation that lands preferentially on the treatment arm is a thumb on
the scale, not noise.

