/**
 * 1.4 — schema fidelity.
 *
 * The schema is supplied and must not be edited, so validity is mostly a given.
 * What actually varies — and what the prompt explicitly asks for — is whether
 * the component supports every property the schema declares. A badge that
 * silently drops `icon` or `size` is a worse answer than one that does not, and
 * nothing else in the grader set notices.
 */

import { discoverGraded, stripComments } from "./discover";
import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, readShipped, type Trial } from "./trial";

/** Names that say nothing about what they hold (repo convention). */
const VAGUE_PROPERTY_NAMES = new Set([
  "items",
  "data",
  "content",
  "values",
  "list",
  "entries",
]);

/** Property names the fixture handed the agent, which it may not rename. */
function fixtureProperties(trial: Trial, path: string): Set<string> {
  const raw = readShipped(trial, path);
  if (!raw) return new Set();

  try {
    const parsed = JSON.parse(raw) as { properties?: Record<string, unknown> };
    return new Set(Object.keys(parsed.properties ?? {}));
  } catch {
    return new Set();
  }
}

export function schemaValidity(trial: Trial): GraderResult {
  const found = discoverGraded(trial);
  if (!found.schema) {
    return notApplicable("schema-validity", "contract", "no schema file");
  }

  const raw = readFile(trial, found.schema) ?? "";
  let parsed: {
    $schema?: string;
    type?: string;
    properties?: Record<string, unknown>;
  } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return result("schema-validity", "contract", [
      check("parses", "schema is valid JSON", false, "JSON.parse failed"),
    ]);
  }

  const properties = Object.keys(parsed.properties ?? {});
  const componentSource = found.component
    ? stripComments(readFile(trial, found.component) ?? "")
    : "";
  const supportSurface = [
    componentSource,
    ...found.client.map((path) => stripComments(readFile(trial, path) ?? "")),
  ].join("\n");

  const unsupported = properties.filter(
    (name) => !new RegExp(`\\b${name}\\b`).test(supportSurface),
  );

  // This module's premise is that the schema is supplied and must not be
  // edited, so scoring the *fixture author's* naming measures nothing about the
  // agent. `832` ships `content` as a required property under
  // `additionalProperties: false`; every one of its twelve trials was docked
  // 0.25 for a name no agent could legally change. Only names the agent itself
  // introduced are graded. (ADR 54's family, fourth instance.)
  const supplied = fixtureProperties(trial, found.schema);
  const vague = properties.filter(
    (name) => VAGUE_PROPERTY_NAMES.has(name) && !supplied.has(name),
  );

  return result("schema-validity", "contract", [
    check("parses", "schema is valid JSON", true),
    check(
      "well-formed",
      "declares $schema, type and properties",
      Boolean(parsed.$schema && parsed.type && properties.length > 0),
    ),
    partial(
      "props-supported",
      "every declared property is used by the implementation",
      properties.length === 0
        ? 0
        : (properties.length - unsupported.length) / properties.length,
      unsupported.length ? `unused: ${unsupported.join(", ")}` : undefined,
    ),
    check(
      "specific-names",
      "no vague property names",
      vague.length === 0,
      vague.length ? `vague: ${vague.join(", ")}` : undefined,
    ),
  ]);
}
