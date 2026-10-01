/**
 * Publish orchestration: identity, collision detection, projections.
 *
 * `publish()` is pure — it reads normalized input and returns artifacts.
 * `bin/generate.mjs` writes and validates them.
 */

import { fold, foldManifest } from "./fold.mjs";
import { contentAddress } from "./canonical.mjs";
import { projectContract, projectManifest } from "./knapsack.mjs";
import { projectDsds } from "./dsds.mjs";

export const CONTRACT_FORMAT = "kickstartds/component-contract@1";
export const INDEX_FORMAT = "kickstartds/component-contract-index@1";

/** The declared name is the input to the fold: the component source identifier. */
export function declaredNameOf(raw) {
  return raw.declaredName ?? raw.id ?? raw.contractId ?? raw.component ?? raw.title;
}

/** The display name is carried verbatim, never folded. */
export function displayNameOf(raw) {
  return raw.component ?? raw.title ?? declaredNameOf(raw);
}

/** Produce a v1-identity contract: `contractId`/`component`, `id`/`title` gone. */
export function normalizeContract(raw, { contractId, component }) {
  const { id, title, declaredName, ...rest } = raw;
  return { ...rest, contractId, component };
}

/**
 * @param {Array<object>} contracts contracts as produced by the emitter (or the
 *   Phase-0 spike, whose `id`/`title` are accepted as declared/display names)
 * @param {{ contractVersion?: string }} [options]
 */
export function publish(contracts, options = {}) {
  const contractVersion = options.contractVersion ?? "0.0.0";

  const entries = contracts.map((raw) => ({
    raw,
    declaredName: declaredNameOf(raw),
    component: displayNameOf(raw),
  }));

  const folded = foldManifest(entries.map((entry) => ({ name: entry.declaredName })));

  if (!folded.ok) {
    return {
      ok: false,
      findings: folded.findings,
      rejections: folded.rejections,
      collisions: folded.collisions,
    };
  }

  const accepted = new Set(folded.accepted.map((entry) => entry.contractId));

  const normalized = [];
  for (const entry of entries) {
    const result = fold(entry.declaredName);
    if (!result.ok || !accepted.has(result.contractId)) continue;
    normalized.push(
      normalizeContract(entry.raw, {
        contractId: result.contractId,
        component: entry.component,
      }),
    );
  }
  normalized.sort((a, b) => (a.contractId < b.contractId ? -1 : 1));

  const knapsackContracts = [];
  const losses = [];
  for (const contract of normalized) {
    const projected = projectContract(contract);
    knapsackContracts.push({ contractId: contract.contractId, json: projected.contract });
    for (const loss of projected.losses) {
      losses.push({ contractId: contract.contractId, ...loss });
    }
  }

  const manifest = projectManifest(knapsackContracts, {
    contractVersion,
    contentAddress,
  });

  const dsds = projectDsds(normalized);

  const index = {
    $format: INDEX_FORMAT,
    format: CONTRACT_FORMAT,
    contractVersion,
    artifacts: normalized.map((contract) => ({
      contractId: contract.contractId,
      component: contract.component,
      path: `${contract.contractId}.contract.json`,
      address: contentAddress(contract),
      origin: "synced",
    })),
  };

  return {
    ok: true,
    findings: [],
    contracts: normalized,
    knapsack: { contracts: knapsackContracts, manifest },
    dsds,
    index,
    losses,
  };
}
