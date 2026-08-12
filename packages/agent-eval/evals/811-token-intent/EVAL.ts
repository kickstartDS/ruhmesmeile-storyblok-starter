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
  "src/components/stat/StatComponent.tsx":
    "3d5d9cc78c5830a43d17083fd6b59d34e91426fa8ac825bc14aa595a78bbaa66",
  "src/components/stat/stat.schema.json":
    "b337a9fd31f23b9f2ed258e4105cbe9fffe1a771a11077a2f596da84384f5a9c",
  "src/components/stat/stat.scss":
    "0af7bfe2c26d389478eb47f4e8c3de8e949f7dd552e23d04cc6f3570faa7c66f",
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

// lib/eval-harness/sources/811-token-intent.ts
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

// lib/eval-harness/sources/811-token-intent.ts
captureTranscript();
var harness = createHarness({
  dir: "src/components/stat",
  slug: "stat",
  pascal: "Stat",
  renderProps: {
    value: "48,120",
    label: "Monthly active users",
    delta: "+12.4%",
    trend: "up",
  },
});
var { files: FILES, read, digest, toolchainReport } = harness;
var SHIPPED = {
  component: shipped("src/components/stat/StatComponent.tsx"),
  schema: shipped("src/components/stat/stat.schema.json"),
};
test("the component file is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});
test("the provided schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});
function primitiveColourRefs(css) {
  return [...new Set(css.match(/--ks-color-[a-zA-Z0-9-]+/g) ?? [])];
}
test("colours come from the semantic layer, not the primitive palette", () => {
  expect(primitiveColourRefs(read(FILES.styles))).toEqual([]);
});
var CATEGORIES = ["display", "copy", "interface", "mono"];
function categoryOf(token) {
  for (const category of CATEGORIES) {
    if (
      token.startsWith(`--ks-font-size-${category}`) ||
      token.startsWith(`--ks-line-height-${category}`) ||
      token === `--ks-font-family-${category}` ||
      token === `--ks-text-color-${category}`
    ) {
      return category;
    }
  }
  return null;
}
function blocks(css) {
  const out = [];
  const source = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) break;
    const selector = source.slice(index, open).split(/[;}]/).pop().trim();
    let depth = 1;
    let cursor = open + 1;
    let body = "";
    while (cursor < source.length && depth > 0) {
      const char = source[cursor];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      if (depth > 0) body += char;
      cursor += 1;
    }
    out.push({ selector, body: body.replace(/[^{}]*\{[\s\S]*?\}/g, "") });
    index = open + 1;
  }
  return out;
}
function tokensFor(body, property) {
  const found = [];
  const pattern = new RegExp(`${property}\\s*:([^;]*)`, "g");
  for (const match of body.matchAll(pattern)) {
    found.push(...(match[1].match(/--ks-[a-zA-Z0-9-]+/g) ?? []));
  }
  return found;
}
function categoryMixes(css) {
  const mixes = [];
  for (const { selector, body } of blocks(css)) {
    const sizes = tokensFor(body, "font-size").map(categoryOf).filter(Boolean);
    if (!sizes.length) continue;
    const expected = sizes[0];
    const partners = [
      ...tokensFor(body, "line-height"),
      ...tokensFor(body, "font-family"),
      ...tokensFor(body, "color"),
    ];
    for (const token of partners) {
      const category = categoryOf(token);
      if (category && category !== expected) {
        mixes.push(`${selector} \u2014 ${expected} font-size with ${token}`);
      }
    }
  }
  return mixes;
}
test("typography tokens are not mixed across categories", () => {
  expect(categoryMixes(read(FILES.styles))).toEqual([]);
});
test("the stylesheet still styles the component", () => {
  const styles = read(FILES.styles);
  expect(tokensFor(styles, "font-size").length).toBeGreaterThanOrEqual(3);
  expect(tokensFor(styles, "line-height").length).toBeGreaterThanOrEqual(3);
  expect(tokensFor(styles, "color").length).toBeGreaterThanOrEqual(3);
});
test("the two trends stay tokenised and distinct from one another", () => {
  const styles = read(FILES.styles);
  const up = blocks(styles).find((block) => block.selector.includes("--up"));
  const down = blocks(styles).find((block) =>
    block.selector.includes("--down"),
  );
  expect(up, "no rule for the up trend").toBeTruthy();
  expect(down, "no rule for the down trend").toBeTruthy();
  const upColour = tokensFor(up.body, "color");
  const downColour = tokensFor(down.body, "color");
  expect(upColour.length).toBeGreaterThan(0);
  expect(downColour.length).toBeGreaterThan(0);
  expect(upColour).not.toEqual(downColour);
});
test("no literal values are introduced", () => {
  const styles = read(FILES.styles).replace(/^\s*\/\/.*$/gm, "");
  const literals = [
    ...(styles.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(styles.match(/\b(?:rgba?|hsla?)\(/g) ?? []),
    ...(styles.match(
      /(?:font-size|line-height)\s*:[^;]*\b\d+(?:\.\d+)?(?:px|rem|em)?\s*;/g,
    ) ?? []),
  ];
  expect(literals).toEqual([]);
});
test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});
test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
