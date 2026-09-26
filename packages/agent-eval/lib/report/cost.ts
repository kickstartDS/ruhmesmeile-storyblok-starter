/**
 * 1.18 — what a trial actually costs.
 *
 * The harness records duration and tokens but never a price, so "MCP costs
 * more" stayed a statement about token counts. It is not: the first valid
 * matrix ran 13.0M cache-read tokens against 134K output tokens on a single
 * `both` trial. Output is the number everyone quotes and it is a *quarter* of
 * the bill. Anything reasoning about budget from output tokens alone — item
 * 1.19, D6, D9 — would be wrong by roughly 4×.
 *
 * Prices are per million tokens, in USD, and are deliberately a static table
 * rather than a lookup: this produces an estimate for planning, not an invoice.
 * The authoritative number is the provider's own billing.
 */

import type { Efficiency } from "../graders/efficiency";

export interface Pricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * Anthropic list prices, USD per million tokens.
 *
 * Cache writes carry a 25% premium over input and cache reads a 90% discount,
 * which is why a long agentic run is dominated by whichever of the two the
 * agent's context churn produces more of.
 *
 * The Opus row is Opus 4.5 and later. It was Opus 4.1's ($15/$75) until D-121,
 * which is a threefold difference and the reason judge spend was reported at
 * triple the invoice for three campaigns. Nothing in the matrix has ever run on
 * Opus, so no campaign figure was affected — but a stale row in a table nobody
 * exercises is a trap armed for whoever exercises it first.
 */
const PRICING: Record<string, Pricing> = {
  "claude-sonnet": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-opus": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-haiku": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },

  /**
   * DeepSeek v4.1 Flash on Novita, taken from the model's pricing card rather
   * than from `GET /openai/v1/models` — that endpoint publishes only input and
   * output, and the cache rate is the one that decides this model's bill.
   *
   * Cache read is $0.006, a 98% discount on input rather than Anthropic's 90%.
   * The difference is not cosmetic at this workload's mix: the spike read 2.15M
   * cache tokens against 130K of input, so at Anthropic's ratio cache would be
   * 62% of the trial and at Novita's it is 15%. An earlier revision of this row
   * carried the input rate as a deliberate upper bound and overstated the trial
   * by 3.6×.
   *
   * Cache *write* is not published and the spike never exercised it — every
   * assistant message reported `cache_creation_input_tokens: 0`, so the
   * endpoint appears to cache implicitly rather than on explicit breakpoints.
   * It is set to the input rate, which is the conservative reading of a term
   * this workload does not currently generate.
   *
   * Checked against a real invoice: 18 requests billed $0.068383332 for
   * 129,291 net input, 1,401,472 cache read and 17,656 output. Applying this
   * row to those counts gives $0.06838 (D-173). Note the Novita dashboard
   * quotes "Input Tokens" *inclusive* of cache, so billed input is the
   * difference between its input and cache columns — `Efficiency.tokens.input`
   * is already net, matching Anthropic's convention, and needs no adjustment.
   */
  deepseek: { input: 0.3, output: 1.2, cacheWrite: 0.3, cacheRead: 0.006 },

  /**
   * GLM 5.3 Flash on Novita, from the pricing card for the same reason as
   * above — input $0.15, output $0.50, cache read $0.03 per Mtok.
   *
   * Half DeepSeek's input and output, but **five times its cache read**, and
   * on this workload that inversion decides which model is cheaper. The mix is
   * cache-dominated: the DeepSeek spike read 2.15M cache tokens against 130K
   * of input and 27K of output, a cache/output ratio of 80×. Applying both
   * rows to that same volume gives $0.084 on DeepSeek against $0.101 on GLM —
   * so the model with the lower headline prices is the more expensive one
   * here, by about 20%. Anyone reading the two cards side by side would
   * conclude the opposite.
   *
   * Cache *write* is unpublished, as with DeepSeek, and is set to the input
   * rate on the same conservative reading. Whether this endpoint also caches
   * implicitly is unverified: if GLM reports non-zero
   * `cache_creation_input_tokens` where DeepSeek reported zero, this term
   * starts mattering and the row needs a real number rather than a bound.
   * `pnpm spike:verify` prints the cache-write total, so the spike answers it
   * before the grid runs.
   *
   * Not yet checked against an invoice. D-173 caught two errors in the
   * DeepSeek row for seven cents, and the same $0.09 spike is worth spending
   * here before 240 trials are billed against an unverified row.
   */
  glm: { input: 0.15, output: 0.5, cacheWrite: 0.15, cacheRead: 0.03 },
};

const FALLBACK = PRICING["claude-sonnet"]!;

/**
 * Match the model string the transcript observed (e.g. `claude-sonnet-5`)
 * against the price table by family, so a new point release does not silently
 * fall back to the wrong tier.
 */
export function pricingFor(model: string | null | undefined): Pricing {
  if (!model) return FALLBACK;
  const normalized = model.toLowerCase();
  for (const [family, price] of Object.entries(PRICING)) {
    if (normalized.includes(family)) return price;
  }
  return FALLBACK;
}

export interface CostBreakdown {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  total: number;
}

/**
 * Estimated USD for one trial.
 *
 * Takes only the `tokens` half of an `Efficiency` so that a summed cohort can
 * be re-priced on a different model without fabricating turn counts and tool
 * call totals it has no meaning for.
 */
export function costOf(
  efficiency: Pick<Efficiency, "tokens">,
  model: string | null | undefined,
): CostBreakdown {
  const price = pricingFor(model);
  const { tokens } = efficiency;
  const per = (count: number, rate: number) => (count / 1_000_000) * rate;

  const input = per(tokens.input, price.input);
  const output = per(tokens.output, price.output);
  const cacheWrite = per(tokens.cacheWrite, price.cacheWrite);
  const cacheRead = per(tokens.cacheRead, price.cacheRead);

  return {
    input,
    output,
    cacheWrite,
    cacheRead,
    total: input + output + cacheWrite + cacheRead,
  };
}

/** `$8.59`, or `$0.42` below a dollar — never scientific notation. */
export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}
