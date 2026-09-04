/**
 * The grader registry.
 *
 * Order is report order. Adding a grader here is all it takes for it to appear
 * in every graded run, including historical ones — grading is host-side and
 * re-runnable at no cost (ADR Decision 17).
 */

import { componentContract } from "./component-contract";
import { purity } from "./purity";
import { authoringSeams } from "./authoring-seams";
import { tokenConformance } from "./token-conformance";
import { schemaValidity } from "./schema-validity";
import { bem } from "./bem";
import { dsReuse } from "./ds-reuse";
import { stylePlacement } from "./style-placement";
import { clientBehaviour } from "./client-behaviour";
import { toolchain, a11y } from "./toolchain";
import { judge } from "./judge";
import { mcpUsage, negativeUsage } from "./mcp-usage";
import type { GraderResult } from "./types";
import type { Trial } from "./trial";

export type Grader = (trial: Trial) => GraderResult;

/** Graders that feed the composite quality score. */
export const QUALITY_GRADERS: Grader[] = [
  componentContract,
  purity,
  authoringSeams,
  tokenConformance,
  schemaValidity,
  bem,
  dsReuse,
  stylePlacement,
  clientBehaviour,
  toolchain,
  a11y,
  // Reads cached verdicts only, and reports `n/a` where none exist — so listing
  // it here does not make grading cost anything, and does not change the score
  // of any trial that has not been judged.
  judge,
];

/**
 * Diagnostic graders. Reported, never scored — `mcp-usage` would reward calling
 * a tool rather than producing a good component, and `negative-usage` is a
 * validity check on the experiment itself, not on the agent.
 */
export const DIAGNOSTIC_GRADERS: Grader[] = [mcpUsage, negativeUsage];

export function runQualityGraders(trial: Trial): GraderResult[] {
  return QUALITY_GRADERS.map((grader) => grader(trial));
}

export function runDiagnosticGraders(trial: Trial): GraderResult[] {
  return DIAGNOSTIC_GRADERS.map((grader) => grader(trial));
}

export * from "./types";
export * from "./trial";
export * from "./quality";
export * from "./efficiency";
export * from "./contract";
export * from "./targets";
