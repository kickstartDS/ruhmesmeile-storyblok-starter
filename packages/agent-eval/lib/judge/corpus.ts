/**
 * The reference corpus shown to comparative rubrics.
 *
 * Two of the four rubrics ask a comparative question — "does this read as a
 * component of *this* design system", "does it read like the rest of the
 * codebase" — and the first campaign showed both of them with nothing to
 * compare against. `code-idiom` answered `unknown` 40 times out of 48, which is
 * the escape hatch working exactly as intended: the question was unanswerable
 * as posed. `design-intent` answered `pass` 48 times out of 48, which is the
 * same failure in a nicer suit — zero variance is zero information (D-99).
 *
 * `token-reasoning` was the only rubric that discriminated, and the only one
 * that had been given a corpus: the 1457 semantic token names. That is the
 * whole finding, and this module is the fix.
 *
 * The corpus is the real design system, which is available because the judge
 * runs on the host (ADR 72). The in-sandbox placement could not have shown the
 * judge the design system it is being asked to compare against — the sandbox
 * deliberately contains only a cut-down vendored slice.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TARGETS } from "../graders/targets";

const COMPONENTS = fileURLToPath(
  new URL("../../../design-system/src/components", import.meta.url),
);

/**
 * Exemplars must never be an eval's target component.
 *
 * Showing the judge our own `badge` while asking it to grade an agent's `badge`
 * would stop measuring "is this idiomatic" and start measuring "did you
 * reproduce our answer" — penalising defensible variation and quietly turning a
 * style rubric into a diff. The guard below enforces this rather than trusting
 * the list, because the list is right today and the eval suite is going to
 * grow to 20–30 tasks.
 *
 * Chosen for coverage rather than volume: `button` carries a substantial
 * stylesheet and its own component-token layer, `breadcrumb` is small and a
 * different shape entirely. Between them they show the forwardRef/Context
 * pattern, BEM scoping, the token layering and a schema with real variants.
 *
 * `gallery` is here for the one thing neither of those has: a client file.
 * Both original exemplars are static, so the corpus contained no example of
 * how this design system implements interactive behaviour — and `code-idiom`,
 * whose whole premise is "the references define what idiomatic means here",
 * was therefore asked about `832-client-behaviour` with nothing on either side
 * of the comparison. `Gallery.client.js` shows the whole convention in one
 * file: the `Component`/`define` base, the `identifier` export, and listeners
 * that are removed again (D-129).
 *
 * `nav-toggle` is here because the corpus was misrepresenting the design system
 * on the single point `code-idiom` disagreed with its rater about most. Eight
 * of that rubric's ten false failures were one objection — client JS in a `js/`
 * subdirectory rather than flat beside the component — reasoned from
 * `Gallery.client.js` as though it were the rule. The design system does both:
 * eight client files sit flat, five sit under `js/` (`section`, `nav-main`).
 * The corpus showed one half, the judge generalised it into a convention, and
 * then applied it inconsistently — excusing the same placement on three trials
 * and failing it on eight. That is a sampling defect in the evidence, not a
 * fault in the question, so it is repaired here rather than in the criterion
 * (D-142).
 *
 * It is the one well-formed `js/` example that is not `section`, and it is a
 * component in its own right: `NavToggleComponent.tsx` pairs with
 * `js/NavToggle.client.js`, with `nav-toggle.scss` and `_nav-toggle-tokens.scss`
 * alongside. It has no schema of its own, which is allowed — a role may be
 * absent. Its client file carries the convention a second time in a different
 * shape from Gallery's: `identifier`, `define`, `handleEvent` dispatch, and
 * listeners added and removed in matching pairs.
 *
 * It overlaps the `disclosure` target in kind — both are open/close behaviour —
 * which is the risk `gallery` already carries and is not the risk the guard
 * exists to prevent. This is not our answer to that task; it is a different
 * component that happens to toggle.
 *
 * Still deliberately not `section`, and the reason is stronger than it first
 * looked. `section` does not merely *contain* `spotlight.client.js`: it is
 * threaded through with our answer to the `spotlight` eval — a `spotlight`
 * prop, a `--spotlight` modifier, four `--dsa-section__spotlight--*` tokens, a
 * schema field, and a `Section.client.js` whose body lazy-imports
 * `initSpotlight`. Selecting roles by exact filename would keep
 * `spotlight.client.js` itself out of the corpus and still hand the judge most
 * of the implementation. The guard below catches a slug collision; it cannot
 * catch this, which is why the list stays curated and short.
 */

/**
 * An exemplar's directory and its component slug, which are usually the same.
 *
 * `nav-toggle` is the exception that forces the distinction: a component with
 * its own stylesheet, token partial, React file and client file, living inside
 * `nav-main/` rather than in a directory of its own. Naming the two separately
 * is what lets the corpus show it without also dragging in the unrelated
 * `NavMainComponent.tsx` and `nav-main.scss` beside it.
 */
interface Exemplar {
  dir: string;
  slug: string;
}

const EXEMPLARS: Exemplar[] = [
  { dir: "button", slug: "button" },
  { dir: "breadcrumb", slug: "breadcrumb" },
  { dir: "gallery", slug: "gallery" },
  { dir: "nav-main", slug: "nav-toggle" },
];

/**
 * The files that show how a component is built, as roles rather than names.
 *
 * Each entry lists the accepted spellings for one role, in preference order,
 * and the first that exists wins. A role may legitimately be absent — `button`
 * has no client behaviour — but a role must not be *missed* because the design
 * system spelled it the other legal way.
 *
 * That is not hypothetical. This asked for `_${slug}-tokens.scss` only, and
 * `breadcrumb`'s partial is `breadcrumb-tokens.scss` without the underscore, so
 * `existsSync` dropped it and the corpus had been showing three of that
 * component's four files since the day it was written. Both spellings are in
 * the design system today; neither is wrong (D-130).
 *
 * The client role now accepts both placements for exactly the same reason. This
 * design system puts client files flat beside the component *and* under `js/`,
 * and a corpus that can only see the first spelling drops the file silently for
 * every component that uses the second — which is how the judge came to believe
 * flat was the only legal answer (D-142). Flat is listed first, so a component
 * carrying both would still be shown the way `gallery` writes it.
 */
const roles = (slug: string): string[][] => {
  const pascal = slug.replace(/(^|-)(\w)/g, (_, __, c: string) =>
    c.toUpperCase(),
  );

  return [
    [`${pascal}Component.tsx`],
    [`${pascal}.client.js`, `js/${pascal}.client.js`],
    [`${slug}.scss`],
    [`_${slug}-tokens.scss`, `${slug}-tokens.scss`],
    [`${slug}.schema.json`],
  ];
};

/**
 * Assemble the corpus, or fail loudly.
 *
 * A missing corpus would not break anything visibly: the rubrics would simply
 * revert to the unanswerable questions they started as, and quietly pass or
 * shrug at everything. That is a defect that fails silently *upward* (D-67), and
 * the one class this project has been bitten by most. The corpus is checked into
 * the same repository as the judge, so its absence is a broken checkout, not a
 * runtime condition worth degrading gracefully for.
 */
export function referenceCorpus(): string {
  if (!existsSync(COMPONENTS)) {
    throw new Error(
      `Judge reference corpus not found at ${COMPONENTS}. The comparative rubrics cannot run without it.`,
    );
  }

  const targets = new Set(Object.values(TARGETS).map((target) => target.slug));
  const collisions = [
    ...new Set(EXEMPLARS.flatMap(({ dir, slug }) => [dir, slug])),
  ].filter((slug) => targets.has(slug));
  if (collisions.length) {
    throw new Error(
      `Exemplar(s) ${collisions.join(", ")} are also eval targets. An exemplar that is a target turns a style rubric into a diff against our own answer.`,
    );
  }

  const sections = EXEMPLARS.flatMap(({ dir, slug }) =>
    roles(slug)
      .map((spellings) =>
        spellings
          .map((file) => ({ file, path: join(COMPONENTS, dir, file) }))
          .find((entry) => existsSync(entry.path)),
      )
      .filter((entry) => entry !== undefined)
      .map(
        (entry) =>
          `\n----- ${dir}/${entry.file} -----\n${readFileSync(entry.path, "utf8")}`,
      ),
  );

  return sections.join("");
}
