/**
 * Pass 3 — Reconciliation. Pure function over Pass 1 + Pass 2 output.
 *
 * Produces anatomy (union of observed trees), axes (three-vocabulary join),
 * default (baseline state), variants (deltas only) and bindings
 * (prop → part → mechanism).
 */

import { parseTokenName } from "./tokenGrammar.mjs";

/* ------------------------------------------------------------------ naming */

const SEMANTIC_TAG = {
  svg: "icon",
  img: "image",
  picture: "image",
  video: "video",
  source: "source",
};

/**
 * The part-naming ladder. This is the one inference step in the pipeline, so
 * it is convention-driven and ordered, and every part records `observedIn`.
 */
/**
 * A nested component instance. The design system marks these two ways:
 *   `l-container--<component>`  layout wrapper around a child component
 *   `dsa-<component>`           the child component's own root class
 * Crossing one means we have left this component and entered another.
 */
function slotBoundary(node, componentId) {
  for (const c of node.classes) {
    const m = c.match(/^l-container--([a-z0-9-]+)$/);
    if (m && m[1] !== componentId) return m[1];
  }
  for (const c of node.classes) {
    const m = c.match(/^dsa-([a-z0-9-]+)$/);
    if (m && m[1] !== componentId) return m[1];
  }
  return null;
}

/** Does this subtree contain any token defined by the component under study? */
const definesOwnTokens = (n) =>
  (n.definedTokens?.length ?? 0) > 0 ||
  (n.children || []).some(definesOwnTokens);

/** Does a descendant carry a BEM element class matching `name`? */
function descendantClaims(node, name) {
  const re = new RegExp(`__${name}(?:--|$)`);
  const scan = (n) =>
    (n.children || []).some(
      (c) => c.classes.some((cl) => re.test(cl)) || scan(c),
    );
  return scan(node);
}

/** Glyph internals (<use>, <path>) are rendering detail, not anatomy. */
const OPAQUE_TAGS = new Set(["svg", "picture", "video"]);

function namePart(node, componentId, index, args) {
  // (a) BEM element segment — prefer the design-system's own `dsa-` classes
  const bem = [...node.classes]
    .sort(
      (a, b) => (b.startsWith("dsa-") ? 1 : 0) - (a.startsWith("dsa-") ? 1 : 0),
    )
    .map((c) => c.match(/__([a-z0-9-]+)(?:--|$)/))
    .find(Boolean);
  if (bem) return { name: bem[1], via: "bem-class" };

  // (b) token grammar — the leaf element of a token defined on this node.
  // Tokens cascade, so a container often declares its children's tokens. Only
  // trust the name when no descendant already claims it via a BEM class.
  for (const t of node.definedTokens || []) {
    const parsed = parseTokenName(t, componentId);
    if (!parsed || !parsed.leaf || parsed.leaf === "root") continue;
    if (descendantClaims(node, parsed.leaf)) continue;
    return { name: parsed.leaf, via: "token-grammar" };
  }

  // (c) content match — a leaf whose text is exactly a string prop's value is
  // that prop's rendering. Evidence, not inference.
  if (node.text && args) {
    for (const [k, v] of Object.entries(args)) {
      if (typeof v !== "string") continue;
      const t = v.trim().slice(0, 80);
      if (t && t === node.text) return { name: k, via: "content-match" };
    }
  }

  // (d) semantic tag
  if (SEMANTIC_TAG[node.tag])
    return { name: SEMANTIC_TAG[node.tag], via: "tag" };

  // (e) positional fallback
  return { name: `child-${index + 1}`, via: "position" };
}

function roleOf(node) {
  if (SEMANTIC_TAG[node.tag] === "icon") return "glyph";
  if (["img", "picture", "video"].includes(node.tag)) return "media";
  if (
    ["button", "a", "input", "select", "textarea", "summary"].includes(node.tag)
  )
    return "control";
  if (node.children.length === 0 && node.text) return "text";
  return "container";
}

/* -------------------------------------------------------------- tree union */

/** Flatten an observed tree into `path → node` plus sibling multiplicity. */
function indexTree(
  node,
  componentId,
  args,
  path = "root",
  out = new Map(),
  repeated = new Set(),
) {
  out.set(path, node);
  const counts = new Map();
  const named = node.children.map((c, i) => {
    const slot = slotBoundary(c, componentId);
    const { name, via } = slot
      ? { name: slot, via: "slot-boundary" }
      : namePart(c, componentId, i, args);
    counts.set(name, (counts.get(name) || 0) + 1);
    return { child: c, name, via, slot };
  });
  const seen = new Map();
  for (const { child, name, via, slot } of named) {
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    const isRepeated = counts.get(name) > 1;
    if (isRepeated) repeated.add(`${path}/${name}`);
    // repeated siblings collapse onto one path — the first instance wins
    const childPath = `${path}/${name}`;
    if (isRepeated && n > 1) continue;
    child.__via = via;
    child.__slot = slot || null;
    // Descend past a slot boundary only where this component still styles
    // something — otherwise we would absorb another component's anatomy.
    if (slot && !definesOwnTokens(child)) {
      out.set(childPath, child);
      continue;
    }
    if (OPAQUE_TAGS.has(child.tag)) {
      out.set(childPath, child);
      continue;
    }
    indexTree(child, componentId, args, childPath, out, repeated);
  }
  return { index: out, repeated };
}

/* ------------------------------------------------------- style bookkeeping */

const UNINTERESTING = new Set([
  "none",
  "normal",
  "auto",
  "0px",
  "static",
  "visible",
  "rgba(0, 0, 0, 0)",
  "1",
  "0s",
  "start",
  "block",
  "inline",
  "row",
  "1e-05s",
  "",
]);

/** Which observed style keys a token's property suffix corresponds to. */
const TOKEN_PROPERTY_STYLES = {
  color: ["color"],
  "background-color": ["backgroundColor"],
  background: ["backgroundColor", "backgroundImage"],
  "border-radius": ["borderTopLeftRadius"],
  "border-width": ["borderTopWidth"],
  "border-color": ["borderTopColor"],
  border: ["borderTopWidth", "borderTopStyle", "borderTopColor"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  margin: ["marginTop", "marginBottom"],
  gap: ["rowGap", "columnGap"],
  font: ["fontWeight", "fontSize", "lineHeight", "fontFamily"],
  "font-size": ["fontSize"],
  "font-weight": ["fontWeight"],
  "font-family": ["fontFamily"],
  "line-height": ["lineHeight"],
  "letter-spacing": ["letterSpacing"],
  "text-transform": ["textTransform"],
  "text-decoration": ["textDecorationLine"],
  "text-align": ["textAlign"],
  "box-shadow": ["boxShadow"],
  shadow: ["boxShadow"],
  opacity: ["opacity"],
  width: ["width"],
  height: ["height"],
  "min-height": ["minHeight"],
  "max-width": ["maxWidth"],
  "aspect-ratio": ["aspectRatio"],
  transition: ["transitionDuration"],
  duration: ["transitionDuration"],
};

const shortFont = (v) => (v || "").split(",")[0].replace(/"/g, "").trim();

function styleValue(styles, keys) {
  const parts = keys.map((k) =>
    k === "fontFamily" ? shortFont(styles[k]) : styles[k],
  );
  if (keys.length === 4 && new Set(parts).size === 1) return parts[0];
  return parts.filter(Boolean).join(" ");
}

/**
 * Build a part's `styles` block: for every token defined on the node, report
 * the token, what it resolves to, and what it actually computed to.
 */
function buildStyles(node, staticData, args = {}) {
  // A component declares the custom properties for ALL of its variants; only
  // the ones matching the active configuration are the ones actually in play.
  const activeSegments = new Set();
  for (const axis of staticData.axes) {
    const value =
      args[axis.prop] ?? staticData.defaults[axis.prop] ?? axis.default;
    const hit = axis.values.find((v) => v.api === value);
    if (hit?.tokenSegment)
      activeSegments.add(hit.tokenSegment.replace(/^_/, ""));
  }

  const styles = {};
  const specificity = {};
  for (const token of node.definedTokens || []) {
    const parsed = parseTokenName(token, staticData.id);
    if (!parsed) continue;
    if (parsed.state) continue; // states are not observable in a static capture
    const keys = TOKEN_PROPERTY_STYLES[parsed.property];
    if (!keys) continue;

    const qualifiers = [
      parsed.rootVariant,
      ...parsed.elements.map((e) => e.variant),
    ].filter(Boolean);
    // Reject tokens qualified for a variant this configuration is not in.
    if (qualifiers.some((q) => !activeSegments.has(q))) continue;

    const computed = styleValue(node.styles, keys);
    if (!computed || UNINTERESTING.has(computed)) continue;
    const name = parsed.property.replace(/-([a-z])/g, (_, c) =>
      c.toUpperCase(),
    );
    // Prefer the most specific applicable token.
    if (
      specificity[name] !== undefined &&
      specificity[name] >= qualifiers.length
    )
      continue;
    specificity[name] = qualifiers.length;
    styles[name] = {
      token,
      resolves: staticData.resolve(token),
      computed,
    };
  }
  return styles;
}

const LAYOUT_KEYS = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gridTemplateColumns",
];

function buildLayout(node) {
  const layout = {};
  for (const k of LAYOUT_KEYS) {
    const v = node.styles[k];
    if (v && !UNINTERESTING.has(v)) layout[k] = v;
  }
  const gap = node.styles.rowGap;
  if (gap && !UNINTERESTING.has(gap)) layout.gap = gap;
  return Object.keys(layout).length ? layout : undefined;
}

/* ---------------------------------------------------------------- diffing */

function diffPart(base, other) {
  const delta = {};
  const add = other.classes.filter((c) => !base.classes.includes(c));
  const remove = base.classes.filter((c) => !other.classes.includes(c));
  if (add.length || remove.length) {
    delta.classes = {};
    if (add.length) delta.classes.add = add;
    if (remove.length) delta.classes.remove = remove;
  }
  const styles = {};
  for (const k of Object.keys(base.styles)) {
    const a = base.styles[k];
    const b = other.styles[k];
    if (a !== b)
      styles[k] = {
        from: k === "fontFamily" ? shortFont(a) : a,
        to: k === "fontFamily" ? shortFont(b) : b,
      };
  }
  if (Object.keys(styles).length) delta.styles = styles;
  const attrs = {};
  for (const k of new Set([
    ...Object.keys(base.attrs),
    ...Object.keys(other.attrs),
  ])) {
    if (base.attrs[k] !== other.attrs[k])
      attrs[k] = { from: base.attrs[k] ?? null, to: other.attrs[k] ?? null };
  }
  if (Object.keys(attrs).length) delta.attrs = attrs;
  if (base.tag !== other.tag) delta.element = { from: base.tag, to: other.tag };
  if (
    base.box.width !== other.box.width ||
    base.box.height !== other.box.height
  )
    delta.box = other.box;
  return Object.keys(delta).length ? delta : null;
}

/** Restrict a story's args to the props that are candidate axes. */
function axisConfig(args, staticData) {
  const cfg = {};
  for (const a of staticData.axes)
    if (args[a.prop] !== undefined) cfg[a.prop] = args[a.prop];
  return cfg;
}

function configDiff(baseCfg, cfg) {
  const out = {};
  for (const k of Object.keys(cfg)) if (cfg[k] !== baseCfg[k]) out[k] = cfg[k];
  return out;
}

/* --------------------------------------------------------------- bindings */

function classifyMechanism(prop, staticData, evidence) {
  const def = staticData.api.props[prop];
  if (!def) return null;
  const e = evidence[prop] || {};
  if (e.presence?.size)
    return { mechanism: "presence", parts: [...e.presence].sort() };
  if (e.element?.size)
    return { mechanism: "element-swap", parts: [...e.element].sort() };
  if (e.classes?.size)
    return { mechanism: "class-toggle", parts: [...e.classes].sort() };
  if (e.tokens?.size)
    return { mechanism: "token-swap", parts: [...e.tokens].sort() };
  if (e.attrs?.size)
    return { mechanism: "attribute", parts: [...e.attrs].sort() };
  if (e.layout?.size)
    return { mechanism: "layout", parts: [...e.layout].sort() };
  if (e.styles?.size)
    return { mechanism: "token-swap", parts: [...e.styles].sort() };
  if (def.role === "content") return { mechanism: "content", parts: [] };
  return { mechanism: "none", parts: [] };
}

/* ------------------------------------------------------------------ main */

export function reconcile(staticData, observations, opts = {}) {
  const id = staticData.id;
  const stories = staticData.stories.filter((s) => observations[s.id]?.ok);
  const failed = staticData.stories
    .filter((s) => !observations[s.id]?.ok)
    .map((s) => ({ id: s.id, error: observations[s.id]?.error }));

  // The declared baseline (§5.6). It is generated from `{Name}Defaults.ts`
  // rather than chosen from the authored stories, so every authored story is a
  // variant and nothing here depends on guessing which story "is" the default.
  const declared = staticData.declared || { config: {}, sources: {}, gaps: [] };
  const baseline = staticData.defaultStory;
  if (!baseline || !observations[baseline.id]?.ok)
    return {
      error: `declared default not observed (${baseline?.id ?? "no story generated"})`,
      failed,
    };

  // The baseline participates in presence/anatomy, but never in `variants`.
  const ok = [
    { ...baseline, args: declared.config, name: "declared default" },
    ...stories,
  ];

  // ---- index every story's tree ------------------------------------------
  const indexed = new Map();
  const repeatedPaths = new Set();
  for (const s of ok) {
    const { index, repeated } = indexTree(observations[s.id].tree, id, s.args);
    indexed.set(s.id, index);
    repeated.forEach((p) => repeatedPaths.add(p));
  }

  const defaultIndex = indexed.get(baseline.id);
  const baseCfg = axisConfig(declared.config, staticData);

  // ---- part presence across stories ---------------------------------------
  const allPaths = new Set();
  for (const index of indexed.values())
    for (const p of index.keys()) allPaths.add(p);
  const presenceMap = new Map();
  for (const p of allPaths) {
    const inStories = ok
      .filter((s) => indexed.get(s.id).has(p))
      .map((s) => s.id);
    presenceMap.set(p, inStories);
  }

  // ---- gates: which prop predicts a conditional part ----------------------
  function findGate(path) {
    const present = new Set(presenceMap.get(path));
    for (const [prop, def] of Object.entries(staticData.api.props)) {
      const truthy = (v) =>
        v !== undefined &&
        v !== null &&
        v !== false &&
        v !== "" &&
        !(Array.isArray(v) && v.length === 0);
      let consistent = true;
      let discriminates = false;
      for (const s of ok) {
        const t = truthy(s.args[prop]);
        const inHere = present.has(s.id);
        if (t !== inHere) {
          consistent = false;
          break;
        }
        if (!t) discriminates = true;
      }
      if (consistent && discriminates)
        return { prop, when: def.type === "array" ? "non-empty" : "truthy" };
    }
    return null;
  }

  // ---- build the anatomy tree --------------------------------------------
  const childrenOf = new Map();
  for (const p of allPaths) {
    const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : null;
    if (parent === null) continue;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(p);
  }

  const tokensByPath = new Map();
  for (const [, index] of indexed) {
    for (const [path, node] of index) {
      if (!tokensByPath.has(path)) tokensByPath.set(path, new Set());
      (node.definedTokens || []).forEach((t) => tokensByPath.get(path).add(t));
    }
  }

  function buildAnatomy(path) {
    const sample =
      defaultIndex.get(path) || indexed.get(presenceMap.get(path)[0]).get(path);
    const inAll = presenceMap.get(path).length === ok.length;
    const isRepeated = repeatedPaths.has(path);

    // classes present in EVERY story that has this part (invariant only)
    const classSets = presenceMap
      .get(path)
      .map((sid) => new Set(indexed.get(sid).get(path).classes));
    const invariant = [...classSets[0]]
      .filter((c) => classSets.every((s) => s.has(c)))
      .sort();

    const node = {
      path,
      element: sample.tag,
      classes: invariant,
      role: sample.__slot ? "slot" : roleOf(sample),
      presence: isRepeated ? "repeated" : inAll ? "always" : "conditional",
      namedBy: sample.__via || "root",
    };
    if (sample.__slot) node.instanceOf = sample.__slot;
    if (node.presence !== "always") {
      const gate = findGate(path);
      if (gate) node.gate = gate;
      node.observedIn = presenceMap.get(path).slice(0, 4);
    }
    const tokens = [...(tokensByPath.get(path) || [])].sort();
    if (tokens.length) node.tokens = tokens;
    const kids = (childrenOf.get(path) || []).sort();
    if (kids.length) node.children = kids.map(buildAnatomy);
    return node;
  }

  const anatomy = buildAnatomy("root");

  // Parts named by content-match ARE the rendering of that prop.
  const contentParts = new Map();
  (function collect(n) {
    if (n.namedBy === "content-match") {
      const leaf = n.path.split("/").pop();
      if (!contentParts.has(leaf)) contentParts.set(leaf, []);
      contentParts.get(leaf).push(n.path);
    }
    (n.children || []).forEach(collect);
  })(anatomy);

  // ---- axes: join api ↔ class ↔ tokenSegment ------------------------------
  const axes = staticData.axes.map((axis) => {
    const values = axis.values.map((v) => {
      const withValue = ok.filter((s) => s.args[axis.prop] === v.api);
      const withoutValue = ok.filter(
        (s) => s.args[axis.prop] !== undefined && s.args[axis.prop] !== v.api,
      );
      let cls = null;
      // A class can only be attributed to a value when some story sets a
      // DIFFERENT value — otherwise the component's base classes would be
      // indistinguishable from the value's own.
      if (withValue.length && withoutValue.length) {
        const inAll = withValue
          .map((s) => new Set(indexed.get(s.id).get("root")?.classes || []))
          .reduce((a, b) => new Set([...a].filter((c) => b.has(c))));
        const inNone = new Set(
          withoutValue.flatMap((s) => [
            ...(indexed.get(s.id).get("root")?.classes || []),
          ]),
        );
        const candidates = [...inAll].filter((c) => !inNone.has(c)).sort();
        cls = candidates[0] ?? null;
      }
      const out = { api: v.api, class: cls, tokenSegment: v.tokenSegment };
      if (!withValue.length) out.proven = false;
      else if (!withoutValue.length) out.discriminated = false;
      const issues = [];
      if (v.tokenSegment === null && cls && staticData.tokenSegments.length)
        issues.push("token-vocabulary-mismatch");
      if (issues.length) out.issues = issues;
      return out;
    });
    return {
      prop: axis.prop,
      default: staticData.defaults[axis.prop] ?? axis.default,
      values,
    };
  });

  // ---- default state ------------------------------------------------------
  const defaultParts = {};
  for (const [path, node] of defaultIndex) {
    const styles = buildStyles(node, staticData, declared.config);
    const layout = buildLayout(node);
    const entry = {};
    if (Object.keys(styles).length) entry.styles = styles;
    if (layout) entry.layout = layout;
    entry.box = node.box;
    defaultParts[path] = entry;
  }

  const defaultState = {
    configuration: Object.fromEntries(
      Object.keys(declared.config)
        .sort()
        .map((k) => [
          k,
          { value: declared.config[k], source: declared.sources[k] },
        ]),
    ),
    parts: defaultParts,
    evidence: { story: baseline.id, screenshot: baseline.screenshot ?? null },
  };

  // ---- variants + binding evidence ---------------------------------------
  const evidence = {};
  const touch = (prop, kind, path) => {
    evidence[prop] ??= {};
    evidence[prop][kind] ??= new Set();
    evidence[prop][kind].add(path);
  };

  const variants = [];
  // A part absent from the declared baseline has no delta to express, but its
  // styles are still worth recording. The FIRST variant to show it carries its
  // full state; later variants diff against that, so nothing is restated.
  const introducedBase = new Map();

  for (const s of ok) {
    if (s.id === baseline.id) continue;
    const cfg = axisConfig(s.args, staticData);
    const when = configDiff(baseCfg, cfg);
    const index = indexed.get(s.id);
    const parts = {};
    const introducedHere = new Set();
    for (const [path, node] of index) {
      const base = defaultIndex.get(path) || introducedBase.get(path);
      if (!base) {
        const styles = buildStyles(node, staticData, s.args);
        const layout = buildLayout(node);
        const entry = { introduced: true, classes: node.classes };
        if (Object.keys(styles).length) entry.styles = styles;
        if (layout) entry.layout = layout;
        entry.box = node.box;
        parts[path] = entry;
        introducedBase.set(path, node);
        introducedHere.add(path);
        continue;
      }
      const delta = diffPart(base, node);
      if (delta) parts[path] = delta;
    }
    // attribute deltas to the single prop that changed, when unambiguous
    const changed = Object.keys(when);
    if (changed.length === 1) {
      const prop = changed[0];
      for (const [path, d] of Object.entries(parts)) {
        if (introducedHere.has(path)) continue; // not a delta — do not attribute
        if (d.classes) touch(prop, "classes", path);
        if (d.element) touch(prop, "element", path);
        if (d.attrs) touch(prop, "attrs", path);
        if (d.styles) {
          const layoutish = Object.keys(d.styles).some((k) =>
            LAYOUT_KEYS.includes(k),
          );
          touch(prop, layoutish ? "layout" : "styles", path);
        }
      }
    }
    if (Object.keys(parts).length || Object.keys(when).length)
      variants.push({
        when,
        parts,
        evidence: { story: s.id, screenshot: s.screenshot },
      });
  }

  // Pairwise attribution: any two stories differing in exactly ONE axis prop
  // isolate that prop's effect, even when neither is the default story.
  for (const a of ok) {
    for (const b of ok) {
      if (a.id >= b.id) continue;
      const diff = configDiff(
        axisConfig(a.args, staticData),
        axisConfig(b.args, staticData),
      );
      const keys = Object.keys(diff);
      if (keys.length !== 1) continue;
      const prop = keys[0];
      const ia = indexed.get(a.id);
      const ib = indexed.get(b.id);
      for (const [path, nodeB] of ib) {
        const nodeA = ia.get(path);
        if (!nodeA) continue;
        const d = diffPart(nodeA, nodeB);
        if (!d) continue;
        if (d.classes) touch(prop, "classes", path);
        if (d.element) touch(prop, "element", path);
        if (d.attrs) touch(prop, "attrs", path);
        if (d.styles) {
          const layoutish = Object.keys(d.styles).some((k) =>
            LAYOUT_KEYS.includes(k),
          );
          touch(prop, layoutish ? "layout" : "styles", path);
        }
      }
    }
  }

  // presence evidence from gates
  for (const path of allPaths) {
    if (presenceMap.get(path).length === ok.length) continue;
    const gate = findGate(path);
    if (gate) touch(gate.prop, "presence", path);
  }
  // token-swap evidence from the axis→segment join
  for (const axis of axes) {
    for (const v of axis.values) {
      if (!v.tokenSegment) continue;
      for (const [path, tokens] of tokensByPath) {
        if (
          [...tokens].some(
            (t) =>
              t.includes(v.tokenSegment + "-") ||
              t.includes(v.tokenSegment + "_"),
          )
        )
          touch(axis.prop, "tokens", path);
      }
    }
  }

  // ---- bindings -----------------------------------------------------------
  const bindings = [];
  for (const prop of Object.keys(staticData.api.props).sort()) {
    const result = classifyMechanism(prop, staticData, evidence);
    if (!result) continue;
    const binding = { prop, mechanism: result.mechanism, parts: result.parts };
    if (!binding.parts.length && contentParts.has(prop))
      binding.parts = contentParts.get(prop).sort();
    if (binding.mechanism === "content" && !binding.parts.length)
      binding.proven = false;
    const axis = axes.find((a) => a.prop === prop);
    if (axis && result.mechanism !== "none") {
      const segs = axis.values.map((v) => v.tokenSegment).filter(Boolean);
      if (segs.length) {
        const tokens = new Set();
        for (const t of staticData.tokens) {
          const seg = segs.find((sg) => t.includes(sg));
          if (seg) tokens.add(t.replace(seg, `_{${prop}}`));
        }
        if (tokens.size) binding.tokens = [...tokens].sort();
      }
      const affected = new Set();
      for (const v of variants) {
        if (Object.keys(v.when).length !== 1 || !(prop in v.when)) continue;
        for (const d of Object.values(v.parts))
          Object.keys(d.styles || {}).forEach((k) => affected.add(k));
      }
      if (affected.size) binding.affects = [...affected].sort();
    }
    bindings.push(binding);
  }

  // ---- composition --------------------------------------------------------
  const slots = staticData.slots.map((slot) => {
    const counts = new Set(
      ok
        .map((s) =>
          Array.isArray(s.args[slot.prop]) ? s.args[slot.prop].length : null,
        )
        .filter((n) => n !== null),
    );
    const gatePath = [...allPaths].find((p) => {
      const g = findGate(p);
      return g && g.prop === slot.prop;
    });
    return {
      ...slot,
      part: gatePath || "root",
      observedCounts: [...counts].sort((a, b) => a - b),
    };
  });

  // ---- coverage -----------------------------------------------------------
  const axisCoverage = {};
  let proven = 0;
  let total = 0;
  for (const axis of axes) {
    const missing = axis.values
      .filter((v) => v.proven === false)
      .map((v) => v.api);
    axisCoverage[axis.prop] = {
      total: axis.values.length,
      proven: axis.values.length - missing.length,
      missing,
    };
    total += axis.values.length;
    proven += axis.values.length - missing.length;
  }
  const partsList = [...allPaths];
  const coverage = {
    axes: axisCoverage,
    parts: {
      total: partsList.length,
      inDefault: partsList.filter((p) => defaultIndex.has(p)).length,
      conditional: partsList.filter(
        (p) => presenceMap.get(p).length < ok.length,
      ).length,
    },
    // How much of the declared baseline is designed vs. synthesised (§5.6.1).
    // A baseline propped up by placeholders or left with empty slots is a
    // weaker foundation for every delta computed against it, so we say so.
    baseline: {
      values: Object.keys(declared.config).length,
      fromExample: Object.values(declared.sources).filter(
        (s) => s === "example",
      ).length,
      placeholders: declared.gaps.filter((g) => g.kind === "placeholder")
        .length,
      emptySlots: declared.gaps
        .filter((g) => g.kind === "empty-slot")
        .map((g) => g.prop),
    },
    stories: { observed: stories.length, failed: failed.length },
    combinations: {
      proven: variants.length + 1,
      possible: Math.max(
        variants.length + 1,
        axes.reduce((n, a) => n * a.values.length, 1),
      ),
    },
    score: total ? Number((proven / total).toFixed(2)) : null,
  };

  // Token grammar vs. observed anatomy. A token addressing an element that no
  // part is called, but that collapses onto a real part name once punctuation
  // is removed, is a naming drift in the stylesheet.
  const partNames = new Set();
  (function collect(n) {
    partNames.add(n.path.split("/").pop());
    (n.children || []).forEach(collect);
  })(anatomy);
  const flat = (s) => s.replace(/-/g, "");
  const byFlat = new Map([...partNames].map((p) => [flat(p), p]));
  const issues = [];
  const seenSegments = new Set();
  // Every element segment of every token path, not just the leaf.
  const segments = new Set();
  const tokenNames = Array.isArray(staticData.tokens)
    ? staticData.tokens
    : Object.keys(staticData.tokens || {});
  for (const t of tokenNames) {
    const parsed = parseTokenName(t, id);
    for (const seg of parsed?.elementPath || []) segments.add(seg);
  }
  // Two segments that collapse onto the same name once punctuation is removed
  // are the same element spelled two ways.
  const spellings = new Map();
  for (const seg of [...segments].sort()) {
    const k = flat(seg);
    if (!spellings.has(k)) spellings.set(k, []);
    spellings.get(k).push(seg);
  }
  for (const [, spelt] of spellings) {
    if (spelt.length < 2) continue;
    issues.push({
      code: "token-segment-spelling-drift",
      detail: `tokens spell the same element ${spelt.map((s) => `\`${s}\``).join(" and ")}`,
      segments: spelt,
    });
    spelt.forEach((s) => seenSegments.add(s));
  }
  for (const seg of [...segments].sort()) {
    if (seg === "root" || partNames.has(seg) || seenSegments.has(seg)) continue;
    const match = byFlat.get(flat(seg));
    if (!match) continue;
    seenSegments.add(seg);
    issues.push({
      code: "token-part-name-mismatch",
      detail: `tokens address \`${seg}\` but the observed part is \`${match}\``,
      tokenSegment: seg,
      part: match,
    });
  }

  return {
    anatomy,
    axes,
    default: defaultState,
    variants,
    bindings,
    composition: { slots },
    coverage,
    issues,
    failed,
    namingStats: countNaming(anatomy),
  };
}

function countNaming(node, acc = {}) {
  acc[node.namedBy] = (acc[node.namedBy] || 0) + 1;
  (node.children || []).forEach((c) => countNaming(c, acc));
  return acc;
}
