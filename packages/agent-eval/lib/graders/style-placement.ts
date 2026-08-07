/**
 * 1.7 — style placement.
 *
 * NOTE — this grader is the inverse of what the PRD drafted. The PRD said a
 * component "does not import its own SCSS; styles registered in index.scss".
 * That is the rule for the website package's local components. In the design
 * system itself, all 61 styled components import their own stylesheet
 * (`import "./button.scss"` in `ButtonComponent.tsx`), and the token partial is
 * pulled in by the stylesheet via `@use`. We grade the design system's rule,
 * because that is what the fixture is. See ADR Decision 18.
 */

import { discoverGraded, stripComments } from "./discover";
import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, type Trial } from "./trial";

export function stylePlacement(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  if (!found.component || !found.styles) {
    return notApplicable(
      "style-placement",
      "contract",
      "needs both a component and a stylesheet",
    );
  }

  const component = stripComments(readFile(trial, found.component) ?? "");
  const styles = stripComments(readFile(trial, found.styles) ?? "");
  const styleFile = found.styles.split("/").pop()!;
  const tokenFile = found.tokens?.split("/").pop()?.replace(/^_/, "");

  const importsOwnStyles = new RegExp(
    `import\\s+["']\\.\\/${styleFile.replace(/\./g, "\\.")}["']`,
  ).test(component);

  return result("style-placement", "contract", [
    check(
      "imports-own-styles",
      "component imports its own stylesheet",
      importsOwnStyles,
      importsOwnStyles ? undefined : `expected import "./${styleFile}"`,
    ),
    partial(
      "tokens-via-use",
      "stylesheet pulls in the token partial with @use",
      tokenFile
        ? new RegExp(`@use\\s+["'].*${tokenFile.replace(/\./g, "\\.")}`).test(
            styles,
          )
          ? 1
          : 0
        : 0.5,
      tokenFile ? undefined : "no token partial to import",
    ),
  ]);
}
