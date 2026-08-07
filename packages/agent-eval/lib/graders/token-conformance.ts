/**
 * 1.3 — token conformance.
 *
 * Calibrated against the design system: of 63 components with a stylesheet,
 * exactly one uses a hex literal and one uses `rgb()`, 56 consume `var(--dsa-*)`,
 * and zero component-token partials reference `--ks-brand-*` directly. So all
 * four rules below are ones the design system itself satisfies — which is the
 * bar a grader has to clear before it is allowed to judge an agent.
 */

import { tokenPrefix } from "./contract";
import { discoverGraded, stripComments } from "./discover";
import { loadTokenRegistry } from "./tokens";
import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, type Trial } from "./trial";

/** `var(--x)` references, declarations excluded. */
function referencedTokens(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)].map((m) => m[1]!);
}

function declaredTokens(source: string): string[] {
  return [...source.matchAll(/(--[a-zA-Z0-9-_]+)\s*:/g)].map((m) => m[1]!);
}

export function tokenConformance(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  const registry = loadTokenRegistry();

  if (!found.styles) {
    return notApplicable(
      "token-conformance",
      "contract",
      "no stylesheet to grade",
    );
  }
  if (!registry.loaded) {
    return notApplicable(
      "token-conformance",
      "contract",
      `token registry unavailable at ${registry.source} — run pnpm --filter design-tokens-mcp sync-tokens`,
    );
  }

  const styleSources = [found.styles, found.tokens]
    .filter((path): path is string => Boolean(path))
    .map((path) => stripComments(readFile(trial, path) ?? ""));
  const combined = styleSources.join("\n");

  const colourLiterals = [
    ...(combined.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(combined.match(/\b(?:rgba?|hsla?)\(/g) ?? []),
  ];

  const referenced = referencedTokens(combined);
  const prefix = tokenPrefix(trial.target.slug);
  const known = referenced.filter(
    (name) =>
      registry.semantic.has(name) ||
      registry.branding.has(name) ||
      registry.component.has(name) ||
      // Component tokens the agent defines itself are legitimate as long as
      // they are namespaced to this component.
      name.startsWith(prefix),
  );
  const unknown = [...new Set(referenced.filter((n) => !known.includes(n)))];

  // Layer discipline: component tokens must go through the semantic layer.
  const tokenPartial = found.tokens
    ? stripComments(readFile(trial, found.tokens) ?? "")
    : "";
  const layerSource = tokenPartial || combined;
  const componentDecls = declaredTokens(layerSource).filter((name) =>
    name.startsWith("--dsa-"),
  );
  const brandLeaks = referencedTokens(layerSource).filter((name) =>
    name.startsWith("--ks-brand-"),
  );

  return result("token-conformance", "contract", [
    check(
      "no-colour-literals",
      "no literal colour values",
      colourLiterals.length === 0,
      colourLiterals.length
        ? `${colourLiterals.length} literal(s): ${[...new Set(colourLiterals)].slice(0, 6).join(", ")}`
        : undefined,
    ),
    check(
      "uses-tokens",
      "consumes design tokens",
      referenced.length > 0,
      referenced.length ? `${referenced.length} token reference(s)` : "none",
    ),
    partial(
      "known-tokens",
      "referenced tokens exist in the design system",
      referenced.length === 0 ? 0 : known.length / referenced.length,
      unknown.length ? `unknown: ${unknown.slice(0, 8).join(", ")}` : undefined,
    ),
    partial(
      "component-token-layer",
      "defines namespaced component tokens",
      componentDecls.length > 0 ? 1 : 0.5,
      componentDecls.length
        ? `${componentDecls.length} ${prefix}* token(s)`
        : "styles consume tokens directly without a component-token layer",
    ),
    check(
      "no-branding-shortcut",
      "component tokens do not reference the branding layer directly",
      brandLeaks.length === 0,
      brandLeaks.length
        ? `direct branding refs: ${[...new Set(brandLeaks)].slice(0, 5).join(", ")}`
        : undefined,
    ),
  ]);
}
