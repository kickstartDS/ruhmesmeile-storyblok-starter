/**
 * 1.5 — BEM naming, namespaced to the component block.
 *
 * The design system prefixes every block with `dsa-` and keeps selectors inside
 * it; 58 of 61 styled components do this. Leaking a bare element selector out
 * of the block is the failure mode that actually hurts, because it silently
 * restyles unrelated markup wherever the stylesheet is loaded.
 */

import { blockClass } from "./contract";
import { discover, discoverGraded, stripComments } from "./discover";
import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, readShipped, type Trial } from "./trial";

/** Nested BEM references: `&__element`, `&--modifier`. */
const NESTED = /(^|\s)&(__|--)[a-z0-9-]/gm;

/** How many nested references a stylesheet contains. */
const countNested = (scss: string): number => [...scss.matchAll(NESTED)].length;

/** Top-level selectors — anything not nested inside another rule. */
function topLevelSelectors(scss: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let buffer = "";

  for (const char of scss) {
    if (char === "{") {
      if (depth === 0) selectors.push(buffer.trim());
      depth += 1;
      buffer = "";
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
      buffer = "";
    } else if (depth === 0) {
      buffer += char;
    }
  }

  return selectors
    .map((selector) => selector.split(/\n/).pop()?.trim() ?? "")
    .filter((selector) => selector.length > 0 && !selector.startsWith("@"));
}

export function bem(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  if (!found.styles) {
    return notApplicable("bem", "contract", "no stylesheet to grade");
  }

  const styles = stripComments(readFile(trial, found.styles) ?? "");
  const component = found.component
    ? stripComments(readFile(trial, found.component) ?? "")
    : "";
  const block = blockClass(trial.target.slug);

  // On a diff task the component is frequently — and correctly — left
  // untouched, which removes it from the graded view. Scoring `block-applied`
  // against an empty string then fails an agent for *not* rewriting a file the
  // eval asserts must not change. This is the same defect D-48 fixed in
  // `client-behaviour`, and it capped `bem` at 0.75 for all twelve trials of
  // `812` regardless of arm.
  const componentWithheld = !found.component && !!discover(trial).component;

  const selectors = topLevelSelectors(styles);
  const leaking = selectors.filter(
    (selector) => !selector.includes(`.${block}`) && !selector.startsWith(":"),
  );

  const classNames = [
    ...new Set(
      [...styles.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]!),
    ),
  ].filter((name) => name.startsWith(block));

  const malformed = classNames.filter(
    (name) =>
      !new RegExp(`^${block}(__[a-z0-9-]+)?(--[a-z0-9-]+)?$`).test(name),
  );

  // Nesting is idiom, not formatting — no formatter converts `.dsa-tag__label`
  // into `&__label`, which is why `code-idiom`'s "ignore anything a formatter
  // would fix" does not cover it and why nothing scored it for the first three
  // campaigns. 50 of the 58 design system stylesheets that have any element or
  // modifier rule nest them; the 8 that do not are almost all form fields. The
  // MCP's own SCSS template emits `&__header` and `&--primary`, so this is the
  // house style stated in the guidance and then never checked — and adoption
  // sat near 50% in every arm, component-builder included (D-122).
  //
  // Scored as a ratio rather than a flag: one nested block should not buy a
  // pass for a stylesheet that is otherwise flat.
  const inherited = readShipped(trial, found.styles);
  const inheritedFlat = new Set(
    inherited ? topLevelSelectors(stripComments(inherited)) : [],
  );

  // Only the author's own selectors count. A diff task hands over a stylesheet
  // that may already be flat, and faulting the agent for the fixture's dialect
  // measures our authoring, not theirs — the same mistake `block-applied`
  // makes above and two hand-labels made on `860` (ADR 84).
  const flatOwn = selectors.filter(
    (selector) =>
      new RegExp(`^\\.${block}(__|--)`).test(selector) &&
      !inheritedFlat.has(selector),
  ).length;

  const nestedOwn = Math.max(
    0,
    countNested(styles) -
      (inherited ? countNested(stripComments(inherited)) : 0),
  );

  // A stylesheet with no elements or modifiers has nothing to nest, and a
  // component that legitimately needs neither must not be marked down for it.
  const nestingApplies = flatOwn + nestedOwn > 0;

  return result("bem", "contract", [
    check(
      "block-defined",
      `styles define the .${block} block`,
      styles.includes(`.${block}`),
      styles.includes(`.${block}`) ? undefined : `expected .${block}`,
    ),
    ...(componentWithheld
      ? []
      : [
          check(
            "block-applied",
            `component renders the ${block} class`,
            component.includes(block),
          ),
        ]),
    check(
      "no-leaking-selectors",
      "no top-level selectors outside the block",
      leaking.length === 0,
      leaking.length ? `leaks: ${leaking.slice(0, 5).join(" | ")}` : undefined,
    ),
    partial(
      "bem-shape",
      "class names follow block__element--modifier",
      classNames.length === 0
        ? 0
        : (classNames.length - malformed.length) / classNames.length,
      malformed.length
        ? `malformed: ${malformed.slice(0, 6).join(", ")}`
        : undefined,
    ),
    ...(nestingApplies
      ? [
          partial(
            "bem-nesting",
            "elements and modifiers nest under the block with &",
            nestedOwn / (nestedOwn + flatOwn),
            flatOwn
              ? `${flatOwn} selector(s) written flat instead of nested under .${block}`
              : undefined,
          ),
        ]
      : []),
  ]);
}
