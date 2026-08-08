# agent-eval

Measures what the kickstartDS MCP servers are actually worth.

Every experiment gives a coding agent the same task, in the same sandbox, from
the same instruction-free fixture — and varies exactly one thing: which MCP
servers it can reach. The difference between two runs is therefore attributable
to the MCP set, in quality, cost, time and efficiency.

- **PRD:** [docs/internal/prd/ui-generation-eval-prd.md](../../docs/internal/prd/ui-generation-eval-prd.md)
- **Checklist:** [docs/internal/checklists/ui-generation-eval-checklist.md](../../docs/internal/checklists/ui-generation-eval-checklist.md)
- **Decisions:** [docs/adr/adr-ui-generation-eval.md](../../docs/adr/adr-ui-generation-eval.md)

Built on [`@vercel/agent-eval`](https://github.com/vercel-labs/agent-eval).

## Read this before your first run

**Runs cost real money and take real time.** There is no automatic trigger:
no agent, workflow or hook may start an eval run. Spend is a human decision,
every time (Decision 11).

Start with a single experiment and a single eval, look at the result, and only
then widen the matrix.

## Prerequisites

1. **Docker**, running. Every run is sandboxed in Docker — locally and in CI —
   so no Vercel account is required (Decision 4).

2. **The `claude` CLI**, authenticated. The harness shells out to it directly.

   ```bash
   npm i -g @anthropic-ai/claude-code
   claude   # sign in once
   ```

3. **The MCP servers, built.** Experiments stage the MCP servers from your
   working tree, so they test the code in your current commit rather than
   whatever happens to be deployed.

   ```bash
   pnpm --filter @kickstartds/component-builder-mcp build
   pnpm --filter @kickstartds/design-tokens-mcp build
   ```

   Skipping this fails at config load, before a sandbox is provisioned and
   before a token is spent.

## Usage

```bash
pnpm setup:check                         # rehearse setup against a real container, no spend
pnpm eval                                # interactive experiment picker
pnpm eval run cc-none-sonnet-high        # one specific experiment
pnpm status                              # which results are stale
pnpm playground                          # browse results and fixtures
```

## Layout

```
agent-eval.config.ts   Shared defaults — model, judge, timeout, runs
experiments/*.ts       One flat file per variant. Subdirectories are NOT read.
evals/<task>/          Task fixtures: PROMPT.md, EVAL.ts, package.json, src/
lib/experiment.ts      defineExperiment() — wiring shared by every variant
lib/mcp/               Variant matrix and sandbox staging of the MCP servers
lib/fixtures/hygiene.ts  Guards fixtures against leaked agent instructions
results/               Per-run artifacts (gitignored)
```

## Run artifacts

Each trial lands in
`results/<experiment>/<timestamp>/<eval>/run-N/` with:

```
result.json                     Status, duration, model, output paths
outputs/eval.txt                Full vitest output for the run
project/                        Complete workspace snapshot, post-validation
project/agent-transcript.jsonl  Raw Claude Code transcript
project/agent-transcript-meta.json  Token totals, tool-call histogram, mcp__* subset
```

The two transcript files are written by `EVAL.ts`, not by the harness. Upstream
captures transcripts from a single hard-coded path and returns `null` on any
miss, which is what happened on the first real run — so cost, efficiency and
MCP-usage data would have been permanently unavailable. `EVAL.ts` searches every
plausible home root and drops the transcript into the workspace, where the
post-validation file capture picks it up.

If `agent-transcript-meta.json` reports `"found": false`, it lists every path it
searched. Nothing about the transcript is asserted — a missing one is an
infrastructure problem and must never be scored as a model failure.

When adding a fixture, copy the transcript-capture block from an existing
`EVAL.ts`. It is duplicated on purpose: only `EVAL.ts`, `EVAL.tsx` and
`PROMPT.md` are withheld from the agent, so a shared helper module would be
uploaded with the fixture and would tell the agent we read its tool calls.

## Experiment naming

`<agent>-<mcp-variant>-<model>-<effort>.ts`, e.g. `cc-both-sonnet-high.ts`.

The `name` passed to `defineExperiment()` **must** match the file name: the
framework derives the results directory from the file name, and the
variant-version guard keys off that same directory.

Experiment files must sit directly in `experiments/` — the CLI only reads flat
`.ts` files there and silently ignores subdirectories.

## The variant-version guard

The framework decides whether to reuse a cached result by fingerprinting the
eval files plus a fixed set of config fields. It **cannot** fingerprint
`setup()`, because functions are not hashable — and `setup()` is exactly where
this package stages the MCP servers.

Left alone, that means: rebuild an MCP server, re-run the experiment, and get
last week's numbers reported as this week's. No error, no warning.

So `defineExperiment()` hashes everything it uploads and stores that hash next
to the results. On mismatch it refuses to start:

```
Experiment "cc-both-sonnet-high" was last run against a different MCP build.
  previous: both:8f1c2a9e4b6d0517
  current:  both:2d7e5a1c9f3b4860

Re-run with --force to discard them.
```

`--force` is the correct response — it discards the stale results. The guard
exists so that discarding is a decision rather than an accident.

## Why the baseline has nothing

The baseline variant gets no MCP servers, and no fixture may contain
`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` or similar
(enforced by `lib/fixtures/hygiene.ts`). This repo's own instruction files
encode a great deal of kickstartDS knowledge; if any of it reached a fixture,
the baseline would receive the very guidance the MCP servers exist to provide,
and every measured delta would collapse toward zero for reasons that have
nothing to do with the MCPs.

`WebSearch` and `WebFetch` are denied for the same reason — in **every**
variant, via `permissions.deny` in `.claude/settings.local.json`. The first
baseline run with working transcripts caught one trial in three searching for
kickstartDS conventions and fetching real `TagLabelComponent.tsx` and
`tag-label.scss` off GitHub. A control that can download the design system is
not a control, and a gate that depends on live web content cannot attribute a
regression to the model.

If you are looking at a run and want to confirm this held, check `toolCalls` in
`agent-transcript-meta.json` — `WebFetch` and `WebSearch` must be absent.
