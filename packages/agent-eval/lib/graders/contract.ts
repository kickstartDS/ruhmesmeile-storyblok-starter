/**
 * The kickstartDS component contract, derived from the design system itself.
 *
 * IMPORTANT — this file is empirical, not aspirational. Every rule here was
 * measured against `packages/design-system/src/components` (68 components) and
 * holds for the overwhelming majority of real components:
 *
 *   {Pascal}Component.tsx      68/68
 *   {slug}.scss                61/61 of components that have styles at all
 *   {slug}.schema.json         67/68
 *   imports its own stylesheet 61/61
 *   `.dsa-` block in styles    58/61
 *   `_{slug}-tokens.scss`      41/68
 *   `{Pascal}.client.js`        7/68 (only interactive components)
 *
 * The P0 rubric graded `{Name}Component.scss` and `{Name}Component.client.ts`
 * instead. Neither exists anywhere in the design system — both come from
 * `.github/copilot-instructions.md`, which is wrong on those two lines. That
 * rubric bug marked correct output as failing, and would have penalised the MCP
 * variants for following their own (correct) guidance. See ADR Decision 18.
 *
 * When the design system's conventions change, re-measure and change this file.
 * `pnpm graders:selftest` grades real components and fails if the encoded
 * contract has drifted away from them.
 */

export interface ComponentContract {
  /** `BadgeComponent.tsx` */
  component: string;
  /** `badge.scss` */
  styles: string;
  /** `_badge-tokens.scss` — optional in practice, rewarded when present. */
  tokens: string;
  /** `badge.schema.json` */
  schema: string;
  /**
   * Accepted client-behaviour file names. The design system puts these either
   * next to the component or under `js/`, always `.client.js`.
   */
  clientCandidates: string[];
}

export function pascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

export function contractFor(slug: string): ComponentContract {
  const name = pascalCase(slug);
  return {
    component: `${name}Component.tsx`,
    styles: `${slug}.scss`,
    tokens: `_${slug}-tokens.scss`,
    schema: `${slug}.schema.json`,
    clientCandidates: [`${name}.client.js`, `js/${name}.client.js`],
  };
}

/** BEM block class for a component, e.g. `dsa-badge`. */
export function blockClass(slug: string): string {
  return `dsa-${slug}`;
}

/** Component-token prefix for a component, e.g. `--dsa-badge`. */
export function tokenPrefix(slug: string): string {
  return `--dsa-${slug}`;
}
