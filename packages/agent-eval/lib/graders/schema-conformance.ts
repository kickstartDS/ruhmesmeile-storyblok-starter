/**
 * 1.7 — the component implements the API its schema declares.
 *
 * The schema is the authoritative contract. In the eval fixtures it is shipped
 * and the briefs say to leave it alone, so it is the one part of the task that
 * is not the agent's opinion: every property in it is something the component
 * was asked for. `component-contract` already checks the file is present and
 * unmodified. Nothing checked whether it was *implemented*.
 *
 * The gap was found the long way round. `api-design` — a judge rubric withdrawn
 * under D-102 and gated by `requires: ["schema"]`, which yields no material in
 * Phase 1 because the agent never authors the schema — left 48 fossil verdicts
 * behind from before that gate existed. Read back, they were the only judge
 * output in the corpus that no grader could reach, and they were unanimous
 * about what they had found:
 *
 *   - a schema `actionUrl` the component omitted entirely, leaving the button
 *     non-functional as a link
 *   - a schema `cta` object with `label`/`icon` flattened to `actionLabel` and
 *     `actionIcon`
 *   - `label` renamed to `summary` and `body` to `content`, "breaking the
 *     contract other teams would depend on"
 *
 * Every one of those is a set difference between two lists of names, which is a
 * grader's job and not a judge's (D-145). So the objection survives here and
 * the rubric does not have to.
 *
 * **The test is mention, not shape.** A property counts as implemented if its
 * name appears anywhere in the component's TypeScript sources. That is a weak
 * test on purpose: a grader must not invent violations, and the failure
 * direction is the sound one — a name that appears nowhere in the component is
 * definitely not implemented, whatever spelling the props happen to use. Type
 * correctness, optionality and nesting are all deliberately out of scope, and
 * `api-design` is where they belong if they are ever wanted.
 *
 * Stylesheets and the schema itself are excluded from the search. The schema
 * mentions every property by definition, and a stylesheet mentioning `variant`
 * in a modifier class says nothing about whether a prop was threaded through.
 */

import { discoverGraded } from "./discover";
import { notApplicable, partial, result, type GraderResult } from "./types";
import { readFile, type Trial } from "./trial";

interface Schema {
  properties?: Record<string, unknown>;
  required?: string[];
}

/** Property names the schema declares, and the subset it marks required. */
function declared(source: string): { all: string[]; required: string[] } {
  try {
    const parsed = JSON.parse(source) as Schema;
    const all = Object.keys(parsed.properties ?? {});
    const required = (parsed.required ?? []).filter((name) =>
      all.includes(name),
    );
    return { all, required };
  } catch {
    return { all: [], required: [] };
  }
}

const mentions = (source: string, name: string): boolean =>
  new RegExp(`\\b${name}\\b`).test(source);

/** Score a name list by how much of it the component mentions. */
function coverage(
  names: string[],
  source: string,
): { score: number; missing: string[] } {
  const missing = names.filter((name) => !mentions(source, name));
  return {
    score: names.length === 0 ? 1 : (names.length - missing.length) / names.length,
    missing,
  };
}

export function schemaConformance(trial: Trial): GraderResult {
  const found = discoverGraded(trial);

  if (!found.schema) {
    return notApplicable(
      "schema-conformance",
      "contract",
      "no schema to conform to",
    );
  }

  const schema = declared(readFile(trial, found.schema) ?? "");
  if (schema.all.length === 0) {
    return notApplicable(
      "schema-conformance",
      "contract",
      "schema declares no properties",
    );
  }

  // Every TypeScript source the component ships — the component file, and any
  // props or defaults modules beside it. A prop can legitimately be declared in
  // one and consumed in another.
  const sources = found.all
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => readFile(trial, `${trial.target.dir}/${name}`) ?? "")
    .join("\n");

  if (sources.trim() === "") {
    return notApplicable(
      "schema-conformance",
      "contract",
      "no TypeScript sources to search",
    );
  }

  const required = coverage(schema.required, sources);
  const all = coverage(schema.all, sources);

  const checks = [
    partial(
      "declared-props",
      "every property the schema declares is implemented",
      all.score,
      all.missing.length
        ? `not mentioned in the component: ${all.missing.join(", ")}`
        : undefined,
    ),
  ];

  // Required properties are the part of the contract with no discretion in it.
  // Scored separately so that dropping one is visible even when the optional
  // surface is complete.
  if (schema.required.length > 0) {
    checks.push(
      partial(
        "required-props",
        "every property the schema requires is implemented",
        required.score,
        required.missing.length
          ? `required but not mentioned: ${required.missing.join(", ")}`
          : undefined,
      ),
    );
  }

  return result("schema-conformance", "contract", checks);
}
