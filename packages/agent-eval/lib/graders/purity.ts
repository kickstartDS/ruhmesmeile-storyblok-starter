/**
 * 1.2 — purity and the Context-overridable pattern.
 *
 * The design system's components are pure: no local React state, no effects,
 * refs forwarded, and every component exported through a Context so consumers
 * can swap the implementation (`ComponentProviders.tsx` in the website depends
 * on this). Interactivity belongs in the vanilla-JS client file.
 */

import { pascalCase } from "./contract";
import { discoverGraded, stripComments } from "./discover";
import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, type Trial } from "./trial";

const STATE_HOOKS = ["useState", "useReducer", "useEffect", "useLayoutEffect"];

export function purity(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  if (!found.component) {
    return notApplicable("purity", "contract", "no component file to grade");
  }

  const raw = readFile(trial, found.component) ?? "";
  const source = stripComments(raw);
  const name = pascalCase(trial.target.slug);

  const usedHooks = STATE_HOOKS.filter((hook) =>
    new RegExp(`\\b${hook}\\s*[<(]`).test(source),
  );

  const hasContext =
    new RegExp(`createContext\\s*\\(`).test(source) &&
    new RegExp(`useContext\\s*\\(`).test(source);

  return result("purity", "contract", [
    check(
      "no-react-state",
      "no local React state or effects",
      usedHooks.length === 0,
      usedHooks.length ? `uses ${usedHooks.join(", ")}` : undefined,
    ),
    check("forward-ref", "forwards its ref", /forwardRef/.test(source)),
    partial(
      "context-overridable",
      "exported through a Context for overrides",
      hasContext ? 1 : /createContext/.test(source) ? 0.5 : 0,
      hasContext
        ? undefined
        : "no createContext + useContext pair — component cannot be swapped by a provider",
    ),
    partial(
      "provider-export",
      `exports ${name}Provider`,
      new RegExp(`${name}Provider`).test(source) ? 1 : 0,
    ),
  ]);
}
