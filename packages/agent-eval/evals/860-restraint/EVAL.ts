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

// <define:__FIXTURE_DIGESTS__>
var define_FIXTURE_DIGESTS_default = {
  "src/components/tag/TagComponent.tsx":
    "489c6a8dca061a785972ce613b56d8a5830dfa8180d407f51e5f1c600d0f63bd",
  "src/components/tag/_tag-tokens.scss":
    "df8afd6e6e30c5c21942747d5cfee52bb387ca36d7ee3cf5d0f4c044fab82547",
  "src/components/tag/js/Tag.client.js":
    "0883dadf587258ea0db70bc61ac64053729e071d34cee5a2a6cdc994c9fa908d",
  "src/components/tag/tag.schema.json":
    "04e6a48850ead294d70b904fd9f899f1444941a8fae1e88466ac1751ce300aeb",
  "src/components/tag/tag.scss":
    "f5c4b9ef77ce74deebfa3af8cb024bfd4e69961e3a45198747d2aa7128f8af7f",
  "src/token/background-color-token.scss":
    "6238d7754e6f27ddd3312add938fe8638da1df934c7e5c961c22dbd9cc9bc03f",
  "src/token/border-color-token.scss":
    "a42ecd37f04b25d48faf6806dc5ec011c5c472d4ad3b175b91afc8c9d307dab7",
  "src/token/border-token.scss":
    "c3388cec18e51807eb8f985ad0737581b4b5d87e2d1575e9bf49a1f58178fc7e",
  "src/token/box-shadow-token.scss":
    "781467e4312a5c2f03a164000482575506221dcb7faa77174a6691e608d4c1b7",
  "src/token/branding-tokens.css":
    "b7982c0fea11e59260e54c77b15dfda9d68b64e9beee315bb8fc3b9d47494b2e",
  "src/token/color-token.scss":
    "434eb5a9fa368af630b24a308a8ea6327172be91a60a6734ca8c17f04e711810",
  "src/token/font-size-token.scss":
    "651ad344098ded528b4808b2b378d20e87d20d23b9bf1a0193b495a4093f7fee",
  "src/token/font-token.scss":
    "a9c9f193d4a91e27f1985ca99d24deef648bf2816a54dcbe22f9f7c76ddf23d0",
  "src/token/scaling-token.scss":
    "62d2659ce880d74c4640ae74392e3f3768e59b076898d14f377f1ee9c0c839cc",
  "src/token/spacing-token.scss":
    "76e37f5f1e3baa4e926829a0d331ffd39344689001a90b097a5ba5a32356d09d",
  "src/token/text-color-token.scss":
    "3606c15dc3894f0a57d73b0267fe513f00b7323bdc5a2945da346eb09ff95d98",
  "src/token/transition-token.scss":
    "6674234915fe5165d6481da46772354a3564838e8a1a763e8d2e19e8d30394e8",
};

// lib/eval-harness/sources/860-restraint.ts
import {
  existsSync as existsSync2,
  readdirSync as readdirSync2,
} from "node:fs";
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
function shipped(relPath) {
  const digests =
    typeof define_FIXTURE_DIGESTS_default === "undefined"
      ? {}
      : define_FIXTURE_DIGESTS_default;
  const digest2 = digests[relPath];
  if (!digest2) {
    throw new Error(
      `no shipped digest for "${relPath}".
  known: ${Object.keys(digests).sort().join(", ") || "(none \u2014 the build-time define is missing)"}`,
    );
  }
  return digest2;
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
  const clientFile = () => clientCandidates.find((path) => existsSync(path));
  const read2 = (path) => readFileSync(path, "utf-8");
  const digest2 = (path) =>
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
    clientFile,
    read: read2,
    digest: digest2,
    toolchainReport: toolchainReport2,
    runtimeReport,
    writeRuntimeReport,
    reportFiles: {
      toolchain: TOOLCHAIN_REPORT_FILE,
      runtime: RUNTIME_REPORT_FILE,
    },
  };
}

// lib/eval-harness/sources/860-restraint.ts
captureTranscript();
var harness = createHarness({
  dir: "src/components/tag",
  slug: "tag",
  pascal: "Tag",
  renderProps: {
    label: "Design system",
    removable: true,
    removeLabel: "Remove Design system",
  },
});
var { files: FILES, read, digest, toolchainReport } = harness;
var SHIPPED = {
  schema: shipped("src/components/tag/tag.schema.json"),
  client: shipped("src/components/tag/js/Tag.client.js"),
  tokens: shipped("src/components/tag/_tag-tokens.scss"),
};
var runtime = await harness.writeRuntimeReport();
test("the reported violation is gone", () => {
  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
});
test("the remove control has an accessible name", () => {
  const html = String(runtime.html ?? "");
  const button = html.match(/<button[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(button).toMatch(/Remove Design system/);
});
test("the accessible name comes from the existing prop", () => {
  const source = read(FILES.component);
  expect(source).toMatch(/removeLabel/);
});
test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});
test("unrelated client behaviour is left untouched", () => {
  expect(digest(`${harness.dir}/js/Tag.client.js`)).toBe(SHIPPED.client);
});
test("the component token partial is left untouched", () => {
  expect(digest(`${harness.dir}/_tag-tokens.scss`)).toBe(SHIPPED.tokens);
});
test("the stylesheet is not rewritten", () => {
  const styles = read(FILES.styles);
  for (const selector of [
    ".dsa-tag",
    ".dsa-tag__label",
    ".dsa-tag__remove",
    ".dsa-tag__remove-icon",
  ]) {
    expect(styles).toContain(selector);
  }
  expect(styles).toContain('@use "tag-tokens');
});
test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});
test("no unrequested files are added to the component", () => {
  const shipped2 = /* @__PURE__ */ new Set([
    "TagComponent.tsx",
    "tag.scss",
    "_tag-tokens.scss",
    "tag.schema.json",
    "js",
  ]);
  const added = readdirSync2(harness.dir)
    .filter((name) => !shipped2.has(name))
    .filter((name) => !/\.(test|spec|stories)\./.test(name));
  expect(added).toEqual([]);
});
test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});
test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
test("toolchain and runtime reports are written for host-side grading", () => {
  expect(existsSync2(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync2(harness.reportFiles.runtime)).toBe(true);
});
