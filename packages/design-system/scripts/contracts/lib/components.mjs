/**
 * Which components are contract subjects.
 *
 * A subject directory contains a React component, a JSON Schema, and generated
 * defaults — the three things the emitter needs. Everything else in
 * `src/components/` is a root content type (`cms/`), a style-only partial
 * (`lightbox/`, `rich-text/`), or a schema without a rendered component
 * (`blog-tag/`, `tile/`, `page-wrapper/`), and is skipped rather than guessed
 * at. Skips are reported so a new component that is *not* picked up is visible
 * rather than silent.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** kebab-case component id → PascalCase file prefix. */
export const pascal = (id) =>
  id
    .split("-")
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");

/** Pure predicate over a directory's file names — the unit-testable core. */
export function isContractSubject(id, files) {
  const set = new Set(files);
  return (
    set.has(`${pascal(id)}Component.tsx`) &&
    set.has(`${id}.schema.json`) &&
    set.has(`${pascal(id)}Defaults.ts`)
  );
}

/**
 * The name the generated story must import. Most components export
 * `{Pascal}`; the form fields export `{Pascal}Component`. A file that exports
 * neither (e.g. `seo`, which is data-only and renders nothing) is not a
 * contract subject: there is no DOM to observe.
 */
export function componentExportName(source, id) {
  const name = pascal(id);
  if (
    new RegExp(`export\\s+(?:const|function|class)\\s+${name}Component\\b`).test(
      source,
    )
  ) {
    return `${name}Component`;
  }
  if (new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b`).test(source)) {
    return name;
  }
  return null;
}

/**
 * @param {string} root design-system package root
 * @returns {{ subjects: string[], skipped: string[], exportNames: Record<string, string> }}
 */
export function listComponents(root) {
  const dir = join(root, "src/components");
  const subjects = [];
  const skipped = [];
  const exportNames = {};

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const componentDir = join(dir, id);
    if (!isContractSubject(id, readdirSync(componentDir))) {
      skipped.push(id);
      continue;
    }
    const source = readFileSync(
      join(componentDir, `${pascal(id)}Component.tsx`),
      "utf8",
    );
    const exportName = componentExportName(source, id);
    if (!exportName) {
      skipped.push(id);
      continue;
    }
    subjects.push(id);
    exportNames[id] = exportName;
  }

  subjects.sort();
  skipped.sort();
  return { subjects, skipped, exportNames };
}

/** Convenience for callers that only know a component id. */
export function hasComponent(root, id) {
  return existsSync(join(root, "src/components", id, `${pascal(id)}Component.tsx`));
}
