/**
 * DSDS projection (PRD §10.5).
 *
 * DSDS removed its own `api` block and left a `specs[]` pointer for any
 * contract format. We fill it with two entries per component — one for our
 * contract, one for the Knapsack projection — and project the API half onto
 * DSDS `traits` per the normative mapping:
 *
 *   enum prop    -> traitType: "variant", kind: "enum", values default-first
 *   boolean prop -> traitType: "variant", kind: "boolean"
 *   states       -> traitType: "state",   kind: "boolean"
 *   other types  -> no trait
 *
 * `disabled` is emitted once, as a boolean prop trait, never also as a state:
 * our contract models it as a boolean axis with `mechanism: attribute`.
 */

export const DSDS_PROJECTION_FORMAT = "kickstartds/component-contract-dsds@1";

/** Default first, then the remaining values in declared order (SR-139). */
export function orderDefaultFirst(defaultValue, values) {
  const rest = values.filter((value) => value !== defaultValue);
  return defaultValue === undefined ? [...values] : [defaultValue, ...rest];
}

/**
 * Project a contract's API half onto DSDS traits.
 *
 * Where our contract is more discriminating than Knapsack's raw rule, we use
 * our classification: only props with `role` `appearance` or `state` become
 * variant traits. `type: "submit"` (role `behaviour`) is an enum but is not a
 * design variant, so it gets no trait; `label`/`url` (role `content`) likewise.
 * Where `role` is absent we fall back to the mechanical enum/boolean rule.
 *
 * @param {{ api?: { props?: Record<string, object> }, states?: string[] }} contract
 * @returns {Array<{ name: string, traitType: string, kind: string, values?: unknown[] }>}
 */
export function projectTraits(contract) {
  const traits = [];

  for (const [name, prop] of Object.entries(contract.api?.props ?? {})) {
    const isVariant =
      prop.role === undefined || prop.role === "appearance" || prop.role === "state";
    if (!isVariant) continue;

    if (Array.isArray(prop.values)) {
      traits.push({
        name,
        traitType: "variant",
        kind: "enum",
        values: orderDefaultFirst(prop.default, prop.values),
      });
    } else if (prop.type === "boolean") {
      traits.push({ name, traitType: "variant", kind: "boolean" });
    }
    // Any other type: DSDS traits do not model free-form props.
  }

  for (const state of contract.states ?? []) {
    traits.push({ name: state, traitType: "state", kind: "boolean" });
  }

  return traits;
}

/**
 * Build the whole DSDS projection document for a publish.
 *
 * @param {Array<object>} contracts normalized contracts
 * @param {{ selfBase?: string, knapsackBase?: string }} [options]
 */
export function projectDsds(contracts, options = {}) {
  const selfBase = options.selfBase ?? "../";
  const knapsackBase = options.knapsackBase ?? "../knapsack/";

  const components = contracts
    .map((contract) => {
      const id = contract.contractId;
      return {
        id,
        contractId: id,
        specs: [
          {
            href: `${selfBase}${id}.contract.json`,
            rel: "contract",
            role: "kickstartds Component Contract",
          },
          {
            href: `${knapsackBase}${id}.contract.json`,
            rel: "contract",
            role: "Design System Contract",
          },
        ],
        traits: projectTraits(contract),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  return {
    $format: DSDS_PROJECTION_FORMAT,
    generatedFrom: "kickstartds/component-contract@1",
    components,
  };
}
