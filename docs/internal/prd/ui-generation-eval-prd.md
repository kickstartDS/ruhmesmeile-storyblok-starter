# PRD: UI Generation Eval Loop (`packages/agent-eval`)

**Version:** 1.0
**Date:** 2026-08-06
**Status:** Draft
**Inspired by:**

- [vercel-labs/agent-eval](https://github.com/vercel-labs/agent-eval) — harness foundation (sandboxing, fingerprinting, transcripts, agentic judge, playground)
- [storybookjs/mcp @ `agentic-reference-eval` → `agent-eval/`](https://github.com/storybookjs/mcp/tree/agentic-reference-eval/agent-eval) — experiment matrix conventions, `#test-utils` assertion layer, label-gated CI spend, cost guardrails
- [storybookjs/mcp @ `main` → `eval/`](https://github.com/storybookjs/mcp/tree/main/eval) — the artifact model we want back: per-trial `project/`, `results/`, and a **run report rendered as stories inside the trial's own Storybook**
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — vocabulary (task / trial / grader / transcript / outcome), grader taxonomy, capability vs. regression suites, `pass@k` vs. `pass^k`

---

## 1. Context & Motivation

### 1.1 Where we are today

We ship two read/query MCP servers whose entire purpose is to make an AI agent better at producing kickstartDS UI:

| Server                                                            | Surface                          | Claim we make                                                           |
| ----------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| [Component Builder MCP](../../../packages/component-builder-mcp/) | 7 read-only tools, 3 resources   | Agents produce components that match the kickstartDS component contract |
| [Design Tokens MCP](../../../packages/design-tokens-mcp/)         | 29 tools, 4 resources, 3 prompts | Agents style with the correct token layer instead of hardcoding values  |

On top of that we ship `.github/copilot-instructions.md`, a Storybook docs MCP, and a large body of conventions (pure components, no React state, BEM + token layers, JSON Schema as source of truth, styles in `index.scss`).

**We have zero evidence for any of these claims.** Every improvement to the MCP servers today is justified by intuition and anecdote. We cannot answer:

- Does the Component Builder MCP actually raise output quality versus a well-written instructions file?
- Do 29 Design Tokens MCP tools pay for the context they consume — or would 5 tools score the same for a third of the tokens?
- Is a model upgrade a regression for us, even though it is an improvement in general?
- Did last week's tool-description rewrite help, hurt, or do nothing?

### 1.2 The gap

Two gaps, and they are different problems:

1. **Attribution gap** — we cannot isolate the contribution of a single MCP server. We need a controlled matrix: baseline (no MCP) × each MCP alone × both together, holding agent, model, prompt, and fixture constant.
2. **Drift gap** — agent output quality moves under us without any commit in this repository. Model providers ship silent updates; agent CLIs change their harness; our own tool descriptions get edited. We need a **repeatable quality gate** that fails loudly when the design system's generated-UI quality regresses.

There is also an **inspection gap**. Numeric pass rates are not enough for a design system. A component can typecheck, lint, build, and still be wrong: wrong token layer, wrong BEM structure, React state smuggled in, a native `<button>` instead of our `Button`, an a11y trap. Somebody has to _look_ at the thing. The old Storybook eval harness solved this exactly right — every trial kept its full generated project and rendered its own report (summary, transcript, build/typecheck/lint output, source) as stories in a Storybook you could just open. We want that back, on top of a modern harness.

### 1.3 What this PRD proposes

A new private workspace package, `packages/agent-eval`, that:

- wraps **`@vercel/agent-eval`** as the execution harness (sandbox, run isolation, result fingerprinting, failure classification, transcript o11y, agentic LLM judge, results playground);
- adds a **kickstartDS layer** on top: design-system fixtures, an `#assertions` module encoding our component contract and token architecture, and MCP-variant experiment configs;
- measures every run across four dimensions — **quality, cost, time, efficiency** — and reports each MCP combination as a _delta against the no-MCP baseline_;
- persists **every run as a static, browsable artifact**: the generated `project/`, a built Storybook containing both the generated component **and** the run report as stories, plus `summary.json`, transcripts, and raw grader output;
- runs as a **label-gated CI quality gate** with an explicit per-run budget ceiling and a stored baseline to detect drift.

---

## 2. Goals

| #   | Goal                                                                                                                     | Success Metric                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Attribute quality to a specific MCP.** Isolate the effect of each MCP server on generated UI quality.                  | For a fixed agent+model, the report states `Δ pass@1`, `Δ quality score` and a confidence interval for each of the 4 MCP variants vs. baseline.                                                            |
| G2  | **Price the MCPs.** Know what each MCP costs in money, latency, and context.                                             | Per variant: USD/task, wall-clock, API time, turns, total tool calls, and **MCP output tokens injected into context**; plus derived **cost-per-passing-run**.                                              |
| G3  | **Enforce a quality gate against drift.** Detect regressions in generated-UI quality that originate outside our commits. | A `regression` suite with pinned thresholds; `agent-eval status --check` exits non-zero on a drop of >1 pass-rate step vs. the stored baseline.                                                            |
| G4  | **Make every run inspectable, statically.**                                                                              | For any historical run, a reviewer opens one static URL and sees the generated component rendered in Storybook, the run summary, the full transcript, and all grader output — without re-running anything. |
| G5  | **Grade the design-system contract, not just "does it compile".**                                                        | ≥8 deterministic graders covering file structure, purity (no React state), token-layer conformance, schema validity, BEM, a11y, and DS-component reuse.                                                    |
| G6  | **Keep spend predictable and human-authorized.**                                                                         | Full-matrix runs are label-gated in CI, never auto-triggered; a hard per-run budget ceiling aborts the run; `--dry` cost estimate is printed before spend.                                                 |
| G7  | **Guide MCP development.** Turn eval results into a work queue.                                                          | Each release of `component-builder-mcp` / `design-tokens-mcp` links to an eval run showing the intended metric moved.                                                                                      |

---

## 3. Non-Goals

- **Content-quality evals for `storyblok-mcp`.** Explicitly out of scope for v1 — see §11 (Phase 5). The package layout must not preclude it, but no tasks, graders, or fixtures for content generation ship in v1.
- **Production monitoring / online eval.** This grades offline, seeded tasks. It is not telemetry on real editor sessions.
- **Human-study infrastructure.** No annotation UI, no inter-rater agreement tooling. We calibrate the LLM judge against a small hand-graded set manually (§7.3) and stop there.
- **Benchmarking foundation models in general.** We measure _our_ design system's UI-generation task. A model that loses here may be excellent elsewhere; we do not publish general leaderboards.
- **Pixel-perfect visual regression.** Chromatic already covers the design system's own components. Generated components get screenshots as _review artifacts_, not as diff-gated assertions (v1).
- **Replacing `.github/copilot-instructions.md`.** Instructions remain how we guide agents in this repository. They are simply held _out_ of the eval environment (D14) so that what we measure is the MCP servers' built-in capability, not our local setup.
- **Publishing to npm.** `packages/agent-eval` is `private: true`, excluded from Changesets releases.

---

## 4. Vocabulary

We adopt Anthropic's vocabulary verbatim so that discussion, code, and reports agree.

| Term            | Meaning here                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Task**        | One unit of work given to the agent, e.g. "build a `Testimonial` component". Lives in `evals/<nnn-name>/PROMPT.md`.       |
| **Trial / Run** | One execution of one task under one variant. `runs: N` in the experiment config produces N trials.                        |
| **Variant**     | A combination of agent, model, reasoning effort, and **MCP set**. Encoded as one file in `experiments/`.                  |
| **Grader**      | Anything that turns a trial into a score. Deterministic, transcript-based, or model-based (§7).                           |
| **Assertion**   | A single check inside a grader. Ours live in `lib/assertions/` and are exposed to `EVAL.ts` via the `#assertions` import. |
| **Transcript**  | The full agent conversation + tool calls, persisted per trial.                                                            |
| **Outcome**     | The trial's pass/fail plus its four-dimension metric bundle.                                                              |
| **Suite**       | `capability` (hard, expected to fail initially) or `regression` (graduated, expected to pass, gates CI).                  |

Scoring conventions:

- **`pass@1`** — headline quality number. Fraction of trials that pass.
- **`pass^k`** — consistency bar. Fraction of tasks where _all_ k trials pass. Reported for the regression suite; this is what a quality gate actually cares about.
- **Quality score `0..1`** — weighted composite with partial credit (§7.4). A binary pass hides that variant A missed one lint rule while variant B produced unusable output.

---

## 5. Package Design

### 5.1 Location and naming

```
packages/agent-eval/          # private: true, not published
```

Auto-discovered by the `packages/*` glob in `pnpm-workspace.yaml` — no workspace config change needed.

### 5.2 Layout

Mirrors the `@vercel/agent-eval` convention (`evals/`, `experiments/`, `results/`) plus a kickstartDS layer, following the structure the Storybook `agent-eval` package uses on `agentic-reference-eval`.

```
packages/agent-eval/
  package.json                     # private, scripts: eval, eval:dry, playground, report, results:download
  agent-eval.config.ts             # shared defaults (timeout, sandbox, copyFiles, judge model pin)
  README.md

  evals/                           # the task suite (§6)
    810-atom-from-schema/
      PROMPT.md                    # the task, verbatim, given to the agent
      EVAL.tsx                     # assertions (vitest + #assertions + @vercel/agent-eval/eval)
      package.json                 # fixture deps for this eval
      src/                         # seed files the agent starts from
      REFERENCE/                   # optional hand-built "gold" implementation, never shown to the agent
    820-restyle-with-tokens/
    830-extend-existing-component/
    ...

  experiments/                     # the variant matrix (§6.2) — FLAT, no subdirectories
    cc-none-sonnet-high.ts
    cc-cb-sonnet-high.ts
    cc-dt-sonnet-high.ts
    cc-both-sonnet-high.ts
    ...

  lib/
    experiment.ts                  # defineExperiment() — builds ExperimentConfig from a variant descriptor
    mcp/
      variants.ts                  # MCP_VARIANTS: none | component-builder | design-tokens | both
      stage.ts                     # reads built MCP packages, vendors workspace deps, hashes the payload
    assertions/                    # #assertions — the kickstartDS contract (§7.1)
      component-contract.ts
      purity.ts
      token-conformance.ts
      schema-validity.ts
      bem.ts
      ds-reuse.ts
      a11y.ts
      mcp-usage.ts                 # transcript-based
      quality.ts                   # weighted composite scoring
    report/
      collect.ts                   # trial -> normalized Outcome record
      metrics.ts                   # quality / cost / time / efficiency aggregation, baseline deltas
      build-report-storybook.ts    # §8 — the static artifact builder
    fixtures/
      design-system/               # the project template the agent works in (§5.3)

  templates/
    report-docs/                   # stories that render the run report itself (§8.2)
      Summary.stories.tsx
      Conversation.stories.tsx
      Graders.stories.tsx
      Source.stories.tsx

  results/                         # per-run artifacts, git-ignored, published as static site (§8)
  baselines/                       # committed pinned thresholds for the regression gate (§9)
```

### 5.3 The fixture

Every trial starts from a **fixture project**, not from a checkout of this monorepo. Rationale: trial isolation (Anthropic: agents cheat via leftover state — a `git log` of the real repo would leak the answer), reproducibility, and sandbox size.

The fixture is a minimal kickstartDS consumer:

- `@kickstartds/design-system` installed **from npm at the exact version in the workspace** (`packages/design-system/package.json`), so the fixture stays in lockstep with the tokens the Design Tokens MCP was synced from;
- a Storybook 10 setup with the design system's token CSS loaded;
- `tsconfig`, ESLint, Stylelint configured exactly as the design system configures them;
- a handful of pre-existing components so "extend an existing component" tasks are realistic;
- **no `.github/copilot-instructions.md`, no `AGENTS.md`, no `.cursorrules`, no repo-local agent configuration of any kind** (D14). The fixture is deliberately context-free: everything the agent knows about kickstartDS must arrive through the MCP servers under test, or not at all.

A `fixture-hygiene` check runs at config load and fails the run if any agent-instruction file is present in a fixture — this is the single easiest way to silently invalidate the whole comparison.

The design-system dependency is only introduced once tasks need to compile against it (P1); the P0 fixture is React + TypeScript only, to keep the first end-to-end run cheap.

### 5.4 Harness configuration defaults

```ts
// agent-eval.config.ts (shape, not final)
export const DEFAULTS = {
  timeout: 900, // 15 min — component tasks are smaller than Storybook's, but MCP roundtrips add up
  sandbox: "docker", // Docker everywhere, local and CI — no Vercel account required (D4)
  copyFiles: "all", // MANDATORY — G4 depends on the full project snapshot
  validation: "vitest",
  scripts: [], // post-run scripts disabled; validation happens inside EVAL.ts
  earlyExit: false, // framework default is TRUE — must be overridden or multi-run stats collapse
  runs: 3, // default; regression suite raises to 5 for pass^k
  judge: { model: "<pinned>" }, // pinned; see §7.3
};
```

Three decisions, two inherited from Storybook's `agent-eval` experience and one forced by the framework's defaults:

- **Post-run `scripts` are disabled by default.** Sandbox flakiness produced more failures than agent mistakes. Build/typecheck/lint are executed from inside `EVAL.ts` via our own assertion helpers, so a tooling hiccup is distinguishable from an agent error.
- **`earlyExit` must be explicitly `false`.** The framework defaults it to `true`, which stops an experiment after the first passing run. Left at the default, every multi-run experiment silently degrades to pass@1-with-retries and `pass^k` becomes unmeasurable.
- **`setup()` and `editPrompt()` are not fingerprinted.** Our MCP wiring lives in `setup()`, so _any_ change to the staged MCP build is invisible to the framework's reuse logic. We compensate with a computed variant-version guard — see §9 and ADR Decision 9.

One consequence of running on direct provider keys instead of the Vercel AI Gateway (D3): **`@vercel/agent-eval`'s automatic failure classification (`model` / `infra` / `timeout`) is unavailable**, since it requires `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`. We therefore own failure triage ourselves — see §7.5.

---

## 6. The Experiment Matrix

### 6.1 What varies, and one variable at a time

| Axis                 | v1 values                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| **MCP set**          | `none` · `component-builder` · `design-tokens` · `both`                  |
| **Agent**            | Claude Code (`cc`) primary; Codex (`codex`) secondary                    |
| **Model**            | one primary per agent, pinned; `EVAL_EXTRA_MODELS=1` opens the wider set |
| **Reasoning effort** | `high` primary; `medium` behind the extra-models flag                    |

**Instructions are not an axis — they are excluded outright (D14).** No `copilot-instructions.md` or equivalent enters the sandbox in any variant. Consumers of our design system have wildly different local setups; folding ours into the measurement would mean the numbers describe _our repository_ rather than the MCP servers. The `none` baseline is therefore a genuinely context-free agent, and every point of lift is attributable to an MCP server.

The practical consequence: **baseline scores will look bad**, and they should. The interesting quantity is the gap, not the floor.

Experiments are named `<agent>-<mcpset>-<model>-<effort>`, e.g. `cc-both-sonnet-high`, `codex-none-gpt-x-medium` — the Storybook convention, which makes results directories self-describing.

The **core matrix** (always run) is 4 MCP sets × 1 agent × 1 model = 4 experiments. Everything else is opt-in via env flags (`EVAL_EXTRA_MODELS=1`, `EVAL_ONLY=<name>`), because the cost of a full crossing grows multiplicatively.

### 6.2 MCP wiring

`lib/mcp/variants.ts` maps a variant key to the MCP servers staged into the sandbox by `setup(sandbox)`:

```
none              -> {}
component-builder -> { component-builder: node .mcp-servers/component-builder/dist/index.js }
design-tokens     -> { design-tokens:     node .mcp-servers/design-tokens/dist/index.js }
both              -> both of the above
```

The `claude-code` adapter takes no MCP flag, so wiring goes through the files Claude Code reads from the project root: `setup()` writes a `.mcp.json` naming each server, plus a `.claude/settings.local.json` containing `enableAllProjectMcpServers: true` — without which project-scoped servers sit behind an interactive approval prompt that a `--print` run can never answer.

Servers are staged from the **built workspace packages**, uploaded file-by-file (`Sandbox.writeFiles()` accepts only UTF-8 strings, so a packed tarball is not an option) and installed with `npm install --omit=dev` inside the sandbox. Workspace-protocol dependencies — currently `@kickstartds/shared-auth` — exist on no registry, so they are vendored under `.mcp-servers/_vendor/` and referenced as `file:` dependencies, resolved recursively.

MCP servers therefore run **over stdio from a workspace build**, not against the deployed HTTP endpoints. This keeps trials hermetic, removes JWT/network flakiness from the measurement, and — critically — means an eval run tests _the code in the current commit_, which is what a quality gate needs. A `-hosted` variant covering the deployed HTTP surface (incl. JWT auth) is deferred (D8).

### 6.3 Reported deltas

The report's headline table, per task and aggregated:

| Variant             | pass@1 | pass^3 | Quality | USD/task | Wall-clock | Turns | Tool calls | MCP ctx tokens |
| ------------------- | ------ | ------ | ------- | -------- | ---------- | ----- | ---------- | -------------- |
| `none` (baseline)   | —      | —      | —       | —        | —          | —     | —          | 0              |
| `component-builder` | Δ      | Δ      | Δ       | Δ        | Δ          | Δ     | Δ          | abs            |
| `design-tokens`     | Δ      | Δ      | Δ       | Δ        | Δ          | Δ     | Δ          | abs            |
| `both`              | Δ      | Δ      | Δ       | Δ        | Δ          | Δ     | Δ          | abs            |

Plus two derived numbers that are the actual decision-support output:

- **Cost-to-success** = total USD ÷ passing trials. A variant that passes more often but costs 3× may still be worse.
- **MCP lift ratio** = `Δ quality ÷ (Δ USD normalized)`. Answers "is this server worth its context".

---

## 7. Graders

Following Anthropic's taxonomy, three grader families. Deterministic first — cheap, stable, and the majority of our contract is mechanically checkable.

### 7.1 Deterministic graders (`lib/assertions/`)

| Grader                         | Checks                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component-contract`           | All four files present and correctly named: `{Name}Component.tsx`, `{Name}Component.scss`, `{Name}Component.client.ts` (when behavior is required), `{name}.schema.json`.                                                                                              |
| `purity`                       | No `useState` / `useReducer` / `useEffect`-driven local state in the component; `forwardRef` present; Context-overridable pattern used.                                                                                                                                |
| `token-conformance`            | SCSS uses only known `--ks-brand-*` / `--ks-*` / `--dsa-*` custom properties (validated against the design system's extracted token list); no hardcoded hex, rgb, or raw px where a token exists; component tokens reference semantic tokens, never branding directly. |
| `schema-validity`              | `{name}.schema.json` is valid JSON Schema, dereferences, generates TS props without error, and uses specific property names (rejects generic `items`, `data`, `content`).                                                                                              |
| `bem`                          | Class names follow BEM and are namespaced to the component; no bare element selectors leaking outside the block.                                                                                                                                                       |
| `ds-reuse`                     | Native `<button>`, `<input>`, `<select>`, etc. are not hand-rolled where a kickstartDS component exists; imports resolve to `@kickstartds/design-system`.                                                                                                              |
| `style-placement`              | Component does not import its own SCSS/CSS; styles registered in the fixture's `index.scss`.                                                                                                                                                                           |
| `build` / `typecheck` / `lint` | Fixture builds, `tsc` reports 0 errors, ESLint + Stylelint report 0 errors.                                                                                                                                                                                            |
| `stories`                      | A Storybook story exists, renders, and its play function (if any) passes.                                                                                                                                                                                              |
| `a11y`                         | axe reports 0 critical/serious violations on the rendered story.                                                                                                                                                                                                       |

Each returns `{ passed, score, details }` so partial credit is available.

### 7.2 Transcript-based graders

Read from `project/agent-transcript.jsonl` and its pre-derived companion
`project/agent-transcript-meta.json`, which `EVAL.ts` writes in-sandbox (§8.1,
ADR Decision 15). The meta file already carries `observedModel`,
`assistantMessages`, token totals split by input / output / cache-read /
cache-write, a full `toolCalls` histogram, and the `mcp__*` subset with a count —
so graders do not re-parse ~800 KB of JSONL per trial. Anything richer
(`filesRead`, `shellCommands`, self-correction loops, error signatures) is
derived host-side from the raw JSONL.

> `@vercel/agent-eval`'s own o11y bundle is deliberately **not** the source of
> truth here: it is populated only when upstream's single-path transcript capture
> succeeds, and it did not on the first real run.

| Grader           | Checks                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp-usage`      | Which MCP tools were called, how often, in what order. Was `get-ui-building-instructions` called _first_? Was the token MCP consulted before writing SCSS? |
| `mcp-context`    | Total tokens returned by MCP tool calls — the context price of the server.                                                                                 |
| `efficiency`     | Turns, shell commands, files read, self-correction loops (repeat edits to the same file), error count.                                                     |
| `negative-usage` | For `none` variants: assert the agent did **not** somehow reach an MCP (guards against config leakage between variants).                                   |

`mcp-usage` is diagnostic, not gating, on capability tasks — Anthropic's "grade the product, not the path". It _is_ gating on a small number of dedicated tool-invocation tasks where calling the tool is the point.

### 7.3 Model-based grader (LLM judge)

Via `@vercel/agent-eval`'s agentic judge (`toSatisfyCriterion`, `toScoreAtLeast`).

Rules:

- **One isolated judge call per rubric dimension.** Dimensions: _design intent_ (does it look like a kickstartDS component), _token-layer reasoning_ (are the chosen tokens semantically right, not merely valid), _API design_ (is the schema a sensible public API), _code idiom_ (does it read like the rest of the design system).
- **The judge model is pinned** in `agent-eval.config.ts`. Comparing MCP variants while the judge drifts is meaningless. Changing the pin invalidates fingerprints and must be a deliberate, changelog-worthy act.
- **Judges get an "Unknown" escape hatch** and are instructed to use it rather than guess.
- **Never `.not.toSatisfyCriterion`.** Negative checks use the deterministic `toContainText` form.
- **Calibration:** before the judge counts toward a gate, ≥20 hand-graded trials must show ≥80% agreement with human grading. Calibration set lives in `evals/*/REFERENCE/` and is re-checked whenever the judge pin changes.

### 7.4 Composite quality score

```
quality = 0.40 * deterministic_contract   (contract, purity, token, schema, bem, ds-reuse, placement)
        + 0.25 * toolchain                (build, typecheck, lint)
        + 0.20 * runtime                  (stories render, play fns, a11y)
        + 0.15 * judge                    (mean of pinned rubric dimensions)
```

Weights are declared in `lib/assertions/quality.ts`, versioned, and printed in every report — a score is only comparable within one weighting version.

### 7.5 Failure triage (replacing gateway classification)

Because we run on direct provider keys, the harness cannot tell us whether a failed trial was the model's fault. `lib/report/collect.ts` implements a local classifier:

- **`timeout`** — the trial hit the configured `timeout` with no terminal agent message.
- **`infra`** — the transcript carries provider/network/sandbox error signatures (rate limit, 5xx, connection reset, image pull failure, MCP server failed to start), or the fixture failed to install before the agent's first turn.
- **`model`** — everything else: the agent finished and the graders failed it.

Only `model` failures count toward pass rates and the quality gate. `infra` and `timeout` trials are retried once, then reported as excluded-with-reason rather than silently dropped. A run where >20% of trials classify as non-`model` is marked **invalid** and may not update any baseline.

---

## 8. Static Artifacts (G4)

This is the requirement that most differentiates us from stock `@vercel/agent-eval`, and it is a hard requirement, not a nice-to-have.

### 8.1 What every trial persists

```
results/
  index.html                     # the results site root (bin/report-index.ts)
  <experiment>/
    .pinned                      # optional: timestamps prune must never touch
    <timestamp>/<eval>/
      summary.json               # from agent-eval: passRate, meanDuration, fingerprint, classification
      run-1/
        result.json
        outputs/
          eval.txt               # vitest output for this trial
        project/                 # complete generated project (copyFiles: 'all')
          .mcp.json                    # the MCP set this arm was given
          agent-transcript.jsonl       # raw agent transcript (captured by EVAL.ts)
          agent-transcript-meta.json   # tokens, tool-call histogram, mcp__* subset
        report-manifest.json     # ← written by `report build`
        storybook-static/        # ← built, browsable Storybook for THIS trial
        screenshots/             # ← story screenshots (review artifacts, not diff-gated)
      run-2/ ...
```

> **Everything below `report-manifest.json` is derived, not paid for.** The
> harness writes `summary.json`, `result.json`, `outputs/` and `project/`; the
> last three entries are produced afterwards by `pnpm report build` and can be
> regenerated at any time from the trial. This split is what lets `results:download`
> refuse to overwrite an existing trial (ADR 68) and what lets grading be
> retroactive and free (D-50).
>
> There is no `classification.json` or `kickstartds-report.json` on disk. The
> normalized `Outcome` — quality/cost/time/efficiency plus per-grader detail —
> is computed on demand by `lib/report/collect.ts`, because it is a pure
> function of the trial and caching it would only create a second thing to
> invalidate whenever a grader changes.

> **Transcripts are ours, not the harness's.** `@vercel/agent-eval` writes
> `transcript.json` / `transcript-raw.jsonl` only when its own capture succeeds;
> it reads one hard-coded path and silently yields `null` otherwise, which is
> what happened on the first real baseline run. Because cost (G2), efficiency
> (G6) and MCP usage (§7.2) are all derived from the transcript, `EVAL.ts`
> captures it in-sandbox and writes it into the workspace, where the
> post-validation file capture picks it up. See ADR Decision 15.

```

### 8.2 The report Storybook

For each trial we build a Storybook that contains **both** the generated
component, rendered live, **and** the run report itself. The report stories live
in `lib/report/host/` — a host-side Storybook that mounts the trial through
`lib/report/host/trial-plugin.ts` and `lib/report/manifest.ts`, rather than a
`templates/report-docs/` directory copied into the project. Keeping the host
out of the trial means a report can be rebuilt for an old run without the run
ever having known about it.

Story sort order, as built:

```

Summary → Component → Conversation → Graders → Output → Source

````

- **Summary** — task prompt, variant (agent/model/MCP set), pass/fail, quality breakdown, cost, duration, turns, MCP tool-call table.
- **Component → Rendered** — the produced component, live and interactive, mounted in `.rp-stage` with the fixture's own token layer applied. This sits second rather than last: the first question about a trial is what it made.
- **Component → Provenance** — which files came from the agent and which from the host, so "it renders" is never mistaken for "the agent made it render".
- **Conversation** — the full transcript, rendered readably, with MCP tool calls and their outputs expandable.
- **Graders** — every assertion with pass/fail and raw output.
- **Output** — all toolchain and runtime output on one page, rather than separate Build/Typecheck/Lint/A11y pages. The graders already attribute failures to a dimension; splitting the raw logs to match only made a reviewer click four times to find one stack trace.
- **Source** — the produced files first, then the fixture's, syntax-highlighted.

Opening a trial locally must be one command, and timestamps are resolved via
`resolveMatrix()` so addresses omit them:

```bash
pnpm --filter agent-eval report open <experiment>/<eval>/run-1
pnpm --filter agent-eval report build <experiment>/<eval>/run-1   # or --all
````

### 8.3 Publication

`results/` is git-ignored. Runs are published as a **static results site**,
rooted at `results/index.html` (`pnpm report:index`) so that every link it emits
is a working relative path:

- an index page listing tasks × arms with the headline metrics and the
  baseline-delta table — quality ±σ, Δ quality, pass@1, $/trial, cost ×,
  quality per extra dollar;
- a **row of screenshot thumbnails per arm**, bordered green or red by outcome,
  each linking into that trial's Storybook. A table of numbers says `cc-none`
  scored 0.64 on `810`; a row of sixty thumbnails shows what that looked like.

Hosting follows existing repo practice: `config/deploy-agent-eval-results.yml`
alongside the other `config/deploy-*.yml` services, behind the shared JWT auth.
Unlike every other service it is **not built from source** — the tree is the
output of paid runs — so `packages/agent-eval/Dockerfile` copies a populated
`results/` in as a late layer, and `server/index.ts` serves it behind a
token-paste login with a `connect-src 'none'` CSP, because the reports
deliberately execute agent-authored code (ADR 69).

CI runs upload the same tree as a workflow artifact, retrieved with
`pnpm results:download` (`gh`-based, `--from` for a local directory). The merge
is idempotent and **never overwrites** an existing trial: CI owns the run, the
local machine owns everything derived from it.

Retention: `pnpm results:prune` keeps the **last 10 runs per experiment** plus
every timestamp listed in `results/<experiment>/.pinned` (D10) — and, because
timestamps differ per arm and per batch, every timestamp the reports currently
resolve to. It is dry-run unless given `--apply`. Artifacts run 20–40 MB per
run, and each built trial Storybook adds ~7.5 MB on top; most of that is an
identical Storybook runtime, which is the outstanding dedupe candidate.

---

## 9. Quality Gate & Drift Detection (G3)

### 9.1 Two suites

- **`capability`** — hard tasks we currently fail. Not gating. Their job is to have headroom; a suite where everything passes has stopped measuring anything.
- **`regression`** — tasks that have reached a high pass rate and been _graduated_. Gating. A task graduates when it holds `pass^5 = 1.0` across two consecutive full runs.

### 9.2 Baselines

`baselines/<experiment>.json` commits the accepted pass rate, quality score, and cost envelope per task. It is a reviewed file — moving a baseline is a PR with a reason.

Gate condition (via `agent-eval status --check --json` plus our own comparator):

- **Fail** on any regression-suite task dropping below its baseline pass rate.
- **Fail** on composite quality dropping more than a declared epsilon.
- **Warn** on cost or duration regressing >25% (a much slower, much pricier "pass" is a real regression).

### 9.3 Cadence and spend control

Adopting Storybook's model, because it is the part of their setup that has actually been stress-tested against real bills:

- **Never auto-triggered on push.** Full runs are opt-in via PR labels (`ci:eval`, `ci:extra-models`) or manual dispatch. **Applying those labels and dispatching eval workflows is a human decision — agents must never do it.**
- **Agents validating locally** use `EVAL_ONLY=<name>` with a single experiment at a time.
- **`pnpm eval:dry`** prints the projected task × variant × run count and an estimated spend before anything executes.
- **Hard budget guardrail of $40 per full run** (D6); the harness aborts when exceeded. Raised from $25 after the P1 calibration run measured `cc-both` at $29.71.
- **Nightly** runs the regression suite on the primary variant only — the cheap drift tripwire. Full matrix runs on release of either MCP package.

### 9.4 Known failures

When an assertion must be relaxed, the relaxation carries a self-contained comment directly above it: observed behavior, CI run id, date, and the condition under which it should be re-enabled. No separate tracking file — it rots.

---

## 10. Task Suite (v1)

20–30 tasks, following Anthropic's "20–50 is a good start". Numbering lines borrowed from Storybook's convention so the suite can grow without renumbering:

| Range | Line                          | Examples                                                                                                                       |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `8xx` | **Core** (always run)         | Build an atom from a written spec · Build a composite from two existing components · Add a story with a play function          |
| `81x` | **Token-centric**             | Restyle an existing component to a different semantic intent · Add a component-token layer · Adapt to a non-default theme      |
| `82x` | **Schema-centric**            | Design a JSON Schema for a described component and generate matching props · Extend an existing schema without breaking it     |
| `83x` | **Behavior**                  | Add client-side behavior with vanilla JS (no React state) · Progressive-enhancement fallback                                   |
| `84x` | **Reuse / anti-hand-rolling** | Task whose obvious solution is a native `<button>`/`<input>` — correct answer is the DS component                              |
| `85x` | **A11y**                      | Build a disclosure/menu with correct roles and keyboard handling                                                               |
| `86x` | **Negative / restraint**      | A request that should be _declined or minimally scoped_ (e.g. "add a new brand color") — guards against one-sided optimization |
| `9xx` | **Extra** (flag-gated)        | Long-horizon multi-component tasks, expensive, `EVAL_EXTRA_EVALS=1`                                                            |

Task authoring rules:

- A task that scores 0% across 100 trials is a broken task, not a hard task — rewrite the prompt.
- A task at 100% across all variants has saturated and no longer discriminates — graduate to regression or retire.
- Prompts are written as a **realistic developer request**, not as a checklist that pre-encodes the grader.
- `REFERENCE/` gold implementations are never mounted into the sandbox.

---

## 11. Rollout

| Phase  | Scope                                                                                                                                                                                                | Exit criterion                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **P0** | Package scaffold, `@vercel/agent-eval` wired, Docker sandbox, fixture builder, one task, `baseline` vs `both` variants.                                                                              | One end-to-end run produces a result with a transcript and a project snapshot. |
| **P1** | Deterministic grader set (§7.1) + transcript graders (§7.2). Full 4-variant MCP matrix on 5 tasks.                                                                                                   | First real answer to "does either MCP help?", with cost and time deltas.       |
| **P2** | Static artifacts: per-trial Storybook build, report-docs stories, results index site, local `open` command.                                                                                          | G4 satisfied — a historical run is fully inspectable from a static URL.        |
| **P3** | Task suite to 20–30 tasks. LLM judge added and calibrated. Composite quality score live.                                                                                                             | Judge ≥80% agreement with human grading on the calibration set.                |
| **P4** | Regression suite graduation, `baselines/`, CI workflow with label gating, budget guardrail, nightly tripwire.                                                                                        | G3 satisfied — a deliberate quality regression is caught by CI.                |
| **P5** | _(post-v1)_ Widen to content quality via `storyblok-mcp`: new fixture, new grader family (schema validity, compositional quality warnings, SEO), reusing the same harness, matrix, report, and gate. | Separate PRD.                                                                  |

---

## 12. Decisions

### 12.1 Decided (2026-08-06)

| #   | Decision                                                                                                         | Consequence                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Package name:** `packages/agent-eval`.                                                                         | Matches upstream and the Storybook precedent; scope is signalled by tasks, not the folder name.                                                                                                                    |
| D2  | **Agent/model scope:** Claude Code + one pinned model for P0–P2.                                                 | Isolates the MCP variable cleanly and keeps P1 within budget. A second agent lands in P3; cross-agent claims are out of scope until then.                                                                          |
| D3  | **Model access:** direct provider keys, no Vercel AI Gateway.                                                    | No vendor dependency and no gateway billing layer — **but** we lose automatic failure classification and must implement §7.5 ourselves.                                                                            |
| D4  | **Sandbox:** Docker everywhere, local and CI.                                                                    | No Vercel account, no Sandbox quota. CI parallelism is bounded by runner capacity, so full-matrix runs are slower; budget the wall-clock accordingly.                                                              |
| D5  | **Fixture:** generated fixture project with a packed `@kickstartds/design-system` tarball.                       | Trial isolation and reproducibility; the fixture becomes a maintained artifact that must track design-system changes.                                                                                              |
| D6  | **Budget ceiling:** **$40 hard cap per full run** of the 4-variant core matrix.                                  | Caps task-count × runs. Raised from $25 after P1 measured `cc-both` at $29.71 on a single-eval matrix — the original figure was set before any per-trial cost was known. Not yet enforced in code (checklist 4.6). |
| D7  | **Results hosting:** Kamal-deployed static site behind the shared JWT auth.                                      | Consistent with the other four hosted services; reuses `packages/shared-auth` and the existing `config/deploy-*.yml` pattern.                                                                                      |
| D8  | **MCP transport:** stdio from the workspace build.                                                               | Hermetic trials that test the current commit — what a quality gate needs. An optional `-hosted` variant is added later to smoke-test the deployed HTTP surface incl. JWT auth.                                     |
| D9  | **Runs per task:** 3 for `capability`, 5 for `regression`.                                                       | `pass^5` is meaningful enough to gate on; the capability suite stays cheap. Revisit once real per-trial costs are known against the D6 cap.                                                                        |
| D10 | **Retention:** last 10 runs per experiment, plus every baseline-setting run pinned indefinitely.                 | Bounded storage growth despite a built Storybook per trial. Pruning is automated in the results-site deploy step.                                                                                                  |
| D11 | **CI gating:** report-only until P4 baselines have survived two full cycles, then block on the regression suite. | Avoids a gate that cries wolf before its thresholds are trustworthy. The switch from report to block is an explicit, reviewed commit.                                                                              |
| D12 | **Visibility:** private for v1, behind the shared JWT (D7).                                                      | Public publication stays open as a later marketing move; nothing in the design precludes it.                                                                                                                       |
| D13 | **Screenshots:** not committed, not tracked in Git LFS — they live only under `results/`.                        | Keeps repository size flat. Screenshots remain available through the results site and CI artifacts.                                                                                                                |
| D14 | **Repo-local agent instructions are excluded from every variant**, including the baseline.                       | We measure the MCP servers' built-in capability, isolated from local setup context that differs between consumers. Baselines will read low by design; enforced by the `fixture-hygiene` check (§5.3).              |
| D15 | **CI runner sizing:** start on standard runners, measure in P1, escalate only if a full run exceeds ~2h.         | Wall-clock, not spend, is the binding constraint under Docker-only sandboxing (D4).                                                                                                                                |

All open questions are resolved; nothing blocks P0. Items flagged for deliberate revisit: **D6** (budget) and **D9** (runs per task) after the P1 calibration run, **D8** (hosted variant) once the deployed surface is worth smoke-testing, **D12** (public results), and **D14** — an instructions-vs-MCP study remains an interesting one-off, but only as a separate experiment, never as a variable inside the core matrix.

---

## 13. Risks

| Risk                                                                                                                                                                                                                                           | Mitigation                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Silent stale results.** `setup()`/`editPrompt()` aren't fingerprinted; an MCP config change could be compared against cached runs from the old config — invalidating the entire comparison.                                                  | `lib/experiment.ts` embeds a hand-maintained `variantVersion` string into a fingerprinted field; README documents `--force`. CI always runs with `--force` for matrix comparisons. |
| **Cost overrun.** Matrix × tasks × runs multiplies fast.                                                                                                                                                                                       | `--dry` estimates, $40 hard cap (D6), label-gated CI, `EVAL_ONLY` for local iteration, cheap nightly tripwire.                                                                     |
| **Judge drift makes historical comparisons invalid.**                                                                                                                                                                                          | Pinned judge model; pin change is a versioned event; deterministic graders carry 85% of the composite weight.                                                                      |
| **Sandbox flakiness read as quality regression.** Aggravated by D3 — no gateway failure classification.                                                                                                                                        | Local classifier (§7.5), automatic single retry for `infra`/`timeout`, runs invalidated above a 20% non-model failure rate, post-run `scripts` disabled.                           |
| **Instruction leakage into the sandbox.** A stray `copilot-instructions.md`, `AGENTS.md`, or agent config file would lift the baseline and shrink every measured MCP delta — silently, and in the direction that makes our servers look worse. | `fixture-hygiene` pre-trial check (§5.3) fails the run on any agent-instruction file; the `none` variant additionally asserts zero MCP tool calls (§7.2 `negative-usage`).         |
| **Context-free baseline is unrepresentative.** Real consumers do have some local context, so the measured delta is an upper bound on real-world MCP lift.                                                                                      | Accepted and stated explicitly in every report; an instructions-vs-MCP study is scheduled as a separate one-off experiment (D14), never as a core-matrix axis.                     |
| **Overfitting the MCPs to the eval suite.** We author both the tasks and the servers.                                                                                                                                                          | Negative/restraint tasks (`86x`); rotate in new tasks each phase; retire saturated tasks; hold out a small unseen set.                                                             |
| **Artifact storage growth.** A built Storybook per trial is not small.                                                                                                                                                                         | Retention policy (Q10); Storybooks built lazily on demand for older runs if size becomes a problem.                                                                                |
| **Maintenance burden.** An eval suite nobody runs is worse than none.                                                                                                                                                                          | Nightly tripwire on one cheap variant; eval results required in the release notes of both MCP packages (G7).                                                                       |
