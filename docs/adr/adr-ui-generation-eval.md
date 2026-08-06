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

**Chosen:** full matrix runs are label-gated (`ci:eval`, `ci:extra-models`) or manually dispatched — never auto-triggered on push. A hard **$25/run** budget guardrail aborts the run. `pnpm eval:dry` prints the projected task × variant × run plan and estimated spend before anything executes. A nightly single-variant regression run acts as the cheap drift tripwire.

**Rationale:** matrix × tasks × runs multiplies fast, and an eval loop that quietly bills against every push will be deleted rather than fixed. Storybook operates a broader suite at ~$30–45/run with a $75 cap; $25 is a deliberately tight starting point for our narrower 4-variant matrix, to be revisited once P1 produces real per-trial costs.

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

- `captureGeneratedFiles()` runs *after* validation and collects via `git add . && git diff HEAD --name-status`, so untracked files written by `EVAL.ts` are picked up and land in `run-N/project/`. This satisfies G4 (static inspectable artifacts) and the explicit requirement that every run keep its transcript of communication.
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

Closing the web also changed what the baseline *is*: mean duration fell from
647.1s to 310.7s and output quality dropped (plain `.css`, no `{Name}Component`
suffix in any trial). The pre-deny runs were partly measuring retrieval of our
own published source, so they are superseded and should not be cited as
baseline.
