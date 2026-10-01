/**
 * The fold — identity derivation for component contracts.
 *
 * Adopted verbatim from the Knapsack Design System Contract (spec v0.11.0,
 * "The fold"), so that our `contractId` is interoperable by construction:
 * every fold result matches `^[a-z0-9]+(-[a-z0-9]+)*$`, which is a subset of
 * the DSDS `id` pattern and the Knapsack `contractId` pattern.
 *
 * See PRD §5.1.1–§5.1.3. The spec admits its own fold has no executable test;
 * this module is that test (fold.test.mjs covers SCN-014 and SCN-015).
 */

/** The four characters that are separators. Nothing else is a separator. */
const SEPARATORS = new Set([" ", "_", ".", "/"]);

/** Residual-character check and the normalized `contractId` shape. */
const RESIDUAL = /[^a-z0-9-]/;
export const CONTRACT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const REJECTION_EMPTY = "empty after fold";
export const REJECTION_RESIDUAL = "carries residual character";

/**
 * The five normative steps, exposed separately so a fixture can assert the
 * intermediate shape and so the emitter can reuse step 1–4 without classifying.
 *
 * @param {string} declaredName
 * @returns {string} the fold result, before classification
 */
export function foldSteps(declaredName) {
  if (typeof declaredName !== "string") {
    throw new TypeError("declaredName must be a string");
  }

  // 1. Lowercase ASCII A–Z only. No other case mapping, no Unicode
  //    normalization, before, during, or after. `[...str]` iterates code
  //    points, so a surrogate pair is one entry and can never be split.
  const lowered = [...declaredName]
    .map((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 0x41 && cp <= 0x5a ? String.fromCodePoint(cp + 32) : ch;
    })
    .join("");

  // 2. Replace every run of one or more separators with a single hyphen.
  const separated = lowered.replace(/[ _.\/]+/g, "-");

  // 3. Collapse every run of two or more hyphens to a single hyphen.
  const collapsed = separated.replace(/-{2,}/g, "-");

  // 4. Remove leading and trailing hyphens.
  return collapsed.replace(/^-+/, "").replace(/-+$/, "");

  // 5. Change nothing else: no truncation, no maximum length.
}

/**
 * Fold and classify one declared name.
 *
 * @param {string} declaredName
 * @returns {{ ok: true, contractId: string }
 *          | { ok: false, reason: string, character: string | null }}
 */
export function fold(declaredName) {
  const result = foldSteps(declaredName);

  if (result === "") {
    return { ok: false, reason: REJECTION_EMPTY, character: null };
  }

  const residual = RESIDUAL.exec(result);
  if (residual) {
    // Never transliterate, strip, or decompose — name the character.
    return {
      ok: false,
      reason: REJECTION_RESIDUAL,
      character: residual[0],
    };
  }

  return { ok: true, contractId: result };
}

/**
 * Fold a whole publish (manifest scope) and report every finding at once.
 *
 * Collect-all, one report per identifier group, never partial: the Knapsack
 * SR-131/SR-132/SR-133 behaviour. A caller that sees `ok: false` writes no
 * contract for any rejected or colliding declared name.
 *
 * @param {Array<{ name: string, source?: string }>} declaredNames
 * @returns {{
 *   ok: boolean,
 *   accepted: Array<{ contractId: string, declaredName: string, source: string|null }>,
 *   rejections: Array<{ declaredName: string, source: string|null, reason: string, character: string|null }>,
 *   collisions: Array<{ contractId: string, declaredNames: string[] }>,
 *   findings: Array<object>
 * }}
 */
export function foldManifest(declaredNames) {
  const rejections = [];
  const groups = new Map();

  for (const entry of declaredNames) {
    const name = typeof entry === "string" ? entry : entry.name;
    const source = typeof entry === "string" ? null : entry.source ?? null;
    const result = fold(name);

    if (!result.ok) {
      rejections.push({
        declaredName: name,
        source,
        reason: result.reason,
        character: result.character,
      });
      continue;
    }

    if (!groups.has(result.contractId)) groups.set(result.contractId, []);
    groups.get(result.contractId).push({ declaredName: name, source });
  }

  const collisions = [];
  const accepted = [];

  for (const [contractId, members] of groups) {
    if (members.length > 1) {
      collisions.push({
        contractId,
        declaredNames: members.map((m) => m.declaredName),
      });
      continue;
    }
    accepted.push({
      contractId,
      declaredName: members[0].declaredName,
      source: members[0].source,
    });
  }

  accepted.sort((a, b) => (a.contractId < b.contractId ? -1 : 1));
  collisions.sort((a, b) => (a.contractId < b.contractId ? -1 : 1));
  rejections.sort((a, b) => (a.declaredName < b.declaredName ? -1 : 1));

  return {
    ok: rejections.length === 0 && collisions.length === 0,
    accepted,
    rejections,
    collisions,
    findings: [...rejections, ...collisions],
  };
}
