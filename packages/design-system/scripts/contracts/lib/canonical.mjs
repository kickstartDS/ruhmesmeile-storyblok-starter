/**
 * RFC 8785 (JSON Canonicalization Scheme) serialization and content addresses.
 *
 * Two jobs, per PRD §5.1.5:
 *   - the emitter writes byte-identical artifacts (its own concern);
 *   - the content address is computed over the CANONICAL FORM of the parsed
 *     value, so a consumer can verify a file that was reformatted or
 *     reserialized by another tool.
 *
 * The canonical form is: parse the file as JSON, serialize per RFC 8785 as
 * UTF-8 bytes — no whitespace, object members sorted by UTF-16 code units of
 * their names, numbers in ECMAScript shortest round-trip form, strings with
 * only the escapes RFC 8785 requires, no trailing newline.
 */

import { createHash } from "node:crypto";

/**
 * Serialize a JSON value per RFC 8785.
 *
 * `Array.prototype.sort` with no comparator compares by UTF-16 code unit,
 * which is exactly RFC 8785's member ordering. `JSON.stringify` of a string
 * emits only the escapes RFC 8785 requires (quote, backslash, the C0 controls
 * it names, and lone surrogates) and does not escape non-ASCII. `JSON.stringify`
 * of a number is ECMAScript's Number::toString, also what RFC 8785 requires.
 *
 * @param {unknown} value a value that came out of JSON.parse
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null) return "null";

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }

  if (type === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys
        .map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key]))
        .join(",") +
      "}"
    );
  }

  throw new TypeError(`cannot canonicalize a value of type ${type}`);
}

/**
 * `sha256:` + lowercase hex digest of a value's RFC 8785 canonical form.
 *
 * The value is normalized to JSON first (`JSON.parse(JSON.stringify(...))`), so
 * the address is computed over exactly what a `JSON.stringify` of that value
 * would publish — `undefined` object members are dropped and `undefined` array
 * entries become `null`, matching the bytes on disk. RFC 8785 itself is defined
 * over JSON values, so this normalization belongs at the boundary, not inside
 * `canonicalJson`, which stays strict.
 */
export function contentAddress(value) {
  const json = JSON.parse(JSON.stringify(value));
  const bytes = Buffer.from(canonicalJson(json), "utf8");
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

/** Address of a JSON document given as a string (whitespace is irrelevant). */
export function contentAddressOfJson(text) {
  return contentAddress(JSON.parse(text));
}

/**
 * A mismatch is a hard failure, never a warning (Knapsack INV-5, SR-137).
 *
 * @returns {{ ok: boolean, expected: string, actual: string }}
 */
export function verifyAddress(value, address) {
  const actual = contentAddress(value);
  return { ok: actual === address, expected: address, actual };
}
