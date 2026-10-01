/**
 * The `brief` projection — a lossy, token-budgeted Markdown view generated
 * from the contract. Never authored, never edited; it has no independent
 * existence and therefore cannot drift.
 *
 * The optional `narrative` sidecar (§5.12) is the one model-generated input.
 * It is merged in at render time and always marked as prose, never presented
 * as an observation — so a brief with no narrative is still a complete brief,
 * and a brief with one never lets generated prose masquerade as derived fact.
 */

const flat = (node, out = []) => {
  out.push(node);
  (node.children || []).forEach((c) => flat(c, out));
  return out;
};

const label = (v) => (typeof v === "string" ? v : JSON.stringify(v));

export function buildBrief(contract, narrative = null) {
  const L = [];
  const parts = flat(contract.anatomy);

  L.push(`## ${contract.component ?? contract.title}`);
  const rootClasses = contract.anatomy.classes.map((c) => `.${c}`).join("");
  L.push(
    `\`<${contract.anatomy.element}>\`${rootClasses ? ` · \`${rootClasses}\`` : ""}`,
  );
  if (contract.description) L.push(`\n${contract.description}`);
  if (narrative?.default?.description)
    L.push(`\n_${narrative.default.description}_`);

  // anatomy, indented
  L.push(`\n**Anatomy**`);
  const line = (n, depth) => {
    const pad = "  ".repeat(depth);
    const name = n.path.split("/").pop();
    const bits = [`\`<${n.element}>\``, n.role];
    if (n.presence === "repeated") bits.push("repeated");
    if (n.presence === "conditional")
      bits.push(
        n.gate ? `only when \`${n.gate.prop}\` ${n.gate.when}` : "conditional",
      );
    L.push(`${pad}- **${name}** — ${bits.join(" · ")}`);
    (n.children || []).forEach((c) => line(c, depth + 1));
  };
  line(contract.anatomy, 0);

  // visual props
  const visual = contract.bindings.filter((b) => b.mechanism !== "none");
  if (visual.length) {
    L.push(`\n**Visual props**\n`);
    L.push(`| prop | values | mechanism | affects |`);
    L.push(`| --- | --- | --- | --- |`);
    for (const b of visual) {
      const axis = contract.axes.find((a) => a.prop === b.prop);
      const values = axis
        ? axis.values
            .map((v) => `${label(v.api)}${v.api === axis.default ? "*" : ""}`)
            .join(" · ")
        : contract.api.props[b.prop]?.type || "";
      const affects =
        (b.affects || []).join(", ") ||
        b.parts.map((p) => p.split("/").pop()).join(", ");
      L.push(
        `| ${b.prop} | ${values} | ${b.mechanism}${b.proven === false ? " *(unproven)*" : ""} | ${affects} |`,
      );
    }
    L.push(`\n<small>\\* = default</small>`);
  }

  // variants — only worth spelling out when there is prose to attach, since the
  // raw deltas are already covered by the visual-props table
  if (narrative?.variants?.length) {
    // Keyed by story id: two variants can share a `when` (e.g. `{}`), and the
    // story is the evidence both documents already point at.
    const prose = new Map(narrative.variants.map((v) => [v.story, v]));
    const described = (contract.variants || []).filter(
      (v) => prose.get(v.evidence?.story)?.difference,
    );
    if (described.length) {
      L.push(`\n**Variants**`);
      for (const v of described) {
        const when = Object.entries(v.when || {})
          .map(([k, val]) => `\`${k}: ${label(val)}\``)
          .join(", ");
        L.push(
          `- ${when || v.evidence?.story} — _${prose.get(v.evidence?.story).difference}_`,
        );
      }
    }
  }

  // slots
  if (contract.composition.slots.length) {
    L.push(`\n**Slots**`);
    for (const s of contract.composition.slots) {
      const accepts = s.accepts
        ? `accepts ${s.accepts.length} component types`
        : s.itemShape
          ? `items: ${s.itemShape.join(", ")}`
          : "";
      const counts = s.observedCounts?.length
        ? ` · observed counts: ${s.observedCounts.join(", ")}`
        : "";
      L.push(`- \`${s.prop}\` → \`${s.part}\` — ${accepts}${counts}`);
    }
  }

  // tokens, templated
  const tokenLines = contract.bindings.filter((b) => b.tokens?.length);
  const rootTokens = (contract.anatomy.tokens || []).filter(
    (t) =>
      !tokenLines.some((b) =>
        b.tokens.some(
          (x) => x.replace(/_\{\w+\}/, "") === t.replace(/_[a-z]+/, ""),
        ),
      ),
  );
  const others = parts
    .filter((p) => p.path !== "root" && p.tokens?.length)
    .map(
      (p) => `- \`${p.path}\`: ${p.tokens.map((t) => `\`${t}\``).join(", ")}`,
    );
  if (tokenLines.length || rootTokens.length || others.length) {
    L.push(`\n**Tokens**`);
    for (const b of tokenLines)
      L.push(`- \`${b.prop}\`: ${b.tokens.map((t) => `\`${t}\``).join(", ")}`);
    if (rootTokens.length)
      L.push(
        `- \`root\`: ${rootTokens
          .slice(0, 8)
          .map((t) => `\`${t}\``)
          .join(", ")}` +
          (rootTokens.length > 8 ? ` _(+${rootTokens.length - 8} more)_` : ""),
      );
    others.slice(0, 8).forEach((o) => L.push(o));
  }

  // When to escalate. The brief is the cheap view; these are the queries it
  // deliberately does not answer, named so an agent does not have to guess that
  // they exist or when they pay for themselves.
  const mechanisms = new Set(
    visual.map((b) => b.mechanism).filter((m) => m && m !== "none"),
  );
  const escalation = [
    mechanisms.has("token-swap") &&
      "- a prop listed `token-swap` → restyle through its templated tokens above; the class only carries the default values",
    visual.length > 1 &&
      "- one prop's exact blast radius (parts, attributes, box) → `get_prop_visual_impact` with that prop",
    contract.composition.slots.length &&
      "- what a slot accepts before composing into it → `get_component_anatomy`",
    "- a token spelling you are about to trust → `lint_component_contracts` (it reports the mismatches this component already has)",
  ].filter(Boolean);
  if (escalation.length) {
    L.push(`\n**Go deeper when needed**`);
    escalation.forEach((line) => L.push(line));
  }

  // coverage + issues
  const cov = contract.coverage;
  const missing = Object.entries(cov.axes)
    .filter(([, v]) => v.missing.length)
    .map(([k, v]) => `\`${k}: ${v.missing.map(label).join(", ")}\``);
  L.push(
    `\n**Coverage** ${cov.score ?? "n/a"} — ${cov.combinations.proven}/${cov.combinations.possible} configurations proven` +
      (missing.length ? `; no story for ${missing.join(", ")}` : ""),
  );
  for (const axis of contract.axes) {
    for (const v of axis.values) {
      if (v.issues?.includes("token-vocabulary-mismatch"))
        L.push(
          `> ⚠ \`${axis.prop}: ${label(v.api)}\` renders \`.${v.class}\` but has no matching token segment.`,
        );
    }
  }
  for (const i of contract.issues || []) L.push(`> ⚠ ${i.detail}`);
  return L.join("\n") + "\n";
}
