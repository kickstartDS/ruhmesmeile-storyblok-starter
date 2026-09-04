/**
 * 1.3 — the seams between a component and its own modules.
 *
 * This grader exists because two instruments were caught guessing at facts.
 * On `840-reuse-over-native/run-1` a human chip said the component did not
 * merge generated defaults; line 77 is `deepMergeDefaults(defaults, props)`.
 * On `run-2` of the same eval the judge listed "deepMergeDefaults usage" among
 * the conventions satisfied; the file contains none. Same predicate, one error
 * each, opposite directions — so neither rater should be answering it (D-143).
 *
 * What it does *not* check is as load-bearing as what it does. The obvious
 * reading of those disagreements is "grade `deepMergeDefaults` and
 * `classnames`", and both would be unfair:
 *
 *   - `classnames` is not a dependency of any eval fixture. An agent that
 *     hand-rolls `cx` had no alternative, and the chip that penalised it was
 *     scoring the sandbox rather than the agent.
 *   - `deepMergeDefaults` is not in the vendored `@kickstartds/core` either.
 *     Agents that call it authored the helper themselves, so its presence
 *     measures which private helper an agent happened to invent.
 *
 * The fixtures ship a schema and nothing else — no generated `*Props.ts`, no
 * `*Defaults.ts`. "Use the generated types" is therefore not a thing the eval
 * can ask for; there is no generator in the sandbox. What survives is the
 * structure those generated files exist to create, which an agent can reach
 * by authoring the modules itself: the props type and the defaults live in
 * their own modules, and the component imports them rather than inlining them.
 * That is the checkable residue of the convention, and it is spelling-neutral.
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

/** An import whose specifier ends in the given module stem, quote-agnostic. */
const importsModule = (source: string, stem: string): boolean =>
  new RegExp(`from\\s*["'][^"']*${stem}["']`).test(source);

export function authoringSeams(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  if (!found.component) {
    return notApplicable(
      "authoring-seams",
      "contract",
      "no component file to grade",
    );
  }

  const source = stripComments(readFile(trial, found.component) ?? "");

  const propsModule = found.all.find((name) => /Props\.tsx?$/.test(name));
  const defaultsModule = found.all.find((name) => /Defaults\.tsx?$/.test(name));

  // The props type is imported, or it is declared here. Declaring it here is
  // the thing the chip "component API implemented inline" is pointing at.
  const propsImported = importsModule(source, "Props");
  const propsInline = /\b(interface|type)\s+\w*Props\b/.test(source);

  const checks = [
    partial(
      "props-module",
      "props type lives in its own module",
      propsImported && propsModule ? 1 : propsImported ? 0.5 : 0,
      propsImported
        ? propsModule
          ? undefined
          : "imports a props module that is not in the component directory"
        : propsInline
          ? "props type declared inline in the component file"
          : "no named props type",
    ),
  ];

  // Defaults are weaker than props: the design system generates them, and with
  // no generator in the sandbox an agent that inlines them has done something
  // defensible. Scored as partial credit rather than a requirement.
  const defaultsImported = importsModule(source, "Defaults");
  checks.push(
    partial(
      "defaults-module",
      "prop defaults live in their own module",
      defaultsImported && defaultsModule ? 1 : defaultsImported ? 0.5 : 0,
      defaultsImported
        ? undefined
        : defaultsModule
          ? `${defaultsModule} exists but is not imported`
          : "no defaults module — defaults are inline or absent",
    ),
  );

  // The identifier is the link between the React component and the client
  // bundle that hydrates it. Re-declaring it in the component means the two
  // sides agree by coincidence: change one string and the wiring goes quiet.
  if (trial.target.requiresClientBehaviour) {
    const identifierImported = /import\s*{[^}]*\bidentifier\b[^}]*}\s*from/.test(
      source,
    );
    const identifierInline =
      /\b(export\s+)?const\s+identifier\s*[:=]/.test(source);

    checks.push(
      partial(
        "identifier-seam",
        "identifier is imported from the client bundle",
        identifierImported ? 1 : identifierInline ? 0 : 0.5,
        identifierImported
          ? undefined
          : identifierInline
            ? "re-declares the identifier the client bundle already exports"
            : "no shared identifier links the component to its client bundle",
      ),
    );
  }

  return result("authoring-seams", "contract", checks);
}
