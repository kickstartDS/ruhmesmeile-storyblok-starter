/**
 * 1.1 — the component file contract.
 *
 * Grades naming and completeness only. Content lives in the other graders.
 */

import { contractFor } from "./contract";
import { discover } from "./discover";
import { check, partial, result, type GraderResult } from "./types";
import { readFile, type Trial } from "./trial";

export function componentContract(trial: Trial): GraderResult {
  const { slug, dir, requiresClientBehaviour, schemaProperties } = trial.target;
  const contract = contractFor(slug);
  const found = discover(trial);

  const checks = [
    check(
      "component-file",
      `${contract.component} exists`,
      found.componentOnContract,
      found.component
        ? `found ${found.component}`
        : "no component implementation found",
    ),
    check(
      "styles-file",
      `${contract.styles} exists`,
      found.stylesOnContract,
      found.styles ? `found ${found.styles}` : "no stylesheet found",
    ),
    check(
      "schema-file",
      `${contract.schema} is present`,
      found.schema !== null,
    ),
  ];

  if (requiresClientBehaviour) {
    checks.push(
      check(
        "client-file",
        `${contract.clientCandidates[0]} exists`,
        found.clientOnContract,
        found.client.length
          ? `found ${found.client.join(", ")}`
          : "no client behaviour file",
      ),
    );
  }

  // Token partials exist for 41 of 68 real components — common enough to reward,
  // too inconsistent to require.
  checks.push(
    partial(
      "token-partial",
      `${contract.tokens} exists`,
      found.tokens ? 1 : 0.5,
      found.tokens ? `found ${found.tokens}` : "no component-token partial",
    ),
  );

  // Only meaningful when the fixture supplied a schema to leave alone. The
  // design system authors its own schemas, so this check does not apply there.
  if (schemaProperties.length > 0) {
    const schemaSource = found.schema ? readFile(trial, found.schema) : null;
    let untouched = false;
    if (schemaSource) {
      try {
        const parsed = JSON.parse(schemaSource) as {
          properties?: Record<string, unknown>;
        };
        untouched =
          JSON.stringify(Object.keys(parsed.properties ?? {}).sort()) ===
          JSON.stringify([...schemaProperties].sort());
      } catch {
        untouched = false;
      }
    }
    checks.push(
      check(
        "schema-untouched",
        "the supplied schema was not modified",
        untouched,
        untouched
          ? undefined
          : "schema properties differ from the supplied set",
      ),
    );
  }

  const strays = found.all.filter(
    (name) =>
      !name.startsWith("js/") &&
      ![
        contract.component,
        contract.styles,
        contract.tokens,
        contract.schema,
        ...contract.clientCandidates,
      ].includes(name) &&
      !/\.(stories|mdx)/.test(name) &&
      !/^(index\.ts|.*Props\.ts|.*Defaults\.ts)$/.test(name),
  );

  checks.push(
    partial(
      "no-stray-files",
      "no files outside the contract",
      strays.length === 0 ? 1 : Math.max(0, 1 - strays.length * 0.25),
      strays.length ? `${dir}: ${strays.join(", ")}` : undefined,
    ),
  );

  return result("component-contract", "contract", checks);
}
