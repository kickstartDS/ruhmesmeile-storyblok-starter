/**
 * Type shim for `@vercel/agent-eval/eval`.
 *
 * The module does not exist on disk: the runner materializes `eval-helper.mjs`
 * inside the sandbox and aliases this specifier to it via the generated
 * `vitest.config.ts`. Locally we only need the types so `EVAL.ts` typechecks.
 *
 * Source of truth: node_modules/@vercel/agent-eval/dist/lib/agents/eval-helper.mjs
 */
declare module "@vercel/agent-eval/eval" {
  /** Judge subject: the final state of the working directory. */
  export const environment: { readonly __judgeSubject: "environment" };

  /** Judge subject: the materialized agent transcript. */
  export const transcript: { readonly __judgeSubject: "transcript" };

  /** Path to the materialized transcript. Prefer the `transcript` subject. */
  export function transcriptPath(): string;
}

declare module "vitest" {
  interface Assertion<T = any> {
    /** Agentic judge: pass/fail against a natural-language criterion. */
    toSatisfyCriterion(criterion: string): Promise<void>;
    /** Agentic judge: score 0..1 against a criterion, must meet the threshold. */
    toScoreAtLeast(criterion: string, threshold: number): Promise<void>;
    /**
     * Deterministic transcript search. Designed for `.not` — a missing or empty
     * transcript throws rather than passing vacuously.
     */
    toContainText(needle: string | RegExp): void;
  }
}

export {};
