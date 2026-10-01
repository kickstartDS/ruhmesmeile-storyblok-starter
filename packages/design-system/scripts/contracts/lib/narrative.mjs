/**
 * Pass 4 — narrative (PRD §5.12, §6.5).
 *
 * Generates the prose a contract cannot derive: what a component looks like.
 * It is model output, so it is quarantined in its own file and excluded from
 * the determinism guarantee. Everything here except `caption()` is pure:
 * prompts, input hashes and the skip decision are unit-testable without a model.
 *
 * The captioner is injected. Production wires `createOpenAiCaptioner()`; tests
 * wire a deterministic stub. Nothing else in the pipeline knows a model exists.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contentAddress } from "./canonical.mjs";
import { fileHash } from "./deterministic.mjs";

export const NARRATIVE_FORMAT = "kickstartds/component-narrative@1";
export const PROMPT_VERSION = 1;
export const DEFAULT_MODEL = "gpt-4o-2024-08-06";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const SYSTEM_PROMPT = [
  "You describe what a design-system component looks like, from a screenshot.",
  "Write two or three sentences at most, in plain prose, no lists and no headings.",
  "Describe appearance and the impression it gives a reader — weight, density, colour, emphasis.",
  "Do not describe implementation, and do not name a prop, class or token that is not in the facts you are given.",
  "Never speculate about states, viewports or themes you were not shown.",
].join(" ");

/** The facts a prompt is grounded in — copied verbatim, never invented. */
function facts(contract) {
  const lines = [
    `Component: ${contract.component}`,
    `Root element: <${contract.anatomy.element}> with classes ${contract.anatomy.classes
      .map((c) => `.${c}`)
      .join("")}`,
  ];
  if (contract.description) lines.push(`Declared purpose: ${contract.description}`);

  const visual = (contract.bindings ?? []).filter((b) => b.mechanism !== "none");
  if (visual.length) {
    lines.push(
      "Props that change appearance: " +
        visual
          .map((b) => `${b.prop} (${b.mechanism})`)
          .join(", "),
    );
  }
  return lines.join("\n");
}

/** A compact, verbatim rendering of one variant's derived delta. */
export function describeDelta(variant) {
  const lines = [];
  const config = Object.entries(variant.when ?? {})
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
    )
    .join(", ");
  lines.push(`Configuration: ${config || "(default with no changed props)"}`);

  for (const [part, state] of Object.entries(variant.parts ?? {})) {
    if (state.introduced) lines.push(`${part}: first appears in this variant`);
    const add = state.classes?.add ?? [];
    const remove = state.classes?.remove ?? [];
    if (add.length) lines.push(`${part}: gains classes ${add.join(", ")}`);
    if (remove.length) lines.push(`${part}: loses classes ${remove.join(", ")}`);
    if (typeof state.element === "object" && state.element) {
      lines.push(
        `${part}: element changes ${state.element.from} → ${state.element.to}`,
      );
    }
    for (const [property, value] of Object.entries(state.styles ?? {})) {
      if (value && typeof value === "object" && "from" in value) {
        lines.push(`${part}: ${property} ${value.from} → ${value.to}`);
      }
    }
  }
  return lines.join("\n");
}

export function defaultPrompt(contract) {
  return {
    system: SYSTEM_PROMPT,
    user: [
      facts(contract),
      "",
      "This is the component's declared default configuration.",
      "Describe what it looks like.",
    ].join("\n"),
  };
}

export function variantPrompt(contract, variant, { defaultDescription } = {}) {
  const lines = [
    facts(contract),
    "",
    "The first image is the declared default; the second is this variant.",
    defaultDescription
      ? `The default looks like this: ${defaultDescription}`
      : "",
    "The contract derived exactly these differences — do not invent others:",
    describeDelta(variant),
    "",
    "Describe only how this variant differs from the default.",
  ].filter(Boolean);
  return { system: SYSTEM_PROMPT, user: lines.join("\n") };
}

/** `img/screenshots/x.png` (as recorded in the contract) → absolute path. */
function screenshotPath(screenshotsRoot, relative) {
  return relative ? join(screenshotsRoot, relative) : null;
}

/**
 * The inputs a narrative depends on: the contract's canonical address plus a
 * content hash per screenshot. Regeneration is skipped while these are unchanged.
 */
export function narrativeInputs(contract, { screenshotsRoot }) {
  const screenshots = {};
  const missing = [];

  const consider = (relative) => {
    if (!relative) return;
    const absolute = screenshotPath(screenshotsRoot, relative);
    const hash = absolute ? fileHash(absolute) : null;
    if (hash) screenshots[relative] = hash;
    else missing.push(relative);
  };

  consider(contract.default?.evidence?.screenshot);
  for (const variant of contract.variants ?? []) {
    consider(variant.evidence?.screenshot);
  }

  return { contract: contentAddress(contract), screenshots, missing };
}

/** Is the committed narrative still valid for these inputs? */
export function narrativeUpToDate(existing, inputs, { model, promptVersion }) {
  const generated = existing?.generated;
  if (!generated) return false;
  if (generated.model !== model) return false;
  if (generated.promptVersion !== promptVersion) return false;
  if (generated.inputs?.contract !== inputs.contract) return false;

  const before = generated.inputs?.screenshots ?? {};
  const after = inputs.screenshots ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) if (before[key] !== after[key]) return false;
  return true;
}

/**
 * Caption one component.
 *
 * @param {object} options
 * @param {object} options.contract
 * @param {string} options.screenshotsRoot
 * @param {(request: { system: string, user: string, images: string[] }) => Promise<string>} options.caption
 * @param {string} options.model
 * @param {number} [options.promptVersion]
 * @param {string} [options.now] ISO timestamp; injected so tests are stable
 * @returns {Promise<{ narrative: object|null, skipped: string[] }>}
 */
export async function narrateComponent({
  contract,
  screenshotsRoot,
  caption,
  model,
  promptVersion = PROMPT_VERSION,
  now = new Date().toISOString(),
}) {
  const inputs = narrativeInputs(contract, { screenshotsRoot });

  const defaultShot = contract.default?.evidence?.screenshot ?? null;
  let defaultText = null;
  if (defaultShot && Object.hasOwn(inputs.screenshots, defaultShot)) {
    const text = (
      await caption({
        ...defaultPrompt(contract),
        images: [screenshotPath(screenshotsRoot, defaultShot)],
      })
    ).trim();
    if (text) defaultText = text;
  }

  const variants = [];
  for (const variant of contract.variants ?? []) {
    const relative = variant.evidence?.screenshot;
    if (!relative || !Object.hasOwn(inputs.screenshots, relative)) continue;
    const request = variantPrompt(contract, variant, {
      defaultDescription: defaultText,
    });
    const absolute = screenshotPath(screenshotsRoot, relative);
    // Ground the difference in both images when the default is available: the
    // model sees what changed, rather than inferring it from prose.
    const images = [defaultShot, relative]
      .filter((path) => path && Object.hasOwn(inputs.screenshots, path))
      .map((path) => screenshotPath(screenshotsRoot, path));
    const text = (await caption({ ...request, images })).trim();
    if (text) {
      variants.push({
        story: variant.evidence.story,
        when: variant.when ?? {},
        difference: text,
        from: relative,
      });
    }
  }

  if (!defaultText && variants.length === 0) {
    return { narrative: null, skipped: inputs.missing };
  }

  return {
    narrative: {
      $format: NARRATIVE_FORMAT,
      component: contract.component,
      ...(defaultText ? { default: { description: defaultText, from: defaultShot } } : {}),
      variants,
      generated: {
        model,
        promptVersion,
        generatedAt: now,
        inputs: { screenshots: inputs.screenshots, contract: inputs.contract },
      },
    },
    skipped: inputs.missing,
  };
}

/**
 * The production captioner: OpenAI chat completions with image parts, over the
 * global `fetch`. Deliberately not the `openai` SDK — this is a build-time
 * script, and a runtime dependency for one POST is not worth the lockfile.
 */
export function createOpenAiCaptioner({
  apiKey,
  model,
  baseUrl = DEFAULT_BASE_URL,
}) {
  return async ({ system, user, images }) => {
    const content = [{ type: "text", text: user }];
    for (const image of images) {
      const base64 = readFileSync(image).toString("base64");
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` },
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        // Not for reproducibility — model output is excluded from the
        // determinism guarantee (§5.12) — but to keep prose from drifting
        // between regenerations that see the same images.
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI request failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error("OpenAI response carried no message content");
    }
    return text;
  };
}
