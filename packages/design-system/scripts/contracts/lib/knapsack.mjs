/**
 * Knapsack Design System Contract projection (PRD §10.6.1).
 *
 * One-way and lossy by design: the kickstartDS contract is the source, this is
 * a derived view of its API/identity half. `role`/`axis` are dropped, our
 * non-standard `type: "enum"` becomes a JSON Schema `type` + `enum`, and props
 * using `anyOf`/`items`/`$ref` cannot be fully represented. Losses are reported
 * rather than papered over, and the caller validates the result against
 * Knapsack's own published schema before writing it.
 */

export const KNAPSACK_COMPONENT_SCHEMA_ID =
  "https://knapsack-oss.github.io/design-system-contract/schemas/v0/component.contract.schema.json";
export const KNAPSACK_MANIFEST_SCHEMA_ID =
  "https://knapsack-oss.github.io/design-system-contract/schemas/v0/manifest.schema.json";

const JSON_SCHEMA_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);

/** For an enum, derive the narrowest JSON Schema type from its own values. */
function enumType(values) {
  const names = new Set();
  for (const value of values) {
    if (value === null) names.add("null");
    else if (Array.isArray(value)) names.add("array");
    else if (typeof value === "number") names.add("number");
    else names.add(typeof value);
  }
  // integer is a subtype of number; never emit both.
  if (names.has("number")) names.delete("integer");
  const list = [...names];
  if (list.length === 0) return "string";
  return list.length === 1 ? list[0] : list;
}

/** Our `api.props[].type` is mostly JSON Schema already, plus the `enum` marker. */
function mapPropType(prop) {
  const losses = [];

  if (Array.isArray(prop.values)) {
    return { type: enumType(prop.values), enum: [...prop.values], losses };
  }

  const type = prop.type;
  if (typeof type === "string" && JSON_SCHEMA_TYPES.has(type)) {
    return { type, losses };
  }
  if (Array.isArray(type) && type.every((t) => JSON_SCHEMA_TYPES.has(t))) {
    return { type, losses };
  }

  // Unknown / non-standard: the narrowest honest thing is the union of JSON
  // types. The contract is still the record; this is a projection.
  losses.push(`type ${JSON.stringify(type)} widened to a JSON type union`);
  return {
    type: ["string", "number", "boolean", "array", "object"],
    losses,
  };
}

/**
 * Project one normalized contract to a Knapsack component contract.
 *
 * @param {{ contractId: string, component: string, description?: string,
 *           api?: { required?: string[], props?: Record<string, object> },
 *           composition?: { slots?: Array<{ prop: string }> } }} contract
 * @returns {{ contract: object, losses: Array<{ prop: string|null, field: string, detail: string }> }}
 */
export function projectContract(contract) {
  const losses = [];
  const out = {
    $schema: KNAPSACK_COMPONENT_SCHEMA_ID,
    contractId: contract.contractId,
    component: contract.component,
  };
  if (contract.description) out.description = contract.description;

  const props = contract.api?.props ?? {};
  const propNames = Object.keys(props);

  if (propNames.length > 0 || contract.api?.required?.length) {
    const properties = {};
    const required = new Set(contract.api?.required ?? []);

    for (const name of propNames) {
      const prop = props[name];
      const mapped = mapPropType(prop);
      const projected = { type: mapped.type };
      for (const loss of mapped.losses) {
        losses.push({ prop: name, field: "type", detail: loss });
      }
      if (mapped.enum) projected.enum = mapped.enum;
      if (prop.default !== undefined) projected.default = prop.default;
      if (typeof prop.description === "string") {
        projected.description = prop.description;
      }

      for (const field of Object.keys(prop)) {
        if (["type", "default", "description", "values"].includes(field)) continue;
        losses.push({
          prop: name,
          field,
          detail: `not representable in Knapsack v0.1`,
        });
      }

      if (prop.required === true) required.add(name);
      properties[name] = projected;
    }

    // Knapsack: a publisher fails when `required` names a prop that is not a
    // property. Report it instead of emitting a contract that cannot validate.
    for (const name of required) {
      if (!(name in properties)) {
        losses.push({
          prop: name,
          field: "required",
          detail: "required prop is not declared in api.props and is omitted",
        });
        required.delete(name);
      }
    }

    out.props = {
      properties,
      required: [...required].sort(),
      additionalProperties: false,
    };
  }

  const slots = (contract.composition?.slots ?? [])
    .map((slot) => slot.prop)
    .filter((name) => typeof name === "string" && name.length > 0);
  const uniqueSlots = [...new Set(slots)];
  if (uniqueSlots.length > 0) out.slots = uniqueSlots;

  return { contract: out, losses };
}

/**
 * Build the manifest over a set of projected contracts.
 *
 * @param {Array<{ contractId: string, json: object }>} artifacts
 * @param {{ contractVersion: string, contentAddress: (v: object) => string }} options
 */
export function projectManifest(artifacts, { contractVersion, contentAddress }) {
  return {
    $schema: KNAPSACK_MANIFEST_SCHEMA_ID,
    contractVersion,
    artifacts: artifacts
      .map(({ contractId, json }) => ({
        path: `${contractId}.contract.json`,
        address: contentAddress(json),
        origin: "synced",
      }))
      .sort((a, b) => (a.path < b.path ? -1 : 1)),
  };
}
