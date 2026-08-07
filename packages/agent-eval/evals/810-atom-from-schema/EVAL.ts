/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Built from lib/eval-harness/sources/<name>.ts + lib/eval-harness/harness.ts
 * by bin/build-evals.ts. Run `pnpm build:evals` after changing either.
 *
 * Committed on purpose: the experiment fingerprint hashes the eval directory as
 * it sits on disk. The sources live outside evals/ because everything in a
 * fixture except EVAL.ts and PROMPT.md is uploaded to the sandbox.
 */

// lib/eval-harness/sources/810-atom-from-schema.ts
import { existsSync as existsSync2 } from "node:fs";
import { expect, test } from "vitest";

// lib/eval-harness/harness.ts
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
var TRANSCRIPT_FILE = "agent-transcript.jsonl";
var TRANSCRIPT_META_FILE = "agent-transcript-meta.json";
var TOOLCHAIN_REPORT_FILE = "toolchain-report.json";
var RUNTIME_REPORT_FILE = "runtime-report.json";
var requireCjs = createRequire(import.meta.url);
function newestJsonlUnder(dir, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return null;
  let best = null;
  let entries = [];
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
function summarise(raw) {
  const toolCalls = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let assistantMessages = 0;
  let observedModel = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event;
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
function captureTranscript() {
  try {
    const cwd = process.cwd();
    const encodedCwd = cwd.replace(/\//g, "-");
    const roots = ["/home/node", "/root", "/home/sandbox", "/home/user"];
    const home = homedir();
    if (home && !roots.includes(home)) roots.unshift(home);
    const searched = roots.map((root) =>
      join(root, ".claude", "projects", encodedCwd),
    );
    let found = null;
    for (const dir of searched) {
      const candidate = newestJsonlUnder(dir);
      if (candidate && (!found || candidate.mtime > found.mtime)) {
        found = candidate;
      }
    }
    if (!found) {
      for (const root of roots) {
        const candidate = newestJsonlUnder(join(root, ".claude"));
        if (candidate && (!found || candidate.mtime > found.mtime)) {
          found = candidate;
        }
      }
    }
    const meta = {
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
  } catch {}
}
function runStep(command, args) {
  try {
    execFileSync(command, args, { stdio: "pipe", timeout: 18e4 });
    return { ran: true, ok: true, detail: "" };
  } catch (error) {
    const output = [error?.stdout?.toString(), error?.stderr?.toString()]
      .filter(Boolean)
      .join("\n");
    return {
      ran: true,
      ok: false,
      detail: (output || String(error?.message ?? error)).slice(0, 4e3),
    };
  }
}
function createHarness(config) {
  const { dir, slug, pascal, renderProps } = config;
  const files = {
    component: `${dir}/${pascal}Component.tsx`,
    styles: `${dir}/${slug}.scss`,
    schema: `${dir}/${slug}.schema.json`,
  };
  const clientCandidates = [
    `${dir}/${pascal}.client.js`,
    `${dir}/js/${pascal}.client.js`,
  ];
  const clientFile2 = () => clientCandidates.find((path) => existsSync(path));
  const read2 = (path) => readFileSync(path, "utf-8");
  const digest = (path) =>
    existsSync(path)
      ? createHash("sha256").update(readFileSync(path)).digest("hex")
      : null;
  const discoverComponent = () => {
    if (existsSync(files.component)) return files.component;
    if (!existsSync(dir)) return void 0;
    const candidates = readdirSync(dir)
      .filter((name) => /\.(tsx|jsx)$/.test(name))
      .filter((name) => !/\.(test|spec|stories)\./.test(name));
    const preferred =
      candidates.find((name) =>
        new RegExp(`^${slug}(component)?\\.(tsx|jsx)$`, "i").test(name),
      ) ?? candidates[0];
    return preferred ? `${dir}/${preferred}` : void 0;
  };
  const discoverStylesheet = () => {
    if (existsSync(files.styles)) return files.styles;
    if (!existsSync(dir)) return void 0;
    const candidates = readdirSync(dir)
      .filter((name) => /\.(scss|css)$/.test(name))
      .filter((name) => !name.startsWith("_"));
    return candidates.length ? `${dir}/${candidates[0]}` : void 0;
  };
  const compileStyles = () => {
    const stylesheet = discoverStylesheet();
    if (!stylesheet) {
      return { ran: false, ok: false, detail: "no stylesheet was written" };
    }
    try {
      const sass = requireCjs("sass");
      sass.compile(stylesheet, { loadPaths: [dir, "src"] });
      return { ran: true, ok: true, detail: "" };
    } catch (error) {
      return {
        ran: true,
        ok: false,
        detail: String(error?.message ?? error).slice(0, 4e3),
      };
    }
  };
  const toolchainReport2 = {
    typecheck: runStep("npx", ["tsc", "--noEmit"]),
    styles: compileStyles(),
  };
  try {
    writeFileSync(
      TOOLCHAIN_REPORT_FILE,
      JSON.stringify(toolchainReport2, null, 2),
    );
  } catch {}
  const runtimeReport = async () => {
    const report = {
      rendered: false,
      reason: null,
      violations: [],
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
      const define = (key, value) => {
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
      const React = await import("react");
      const { createRoot } = await import("react-dom/client");
      const specifier = `./${componentPath}`;
      const moduleUnderTest = await import(specifier);
      const isRenderable = (value) => {
        if (typeof value === "function") return true;
        if (typeof value !== "object" || value === null) return false;
        const tag = value.$$typeof;
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
      const act = React.act ?? (async (fn) => void (await fn()));
      await act(async () => {
        root.render(React.createElement(candidate, renderProps));
      });
      report.rendered = container.innerHTML.trim().length > 0;
      report.html = container.innerHTML.slice(0, 4e3);
      const axe = requireCjs("axe-core");
      const results = await axe.run(container, {
        rules: {
          region: { enabled: false },
          "page-has-heading-one": { enabled: false },
          "landmark-one-main": { enabled: false },
        },
      });
      report.violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
      }));
    } catch (error) {
      report.reason = String(error?.message ?? error).slice(0, 2e3);
    }
    return report;
  };
  const writeRuntimeReport = async () => {
    const report = await runtimeReport();
    try {
      writeFileSync(RUNTIME_REPORT_FILE, JSON.stringify(report, null, 2));
    } catch {}
    return report;
  };
  return {
    dir,
    files,
    clientCandidates,
    clientFile: clientFile2,
    read: read2,
    digest,
    toolchainReport: toolchainReport2,
    runtimeReport,
    writeRuntimeReport,
    reportFiles: {
      toolchain: TOOLCHAIN_REPORT_FILE,
      runtime: RUNTIME_REPORT_FILE,
    },
  };
}

// lib/eval-harness/sources/810-atom-from-schema.ts
captureTranscript();
var harness = createHarness({
  dir: "src/components/badge",
  slug: "badge",
  pascal: "Badge",
  renderProps: {
    label: "Badge label",
    variant: "informative",
    size: "medium",
    dismissible: true,
  },
});
var { files: FILES, clientFile, read, toolchainReport } = harness;
test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync2(FILES.component)).toBe(true);
});
test("styles file follows the {slug}.scss contract", () => {
  expect(existsSync2(FILES.styles)).toBe(true);
});
test("client behaviour file follows the {Name}.client.js contract", () => {
  expect(clientFile()).toBeDefined();
});
test("the provided schema is left untouched", () => {
  const schema = JSON.parse(read(FILES.schema));
  expect(Object.keys(schema.properties).sort()).toEqual([
    "dismissible",
    "icon",
    "label",
    "size",
    "variant",
  ]);
});
test("component is pure \u2014 no React state or effects", () => {
  const source = read(FILES.component);
  for (const hook of [
    "useState",
    "useReducer",
    "useEffect",
    "useLayoutEffect",
  ]) {
    expect(source).not.toContain(hook);
  }
});
test("component forwards its ref", () => {
  expect(read(FILES.component)).toContain("forwardRef");
});
test("dismiss behaviour is implemented client-side, not in React", () => {
  const path = clientFile();
  expect(path).toBeDefined();
  const client = read(path);
  expect(client.trim().length).toBeGreaterThan(0);
  expect(client).toMatch(/addEventListener/);
});
test("styles use design tokens rather than literal colour values", () => {
  const styles = read(FILES.styles);
  const literals = styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [];
  expect(literals).toEqual([]);
  expect(styles).toMatch(/var\(--/);
});
test("toolchain and runtime reports are written for host-side grading", async () => {
  await harness.writeRuntimeReport();
  expect(existsSync2(harness.reportFiles.toolchain)).toBe(true);
});
test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});
test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
