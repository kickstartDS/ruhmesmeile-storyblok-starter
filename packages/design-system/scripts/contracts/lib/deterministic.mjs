/**
 * Determinism helpers shared by the emitter and the spike.
 *
 * The contract is byte-stable across runs on unchanged input (PRD §6.4): every
 * object key is emitted in sorted order, and the derivation input hashes are a
 * function of file content only.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/** Recursively sort every object key; arrays keep their order. */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])]),
    );
  }
  return value;
}

/**
 * Truncated content hash of a derivation input, recorded in
 * `generated.inputs`. This proves reproducibility of the derivation; it is not
 * the published-artifact content address (that is RFC 8785, `canonical.mjs`).
 */
export function fileHash(path) {
  if (!existsSync(path)) return null;
  return (
    "sha256:" +
    createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16)
  );
}
