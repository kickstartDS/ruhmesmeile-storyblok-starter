/**
 * Ajv validation against the real @directededges/specs-schema.
 *
 * component.schema.json cross-references styles.schema.json and
 * workspace.schema.json, so all three are registered before compiling.
 */

import Ajv from "ajv";
import { readFileSync } from "node:fs";

export function createValidator(schemaDir) {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateFormats: false,
  });

  const load = (file) =>
    JSON.parse(readFileSync(`${schemaDir}/${file}`, "utf8"));

  // Register by bare filename so relative `$ref`s like
  // "workspace.schema.json#/definitions/Config" resolve.
  for (const file of [
    "styles.schema.json",
    "workspace.schema.json",
    "components.schema.json",
  ]) {
    ajv.addSchema(load(file), file);
  }

  const component = load("component.schema.json");
  const validate = ajv.compile(component);

  return function validateSpec(spec) {
    const valid = validate(spec);
    return {
      valid,
      errors: (validate.errors ?? []).map(
        (e) => `${e.instancePath || "/"} ${e.message}`,
      ),
    };
  };
}
