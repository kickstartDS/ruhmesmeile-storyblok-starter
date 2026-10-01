/**
 * `pnpm graders:selftest` — grade the real design system with our own rubric.
 *
 * This exists because the P0 rubric asserted `{Name}Component.scss` and
 * `{Name}Component.client.ts`, neither of which appears anywhere in the 68
 * components of `@kickstartds/design-system`. The rubric was copied from
 * `.github/copilot-instructions.md` rather than measured, and it silently
 * failed correct output for three paid trials.
 *
 * The rule now: every structural check must be satisfied by the design system
 * itself. If a change to a grader drops conformance below the floors measured
 * on 2026-08-06, this fails — the grader is wrong, not the design system.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { componentContract } from "../lib/graders/component-contract";
import { purity } from "../lib/graders/purity";
import { authoringSeams } from "../lib/graders/authoring-seams";
import { schemaConformance } from "../lib/graders/schema-conformance";
import { tokenConformance } from "../lib/graders/token-conformance";
import { bem } from "../lib/graders/bem";
import { stylePlacement } from "../lib/graders/style-placement";
import { typographyPairing } from "../lib/graders/typography-pairing";
import { pascalCase } from "../lib/graders/contract";
import type { Trial } from "../lib/graders/trial";
import type { Target } from "../lib/graders/targets";

const DS_ROOT = new URL("../../design-system/src/components", import.meta.url)
  .pathname;

/**
 * Floors measured across the real design system. Deliberately below 100%:
 * some components genuinely deviate, and a grader that demanded perfection of
 * the reference implementation would be demanding it of nothing real.
 */
const FLOORS: Record<string, number> = {
  "component-contract": 0.75,
  purity: 0.6,
  "authoring-seams": 0.85,
  "schema-conformance": 0.9,
  "token-conformance": 0.75,
  bem: 0.7,
  "style-placement": 0.75,
};

const TEXT = /\.(tsx?|jsx?|scss|css|json|md)$/;

function walk(dir: string, base: string, into: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, into);
    else if (TEXT.test(entry))
      into.set(relative(base, full), readFileSync(full, "utf8"));
  }
}

function trialFor(slug: string): Trial {
  const dir = join(DS_ROOT, slug);
  const files = new Map<string, string>();
  walk(dir, DS_ROOT, files);

  const target: Target = {
    slug,
    dir: slug,
    // The design system is the reference for structure, not for behaviour —
    // only 7 of 68 components have a client file, and demanding one here would
    // fail 61 correct components.
    requiresClientBehaviour: false,
    schemaProperties: [],
    delegatedElements: [],
    // Irrelevant here: the selftest grades checked-in components, so there is
    // no trial to confound.
    mcpUseExpected: false,
    // The selftest grades the design system itself, which has no fixture to
    // diff against — every file must be judged on its content.
    diffTask: false,
    // Not a suite member. The selftest never goes through eval selection, so
    // the tier is carried only to satisfy the type.
    tier: "core",
  };

  return {
    experiment: "selftest",
    // Not a real variant — the reference implementation has no agent behind it.
    variant: "unknown",
    timestamp: "reference",
    evalName: slug,
    run: 0,
    runDir: dir,
    projectDir: DS_ROOT,
    files,
    status: "passed",
    duration: 0,
    model: "n/a",
    evalOutput: null,
    transcript: null,
    target,
  };
}

const slugs = readdirSync(DS_ROOT).filter((entry) =>
  statSync(join(DS_ROOT, entry)).isDirectory(),
);

const graders = {
  "component-contract": componentContract,
  purity,
  "authoring-seams": authoringSeams,
  "schema-conformance": schemaConformance,
  "token-conformance": tokenConformance,
  bem,
  "style-placement": stylePlacement,
};

const scores: Record<string, number[]> = {};
const worst: Record<string, Array<{ slug: string; score: number }>> = {};

for (const slug of slugs) {
  // Skip anything that isn't a component directory.
  const trial = trialFor(slug);
  if (
    ![...trial.files.keys()].some((f) =>
      f.endsWith(`${pascalCase(slug)}Component.tsx`),
    )
  )
    continue;

  for (const [id, grader] of Object.entries(graders)) {
    const outcome = grader(trial);
    if (!outcome.applicable) continue;
    (scores[id] ??= []).push(outcome.score);
    (worst[id] ??= []).push({ slug, score: outcome.score });
  }
}

let failed = false;
console.log(`\nGrader self-test — ${slugs.length} design-system directories\n`);

for (const [id, floor] of Object.entries(FLOORS)) {
  const values = scores[id] ?? [];
  if (values.length === 0) {
    console.log(
      `  ${id.padEnd(20)} no applicable components — grader is dead code`,
    );
    failed = true;
    continue;
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const ok = mean >= floor;
  if (!ok) failed = true;

  console.log(
    `  ${ok ? "✓" : "✗"} ${id.padEnd(20)} mean ${mean.toFixed(2)} ` +
      `(floor ${floor.toFixed(2)}, n=${values.length})`,
  );

  if (!ok) {
    const offenders = (worst[id] ?? [])
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);
    for (const entry of offenders) {
      console.log(`        ${entry.slug.padEnd(24)} ${entry.score.toFixed(2)}`);
    }
  }
}

/**
 * `typography-pairing` is scoped to one fixture component, so the design-system
 * sweep above cannot exercise it — `article-teaser` exists only as the eval's
 * reference answer. It is pinned here instead: the reference must pass, and each
 * of the three assertions must reject a deliberate break of exactly one rule.
 */
{
  const REFERENCE = new URL(
    "../lib/eval-harness/reference/816-typography-pairing",
    import.meta.url,
  ).pathname;
  const styles = readFileSync(join(REFERENCE, "article-teaser.scss"), "utf8");
  const target: Target = {
    slug: "article-teaser",
    dir: "src/components/article-teaser",
    requiresClientBehaviour: false,
    schemaProperties: [],
    delegatedElements: [],
    mcpUseExpected: true,
    diffTask: false,
    tier: "extra",
  };
  const referenceTrial = (body: string): Trial => ({
    experiment: "selftest",
    variant: "unknown",
    timestamp: "reference",
    evalName: "816-typography-pairing",
    run: 0,
    runDir: REFERENCE,
    projectDir: REFERENCE,
    files: new Map([[`${target.dir}/article-teaser.scss`, body]]),
    status: "passed",
    duration: 0,
    model: "n/a",
    evalOutput: null,
    transcript: null,
    target,
  });

  const reference = typographyPairing(referenceTrial(styles));
  if (!reference.applicable) {
    console.log("  ✗ typography-pairing not applicable to its own reference");
    failed = true;
  } else if (!reference.passed) {
    const broken = reference.checks
      .filter((entry) => !entry.passed)
      .map((entry) => `${entry.id}: ${entry.details ?? ""}`)
      .join("; ");
    console.log(`  ✗ typography-pairing rejects the reference answer — ${broken}`);
    failed = true;
  } else {
    console.log(
      `  ✓ typography-pairing reference answer passes (mean ${reference.score.toFixed(2)}, n=1)`,
    );
  }

  const controls: Array<[string, string]> = [
    [
      "mis-paired colour",
      styles.replace(/--ks-text-color-display/g, "--ks-text-color-copy"),
    ],
    [
      "hand-set value",
      styles.replace(
        "font: var(--ks-font-display-m);",
        "font: var(--ks-font-display-m);\n    font-size: 14px;",
      ),
    ],
    [
      "mixed categories",
      styles.replace(
        "font: var(--ks-font-interface-xs);",
        "font: var(--ks-font-interface-xs);\n    font-family: var(--ks-font-family-copy);",
      ),
    ],
  ];

  for (const [label, body] of controls) {
    if (body === styles) {
      console.log(`  ✗ typography-pairing control "${label}" did not mutate — control vacuous`);
      failed = true;
      continue;
    }
    const outcome = typographyPairing(referenceTrial(body));
    if (!outcome.applicable || outcome.passed) {
      console.log(`  ✗ typography-pairing control "${label}" still passes — the rule does not bite`);
      failed = true;
    } else {
      const which = outcome.checks
        .filter((entry) => !entry.passed)
        .map((entry) => entry.id)
        .join(", ");
      console.log(`  ✓ typography-pairing control "${label}" rejected (${which})`);
    }
  }
}

if (failed) {
  console.log(
    "\nA grader scores the real design system below its measured floor.\n" +
      "Fix the grader — the design system is the contract.\n",
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nAll graders agree with the design system they claim to encode.\n",
  );
}
