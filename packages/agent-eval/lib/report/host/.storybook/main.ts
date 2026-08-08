import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

import { trialPlugin } from "../trial-plugin";

/**
 * The trial under inspection, as an absolute path to a `run-N` directory.
 *
 * Set by `bin/report.ts`. The Storybook config itself stays trial-agnostic so
 * that one host build serves every trial, one at a time — building a Storybook
 * per trial from a shared host avoids both 60 `node_modules` trees and the CSS
 * collisions of putting every trial in one instance (each trial's stylesheet
 * claims the same BEM block).
 */
const runDir = process.env.AGENT_EVAL_TRIAL;

if (!runDir) {
  throw new Error(
    "AGENT_EVAL_TRIAL is not set — start the report through `pnpm report open <trial>`.",
  );
}

const config: StorybookConfig = {
  stories: [
    fileURLToPath(new URL("../stories/**/*.stories.tsx", import.meta.url)),
  ],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => {
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      trialPlugin({ runDir }),
    ];
    return viteConfig;
  },
};

export default config;
