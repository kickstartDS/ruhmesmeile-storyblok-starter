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
  "src/components/article-teaser/ArticleTeaserComponent.tsx":
    "76745d8935bc525680658021e89c22799983cd2ca1b8753d8c0cd71e90f523ac",
  "src/components/article-teaser/_article-teaser-tokens.scss":
    "433b7125396edd436fe445158b8775e2793f55bbb135172cd519931517aabe83",
  "src/components/article-teaser/article-teaser.schema.json":
    "f81ef5fb4e0c9a422bc901c3c1d12372ace10ca25ee5df8ffca321c54f212251",
  "src/components/article-teaser/article-teaser.scss":
    "ef6ae73c9994b3e5bbb56d6536a2a677facd8c36404c9668ed17279baa0c3db5",
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

// lib/eval-harness/sources/816-typography-pairing.ts
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

// lib/eval-harness/sources/816-typography-pairing.ts
captureTranscript();
var harness = createHarness({
  dir: "src/components/article-teaser",
  slug: "article-teaser",
  pascal: "ArticleTeaser",
  renderProps: {
    kicker: "Engineering",
    title: "What a design system owes its consumers",
    excerpt:
      "Every token you expose is a promise. Here is how we decide which ones to make.",
    readingTime: "6 min read",
  },
});
var { files: FILES, read, digest, toolchainReport } = harness;
var SHIPPED = {
  component: shipped(
    "src/components/article-teaser/ArticleTeaserComponent.tsx",
  ),
  schema: shipped("src/components/article-teaser/article-teaser.schema.json"),
};
var ELEMENTS = ["kicker", "title", "excerpt", "reading-time"];
var allStyles = () =>
  readdirSync2(harness.dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => read(`${harness.dir}/${name}`))
    .join("\n");
var blockFor = (element) => {
  const styles = allStyles();
  const selector = new RegExp(
    `(?:&|\\.dsa-article-teaser)__${element}(?![\\w-])`,
  );
  const found = selector.exec(styles);
  if (!found) return "";
  const open = styles.indexOf("{", found.index);
  if (open === -1) return "";
  let depth = 0;
  for (let index = open; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    else if (styles[index] === "}") {
      depth -= 1;
      if (depth === 0) return styles.slice(open + 1, index);
    }
  }
  return "";
};
var expanded = (element) => {
  const styles = allStyles();
  const block = blockFor(element);
  let text = block;
  for (const [, token] of block.matchAll(/var\(\s*(--dsa-[a-z0-9_-]+)/g)) {
    const definition = styles.match(
      new RegExp(`${token}\\s*:\\s*([^;]+);`),
    )?.[1];
    if (definition)
      text += `
/* ${token} */ ${definition};`;
  }
  return text;
};
var CATEGORY = "(display|copy|interface|mono)";
var typeOf = (element) => {
  const text = expanded(element);
  const categories = /* @__PURE__ */ new Set();
  const tiers = /* @__PURE__ */ new Set();
  const collect = (pattern, withTier) => {
    for (const match of text.matchAll(pattern)) {
      categories.add(match[1]);
      if (withTier && match[2]) tiers.add(match[2]);
    }
  };
  collect(new RegExp(`--ks-font-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-font-size-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-line-height-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-font-family-${CATEGORY}(?![a-z])`, "g"), false);
  return { categories, tiers };
};
var textColourOf = (element) =>
  expanded(element).match(
    new RegExp(`--ks-text-color-(display|copy|interface)(?![a-z])`),
  )?.[1];
test("each piece of type is set from a single category", () => {
  for (const element of ELEMENTS) {
    const { categories } = typeOf(element);
    expect(
      categories.size,
      `${element} mixes ${[...categories].sort().join(" + ")}`,
    ).toBeLessThanOrEqual(1);
  }
});
test("the text colours belong to the type they sit on", () => {
  for (const element of ELEMENTS) {
    const colour = textColourOf(element);
    if (!colour) continue;
    const { categories } = typeOf(element);
    if (categories.size !== 1) continue;
    expect(
      colour,
      `${element} is ${[...categories][0]} type coloured with ${colour}`,
    ).toBe([...categories][0]);
  }
});
test("nothing is pinned back down with hand-set values", () => {
  for (const element of ELEMENTS) {
    const text = expanded(element);
    expect(text, `${element} sets a raw line-height`).not.toMatch(
      /line-height\s*:\s*[\d.]/,
    );
    expect(text, `${element} sets a raw font-size`).not.toMatch(
      /font-size\s*:\s*[\d.]+(px|rem|em)/,
    );
  }
});
test("the title still reads as display type", () => {
  const { categories, tiers } = typeOf("title");
  expect([...categories]).toEqual(["display"]);
  expect([...tiers]).toContain("m");
});
test("the kicker and reading time still read as interface type", () => {
  for (const element of ["kicker", "reading-time"]) {
    const { categories, tiers } = typeOf(element);
    expect([...categories], element).toEqual(["interface"]);
    expect([...tiers], element).toContain("xs");
  }
});
test("the excerpt is left as the copy it already was", () => {
  const { categories, tiers } = typeOf("excerpt");
  expect([...categories]).toEqual(["copy"]);
  expect([...tiers]).toContain("m");
});
test("the card's surface is left alone", () => {
  const styles = allStyles();
  for (const [token, value] of [
    ["--dsa-article-teaser--padding", "var(--ks-spacing-inset-l)"],
    ["--dsa-article-teaser--gap", "var(--ks-spacing-stack-s)"],
    ["--dsa-article-teaser--background", "var(--ks-background-color-card)"],
    ["--dsa-article-teaser--border-color", "var(--ks-border-color-default)"],
    ["--dsa-article-teaser--border-width", "var(--ks-border-width-default)"],
  ]) {
    expect(styles).toContain(`${token}: ${value};`);
  }
});
test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});
test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});
test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});
test("no unrelated files are added to the component", () => {
  const shippedFiles = /* @__PURE__ */ new Set([
    "ArticleTeaserComponent.tsx",
    "article-teaser.scss",
    "_article-teaser-tokens.scss",
    "article-teaser.schema.json",
  ]);
  const added = readdirSync2(harness.dir).filter(
    (name) => !shippedFiles.has(name) && !name.endsWith(".scss"),
  );
  expect(added).toEqual([]);
});
test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});
test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
test("toolchain and runtime reports are written for host-side grading", async () => {
  const runtime = await harness.writeRuntimeReport();
  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
  expect(existsSync2(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync2(harness.reportFiles.runtime)).toBe(true);
});
