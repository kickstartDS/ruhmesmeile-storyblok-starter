import { describe, expect, it } from "vitest";

import {
  componentExportName,
  isContractSubject,
  listComponents,
  pascal,
} from "./components.mjs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");

describe("component discovery", () => {
  it("derives the PascalCase file prefix", () => {
    expect(pascal("button")).toBe("Button");
    expect(pascal("blog-aside")).toBe("BlogAside");
    expect(pascal("nav-dropdown")).toBe("NavDropdown");
  });

  it("requires a component, a schema, and defaults", () => {
    expect(
      isContractSubject("button", [
        "ButtonComponent.tsx",
        "button.schema.json",
        "ButtonDefaults.ts",
        "button.scss",
      ]),
    ).toBe(true);

    expect(isContractSubject("cms", ["PageProps.ts", "page.schema.json"])).toBe(
      false,
    );
    expect(
      isContractSubject("lightbox", ["lightbox.scss", "lightbox-tokens.json"]),
    ).toBe(false);
    expect(
      isContractSubject("tile", [
        "TileDefaults.ts",
        "tile.schema.json",
        "TileProps.ts",
      ]),
    ).toBe(false);
  });

  it("picks the export the generated story must import", () => {
    expect(componentExportName("export const Button = forwardRef<", "button")).toBe(
      "Button",
    );
    expect(
      componentExportName("export const TextFieldComponent = forwardRef<", "text-field"),
    ).toBe("TextFieldComponent");
    // data-only component: nothing to render, so no export to import
    expect(
      componentExportName('export type { SeoProps } from "./SeoProps";', "seo"),
    ).toBeNull();
  });

  it("discovers the repository's real subject set and skips the rest", () => {
    const { subjects, skipped, exportNames } = listComponents(PACKAGE_ROOT);

    expect(subjects).toContain("button");
    expect(subjects).toContain("section");
    expect(subjects).toContain("faq");
    expect(subjects.length).toBeGreaterThan(60);

    expect(exportNames.button).toBe("Button");
    expect(exportNames["text-field"]).toBe("TextFieldComponent");

    // No renderable component, no contract — never guessed at.
    for (const id of ["cms", "lightbox", "rich-text", "tile", "blog-tag", "seo"]) {
      expect(subjects).not.toContain(id);
      expect(skipped).toContain(id);
    }
  });
});
