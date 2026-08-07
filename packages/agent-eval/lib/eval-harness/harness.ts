/**
 * The part of every EVAL.ts that is not about the task.
 *
 * Transcript capture, the toolchain report and the runtime/a11y report are
 * identical across fixtures and account for roughly 400 of the 552 lines of
 * `810-atom-from-schema/EVAL.ts`. Item 1.17 adds four more evals, and four more
 * copies of that block would drift the moment one of them was fixed — which has
 * already happened twice this project (the `forwardRef` probe and the jsdom
 * `navigator` assignment were each fixed in one place because there only was
 * one place).
 *
 * This file cannot simply be imported by a fixture: `TEST_FILE_PATTERNS` in the
 * harness is the hardcoded list `['EVAL.ts', 'EVAL.tsx', 'PROMPT.md']`, matched
 * on basename, so EVAL.ts is the *only* filename withheld from the agent. A
 * helper sitting next to it would be uploaded into the workspace and would tell
 * the agent that we read its tool calls — an observer effect on the very metric
 * we are measuring. So `bin/build-evals.ts` bundles this module into each
 * fixture's EVAL.ts instead, and the generated file is committed.
 *
 * Nothing here throws. A missing transcript or a crashed probe is an
 * infrastructure failure and must never be scored as a model failure.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

export interface HarnessConfig {
  /** Component directory, e.g. `src/components/badge`. */
  dir: string;
  /** Slug used in file names, e.g. `badge`. */
  slug: string;
  /** Pascal-cased component name, e.g. `Badge`. */
  pascal: string;
  /**
   * Props the runtime probe renders with. Taken from the fixture's own schema,
   * so the probe does not depend on the agent having written a story.
   */
  renderProps: Record<string, unknown>;
}

const TRANSCRIPT_FILE = "agent-transcript.jsonl";
const TRANSCRIPT_META_FILE = "agent-transcript-meta.json";
const TOOLCHAIN_REPORT_FILE = "toolchain-report.json";
const RUNTIME_REPORT_FILE = "runtime-report.json";

// EVAL.ts is ESM (fixtures declare `"type": "module"`), so `require` is not in
// scope. These dependencies are CJS-friendly and cheaper to pull in
// synchronously than to thread through dynamic imports.
const requireCjs = createRequire(import.meta.url);

/* ────────────────────────── transcript capture ──────────────────────────────
 * `@vercel/agent-eval` captures the Claude Code transcript from a single
 * hard-coded path (`~/.claude/projects/<cwd-with-dashes>/*.jsonl`) and silently
 * yields `null` on any miss — which is what happened on our first real run
 * (`transcript: null`, `observedModel: null`, no `transcript.json` on disk).
 *
 * Cost, efficiency and MCP-usage are three of the four dimensions this package
 * exists to measure, and all three are read out of the transcript, so we cannot
 * depend on that. This searches every plausible home root, copies the raw JSONL
 * into the workspace, and writes a small summary next to it. Both files are
 * untracked, so `git add . && git diff HEAD` picks them up and they land in
 * `results/<experiment>/<ts>/<eval>/run-N/project/`.
 * ────────────────────────────────────────────────────────────────────────── */

function newestJsonlUnder(
  dir: string,
  depth = 0,
): { path: string; mtime: number } | null {
  if (depth > 4 || !existsSync(dir)) return null;
  let best: { path: string; mtime: number } | null = null;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    const candidate = stats.isDirectory()
      ? newestJsonlUnder(full, depth + 1)
      : entry.endsWith(".jsonl")
        ? { path: full, mtime: stats.mtimeMs }
        : null;
    if (candidate && (!best || candidate.mtime > best.mtime)) best = candidate;
  }
  return best;
}

/** Token totals + a tool-call histogram, so host graders do not re-parse the JSONL. */
function summarise(raw: string) {
  const toolCalls: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let assistantMessages = 0;
  let observedModel: string | null = null;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const message = event?.message;
    if (typeof message?.model === "string") observedModel = message.model;
    if (message?.role === "assistant") assistantMessages += 1;
    const usage = message?.usage;
    if (usage) {
      inputTokens += usage.input_tokens ?? 0;
      outputTokens += usage.output_tokens ?? 0;
      cacheReadTokens += usage.cache_read_input_tokens ?? 0;
      cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
    }
    for (const block of Array.isArray(message?.content)
      ? message.content
      : []) {
      if (block?.type === "tool_use" && typeof block.name === "string") {
        toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1;
      }
    }
  }

  const mcpToolCalls = Object.fromEntries(
    Object.entries(toolCalls).filter(([name]) => name.startsWith("mcp__")),
  );

  return {
    observedModel,
    assistantMessages,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheWriteTokens,
    },
    toolCalls,
    mcpToolCalls,
    mcpToolCallCount: Object.values(mcpToolCalls).reduce((a, b) => a + b, 0),
  };
}

/**
 * Digests of the fixture as shipped, injected by `bin/build-evals.ts`.
 *
 * Declared, never defined: esbuild's `define` substitutes an object literal at
 * build time. Reading it through `shipped()` keeps the failure mode loud if the
 * substitution is ever missing.
 */
declare const __FIXTURE_DIGESTS__: Record<string, string>;

/**
 * The sha256 a fixture file had before the agent touched it.
 *
 * Use this for "left untouched" assertions instead of pasting a hash. A pasted
 * hash silently rots when the fixture is edited, and a rotted one cannot be
 * distinguished from a real over-edit: `860` failed all four arms on a stale
 * constant while every arm had in fact left the file byte-identical.
 *
 * @param relPath fixture-relative POSIX path, e.g. `src/components/tag/tag.scss`
 */
export function shipped(relPath: string): string {
  const digests =
    typeof __FIXTURE_DIGESTS__ === "undefined" ? {} : __FIXTURE_DIGESTS__;
  const digest = digests[relPath];
  if (!digest) {
    throw new Error(
      `no shipped digest for "${relPath}".\n` +
        `  known: ${Object.keys(digests).sort().join(", ") || "(none — the build-time define is missing)"}`,
    );
  }
  return digest;
}

export function captureTranscript(): void {
  try {
    const cwd = process.cwd();
    const encodedCwd = cwd.replace(/\//g, "-");
    const roots = ["/home/node", "/root", "/home/sandbox", "/home/user"];
    const home = homedir();
    if (home && !roots.includes(home)) roots.unshift(home);

    const searched = roots.map((root) =>
      join(root, ".claude", "projects", encodedCwd),
    );

    let found: { path: string; mtime: number } | null = null;
    for (const dir of searched) {
      const candidate = newestJsonlUnder(dir);
      if (candidate && (!found || candidate.mtime > found.mtime)) {
        found = candidate;
      }
    }
    // Fall back to a broader sweep: the encoded-cwd convention is Claude
    // Code's, and it has changed before.
    if (!found) {
      for (const root of roots) {
        const candidate = newestJsonlUnder(join(root, ".claude"));
        if (candidate && (!found || candidate.mtime > found.mtime)) {
          found = candidate;
        }
      }
    }

    const meta: Record<string, unknown> = {
      cwd,
      encodedCwd,
      roots,
      searched,
      found: Boolean(found),
      sourcePath: found?.path ?? null,
    };

    if (found) {
      const raw = readFileSync(found.path, "utf-8");
      writeFileSync(TRANSCRIPT_FILE, raw);
      meta.bytes = raw.length;
      meta.summary = summarise(raw);
    }

    writeFileSync(TRANSCRIPT_META_FILE, JSON.stringify(meta, null, 2));
  } catch {
    // Diagnostics must never break validation.
  }
}

/* ───────────────────────── toolchain & runtime reports ──────────────────────
 * Both dimensions need code to actually execute, so unlike the structural
 * graders they cannot run on the host against a file snapshot. They run in the
 * sandbox and write JSON next to the transcript; the host-side graders read
 * those files out of `run-N/project/`.
 * ────────────────────────────────────────────────────────────────────────── */

export interface StepResult {
  ran: boolean;
  ok: boolean;
  detail: string;
}

function runStep(command: string, args: string[]): StepResult {
  try {
    execFileSync(command, args, { stdio: "pipe", timeout: 180_000 });
    return { ran: true, ok: true, detail: "" };
  } catch (error: any) {
    const output = [error?.stdout?.toString(), error?.stderr?.toString()]
      .filter(Boolean)
      .join("\n");
    return {
      ran: true,
      ok: false,
      detail: (output || String(error?.message ?? error)).slice(0, 4000),
    };
  }
}

export interface Harness {
  dir: string;
  files: { component: string; styles: string; schema: string };
  clientCandidates: string[];
  clientFile(): string | undefined;
  read(path: string): string;
  digest(path: string): string | null;
  toolchainReport: { typecheck: StepResult; styles: StepResult };
  runtimeReport(): Promise<Record<string, unknown>>;
  writeRuntimeReport(): Promise<Record<string, unknown>>;
  reportFiles: { toolchain: string; runtime: string };
}

export function createHarness(config: HarnessConfig): Harness {
  const { dir, slug, pascal, renderProps } = config;

  // The file contract is measured from the 68 components of
  // @kickstartds/design-system, not copied from an instructions file.
  // Conformance there: {Pascal}Component.tsx 68/68, {slug}.scss 61/61 of styled
  // components, {slug}.schema.json 67/68, {Pascal}.client.js (root or js/) 7/68.
  const files = {
    component: `${dir}/${pascal}Component.tsx`,
    styles: `${dir}/${slug}.scss`,
    schema: `${dir}/${slug}.schema.json`,
  };

  // The design system places client behaviour either beside the component or in
  // a js/ subdirectory; both are in use, so both are accepted.
  const clientCandidates = [
    `${dir}/${pascal}.client.js`,
    `${dir}/js/${pascal}.client.js`,
  ];

  const clientFile = () => clientCandidates.find((path) => existsSync(path));
  const read = (path: string) => readFileSync(path, "utf-8");

  /**
   * Content hash of a file, or null if it is gone.
   *
   * Restraint tasks assert that files outside the change they asked for come
   * back untouched. The expected digests are baked into EVAL.ts, which is the
   * one file the agent never sees, so it cannot work backwards from them.
   */
  const digest = (path: string): string | null =>
    existsSync(path)
      ? createHash("sha256").update(readFileSync(path)).digest("hex")
      : null;

  /**
   * Find the files by role, not by contract path.
   *
   * The first graded run made the case for this: the agent wrote `badge.tsx`
   * rather than `BadgeComponent.tsx`, so a contract-path lookup reported "no
   * component" and the a11y grader scored 0.00 — for a naming miss
   * `component-contract` had already penalised. The runtime dimension carried
   * no information at all, and the composite double-counted one mistake.
   *
   * Naming is the contract grader's job. These two ask a different question:
   * does the thing they actually built compile, render, and survive axe.
   */
  const discoverComponent = (): string | undefined => {
    if (existsSync(files.component)) return files.component;
    if (!existsSync(dir)) return undefined;

    const candidates = readdirSync(dir)
      .filter((name) => /\.(tsx|jsx)$/.test(name))
      .filter((name) => !/\.(test|spec|stories)\./.test(name));

    // Prefer a file named after the component over a barrel or a helper.
    const preferred =
      candidates.find((name) =>
        new RegExp(`^${slug}(component)?\\.(tsx|jsx)$`, "i").test(name),
      ) ?? candidates[0];

    return preferred ? `${dir}/${preferred}` : undefined;
  };

  const discoverStylesheet = (): string | undefined => {
    if (existsSync(files.styles)) return files.styles;
    if (!existsSync(dir)) return undefined;

    const candidates = readdirSync(dir)
      .filter((name) => /\.(scss|css)$/.test(name))
      // `_name.scss` is a partial, pulled in by the main sheet rather than
      // compiled on its own.
      .filter((name) => !name.startsWith("_"));

    return candidates.length ? `${dir}/${candidates[0]}` : undefined;
  };

  const compileStyles = (): StepResult => {
    const stylesheet = discoverStylesheet();
    if (!stylesheet) {
      return { ran: false, ok: false, detail: "no stylesheet was written" };
    }
    try {
      const sass = requireCjs("sass");
      sass.compile(stylesheet, { loadPaths: [dir, "src"] });
      return { ran: true, ok: true, detail: "" };
    } catch (error: any) {
      return {
        ran: true,
        ok: false,
        detail: String(error?.message ?? error).slice(0, 4000),
      };
    }
  };

  const toolchainReport = {
    typecheck: runStep("npx", ["tsc", "--noEmit"]),
    styles: compileStyles(),
  };

  try {
    writeFileSync(
      TOOLCHAIN_REPORT_FILE,
      JSON.stringify(toolchainReport, null, 2),
    );
  } catch {
    // Diagnostics must never break validation.
  }

  /**
   * Render the component and run axe against it.
   *
   * Props come from the schema the fixture supplied, so this does not depend on
   * the agent having written a story — stories and a full Storybook render land
   * in P2, where the static-artifact requirement lives.
   */
  const runtimeReport = async (): Promise<Record<string, unknown>> => {
    const report: Record<string, unknown> = {
      rendered: false,
      reason: null,
      violations: [] as unknown[],
    };

    const componentPath = discoverComponent();
    if (!componentPath) {
      report.reason = "no component was written";
      return report;
    }

    try {
      const { JSDOM } = requireCjs("jsdom");
      const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        pretendToBeVisual: true,
      });
      // Several of these are getter-only accessors on modern Node (`navigator`
      // since Node 21), so plain assignment throws `Cannot set property ...
      // which has only a getter`. defineProperty works for both accessors and
      // plain properties, so use it uniformly.
      const define = (key: string, value: unknown) => {
        Object.defineProperty(globalThis, key, {
          value,
          configurable: true,
          writable: true,
        });
      };
      define("window", dom.window);
      define("document", dom.window.document);
      define("navigator", dom.window.navigator);
      define("HTMLElement", dom.window.HTMLElement);
      define("IS_REACT_ACT_ENVIRONMENT", true);

      const React: any = await import("react");
      const { createRoot } = await import("react-dom/client");
      // Held in a variable on purpose. Written inline, the template literal is
      // statically analysable and esbuild rewrites the whole call into a
      // build-time glob of `./**/*` — which resolves to nothing, because the
      // component under test does not exist until the agent writes it. Through
      // a variable esbuild leaves the call alone, and it still goes through
      // vitest's module runner, which is what compiles the TSX.
      const specifier = `./${componentPath}`;
      const moduleUnderTest: Record<string, unknown> = await import(specifier);

      // `forwardRef()` returns an *object* (`{$$typeof, render}`), not a
      // function, and so does `memo()`. A `typeof === "function"` test rejects
      // both — which is how this probe scored 0.00 on three components that
      // rendered perfectly well. The design system uses `forwardRef` in 68/68
      // components, so the convention the fixture rewards is exactly the one
      // the naive check cannot see.
      const isRenderable = (value: unknown): boolean => {
        if (typeof value === "function") return true;
        if (typeof value !== "object" || value === null) return false;
        const tag = (value as { $$typeof?: symbol }).$$typeof;
        // Contexts and providers also carry `$$typeof` and are not renderable
        // on their own, so match the two wrappers rather than the marker.
        return (
          typeof tag === "symbol" &&
          /react\.(forward_ref|memo)/.test(String(tag.description))
        );
      };

      const candidate = [
        moduleUnderTest[pascal],
        moduleUnderTest.default,
        ...Object.values(moduleUnderTest),
      ].find(isRenderable);

      if (!candidate) {
        report.reason = "no renderable export found";
        return report;
      }

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);

      const root = createRoot(container);
      // React 18.3 exposes `act` on the root export. Not worth supporting older
      // paths for a fixture whose React version we pin ourselves.
      const act: (fn: () => void | Promise<void>) => Promise<void> =
        React.act ??
        (async (fn: () => void | Promise<void>) => void (await fn()));

      await act(async () => {
        root.render(React.createElement(candidate as any, renderProps));
      });

      report.rendered = container.innerHTML.trim().length > 0;
      report.html = container.innerHTML.slice(0, 4000);

      const axe = requireCjs("axe-core");
      // Page-level rules are meaningless for one component rendered into a bare
      // div, and would report a violation for every component ever written.
      const results = await axe.run(container, {
        rules: {
          region: { enabled: false },
          "page-has-heading-one": { enabled: false },
          "landmark-one-main": { enabled: false },
        },
      });

      report.violations = results.violations.map((violation: any) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      }));
    } catch (error: any) {
      report.reason = String(error?.message ?? error).slice(0, 2000);
    }

    return report;
  };

  const writeRuntimeReport = async (): Promise<Record<string, unknown>> => {
    const report = await runtimeReport();
    try {
      writeFileSync(RUNTIME_REPORT_FILE, JSON.stringify(report, null, 2));
    } catch {
      // Never fail validation on diagnostics.
    }
    return report;
  };

  return {
    dir,
    files,
    clientCandidates,
    clientFile,
    read,
    digest,
    toolchainReport,
    runtimeReport,
    writeRuntimeReport,
    reportFiles: {
      toolchain: TOOLCHAIN_REPORT_FILE,
      runtime: RUNTIME_REPORT_FILE,
    },
  };
}
