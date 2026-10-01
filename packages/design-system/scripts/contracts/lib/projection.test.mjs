import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { contentAddress, verifyAddress } from "./canonical.mjs";
import { projectContract, projectManifest } from "./knapsack.mjs";
import { orderDefaultFirst, projectDsds, projectTraits } from "./dsds.mjs";
import { publish } from "./publish.mjs";

const here = (relative) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateKnapsack = ajv.compile(
  here("../vendor/knapsack/component.contract.schema.json"),
);
const validateManifest = ajv.compile(
  here("../vendor/knapsack/manifest.schema.json"),
);

/** A contract in the emitter's (or Phase-0 spike's) input shape. */
const button = {
  $format: "kickstartds/component-contract@1",
  id: "button",
  title: "Button",
  description: "Component used for user interaction",
  api: {
    schema: "./button.schema.dereffed.json",
    required: ["label"],
    props: {
      disabled: { type: "boolean", default: false, role: "state", axis: true },
      label: { type: "string", role: "content", required: true },
      size: {
        type: "enum",
        values: ["small", "medium", "large"],
        default: "medium",
        role: "appearance",
        axis: true,
      },
      type: {
        type: "enum",
        values: ["button", "submit", "reset"],
        default: "button",
        role: "behaviour",
      },
      url: { type: "string", format: "uri", role: "behaviour" },
      variant: {
        type: "enum",
        values: ["primary", "secondary", "tertiary"],
        default: "secondary",
        role: "appearance",
        axis: true,
      },
    },
  },
  composition: { slots: [{ prop: "buttons", part: "root" }] },
};

describe("Knapsack projection", () => {
  it("emits a contract that validates against the target's own schema", () => {
    const { contract } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    expect(validateKnapsack(contract)).toBe(true);
    expect(validateKnapsack.errors).toBeNull();
  });

  it("maps enum props to a JSON Schema type + enum, default-only otherwise", () => {
    const { contract } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    expect(contract.props.properties.variant).toEqual({
      type: "string",
      enum: ["primary", "secondary", "tertiary"],
      default: "secondary",
    });
    expect(contract.props.properties.disabled).toEqual({
      type: "boolean",
      default: false,
    });
    expect(contract.props.properties.url).toEqual({ type: "string" });
  });

  it("closes the prop set and keeps required ⊆ properties", () => {
    const { contract } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    expect(contract.props.additionalProperties).toBe(false);
    expect(contract.props.required).toEqual(["label"]);
    for (const name of contract.props.required) {
      expect(Object.keys(contract.props.properties)).toContain(name);
    }
  });

  it("projects composition slots as slot names", () => {
    const { contract } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    expect(contract.slots).toEqual(["buttons"]);
  });

  it("records what it dropped instead of hiding it", () => {
    const { losses } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    const dropped = new Set(losses.map((loss) => loss.field));
    expect(dropped).toContain("role");
    expect(dropped).toContain("axis");
    expect(dropped).toContain("format");
  });

  it("builds a manifest with valid addresses that verify on read", () => {
    const { contract } = projectContract({
      ...button,
      contractId: "button",
      component: "Button",
    });
    const manifest = projectManifest([{ contractId: "button", json: contract }], {
      contractVersion: "2.2.1",
      contentAddress,
    });
    expect(validateManifest(manifest)).toBe(true);
    expect(manifest.artifacts[0]).toMatchObject({
      path: "button.contract.json",
      origin: "synced",
    });
    expect(verifyAddress(contract, manifest.artifacts[0].address).ok).toBe(true);
  });
});

describe("DSDS projection", () => {
  it("orders enum values default-first", () => {
    expect(orderDefaultFirst("secondary", ["primary", "secondary", "tertiary"])).toEqual(
      ["secondary", "primary", "tertiary"],
    );
    expect(orderDefaultFirst(undefined, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("maps enums, booleans and states, and skips free-form props", () => {
    const traits = projectTraits({
      ...button,
      contractId: "button",
      component: "Button",
    });
    expect(traits).toEqual([
      { name: "disabled", traitType: "variant", kind: "boolean" },
      {
        name: "size",
        traitType: "variant",
        kind: "enum",
        values: ["medium", "small", "large"],
      },
      {
        name: "variant",
        traitType: "variant",
        kind: "enum",
        values: ["secondary", "primary", "tertiary"],
      },
    ]);
    expect(traits.some((trait) => trait.name === "label")).toBe(false);
    expect(traits.some((trait) => trait.name === "url")).toBe(false);
    // `type` is an enum but role `behaviour` — a submit button is not a design variant.
    expect(traits.some((trait) => trait.name === "type")).toBe(false);
  });

  it("emits two specs entries per component: ours and the Knapsack projection", () => {
    const dsds = projectDsds([
      { ...button, contractId: "button", component: "Button" },
    ]);
    expect(dsds.components).toHaveLength(1);
    const [entry] = dsds.components;
    expect(entry.id).toBe("button");
    expect(entry.contractId).toBe("button");
    expect(entry.specs.map((spec) => spec.href)).toEqual([
      "../button.contract.json",
      "../knapsack/button.contract.json",
    ]);
    expect(entry.specs.every((spec) => spec.rel === "contract")).toBe(true);
  });
});

describe("publish", () => {
  it("normalizes identity and produces verifying addresses", () => {
    const result = publish([button], { contractVersion: "2.2.1" });
    expect(result.ok).toBe(true);
    expect(result.contracts[0]).toMatchObject({
      contractId: "button",
      component: "Button",
    });
    expect(result.contracts[0].id).toBeUndefined();
    expect(result.contracts[0].title).toBeUndefined();
    expect(verifyAddress(result.contracts[0], result.index.artifacts[0].address).ok).toBe(
      true,
    );
    expect(result.index.artifacts[0].origin).toBe("synced");
  });

  it("fails the whole publish on a fold collision and writes nothing", () => {
    const result = publish([
      button,
      { ...button, id: "button", title: "Button" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0].contractId).toBe("button");
    expect(result.contracts).toBeUndefined();
  });
});
