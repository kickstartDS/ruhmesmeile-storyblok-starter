/**
 * `get_token_usage` — reverse lookup from a design token to the components and
 * parts that bind it.
 *
 * The Component Contracts make this computable: `anatomy[].tokens` says which
 * tokens a part is styled by, and `bindings[].tokens` carries templated names
 * (e.g. `--dsa-button_{variant}--background-color`) generated from the axes join.
 * Both are read here; `contracts/` is the same published set the
 * component-builder server serves.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface ContractArtifact {
  contractId: string;
  component: string;
  path: string;
}

interface ContractIndex {
  format: string;
  contractVersion: string;
  artifacts: ContractArtifact[];
}

interface AnatomyPart {
  path?: string;
  role?: string;
  tokens?: string[];
  children?: AnatomyPart[];
}

interface ContractBinding {
  prop: string;
  mechanism: string;
  parts?: string[];
  tokens?: string[];
}

interface ContractAxisValue {
  api: unknown;
  tokenSegment?: string | null;
}

interface ContractAxis {
  prop: string;
  values: ContractAxisValue[];
}

interface ComponentContract {
  contractId: string;
  component: string;
  anatomy?: AnatomyPart;
  bindings?: ContractBinding[];
  axes?: ContractAxis[];
}

/**
 * Contracts are served only when `DESIGN_SYSTEM_CONTRACTS_DIR` points at a
 * generated `contracts/` directory. No filesystem-walk fallback: the eval arm
 * must be able to run with and without contracts, and a fallback that finds the
 * monorepo's own set would make the two arms identical.
 */
function candidates(): string[] {
  return process.env.DESIGN_SYSTEM_CONTRACTS_DIR
    ? [resolve(process.env.DESIGN_SYSTEM_CONTRACTS_DIR)]
    : [];
}

let cachedDir: string | null | undefined;

export function contractsDir(): string | null {
  if (cachedDir !== undefined) return cachedDir;
  cachedDir =
    candidates().find((dir) => existsSync(join(dir, "index.json"))) ?? null;
  return cachedDir;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/** Documents were schema-validated by the generator; check the members used here. */
function parseContract(value: unknown): ComponentContract | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.contractId !== "string") return null;
  if (typeof candidate.component !== "string") return null;
  return value as ComponentContract;
}

function loadIndex(): ContractIndex | null {
  const dir = contractsDir();
  if (!dir) return null;
  const value = readJson(join(dir, "index.json"));
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.artifacts)) return null;
  return value as ContractIndex;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Does a templated token (`--dsa-button_{variant}--color`) cover a concrete token? */
export function templateMatches(template: string, token: string): boolean {
  if (template === token) return true;
  if (!template.includes("{")) return false;
  const pattern = template
    .split(/\{[a-z0-9_]+\}/)
    .map(escapeRegExp)
    .join("[a-z0-9_-]+");
  return new RegExp(`^${pattern}$`).test(token);
}

export interface TokenUsage {
  token: string;
  components: string[];
  parts: Array<{ contractId: string; component: string; part: string | null; role?: string }>;
  props: Array<{
    contractId: string;
    component: string;
    prop: string;
    mechanism: string;
    token: string;
    parts: string[];
  }>;
  /** Populated only when nothing matched: tokens that start with the query. */
  nearMatches?: Array<{ token: string; contractId: string }>;
}

function walkParts(part: AnatomyPart, visit: (part: AnatomyPart) => void): void {
  visit(part);
  for (const child of part.children ?? []) walkParts(child, visit);
}

/**
 * Find every component/part/binding that uses `token`, matching both exact
 * token names and templated ones. When nothing matches, returns the tokens that
 * start with the query, so a partial name does not read as "dead".
 */
export function findTokenUsage(token: string): TokenUsage | null {
  const index = loadIndex();
  const dir = contractsDir();
  if (!index || !dir) return null;

  const usage: TokenUsage = { token, components: [], parts: [], props: [] };
  const candidates: Array<{ token: string; contractId: string }> = [];

  for (const artifact of index.artifacts) {
    const contract = parseContract(readJson(join(dir, `${artifact.contractId}.contract.json`)));
    if (!contract) continue;

    if (contract.anatomy) {
      walkParts(contract.anatomy, (part) => {
        for (const candidate of part.tokens ?? []) {
          candidates.push({ token: candidate, contractId: contract.contractId });
          if (templateMatches(candidate, token)) {
            usage.components.push(contract.contractId);
            usage.parts.push({
              contractId: contract.contractId,
              component: contract.component,
              part: part.path ?? null,
              role: part.role,
            });
          }
        }
      });
    }

    for (const binding of contract.bindings ?? []) {
      for (const candidate of binding.tokens ?? []) {
        candidates.push({ token: candidate, contractId: contract.contractId });
        if (templateMatches(candidate, token)) {
          usage.components.push(contract.contractId);
          usage.props.push({
            contractId: contract.contractId,
            component: contract.component,
            prop: binding.prop,
            mechanism: binding.mechanism,
            token: candidate,
            parts: binding.parts ?? [],
          });
        }
      }
    }
  }

  usage.components = [...new Set(usage.components)];

  if (usage.components.length === 0 && token.length > 0) {
    const seen = new Map<string, string>();
    for (const candidate of candidates) {
      if (
        candidate.token.startsWith(token) &&
        !candidate.token.includes("{") &&
        !seen.has(candidate.token)
      ) {
        seen.set(candidate.token, candidate.contractId);
      }
    }
    usage.nearMatches = [...seen.entries()]
      .slice(0, 25)
      .map(([nearToken, contractId]) => ({ token: nearToken, contractId }));
  }

  return usage;
}
