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
 */
const PRICING: Record<string, Pricing> = {
  "claude-sonnet": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-opus": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-haiku": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
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

/** Estimated USD for one trial. */
export function costOf(
  efficiency: Efficiency,
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
