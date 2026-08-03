/**
 * The `brief` projection — a lossy, token-budgeted Markdown view generated
 * from the contract. Never authored, never edited; it has no independent
 * existence and therefore cannot drift.
 */

const flat = (node, out = []) => {
  out.push(node);
  (node.children || []).forEach((c) => flat(c, out));
  return out;
};

const label = (v) => (typeof v === "string" ? v : JSON.stringify(v));

export function buildBrief(contract) {
  const L = [];
  const parts = flat(contract.anatomy);

  L.push(`## ${contract.title}`);
  const rootClasses = contract.anatomy.classes.map((c) => `.${c}`).join("");
  L.push(`\`<${contract.anatomy.element}>\`${rootClasses ? ` · \`${rootClasses}\`` : ""}`);
  if (contract.description) L.push(`\n${contract.description}`);

  // anatomy, indented
  L.push(`\n**Anatomy**`);
  const line = (n, depth) => {
    const pad = "  ".repeat(depth);
    const name = n.path.split("/").pop();
    const bits = [`\`<${n.element}>\``, n.role];
    if (n.presence === "repeated") bits.push("repeated");
    if (n.presence === "conditional")
      bits.push(n.gate ? `only when \`${n.gate.prop}\` ${n.gate.when}` : "conditional");
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
      const affects = (b.affects || []).join(", ") || b.parts.map((p) => p.split("/").pop()).join(", ");
      L.push(`| ${b.prop} | ${values} | ${b.mechanism}${b.proven === false ? " *(unproven)*" : ""} | ${affects} |`);
    }
    L.push(`\n<small>\\* = default</small>`);
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
    (t) => !tokenLines.some((b) => b.tokens.some((x) => x.replace(/_\{\w+\}/, "") === t.replace(/_[a-z]+/, "")))
  );
  const others = parts
    .filter((p) => p.path !== "root" && p.tokens?.length)
    .map((p) => `- \`${p.path}\`: ${p.tokens.map((t) => `\`${t}\``).join(", ")}`);
  if (tokenLines.length || rootTokens.length || others.length) {
    L.push(`\n**Tokens**`);
    for (const b of tokenLines)
      L.push(`- \`${b.prop}\`: ${b.tokens.map((t) => `\`${t}\``).join(", ")}`);
    if (rootTokens.length)
      L.push(
        `- \`root\`: ${rootTokens.slice(0, 8).map((t) => `\`${t}\``).join(", ")}` +
          (rootTokens.length > 8 ? ` _(+${rootTokens.length - 8} more)_` : "")
      );
    others.slice(0, 8).forEach((o) => L.push(o));
  }

  // coverage + issues
  const cov = contract.coverage;
  const missing = Object.entries(cov.axes)
    .filter(([, v]) => v.missing.length)
    .map(([k, v]) => `\`${k}: ${v.missing.map(label).join(", ")}\``);
  L.push(
    `\n**Coverage** ${cov.score ?? "n/a"} — ${cov.combinations.proven}/${cov.combinations.possible} configurations proven` +
      (missing.length ? `; no story for ${missing.join(", ")}` : "")
  );
  for (const axis of contract.axes) {
    for (const v of axis.values) {
      if (v.issues?.includes("token-vocabulary-mismatch"))
        L.push(
          `> ⚠ \`${axis.prop}: ${label(v.api)}\` renders \`.${v.class}\` but has no matching token segment.`
        );
    }
  }
  for (const i of contract.issues || []) L.push(`> ⚠ ${i.detail}`);
  return L.join("\n") + "\n";
}
