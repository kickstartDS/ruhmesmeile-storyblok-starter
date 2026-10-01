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
  "src/components/pricing-plans/pricing-plans.schema.json":
    "97aec15fe37cf79e6cfa64bb2f4e006c7d4d40757cfe6d996e8d52c94534d2a6",
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

// lib/eval-harness/sources/890-pricing-plans.ts
import {
  existsSync as existsSync2,
  readdirSync as readdirSync2,
} from "node:fs";
import { createRequire as createRequire2 } from "node:module";
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
var SUBAGENT_TRANSCRIPT_FILE = "agent-subagent-transcripts.jsonl";
var TOOLCHAIN_REPORT_FILE = "toolchain-report.json";
var RUNTIME_REPORT_FILE = "runtime-report.json";
var MAX_SUBAGENT_BYTES = 4e6;
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
function findTaskDirs(dir, depth = 0, out = []) {
  if (depth > 5 || !existsSync(dir)) return out;
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
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
    if (!stats.isDirectory()) continue;
    if (entry === "tasks") out.push(full);
    else findTaskDirs(full, depth + 1, out);
  }
  return out;
}
function collectSubagentTranscripts(encodedCwd) {
  const roots = [];
  try {
    for (const entry of readdirSync("/tmp")) {
      if (entry.startsWith("claude-")) roots.push(join("/tmp", entry));
    }
  } catch {}
  const taskDirs = [];
  for (const root of roots) {
    const scoped = join(root, encodedCwd);
    findTaskDirs(existsSync(scoped) ? scoped : root, 0, taskDirs);
  }
  const agents = [];
  const lines = [];
  let bytes = 0;
  let truncated = false;
  for (const taskDir of taskDirs) {
    let entries = [];
    try {
      entries = readdirSync(taskDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".output")) continue;
      let raw;
      try {
        raw = readFileSync(join(taskDir, entry), "utf-8");
      } catch {
        continue;
      }
      if (bytes + raw.length > MAX_SUBAGENT_BYTES) {
        truncated = true;
        continue;
      }
      bytes += raw.length;
      lines.push(
        raw.endsWith("\n")
          ? raw
          : `${raw}
`,
      );
      agents.push({
        agentId: entry.replace(/\.output$/, ""),
        bytes: raw.length,
        summary: summarise(raw),
      });
    }
  }
  if (lines.length) writeFileSync(SUBAGENT_TRANSCRIPT_FILE, lines.join(""));
  const mcpToolCalls = {};
  const toolCalls = {};
  for (const agent of agents) {
    const summary = agent.summary;
    for (const [name, n] of Object.entries(summary.toolCalls)) {
      toolCalls[name] = (toolCalls[name] ?? 0) + n;
    }
    for (const [name, n] of Object.entries(summary.mcpToolCalls)) {
      mcpToolCalls[name] = (mcpToolCalls[name] ?? 0) + n;
    }
  }
  return {
    searchedRoots: roots,
    taskDirs,
    count: agents.length,
    bytes,
    truncated,
    agents,
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
    meta.subagents = collectSubagentTranscripts(encodedCwd);
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

// lib/eval-harness/sources/890-pricing-plans.ts
captureTranscript();
var requireCjs2 = createRequire2(import.meta.url);
var harness = createHarness({
  dir: "src/components/pricing-plans",
  slug: "pricing-plans",
  pascal: "PricingPlans",
  renderProps: {
    layout: "equal",
    plan: [
      {
        name: "Basic",
        price: "$99",
        pricePeriod: "per month",
        description: "For a single landing page.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [{ text: "130+ coded blocks" }],
      },
      {
        name: "Premium",
        price: "$199",
        pricePeriod: "per month",
        description: "For teams shipping several sites.",
        badge: "Popular",
        highlight: true,
        cta: { url: "#", label: "Book a meeting" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Premium support", icon: "check" },
        ],
      },
      {
        name: "Enterprise",
        price: "$399",
        pricePeriod: "per month",
        description: "For several brands and teams.",
        cta: { url: "#", label: "Talk to us" },
        featureListTitle: "What's included:",
        featureList: [{ text: "130+ coded blocks" }],
      },
    ],
  },
});
var { files: FILES, read, digest, toolchainReport } = harness;
var SHIPPED = {
  schema: shipped("src/components/pricing-plans/pricing-plans.schema.json"),
};
var HIGHLIGHTED_PRICE = "$199";
var OTHER_PRICES = ["$99", "$399"];
var COLOUR_DECLARATION =
  /(?:^|[;{\n])\s*(--[a-z0-9_-]*(?:color|background|border|shadow|fill|stroke)[a-z0-9_-]*|color|background|background-color|background-image|border|border-color|border-[a-z-]*color|fill|stroke|outline|outline-color|box-shadow)\s*:\s*([^;]+);/gm;
var LITERAL_COLOUR =
  /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(|\b(white|black|silver|gray|grey|red|blue|green|navy|teal|maroon|purple|orange|yellow|pink|brown|lime|aqua|fuchsia)\b/i;
function allStyles() {
  if (!existsSync2(harness.dir)) return "";
  return readdirSync2(harness.dir)
    .filter((name) => name.endsWith(".scss") || name.endsWith(".css"))
    .map((name) => read(harness.dir + "/" + name))
    .join("\n");
}
function colourDeclarations(styles) {
  const out = [];
  for (const match of styles.matchAll(COLOUR_DECLARATION)) {
    out.push([match[1].trim(), match[2].trim()]);
  }
  return out;
}
function literalColours(styles) {
  return colourDeclarations(styles)
    .map(([, value]) => value)
    .filter((value) => !/^var\(--/.test(value))
    .filter((value) => LITERAL_COLOUR.test(value));
}
function reimplementsInversion(styles) {
  return (
    /\[ks-inverted/.test(styles) ||
    /prefers-color-scheme/.test(styles) ||
    /\[data-theme/.test(styles)
  );
}
function semanticColourTokens(styles) {
  const found = /* @__PURE__ */ new Set();
  for (const [, value] of colourDeclarations(styles)) {
    for (const match of value.matchAll(/var\((--ks-[a-z0-9-]+)/g)) {
      found.add(match[1]);
    }
  }
  return [...found];
}
function cssRules(css) {
  const rules = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: match[1].trim(), body: match[2].trim() });
  }
  return rules;
}
function surfaceSelectors(rules) {
  return rules
    .filter(({ body }) => {
      const match = body.match(
        /(^|[;\s{])background(-color|-image)?\s*:\s*([^;]+)/,
      );
      if (!match) return false;
      const value = match[3].trim();
      return value !== "none" && value !== "transparent";
    })
    .map(({ selector }) => selector);
}
function haloSelectors(rules) {
  return rules
    .filter(({ body }) => /(^|[;\s{])z-index\s*:\s*-\d+/.test(body))
    .map(({ selector }) => selector);
}
function hostOf(selector) {
  return selector.replace(/::(?:before|after)\b/g, "").trim();
}
function matchesAny(element, selectors) {
  return selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}
function writtenComponent(dir) {
  if (!existsSync2(dir)) return { component: false, styles: false };
  const names = readdirSync2(dir);
  return {
    component: names.some(
      (name) =>
        /\.(tsx|jsx)$/.test(name) && !/\.(test|spec|stories)\./.test(name),
    ),
    styles: names.some(
      (name) => /\.(scss|css)$/.test(name) && !name.startsWith("_"),
    ),
  };
}
function usesInvertedTokens(region, rules) {
  const invertedComponents = /* @__PURE__ */ new Set();
  for (const { body } of rules) {
    for (const match of body.matchAll(
      /(--[a-z0-9_-]+)\s*:\s*var\((--ks-[a-z0-9-]*inverted[a-z0-9-]*)\b/g,
    )) {
      invertedComponents.add(match[1]);
    }
  }
  for (const element of [region, ...region.querySelectorAll("*")]) {
    for (const rule of rules) {
      if (!matchesAny(element, [rule.selector])) continue;
      for (const declaration of rule.body.matchAll(
        /(?:background(-color|-image)?|color|border-[a-z-]*color|fill)\s*:\s*([^;]+)/g,
      )) {
        const value = declaration[2];
        if (/var\(--ks-[a-z0-9-]*inverted/.test(value)) return true;
        for (const token of value.matchAll(/var\((--[a-z0-9_-]+)/g)) {
          if (invertedComponents.has(token[1])) return true;
        }
      }
    }
  }
  return false;
}
function haloOverSurface(elements, hosts, surfaces) {
  const matchesAny2 = (element, selectors) =>
    selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    });
  const hosted = elements.filter((element) => matchesAny2(element, hosts));
  return hosted
    .filter((element) => matchesAny2(element, surfaces))
    .map((element) => element.outerHTML.slice(0, 120));
}
async function rendered() {
  const report = await harness.runtimeReport();
  const html = typeof report.html === "string" ? report.html : "";
  if (!html) return null;
  const { JSDOM } = requireCjs2("jsdom");
  const dom = new JSDOM(
    `<!doctype html><body><div id="r">${html}</div></body>`,
  );
  return dom.window.document.getElementById("r");
}
function compiled() {
  if (!existsSync2(FILES.styles)) return "";
  try {
    return requireCjs2("sass").compile(FILES.styles, {
      loadPaths: [harness.dir, "src"],
    }).css;
  } catch {
    return "";
  }
}
function tokensDeclaredOutside(inverted, rules) {
  const offenders = [];
  for (const region of inverted) {
    const inside = [region, ...region.querySelectorAll("*")];
    const consumed = /* @__PURE__ */ new Set();
    for (const element of inside) {
      for (const rule of rules) {
        if (!matchesAny(element, [rule.selector])) continue;
        for (const match of rule.body.matchAll(
          /(?:background(-color|-image)?|border-[a-z-]*color|color)\s*:\s*[^;]*?var\((--dsa-[a-z0-9_-]+)/g,
        )) {
          consumed.add(match[2]);
        }
      }
    }
    for (const token of consumed) {
      const declaring = rules
        .filter((rule) => rule.body.includes(`${token}:`))
        .map((rule) => hostOf(rule.selector));
      const declaredInside = declaring.some((selector) =>
        inside.some((element) => matchesAny(element, [selector])),
      );
      if (!declaredInside) {
        offenders.push(
          `${token} is used inside the inverted region but declared by ${declaring.join(" | ") || "nothing"}`,
        );
      }
    }
  }
  return offenders;
}
test("a component and a stylesheet are written into the component directory", () => {
  expect(existsSync2(FILES.schema)).toBe(true);
  const written = writtenComponent(harness.dir);
  expect(written.component).toBe(true);
  expect(written.styles).toBe(true);
});
test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});
test("no colour is written as a literal", () => {
  expect(literalColours(allStyles())).toEqual([]);
});
test("the inversion is not reimplemented in the component", () => {
  expect(reimplementsInversion(allStyles())).toBe(false);
});
test("colours come from the token system", () => {
  expect(semanticColourTokens(allStyles()).length).toBeGreaterThanOrEqual(3);
});
test("the row lays the plans out along one axis", () => {
  expect(allStyles()).toMatch(/display:\s*(grid|flex)/);
});
test("the recommended plan inverts through the token layer", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();
  const text = (element) => element.textContent ?? "";
  const plan = [...root.querySelectorAll("*")].find(
    (element) =>
      text(element).includes(HIGHLIGHTED_PRICE) &&
      !OTHER_PRICES.some((price) => text(element).includes(price)),
  );
  expect(plan).toBeDefined();
  const marked =
    plan.getAttribute("ks-inverted") === "true" ||
    Boolean(plan.querySelector('[ks-inverted="true"]'));
  const tokens = usesInvertedTokens(plan, cssRules(compiled()));
  expect(
    marked || tokens,
    `inverted: attribute=${marked} tokens=${tokens}`,
  ).toBe(true);
});
test("the call to action is the library's, not a hand-rolled control", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();
  const controls = [...root.querySelectorAll("button, a")];
  expect(controls.length).toBe(3);
  expect(
    controls.filter((control) =>
      String(control.className).includes("dsa-button"),
    ).length,
  ).toBe(3);
});
test("the halo is painted behind the card, not over it", async () => {
  const rules = cssRules(compiled());
  const halos = haloSelectors(rules);
  if (halos.length === 0) return;
  const hosts = halos.map(hostOf);
  const surfaces = surfaceSelectors(rules).filter(
    (selector) => !halos.includes(selector),
  );
  const root = await rendered();
  expect(root).not.toBeNull();
  expect(
    haloOverSurface([...root.querySelectorAll("*")], hosts, surfaces),
  ).toEqual([]);
});
test("the colours of the recommended plan are declared where the inversion applies", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();
  const inverted = [...root.querySelectorAll('[ks-inverted="true"]')];
  if (inverted.length === 0) return;
  expect(tokensDeclaredOutside(inverted, cssRules(compiled()))).toEqual([]);
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
export {
  colourDeclarations,
  cssRules,
  haloOverSurface,
  haloSelectors,
  hostOf,
  literalColours,
  matchesAny,
  reimplementsInversion,
  semanticColourTokens,
  surfaceSelectors,
  tokensDeclaredOutside,
  usesInvertedTokens,
  writtenComponent,
};
