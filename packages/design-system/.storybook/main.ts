import { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import type { Manifests } from "storybook/internal/types";

import {
  dereference,
  getCustomSchemaIds,
  getSchemaRegistry,
  IProcessingOptions,
  processSchemaGlobs,
} from "@kickstartds/jsonschema-utils";

const processingConfiguration: Partial<IProcessingOptions> = {
  typeResolution: false,
  layerOrder: ["language", "visibility", "cms", "schema", "kickstartds"],
};

const config: StorybookConfig = {
  stories: [
    "../docs/**/*.mdx",
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)",
  ],

  // @ts-expect-error
  experimental_manifests: async (existingManifests: Manifests = {}) => {
    const ajv = getSchemaRegistry();
    const schemaIds = await processSchemaGlobs(
      ["src/components/**/*.schema.json"],
      ajv,
      processingConfiguration,
    );
    const customSchemaIds = getCustomSchemaIds(schemaIds);
    const dereferencedSchemas = await dereference(customSchemaIds, ajv);

    const modifiedManifests = existingManifests;

    for (const [manifestId, componentManifest] of Object.entries(
      modifiedManifests.components.components,
    )) {
      const componentName = manifestId.split("-").slice(1).join("-");
      if (componentName.startsWith("archetypes-")) continue;

      const schemaPath = Object.keys(dereferencedSchemas).find((path) =>
        path.endsWith(`${componentName}.schema.json`),
      );
      if (!schemaPath) continue;

      componentManifest.description =
        dereferencedSchemas[schemaPath].description ||
        componentManifest.description;
    }

    return modifiedManifests;
  },

  addons: [
    "@storybook/addon-links",
    // "@kickstartds/storybook-addon-html",
    // "storybook-addon-playroom",
    // "@kickstartds/storybook-addon-component-tokens",
    // "storybook-design-token",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
  ],

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  features: {
    experimentalComponentsManifest: true,
    experimentalCodeExamples: true,
  },

  staticDirs: ["../static"],

  core: {
    disableTelemetry: true,
  },

  managerHead: (head) => {
    // Load Inter locally from static assets (served via staticDirs)
    const fontFaces = `<style>
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/fonts/Inter-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7,
    U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F,
    U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
    U+A720-A7FF;
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/fonts/Inter-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
</style>`;
    return `${head}${fontFaces}<script>window.__STORYBLOK_TOKEN__=${JSON.stringify(process.env.STORYBLOK_API_TOKEN || "")}</script>`;
  },

  viteFinal: async (config) => {
    return mergeConfig(config, {
      define: {
        STORYBLOK_API_TOKEN: JSON.stringify(
          process.env.STORYBLOK_API_TOKEN || "",
        ),
      },
      optimizeDeps: {
        include: ["@storybook/addon-docs"],
      },
      plugins: [
        {
          name: "fix-mdx-react-shim",
          enforce: "pre",
          resolveId(source) {
            if (
              source.startsWith("file://") &&
              source.includes("mdx-react-shim.js")
            ) {
              // Convert file:///... path to normal filesystem path for Vite
              return new URL(source).pathname;
            }
            return null;
          },
        },
      ],
    });
  },
};
export default config;
