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
import { readFile, type Trial } from "./trial";

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
  ]);
}
