import { describe, expect, it } from "vitest";

import {
  CONTRACT_ID_PATTERN,
  fold,
  foldManifest,
  foldSteps,
} from "./fold.mjs";

/* Knapsack SCN-014 — declared name folds to a DSDS-valid contractId. */
describe("fold (SCN-014)", () => {
  const rows = [
    ["Button_Primary", "button-primary"],
    ["Button Primary", "button-primary"],
    ["iconBadge", "iconbadge"],
    ["ICON", "icon"],
    ["forms/Button", "forms-button"],
    ["Button--primary", "button-primary"],
    ["card-_header", "card-header"],
    ["Button.Primary", "button-primary"],
  ];

  it.each(rows)("folds %s to %s", (declared, expected) => {
    const result = fold(declared);
    expect(result).toEqual({ ok: true, contractId: expected });
    expect(result.contractId).toMatch(CONTRACT_ID_PATTERN);
  });

  it("is idempotent — the fold of a fold output is itself", () => {
    for (const [declared] of rows) {
      const once = fold(declared).contractId;
      expect(fold(once)).toEqual({ ok: true, contractId: once });
    }
  });

  it("does not truncate", () => {
    const long = "a".repeat(300);
    expect(fold(long)).toEqual({ ok: true, contractId: long });
  });

  it("exposes the steps so intermediate shape is assertable", () => {
    expect(foldSteps("  Button  Primary  ")).toBe("button-primary");
    expect(foldSteps("Icon_Badge")).toBe("icon-badge");
  });
});

/* Knapsack SCN-015 — fold rejects unusable names and refuses to merge collisions. */
describe("fold classification (SCN-015)", () => {
  it("rejects a residual character without transliterating", () => {
    expect(fold("Café")).toEqual({
      ok: false,
      reason: "carries residual character",
      character: "é",
    });
  });

  it.each(["___", "/", " ", "---", "..."])("rejects %s as empty after fold", (declared) => {
    expect(fold(declared)).toEqual({
      ok: false,
      reason: "empty after fold",
      character: null,
    });
  });
});

describe("foldManifest (SCN-015)", () => {
  it("reports rejections and collisions together, one collision per identifier", () => {
    const result = foldManifest([
      { name: "Café", source: "cem" },
      { name: "___", source: "react" },
      { name: "Button Primary", source: "cem" },
      { name: "button_primary", source: "react" },
      { name: "Button--Primary", source: "react" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.accepted).toEqual([]);

    expect(result.rejections).toEqual([
      {
        declaredName: "Café",
        source: "cem",
        reason: "carries residual character",
        character: "é",
      },
      {
        declaredName: "___",
        source: "react",
        reason: "empty after fold",
        character: null,
      },
    ]);

    expect(result.collisions).toEqual([
      {
        contractId: "button-primary",
        declaredNames: ["Button Primary", "button_primary", "Button--Primary"],
      },
    ]);

    // collect-all: two rejections + one collision in one result
    expect(result.findings).toHaveLength(3);
  });

  it("accepts a set with no findings, sorted by contractId", () => {
    const result = foldManifest([{ name: "Button" }, { name: "Blog Aside" }]);
    expect(result.ok).toBe(true);
    expect(result.accepted.map((entry) => entry.contractId)).toEqual([
      "blog-aside",
      "button",
    ]);
  });
});
