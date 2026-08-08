/**
 * Wiring one trial into the report Storybook.
 *
 * A trial is not a project Storybook can be pointed at: it has no stories, its
 * components deliberately do not import their own stylesheet (the repo
 * registers styles globally), and it resolves its vendored packages through
 * `file:` dependencies that only exist inside that one results directory.
 *
 * This plugin bridges all three, through virtual modules so that nothing is
 * ever written into a results tree:
 *
 *   `virtual:trial`           the manifest, as data
 *   `virtual:trial-component` the produced component, its client behaviour and
 *                             its compiled styles, re-exported for a story
 *
 * Styles are compiled here rather than left to Vite because a broken
 * stylesheet is a *result*, not a build failure. An agent that writes invalid
 * SCSS should still have the rest of its trial inspectable.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Plugin } from "vite";

import type { TrialManifest } from "../manifest";

const MANIFEST_ID = "virtual:trial";
const COMPONENT_ID = "virtual:trial-component";

/**
 * The `--ks-*` token layer the component's own tokens resolve against.
 *
 * Fixtures now ship this layer in `src/token/`, so it is normally read from
 * the trial itself and is not host-supplied at all. The design-system fallback
 * below exists for results captured before that was true: those trials
 * reference tokens that nothing in their workspace defines, and rendering them
 * without a layer would show a correct component as unstyled serif text —
 * blaming the agent for the fixture's omission, which is the most misleading
 * thing a review artifact can do.
 *
 * Either way the report names its source rather than quietly changing how the
 * component looks. If neither is present it degrades to unstyled.
 */
const FALLBACK_TOKEN_FILES = [
  "../design-system/src/token/branding-tokens.css",
  "../design-system/src/token/tokens.css",
];

/** Where a fixture's synced token layer lives, relative to the project root. */
const TRIAL_TOKEN_DIR = join("src", "token");

/** Vite's convention: a resolved virtual id is prefixed so it cannot collide. */
const resolved = (id: string): string => `\0${id}`;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Alias every vendored dependency the trial declares.
 *
 * A trial has no `node_modules` — only `project/` was ever captured — so a bare
 * import of a `file:`-linked package resolves to nothing and Rollup fails the
 * entire build rather than the one module.
 *
 * Derived from the trial's own `package.json` rather than from a list of
 * package names, because the first version of this did the latter: it aliased
 * `@kickstartds/core`, which was the package that happened to break first, and
 * left `@kickstartds/ds` unwired — the vendored slice that `840-reuse-over-native`
 * exists entirely to make agents reuse. Every trial that solved that task
 * correctly was unbuildable, and the error read like the agent had invented an
 * import.
 */
function vendorAliases(
  projectDir: string,
): { find: RegExp; replacement: string }[] {
  const manifestPath = join(projectDir, "package.json");
  if (!existsSync(manifestPath)) return [];

  let deps: Record<string, string>;
  try {
    const pkg = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    // An agent may have left package.json unparseable. That is a result the
    // graders record; it is not a reason to refuse to render the trial.
    return [];
  }

  return Object.entries(deps).flatMap(([name, spec]) => {
    const local = /^(?:file|link):(.*)$/.exec(spec);
    if (!local) return [];

    const dir = resolve(projectDir, local[1]);
    if (!existsSync(dir)) return [];

    return [
      {
        find: new RegExp(`^${escapeRegExp(name)}(/.*)?$`),
        replacement: `${dir}$1`,
      },
    ];
  });
}

export interface TrialPluginOptions {
  /** Absolute path to the `run-N` directory being inspected. */
  runDir: string;
}

function readManifest(runDir: string): TrialManifest {
  const path = join(runDir, "report-manifest.json");
  if (!existsSync(path)) {
    throw new Error(
      `No report-manifest.json in ${runDir}. Run \`pnpm report build\` to generate it.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf-8")) as TrialManifest;
}

/**
 * Compile a trial stylesheet to CSS, or explain why it could not be.
 *
 * `sass` is loaded lazily so that the plugin stays importable in contexts that
 * never render (the CLI's `list`, typechecking).
 */
async function compileStyles(
  projectDir: string,
  stylePaths: string[],
): Promise<{ css: string; errors: string[] }> {
  const errors: string[] = [];
  const chunks: string[] = [];

  if (stylePaths.length === 0) return { css: "", errors };

  const sass = await import("sass").catch(() => null);
  if (!sass) {
    return { css: "", errors: ["sass is not installed in the report host"] };
  }

  for (const relative of stylePaths) {
    const absolute = join(projectDir, relative);
    if (!existsSync(absolute)) continue;

    try {
      const result = sass.compile(absolute, {
        loadPaths: [dirname(absolute), join(projectDir, "src"), projectDir],
        silenceDeprecations: ["import", "global-builtin", "mixed-decls"],
      });
      chunks.push(`/* ${relative} */\n${result.css}`);
    } catch (error) {
      errors.push(`${relative}: ${(error as Error).message}`);
    }
  }

  return { css: chunks.join("\n\n"), errors };
}

/**
 * Read the token layer the component resolves against, preferring the trial's.
 *
 * Returns the sources alongside the CSS so the report can name what it added
 * instead of quietly changing how the component looks.
 */
function ambientTokens(projectDir: string): { css: string; sources: string[] } {
  const chunks: string[] = [];
  const sources: string[] = [];

  // The trial's own layer, when the fixture shipped one.
  const trialDir = join(projectDir, TRIAL_TOKEN_DIR);
  if (existsSync(trialDir)) {
    for (const name of readdirSync(trialDir).sort()) {
      if (!/\.(css|scss)$/.test(name)) continue;
      // These are plain custom-property declarations with `//` comments; the
      // only SCSS-ism is the comment syntax, which is cheaper to strip than to
      // run the whole file through sass.
      const source = readFileSync(join(trialDir, name), "utf-8");
      chunks.push(source.replace(/^\s*\/\/.*$/gm, ""));
      sources.push(`${TRIAL_TOKEN_DIR}/${name} (shipped with the fixture)`);
    }
  }

  if (chunks.length) return { css: chunks.join("\n"), sources };

  // Older results predate the shipped layer — fall back to the design system.
  const packageRoot = resolve(new URL("../../..", import.meta.url).pathname);
  for (const relative of FALLBACK_TOKEN_FILES) {
    const absolute = resolve(packageRoot, relative);
    if (!existsSync(absolute)) continue;

    chunks.push(readFileSync(absolute, "utf-8"));
    sources.push(`${relative.replace("../", "packages/")} (host-supplied)`);
  }

  return { css: chunks.join("\n"), sources };
}

/**
 * Build the module a story imports to get at the produced component.
 *
 * The component's export shape is not guaranteed — that is part of what is
 * being graded — so the whole module namespace is re-exported and the story
 * picks a renderable export at runtime. Client behaviour is imported purely
 * for its side effect: `define()` registers against a MutationObserver, so
 * anything Storybook renders afterwards is hydrated automatically.
 */
function componentModuleSource(
  manifest: TrialManifest,
  projectDir: string,
  css: string,
  styleErrors: string[],
  ambient: { css: string; sources: string[] },
): string {
  const { component } = manifest;
  const lines: string[] = [];

  const absolute = (relative: string): string =>
    JSON.stringify(join(projectDir, relative));

  if (component.componentPath) {
    lines.push(
      `import * as componentModule from ${absolute(component.componentPath)};`,
    );
  } else {
    lines.push(`const componentModule = {};`);
  }

  for (const [index, clientPath] of component.clientPaths.entries()) {
    lines.push(`import * as client${index} from ${absolute(clientPath)};`);
  }

  if (component.defaultsPath) {
    lines.push(
      `import * as defaultsModule from ${absolute(component.defaultsPath)};`,
    );
  } else {
    lines.push(`const defaultsModule = {};`);
  }

  lines.push(
    "",
    `export const styles = ${JSON.stringify(css)};`,
    `export const styleErrors = ${JSON.stringify(styleErrors)};`,
    `export const ambientStyles = ${JSON.stringify(ambient.css)};`,
    `export const ambientSources = ${JSON.stringify(ambient.sources)};`,
    `export const clientModules = [${component.clientPaths
      .map((_, index) => `client${index}`)
      .join(", ")}];`,
    `export const exports_ = componentModule;`,
    `export const defaults_ = defaultsModule;`,
  );

  return lines.join("\n");
}

export function trialPlugin(options: TrialPluginOptions): Plugin {
  const runDir = isAbsolute(options.runDir)
    ? options.runDir
    : resolve(options.runDir);
  const projectDir = join(runDir, "project");

  let manifest: TrialManifest | null = null;

  return {
    name: "agent-eval:trial",

    config() {
      const current = readManifest(runDir);

      return {
        resolve: {
          alias: vendorAliases(projectDir),
        },
        server: {
          // The trial lives outside the host's root, so Vite must be told it is
          // allowed to serve from there.
          fs: { allow: [projectDir, runDir] },
        },
        define: {
          __TRIAL_ID__: JSON.stringify(current.id),
        },
      };
    },

    resolveId(id) {
      if (id === MANIFEST_ID || id === COMPONENT_ID) return resolved(id);
      return null;
    },

    async load(id) {
      if (id === resolved(MANIFEST_ID)) {
        manifest ??= readManifest(runDir);
        return `export default ${JSON.stringify(manifest)};`;
      }

      if (id === resolved(COMPONENT_ID)) {
        manifest ??= readManifest(runDir);
        const stylePaths = [
          manifest.component.tokenPath,
          manifest.component.stylePath,
        ].filter((path): path is string => Boolean(path));

        const { css, errors } = await compileStyles(projectDir, stylePaths);
        return componentModuleSource(
          manifest,
          projectDir,
          css,
          errors,
          ambientTokens(projectDir),
        );
      }

      return null;
    },
  };
}
