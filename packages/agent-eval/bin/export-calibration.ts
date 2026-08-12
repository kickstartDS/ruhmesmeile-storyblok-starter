/**
 * Make calibration portable.
 *
 * `candidates()` walks `results/` — 113 MB, gitignored, prunable, and present
 * on exactly one machine. Everything about hand-grading is otherwise portable
 * (the labels are committed, keyed by a hash of the material, and survive both
 * rubric edits and a rebuilt results tree), but the *questions* were not, so
 * only the person holding the campaign output could answer them. That is the
 * single reason calibration has n=1 raters, and n=1 is what makes the 3.7
 * threshold unreadable: a disagreement cannot be attributed to the judge rather
 * than to one reviewer's idiosyncrasy.
 *
 * The fix is that a calibration question does not need the results. It needs
 * the material, the criterion, the brief (D-123) and the reference components
 * the criterion tells the reader to compare against (D-127). All of them are
 * strings. This writes them to one file that anyone can serve or open.
 *
 * What is deliberately *not* in the bundle is the judge's verdict. It is
 * available right there in the cache and it would be one more field, but a
 * verdict shown before labelling is an anchor, and the whole instrument depends
 * on the human answering independently (calibration.ts, property 3).
 *
 *   pnpm --filter agent-eval calibration:export
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { candidates, queue } from "../lib/judge/calibration";
import { RUBRICS } from "../lib/judge/rubrics";
import { cachedContext } from "../lib/judge/run";

const OUT = fileURLToPath(
  new URL("../calibration/bundle.json", import.meta.url),
);

export interface BundleItem {
  key: string;
  rubric: string;
  evalName: string;
  variant: string;
  address: string;
  material: string;
  /**
   * Present only where the rubric grants it to the judge. Withholding it from
   * a human the judge got it from is the D-123 asymmetry; handing it to a human
   * the judge did not is the same bug pointing the other way.
   */
  brief?: string;
}

export interface Bundle {
  generatedAt: string;
  items: BundleItem[];
  rubrics: Array<{ id: string; label: string; criterion: string }>;
  /**
   * The judge's cached system block, per rubric — reference components and the
   * token-name list.
   *
   * D-123 fixed the brief half of the asymmetry and stopped there. The other
   * half is larger: `code-idiom` tells its reader "the reference components are
   * the local idiom — they define what 'like the rest of the codebase' means
   * here", and then only the judge was given them. A grader asked to compare
   * against an unseen exhibit does not abstain, they substitute the conventions
   * they already carry, which is precisely the file-naming and prop-typing
   * vocabulary that filled the retired design-intent notes.
   *
   * Shared, not per item: it is identical across every trial, which is why the
   * judge can cache it. Roughly 90 KB for the whole bundle.
   */
  context: Record<string, string>;
}

const items = queue(candidates()).map((item): BundleItem => {
  const brief = item.rubric.include.prompt
    ? item.trial.files.get("PROMPT.md")
    : undefined;

  return {
    key: item.key,
    rubric: item.rubric.id,
    evalName: item.trial.evalName,
    variant: item.trial.variant,
    address: item.address,
    material: item.material,
    ...(brief ? { brief } : {}),
  };
});

const context: Record<string, string> = {};
for (const rubric of RUBRICS) {
  const shared = cachedContext(rubric);
  if (shared) context[rubric.id] = shared;
}

const bundle: Bundle = {
  generatedAt: new Date().toISOString(),
  items,
  // Only what a grader is shown. `requires` and `include` are judge plumbing.
  rubrics: RUBRICS.map(({ id, label, criterion }) => ({
    id,
    label,
    criterion,
  })),
  // Not the pick list. `calibration/reasons.json` ships in the image on its
  // own, and the server reads it there — so rewording a diagnosis no longer
  // needs the one machine that still holds `results/`.
  context,
};

writeFileSync(OUT, `${JSON.stringify(bundle)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(bundle));
const perRubric = new Map<string, number>();
for (const item of items)
  perRubric.set(item.rubric, (perRubric.get(item.rubric) ?? 0) + 1);

console.log(
  `calibration/bundle.json — ${items.length} items, ${(bytes / 1e6).toFixed(1)} MB`,
);
for (const [rubric, count] of [...perRubric].sort())
  console.log(`  ${rubric.padEnd(18)} ${count}`);
