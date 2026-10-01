import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { afterAll, describe, expect, it } from "vitest";

import { buildBrief } from "./brief.mjs";
import {
  DEFAULT_MODEL,
  PROMPT_VERSION,
  describeDelta,
  narrateComponent,
  narrativeInputs,
  narrativeUpToDate,
  variantPrompt,
} from "./narrative.mjs";

const validateNarrative = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../schema/narrative.schema.json", import.meta.url)),
      "utf8",
    ),
  ),
);

/** A screenshots root with only the files a test asks for. */
const root = mkdtempSync(join(tmpdir(), "narrative-test-"));
mkdirSync(join(root, "img/screenshots"), { recursive: true });
const shot = (name, bytes = "png") => {
  const path = join(root, "img/screenshots", name);
  writeFileSync(path, bytes);
  return `img/screenshots/${name}`;
};
afterAll(() => rmSync(root, { recursive: true, force: true }));

const contract = {
  $format: "kickstartds/component-contract@1",
  contractId: "button",
  component: "Button",
  description: "Component used for user interaction",
  anatomy: {
    path: "root",
    element: "button",
    classes: ["c-button", "dsa-button"],
    role: "control",
    presence: "always",
    tokens: [],
    children: [],
  },
  api: {
    props: {
      variant: {
        type: "enum",
        values: ["primary", "secondary"],
        default: "secondary",
        role: "appearance",
      },
    },
  },
  axes: [
    {
      prop: "variant",
      default: "secondary",
      values: [
        { api: "primary", class: "c-button--solid", tokenSegment: "_primary" },
        { api: "secondary", class: null, tokenSegment: "_secondary" },
      ],
    },
  ],
  bindings: [
    { prop: "variant", mechanism: "class-toggle", parts: ["root"] },
    { prop: "type", mechanism: "none", parts: [] },
  ],
  composition: { slots: [] },
  coverage: {
    axes: {},
    parts: { total: 1, inDefault: 1, conditional: 0 },
    combinations: { proven: 1, possible: 2 },
    score: 0.5,
    baseline: { values: 1, fromExample: 0, placeholders: 0, emptySlots: [] },
    stories: { observed: 1, failed: 0 },
  },
  issues: [],
  default: {
    configuration: { variant: { value: "secondary", source: "schema-default" } },
    evidence: { story: "contract-defaults-button--contract-default", screenshot: null },
  },
  variants: [
    {
      when: { variant: "primary" },
      parts: {
        root: {
          classes: { add: ["c-button--solid"], remove: ["c-button--clear"] },
          styles: { backgroundColor: { from: "rgb(0,0,0)", to: "rgb(48,101,192)" } },
        },
      },
      evidence: { story: "components-button--primary", screenshot: null },
    },
  ],
};

describe("prompts", () => {
  it("renders a variant's derived delta verbatim", () => {
    const delta = describeDelta(contract.variants[0]);
    expect(delta).toContain("variant=primary");
    expect(delta).toContain("gains classes c-button--solid");
    expect(delta).toContain("loses classes c-button--clear");
    expect(delta).toContain("backgroundColor rgb(0,0,0) → rgb(48,101,192)");
  });

  it("grounds the variant prompt in the facts and forbids invention", () => {
    const prompt = variantPrompt(contract, contract.variants[0], {
      defaultDescription: "A compact, filled action control.",
    });
    expect(prompt.user).toContain("Component: Button");
    expect(prompt.user).toContain(".c-button.dsa-button");
    expect(prompt.user).toContain("A compact, filled action control.");
    expect(prompt.user).toContain("do not invent others");
    // behaviour-only bindings are not presented as appearance props
    expect(prompt.user).not.toContain("type (none)");
    expect(prompt.system).toContain("do not name a prop, class or token");
  });

  it("marks an introduced part rather than implying a delta", () => {
    const delta = describeDelta({
      when: { icon: true },
      parts: { "root/icon": { introduced: true } },
    });
    expect(delta).toContain("root/icon: first appears in this variant");
  });
});

describe("inputs and skip logic", () => {
  const defaultShot = shot("default.png", "default-bytes");
  const variantShot = shot("variant.png", "variant-bytes");

  const withShots = {
    ...contract,
    default: { ...contract.default, evidence: { ...contract.default.evidence, screenshot: defaultShot } },
    variants: [
      { ...contract.variants[0], evidence: { ...contract.variants[0].evidence, screenshot: variantShot } },
    ],
  };

  it("hashes the contract and every referenced screenshot", () => {
    const inputs = narrativeInputs(withShots, { screenshotsRoot: root });
    expect(Object.keys(inputs.screenshots).sort()).toEqual([defaultShot, variantShot]);
    expect(inputs.contract).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(inputs.missing).toEqual([]);
  });

  it("reports missing screenshots instead of failing", () => {
    const inputs = narrativeInputs(
      { ...withShots, default: { ...withShots.default, evidence: { story: "s", screenshot: "img/screenshots/nope.png" } } },
      { screenshotsRoot: root },
    );
    expect(inputs.missing).toEqual(["img/screenshots/nope.png"]);
    expect(inputs.screenshots["img/screenshots/nope.png"]).toBeUndefined();
  });

  it("is up to date only while model, prompt version, contract and screenshots match", () => {
    const inputs = narrativeInputs(withShots, { screenshotsRoot: root });
    const existing = { generated: { model: DEFAULT_MODEL, promptVersion: PROMPT_VERSION, inputs } };
    expect(narrativeUpToDate(existing, inputs, { model: DEFAULT_MODEL, promptVersion: PROMPT_VERSION })).toBe(true);

    expect(narrativeUpToDate(existing, inputs, { model: "gpt-4o-mini", promptVersion: PROMPT_VERSION })).toBe(false);
    expect(narrativeUpToDate(existing, inputs, { model: DEFAULT_MODEL, promptVersion: 2 })).toBe(false);

    const changed = narrativeInputs(
      { ...withShots, description: "Changed" },
      { screenshotsRoot: root },
    );
    expect(narrativeUpToDate(existing, changed, { model: DEFAULT_MODEL, promptVersion: PROMPT_VERSION })).toBe(false);

    const reshot = { ...withShots };
    shot("default.png", "default-bytes-changed");
    expect(
      narrativeUpToDate(existing, narrativeInputs(reshot, { screenshotsRoot: root }), {
        model: DEFAULT_MODEL,
        promptVersion: PROMPT_VERSION,
      }),
    ).toBe(false);
  });
});

describe("narrateComponent", () => {
  it("produces a schema-valid narrative and passes both images for a variant", async () => {
    const defaultShot = shot("d2.png", "d2");
    const variantShot = shot("v2.png", "v2");
    const contractWithShots = {
      ...contract,
      default: { ...contract.default, evidence: { story: "contract-defaults-button--contract-default", screenshot: defaultShot } },
      variants: [
        { ...contract.variants[0], evidence: { story: "components-button--primary", screenshot: variantShot } },
      ],
    };

    const calls = [];
    const caption = async ({ user, images }) => {
      calls.push({ user, images });
      return images.length === 1 ? "A compact, filled action control." : "Deeper fill, same geometry.";
    };

    const { narrative } = await narrateComponent({
      contract: contractWithShots,
      screenshotsRoot: root,
      caption,
      model: DEFAULT_MODEL,
      now: "2026-09-26T00:00:00.000Z",
    });

    expect(validateNarrative(narrative)).toBe(true);
    expect(validateNarrative.errors).toBeNull();
    expect(narrative.default).toEqual({
      description: "A compact, filled action control.",
      from: defaultShot,
    });
    expect(narrative.variants).toEqual([
      {
        story: "components-button--primary",
        when: { variant: "primary" },
        difference: "Deeper fill, same geometry.",
        from: variantShot,
      },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1].images).toHaveLength(2); // default + variant
    expect(narrative.generated).toMatchObject({
      model: DEFAULT_MODEL,
      promptVersion: PROMPT_VERSION,
      generatedAt: "2026-09-26T00:00:00.000Z",
    });
  });

  it("omits the default when its screenshot is missing, and still describes variants", async () => {
    const variantShot = shot("v3.png", "v3");
    const partial = {
      ...contract,
      variants: [
        { ...contract.variants[0], evidence: { story: "components-button--primary", screenshot: variantShot } },
      ],
    };

    const { narrative, skipped } = await narrateComponent({
      contract: partial,
      screenshotsRoot: root,
      caption: async () => "Outline treatment instead of a fill.",
      model: DEFAULT_MODEL,
      now: "2026-09-26T00:00:00.000Z",
    });

    expect(validateNarrative(narrative)).toBe(true);
    expect(narrative.default).toBeUndefined();
    expect(narrative.variants).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("returns no narrative when nothing has a screenshot", async () => {
    const { narrative, skipped } = await narrateComponent({
      contract,
      screenshotsRoot: root,
      caption: async () => "never called",
      model: DEFAULT_MODEL,
    });
    expect(narrative).toBeNull();
    expect(skipped).toEqual([]);
  });
});

describe("brief", () => {
  it("merges the default sentence and each variant difference", () => {
    const narrative = {
      $format: "kickstartds/component-narrative@1",
      component: "Button",
      default: { description: "A compact, filled action control.", from: "d.png" },
      variants: [
        {
          story: "components-button--primary",
          when: { variant: "primary" },
          difference: "Deeper fill, same geometry.",
          from: "v.png",
        },
      ],
      generated: { model: DEFAULT_MODEL, promptVersion: PROMPT_VERSION, generatedAt: "x", inputs: { screenshots: {}, contract: "sha256:x" } },
    };

    const brief = buildBrief(contract, narrative);
    expect(brief).toContain("_A compact, filled action control._");
    expect(brief).toContain("`variant: primary`");
    expect(brief).toContain("_Deeper fill, same geometry._");
  });
});
