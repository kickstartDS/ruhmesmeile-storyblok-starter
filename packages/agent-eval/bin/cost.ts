/**
 * What the agent runs actually cost, reconstructed from the transcripts.
 *
 * The harness records no price. It does record per-message `usage`, which is
 * the same thing one multiplication later, and it records it inside the run
 * directory — so this is retroactive, free, and survives everything. No API
 * call, no billing export, and it can be re-read for any campaign that has
 * already happened.
 *
 * That matters more than convenience. D-121 was us reading our own arithmetic
 * and calling it the bill; this reads the provider's own token counts off the
 * transcript and applies the published rate card. The only assumption left is
 * the rate card itself.
 *
 * Its intended use is projection. Haiku is priced at exactly one third of
 * Sonnet on all four token classes, so a Sonnet campaign's measured cost is a
 * Haiku projection divided by three — and the *only* thing that can falsify
 * that projection is Haiku spending a different number of tokens. Run a small
 * batch, compare, and the ratio stops being an assumption for every batch
 * after it.
 *
 *   pnpm cost                 # current matrix, by eval and by arm
 *   pnpm cost --all           # every transcript on disk, superseded ones too
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "node:fs";

import { listExperiments, resolveMatrix, loadEval } from "../lib/graders/trial";

/** USD per million tokens. Anthropic list prices. */
const PRICES = {
  sonnet: {
    input_tokens: 3,
    output_tokens: 15,
    cache_creation_input_tokens: 3.75,
    cache_read_input_tokens: 0.3,
  },
  haiku: {
    input_tokens: 1,
    output_tokens: 5,
    cache_creation_input_tokens: 1.25,
    cache_read_input_tokens: 0.1,
  },
} as const;

type Usage = Record<string, number>;

/**
 * Sum the per-message usage in one agent transcript, counting each message once.
 *
 * Claude Code writes one JSONL line per *content block*, not per message: a
 * reply that emits some text and three tool calls becomes four lines, each
 * carrying a copy of the same `message.usage` for the whole reply. Summing
 * line by line therefore bills every message once per block it happened to
 * contain, which is why the first reconstruction of a $1.19 run reported
 * $2.54 — 12 assistant lines over 5 distinct messages.
 *
 * The error is not a constant factor and cannot be divided out: blocks per
 * message is a function of how many tools the agent called, so the arms that
 * call MCP tools were inflated hardest, in the exact direction that flatters
 * the conclusion we were drawing about what MCPs cost.
 *
 * Deduplicated on `message.id`, which is the API's identifier for one billed
 * response. Lines without one keep their own key, so a transcript in some
 * other shape is over-counted rather than dropped.
 */
function usageOf(transcript: string): Usage {
  const seen = new Map<string, Usage>();
  let anonymous = 0;

  for (const line of readFileSync(transcript, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let parsed: {
      message?: { id?: unknown; usage?: unknown };
      usage?: unknown;
    };
    try {
      parsed = JSON.parse(line) as typeof parsed;
    } catch {
      continue;
    }
    const usage = (parsed.message?.usage ?? parsed.usage) as Usage | undefined;
    if (!usage || typeof usage !== "object") continue;

    const id =
      typeof parsed.message?.id === "string"
        ? parsed.message.id
        : `anonymous-${anonymous++}`;
    if (!seen.has(id)) seen.set(id, usage);
  }

  const total: Usage = {};
  for (const usage of seen.values())
    for (const [key, value] of Object.entries(usage))
      if (typeof value === "number") total[key] = (total[key] ?? 0) + value;

  return total;
}

/**
 * The rate card an arm was billed at.
 *
 * Read off the experiment name rather than the transcript, because the
 * transcript records the model that answered and the arm name is what the
 * matrix is indexed by. An unrecognised arm is priced as Sonnet, which
 * over-states rather than under-states.
 */
const rateFor = (arm: string) =>
  arm.includes("haiku") ? PRICES.haiku : PRICES.sonnet;

const costOf = (usage: Usage, rate: Record<string, number>) =>
  Object.entries(rate).reduce(
    (sum, [key, price]) => sum + (usage[key] ?? 0) * price,
    0,
  ) / 1e6;

interface Row {
  arm: string;
  evalName: string;
  cost: number;
  tokens: number;
}

function rows(all: boolean): Row[] {
  const found: Row[] = [];

  const record = (path: string, arm: string, evalName: string) => {
    if (!existsSync(path)) return;
    const usage = usageOf(path);
    found.push({
      arm,
      evalName,
      cost: costOf(usage, rateFor(arm)),
      tokens: Object.values(usage).reduce((a, b) => a + b, 0),
    });
  };

  if (all) {
    // `**` because the timestamp sits at different depths depending on which
    // harness version wrote the run (see `listRuns`). The eval name is read
    // from the end of the path, where it is always four segments up from the
    // transcript, rather than by index from the front, where it is not.
    for (const path of globSync(
      "results/*/**/run-*/project/agent-transcript.jsonl",
    )) {
      const parts = path.split("/");
      record(path, parts[1]!, parts[parts.length - 4]!);
    }
    return found;
  }

  for (const experiment of listExperiments())
    for (const entry of resolveMatrix(experiment))
      for (const trial of loadEval(experiment, entry.timestamp, entry.evalName))
        record(
          join(trial.runDir, "project", "agent-transcript.jsonl"),
          experiment,
          entry.evalName,
        );

  return found;
}

function table(
  label: string,
  groups: Map<string, number[]>,
  wide: boolean,
): void {
  console.log(
    `\n${label.padEnd(36)}${"n".padStart(4)}${"total".padStart(10)}` +
      (wide ? `${"mean".padStart(9)}${"min".padStart(8)}${"max".padStart(8)}` : ""),
  );
  for (const key of [...groups.keys()].sort()) {
    const values = groups.get(key) ?? [];
    const sum = values.reduce((a, b) => a + b, 0);
    console.log(
      `${key.padEnd(36)}${String(values.length).padStart(4)}${`$${sum.toFixed(2)}`.padStart(10)}` +
        (wide
          ? `${`$${(sum / values.length).toFixed(2)}`.padStart(9)}` +
            `${`$${Math.min(...values).toFixed(2)}`.padStart(8)}` +
            `${`$${Math.max(...values).toFixed(2)}`.padStart(8)}`
          : ""),
    );
  }
}

function group(found: Row[], by: (row: Row) => string): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of found)
    groups.set(by(row), [...(groups.get(by(row)) ?? []), row.cost]);
  return groups;
}

const all = process.argv.includes("--all");
const found = rows(all);

if (found.length === 0) {
  console.log("No agent transcripts found.");
  process.exit(0);
}

console.log(
  all
    ? "\nEvery transcript on disk, including superseded timestamps."
    : "\nCurrent matrix only. `--all` includes superseded timestamps.",
);

table("by eval", group(found, (row) => row.evalName), true);
table("by arm", group(found, (row) => row.arm), false);

const total = found.reduce((sum, row) => sum + row.cost, 0);
const tokens = found.reduce((sum, row) => sum + row.tokens, 0);
console.log(
  `\n${found.length} trials, ${(tokens / 1e6).toFixed(1)}M tokens, $${total.toFixed(2)}\n`,
);
