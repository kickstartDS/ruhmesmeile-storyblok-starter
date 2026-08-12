/**
 * 3.4 — running the judge.
 *
 * The judge is a HOST-SIDE, RETROACTIVE step, not an in-sandbox assertion.
 * The PRD (§7.3) described it as `toSatisfyCriterion` inside `EVAL.ts`, which
 * would have made the rubric part of the eval fingerprint — and the exit
 * criterion for this phase is "iterate the rubrics until they agree with a
 * human 80% of the time". Iterating a fingerprinted rubric means re-running the
 * agents, at roughly $250 a lap. Host-side, a rubric edit costs four API calls
 * per trial and can be replayed over results that already exist. See ADR 72.
 *
 * Consequences worth stating plainly:
 *
 * - Judging never re-runs an agent. It reads `project/` snapshots.
 * - `grade` stays free. Verdicts are cached to `judge.json` next to the trial,
 *   and the grader that turns them into scores only ever reads that file. No
 *   grading run can spend money by accident.
 * - The cache is keyed by model id *and* the exact criterion text. Editing one
 *   rubric re-runs that rubric, and leaves the other three alone.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { discoverGraded } from "../graders/discover";
import { loadTokenRegistry } from "../graders/tokens";
import { readFile, readShipped, untouched, type Trial } from "../graders/trial";
import { referenceCorpus } from "./corpus";
import { PAIRED, RUBRICS, type Rubric } from "./rubrics";

/**
 * The pinned judge model.
 *
 * `agent-eval.config.ts` pins a *tier* ("opus"), which is what the harness
 * wants for the agent under test. A tier is not a pin for a judge: it resolves
 * to whatever is current, so a score from March and a score from September
 * would silently come from different models — exactly the drift the pin exists
 * to prevent (PRD §7.3, risk register). The judge therefore names a dated
 * release. `judge --dry` verifies this id against the API before any spend.
 *
 * Note that this is deliberately not the newest model available. At the time of
 * pinning the newest was published only as an undated alias, and an alias is
 * the thing this constant exists to avoid. A judge that is one generation old
 * and stable is worth more than one that is current and moves.
 */
export const JUDGE_MODEL_ID =
  process.env.JUDGE_MODEL_ID ?? "claude-opus-4-5-20251101";

/** Verdicts are versioned by this together with the criterion text. */
export const JUDGE_PROTOCOL_VERSION = "1";

const API = "https://api.anthropic.com/v1";
const CACHE_FILE = "judge.json";

/**
 * Per-million-token prices for `JUDGE_MODEL_ID`, USD.
 *
 * These price the estimate printed before spending *and* the `costUsd` written
 * into every cache entry, which is the only record of what judging has cost.
 * The comment here used to claim the latter did not exist — that wrong prices
 * "produce a wrong estimate and nothing else" — and on the strength of that
 * nobody checked them. They were Opus 4.1's ($15/$75/$1.50) while the pin is
 * Opus 4.5, so every judge cost ever recorded read 3× the invoice (D-121).
 *
 * Cache writes are a 1.25× premium on input and cache reads a 0.9× discount.
 * The previous formula had no write term at all and billed cache creation as
 * plain input, which understates — the one error pointing the other way.
 */
const PRICE = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

const MAX_TOKENS = 700;

/** Roughly four characters to a token. Good enough to size a bill in advance. */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export type Verdict = "pass" | "fail" | "unknown";

export interface RubricResult {
  rubric: string;
  verdict: Verdict;
  /** 0..1. Meaningless when the verdict is `unknown`. */
  score: number;
  reason: string;
  model: string;
  /** Hash of the criterion this verdict answers. Detects a stale cache. */
  criterion: string;
  /**
   * Hash of everything that was actually sent.
   *
   * The criterion hash alone is not enough: `include` is not part of it, and
   * neither is `buildPrompt`. Adding the reference corpus to a rubric, or
   * fixing which files it is shown, changes what the judge sees while leaving
   * the criterion byte-identical — and the cache would have gone on serving
   * verdicts formed from different material, with nothing to indicate it
   * (D-101).
   *
   * Optional only because entries written before the field existed do not have
   * it. Those used to be trusted, on the stated grounds that the prompts they
   * were formed from were known to match — which was true when it was written
   * and stopped being true the moment `judgedMaterial` changed again (D-119).
   * A missing hash now means stale, because "I cannot check" and "it matches"
   * are not the same claim, and the failure mode of conflating them is a judge
   * verdict formed from material the human calibrating against it never saw.
   */
  promptHash?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface JudgeCache {
  protocol: string;
  results: Record<string, RubricResult>;
}

const SYSTEM = `You are reviewing a single component contributed to an existing design system.

You are given one criterion and the files relevant to it. Answer only that
criterion. Do not comment on anything else you notice, however wrong it looks —
other reviewers are looking at the other dimensions, and a score that quietly
folds in an unrelated defect is worse than no score.

Reply with JSON and nothing else:

{"verdict": "pass" | "fail" | "unknown", "score": <0..1>, "reason": "<two sentences at most>"}

Use "unknown" whenever the material you were given does not settle the question.
It is a correct answer, not a failure to answer, and it is strongly preferred
over a confident guess. Score 1 for a clean pass, 0 for a clear failure, and
values in between where the criterion is partly met; when the verdict is
"unknown" the score is ignored.

Judge only what is in front of you. The brief may refer to files you have not
been shown, and some of those files exist and are authoritative — but you are
seeing everything you have been given, and anything else was withheld on
purpose. Never reason about the contents of a file you cannot read, and never
report a discrepancy against one. If the criterion cannot be settled without
it, that is "unknown".

This material is not a directory listing. You are shown only what the author
wrote by hand, so a file you cannot see is far more likely to have been withheld
than to be missing — schemas, token partials and generated types routinely
exist without appearing here. Never fault the author for the absence of a file.
Judge what the visible code does, including what its own imports tell you it
relies on.

That forgiveness covers absence only, and absence is rarer than it looks.
Content sitting in the wrong file is not absence — it is evidence, and it is in
front of you. Component tokens declared inside the main stylesheet show they are
not in the token partial. A props interface written out by hand shows it was not
generated from a schema. Behaviour implemented with React state shows it is not
in the client bundle. An identifier defined inline shows it was not imported
from one. Judge misplacement you can see; only decline to judge things you
genuinely cannot.

A section headed "MODIFIED FIXTURE" was handed to the author as working code,
not written from scratch, and is followed by a section showing what they
actually changed. Judge the change. Pre-existing structure in such a file is the
fixture's, and several briefs explicitly require leaving it alone — faulting the
author for it punishes them for following the brief.`;

const criterionHash = (rubric: Rubric): string =>
  createHash("sha256")
    .update(`${JUDGE_PROTOCOL_VERSION}\n${rubric.criterion}`)
    .digest("hex")
    .slice(0, 16);

const promptHash = (prompt: string, shared: string | null): string =>
  createHash("sha256")
    .update(`${JUDGE_PROTOCOL_VERSION}\n${SYSTEM}\n${shared ?? ""}\n${prompt}`)
    .digest("hex")
    .slice(0, 16);

const section = (title: string, body: string): string =>
  `\n\n===== ${title} =====\n${body}`;

/** Above this many changed lines, a diff has stopped being a summary. */
const MAX_DIFF_LINES = 80;

/**
 * The lines between the common prefix and the common suffix — one hunk.
 *
 * Not a real diff: a scattered edit collapses into a single span covering
 * everything between the first and last change. That over-reports, never under-
 * reports, and degrades to "the whole file" in the worst case, which is exactly
 * what the reader saw before this existed. Diff tasks in this suite are small
 * edits by construction, so the common case is exact.
 */
function changedRegion(before: string, after: string): string {
  const a = before.split("\n");
  const b = after.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);
  if (removed.length + added.length > MAX_DIFF_LINES) {
    return "(changes are extensive — treat the file as substantially the author's own work)";
  }

  const body = [
    ...removed.map((line) => `- ${line}`),
    ...added.map((line) => `+ ${line}`),
  ].join("\n");

  return body || "(no textual change)";
}

/**
 * One file, labelled with who wrote it.
 *
 * A greenfield file is the author's. A file that also exists in the fixture was
 * *handed* to the author, and showing it whole invites a reader to score the
 * fixture. That is not hypothetical: two hand-labels failed `860-restraint` for
 * hand-written prop types that the fixture ships and whose brief explicitly
 * forbids touching — the correct answer was to leave them exactly as found, so
 * the label punished the agent for obeying (D-122).
 *
 * The full file stays: a rubric like `design-intent` needs whole-file context.
 * What is added is the boundary between what was given and what was written,
 * which neither the judge nor the human could previously see. `untouched`
 * already drops files changed not at all; this covers the ones in between.
 */
const sectionFor = (trial: Trial, path: string, body: string): string => {
  const shipped = readShipped(trial, path);
  if (shipped === null) return section(path, body);

  return (
    section(`${path} (MODIFIED FIXTURE — not written from scratch)`, body) +
    section(`${path} — what the author changed`, changedRegion(shipped, body))
  );
};

/**
 * Assemble what one rubric gets to see.
 *
 * Every file is gated on the agent having written it. `discoverGraded` is not
 * an authorship filter — it hides untouched files on *diff* tasks only, and on
 * the other three tasks it returns whatever is on disk. The first version
 * trusted it as one, and the result was that `api-design` judged a
 * fixture-authored schema on all thirty-six trials that had one: the same file
 * we wrote, graded identically in every arm, which is precisely why it passed
 * 12/12 in the baseline (D-100). ADR 54 and ADR 61 exist to prevent exactly
 * this, and a judge is far more likely to fall for it than a regex, because it
 * cannot tell who wrote what.
 *
 * A rubric is skipped when the agent authored nothing it asks about, which is a
 * different test from "the agent authored no component". Gating on the
 * component alone skipped all twelve `812-restyle-with-tokens` trials — a task
 * where only the stylesheet is edited, and the one task in the suite that is
 * purely about token choice (D-98). Asking each rubric for *its own* material
 * also gets `api-design` right for free: a restyle has no public API to judge.
 *
 * Withholding material is not neutral. The briefs name the schema and call it
 * the source of truth, so hiding it left the judge certain an authoritative
 * document existed and unable to read it — and it invented the contents rather
 * than abstaining (D-102). A rubric that names material in `requires` is not
 * asked at all when that material is missing, which is the only safe response
 * to a question the evidence cannot answer.
 */
export function judgedMaterial(trial: Trial, rubric: Rubric): string | null {
  const found = discoverGraded(trial);
  const material: string[] = [];

  const authored = (path: string | null): string | null => {
    if (!path || untouched(trial, path)) return null;
    return readFile(trial, path);
  };

  // The component is context for every rubric, and required only by one: a
  // task may legitimately produce only styles, which is why this is opt-in
  // rather than the gate it was before D-98.
  const component = authored(found.component);
  if (component) material.push(sectionFor(trial, found.component!, component));
  else if (rubric.requires?.includes("component")) return null;

  // The other half of the component on any interactive task. `discoverGraded`
  // has always found these — the deterministic `client-behaviour` grader reads
  // them — and this function simply never asked, so they reached no rubric.
  //
  // The same shape as D-115/D-119, and the same blind spot: a file that is
  // found, named in the `Discovered` record, and then dropped on the floor
  // between discovery and the judge. The system prompt's "behaviour
  // implemented with React state shows it is not in the client bundle" made
  // the omission survivable in one direction only, which is why nothing looked
  // broken — a wrong answer was still visible in the component, so scores
  // moved, and a right answer was invisible, so they moved less than they
  // should have (D-129).
  //
  // A list, not a single path: the design system puts client behaviour either
  // beside the component or under `js/`, and `nav-main` and `section` both
  // split it across several files.
  if (rubric.include.client) {
    for (const path of found.client) {
      const source = authored(path);
      if (source) material.push(sectionFor(trial, path, source));
    }
  }

  if (rubric.include.styles) {
    let anyStyles = false;

    const styles = authored(found.styles);
    if (styles) {
      material.push(sectionFor(trial, found.styles!, styles));
      anyStyles = true;
    }

    // The token partial is the other half of the stylesheet, and on a restyle
    // it is the half that carries the answer. `discoverGraded` deliberately
    // keeps it out of `styles` — the deterministic graders want the two
    // separately — and this function simply never asked for it, so for three
    // rubrics the partial was found and then dropped on the floor. On a
    // `812-restyle-with-tokens` trial the main sheet holds 24 `--dsa-*`
    // forwards and zero `--ks-*` references, while the partial holds all 24 of
    // them: `token-reasoning`, the rubric whose entire question is which
    // semantic token was chosen, was being shown a file containing none of the
    // choices. The deterministic half of this same blind spot was D-115; this
    // is the other half (D-119).
    const tokens = authored(found.tokens);
    if (tokens) {
      material.push(sectionFor(trial, found.tokens!, tokens));
      anyStyles = true;
    }

    // Either file alone is enough to ask a styles question — an agent is free
    // to put everything in the partial, and several do.
    if (!anyStyles && rubric.requires?.includes("styles")) return null;
  }

  if (rubric.include.schema) {
    const schema = authored(found.schema);
    if (schema) material.push(sectionFor(trial, found.schema!, schema));
    else if (rubric.requires?.includes("schema")) return null;
  }

  return material.length ? material.join("") : null;
}

/**
 * The full prompt: the question, the brief, and the material.
 *
 * The material is split out above so that a human label can be keyed by the
 * code rather than by the question asked of it. 3.7 is "iterate the rubrics
 * until the judge agrees with a human 80% of the time", and that loop is only
 * affordable if editing a criterion does not invalidate the hand-grading — the
 * human is answering whether this component is idiomatic here, which is a fact
 * about the code, while the criterion is the wording under test.
 */
export function buildPrompt(trial: Trial, rubric: Rubric): string | null {
  const material = judgedMaterial(trial, rubric);
  if (material === null) return null;

  let prompt = `Criterion:\n${rubric.criterion}`;

  if (rubric.include.prompt) {
    const brief = trial.files.get("PROMPT.md");
    if (brief) prompt += section("The brief the author was given", brief);
  }

  return prompt + material;
}

/**
 * The part of a rubric's context that is identical for every trial.
 *
 * Two things qualify, and both are large: the 1457 semantic token names and the
 * reference components. Together they are far bigger than the component being
 * judged and completely unchanging, so they go in a cached system block —
 * roughly a tenth of the price, and a prompt cache only ever matches a prefix,
 * so this is only possible because they are kept separate from the per-trial
 * material rather than assembled into one string.
 *
 * Token names only, never values. The judge needs to know what was available to
 * choose from; the full dictionary would crowd out the component it is supposed
 * to be reasoning about.
 */
export function cachedContext(rubric: Rubric): string | null {
  const blocks: string[] = [];

  if (rubric.include.tokenNames) {
    const registry = loadTokenRegistry();
    if (registry.loaded) {
      blocks.push(
        section(
          "Semantic tokens available to the author (names only)",
          [...registry.semantic].sort().join("\n"),
        ),
      );
    }
  }

  if (rubric.include.exemplars) {
    blocks.push(
      section(
        "Reference components from the design system, for comparison",
        referenceCorpus(),
      ),
    );
  }

  return blocks.length ? blocks.join("") : null;
}

export interface Planned {
  rubric: Rubric;
  prompt: string;
  /** Already answered by an identical model and criterion. */
  cached: boolean;
  estimatedInputTokens: number;
  /** Of those, the ones served from the prompt cache after the first call. */
  estimatedCachedTokens: number;
}

/** What judging this trial would do, without doing any of it. */
export function plan(trial: Trial): Planned[] {
  const cache = readCache(trial.runDir);

  return RUBRICS.flatMap((rubric) => {
    const prompt = buildPrompt(trial, rubric);
    if (!prompt) return [];

    const shared = cachedContext(rubric);
    const previous = cache.results[rubric.id];

    return [
      {
        rubric,
        prompt,
        cached:
          previous?.model === JUDGE_MODEL_ID &&
          previous.criterion === criterionHash(rubric) &&
          previous.promptHash === promptHash(prompt, shared),
        estimatedInputTokens:
          estimateTokens(SYSTEM) +
          estimateTokens(prompt) +
          (shared ? estimateTokens(shared) : 0),
        estimatedCachedTokens: shared ? estimateTokens(shared) : 0,
      },
    ];
  });
}

export const estimateCost = (planned: Planned[]): number =>
  planned
    .filter((entry) => !entry.cached)
    .reduce((sum, entry) => {
      const fresh = entry.estimatedInputTokens - entry.estimatedCachedTokens;
      return (
        sum +
        (fresh / 1e6) * PRICE.input +
        (entry.estimatedCachedTokens / 1e6) * PRICE.cacheRead +
        (MAX_TOKENS / 1e6) * PRICE.output
      );
    }, 0);

export function readCache(runDir: string): JudgeCache {
  const path = join(runDir, CACHE_FILE);
  if (!existsSync(path)) {
    return { protocol: JUDGE_PROTOCOL_VERSION, results: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JudgeCache;
  } catch {
    return { protocol: JUDGE_PROTOCOL_VERSION, results: {} };
  }
}

function writeCache(runDir: string, cache: JudgeCache): void {
  writeFileSync(
    join(runDir, CACHE_FILE),
    `${JSON.stringify(cache, null, 2)}\n`,
  );
}

interface AnthropicResponse {
  content: { type: string; text?: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

async function ask(
  prompt: string,
  shared: string | null,
  apiKey: string,
): Promise<AnthropicResponse> {
  // The invariant half of the context goes in the system block, marked
  // cacheable. Order matters: a prompt cache only ever matches a prefix, so
  // anything that varies per trial has to come after everything that does not.
  const system: { type: "text"; text: string; cache_control?: object }[] = [
    { type: "text", text: SYSTEM },
  ];
  if (shared) {
    system.push({
      type: "text",
      text: shared,
      cache_control: { type: "ephemeral" },
    });
  }

  const response = await fetch(`${API}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: JUDGE_MODEL_ID,
      max_tokens: MAX_TOKENS,
      // Judging is a classification, not a brainstorm. The rubrics are meant to
      // give the same answer twice on the same input.
      temperature: 0,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `judge model returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  return (await response.json()) as AnthropicResponse;
}

/**
 * Parse the judge's reply.
 *
 * A model told to emit only JSON mostly does. When it does not, the answer is
 * `unknown` rather than a guess or a thrown error: an unparseable verdict is
 * exactly the situation the escape hatch is for, and it is recorded so that a
 * rubric which provokes it often is visible as a rubric problem.
 */
function parseVerdict(text: string): {
  verdict: Verdict;
  score: number;
  reason: string;
} {
  const json = /\{[\s\S]*\}/.exec(text);
  if (!json)
    return { verdict: "unknown", score: 0, reason: text.slice(0, 200) };

  try {
    const parsed = JSON.parse(json[0]) as {
      verdict?: string;
      score?: number;
      reason?: string;
    };
    const verdict: Verdict =
      parsed.verdict === "pass" || parsed.verdict === "fail"
        ? parsed.verdict
        : "unknown";

    return {
      verdict,
      score: Math.max(0, Math.min(1, Number(parsed.score ?? 0))),
      reason: parsed.reason ?? "",
    };
  } catch {
    return {
      verdict: "unknown",
      score: 0,
      reason: `unparseable reply: ${text.slice(0, 160)}`,
    };
  }
}

/**
 * Judge one trial, reusing every verdict that is still current.
 *
 * Writes `judge.json` into the trial directory after each rubric rather than at
 * the end, so an interrupted run keeps what it already paid for.
 */
export async function judgeTrial(
  trial: Trial,
  apiKey: string,
): Promise<RubricResult[]> {
  const cache = readCache(trial.runDir);

  for (const entry of plan(trial)) {
    if (entry.cached) continue;

    const response = await ask(
      entry.prompt,
      cachedContext(entry.rubric),
      apiKey,
    );
    const text = response.content.find((part) => part.type === "text")?.text;
    const parsed = parseVerdict(text ?? "");
    const usage = response.usage;

    cache.results[entry.rubric.id] = {
      rubric: entry.rubric.id,
      ...parsed,
      model: JUDGE_MODEL_ID,
      criterion: criterionHash(entry.rubric),
      promptHash: promptHash(entry.prompt, cachedContext(entry.rubric)),
      inputTokens:
        usage.input_tokens +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0),
      outputTokens: usage.output_tokens,
      costUsd:
        (usage.input_tokens / 1e6) * PRICE.input +
        ((usage.cache_creation_input_tokens ?? 0) / 1e6) * PRICE.cacheWrite +
        ((usage.cache_read_input_tokens ?? 0) / 1e6) * PRICE.cacheRead +
        (usage.output_tokens / 1e6) * PRICE.output,
    };
    cache.protocol = JUDGE_PROTOCOL_VERSION;
    writeCache(trial.runDir, cache);
  }

  return Object.values(cache.results);
}

/**
 * The rubrics that currently have material on this trial.
 *
 * `judgeTrial` returns everything in the cache, which is a superset of what was
 * asked — a verdict for a rubric that has since been narrowed stays on disk and
 * reads exactly like a fresh one. That has now misled three times: once in a
 * hand-written cross-tab (D-135), once in this file, and once in the CLI's own
 * per-trial summary, which printed `design-intent=pass` for all twelve `812`
 * trials in a run that never asked it. Anything reporting verdicts back to a
 * human goes through here first.
 */
export function askable(trial: Trial): Set<string> {
  return new Set(
    RUBRICS.filter((rubric) => buildPrompt(trial, rubric)).map(
      (rubric) => rubric.id,
    ),
  );
}

/**
 * Count the pairs in `PAIRED` where the structural rubric fails and the
 * conventional one passes — competent but foreign.
 *
 * Only trials where both rubrics are currently askable are compared, for the
 * reason `askable` exists.
 */
export interface DivergenceReport {
  structural: string;
  conventional: string;
  comparable: number;
  /** Structural fail, conventional pass. */
  foreign: string[];
}

export function checkDivergence(trials: Trial[]): DivergenceReport[] {
  return PAIRED.map(([structuralId, conventionalId]) => {
    const report: DivergenceReport = {
      structural: structuralId,
      conventional: conventionalId,
      comparable: 0,
      foreign: [],
    };
    const structural = RUBRICS.find((rubric) => rubric.id === structuralId);
    const conventional = RUBRICS.find((rubric) => rubric.id === conventionalId);
    if (!structural || !conventional) return report;

    for (const trial of trials) {
      const live = askable(trial);
      if (!live.has(structuralId) || !live.has(conventionalId)) continue;

      const { results } = readCache(trial.runDir);
      const strict = results[structuralId];
      const loose = results[conventionalId];
      if (!strict || !loose) continue;
      if (strict.verdict === "unknown" || loose.verdict === "unknown") continue;

      report.comparable += 1;
      if (strict.verdict === "fail" && loose.verdict === "pass") {
        report.foreign.push(
          `${trial.experiment}/${trial.evalName}/run-${trial.run}`,
        );
      }
    }
    return report;
  });
}

/** Confirm the pinned id is a model the API will actually serve. */
export async function verifyPin(
  apiKey: string,
): Promise<{ ok: boolean; available: string[] }> {
  const response = await fetch(`${API}/models?limit=100`, {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  if (!response.ok) {
    throw new Error(`could not list models: ${response.status}`);
  }

  const body = (await response.json()) as { data: { id: string }[] };
  const available = body.data.map((model) => model.id);
  return { ok: available.includes(JUDGE_MODEL_ID), available };
}
