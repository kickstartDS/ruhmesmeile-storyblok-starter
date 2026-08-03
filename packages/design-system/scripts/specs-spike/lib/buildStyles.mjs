/**
 * Map kickstartDS component tokens onto the Specs `Styles` model.
 *
 * Policy (PRD §5.6 + §6.6): emit `TokenReference` wherever a token points at the
 * semantic layer, emit literals only when they are unit-free or plain px, and
 * OMIT everything else rather than approximate it. Every omission is recorded so
 * the spike can report exactly what was dropped and why.
 */

import { readFileSync } from "node:fs";

/** CSS property → Specs `Styles` property. `null` means "no equivalent exists". */
const CSS_TO_SPECS = {
  color: "textColor",
  "background-color": "backgroundColor",
  "border-radius": "cornerRadius",
  "border-width": "strokeWeight",
  "border-color": "strokes",
  border: "strokes",
  opacity: "opacity",
  padding: "padding",
  gap: "itemSpacing",
  width: "width",
  height: "height",
  "min-width": "minWidth",
  "max-width": "maxWidth",
  "min-height": "minHeight",
  "max-height": "maxHeight",
  "box-shadow": "effects",
  "aspect-ratio": "aspectRatio",
  "text-align": "textAlignHorizontal",
  // Typography is a composite in Specs; these are decomposed (register T5).
  font: "typography",
  "font-family": "typography",
  "font-size": "typography",
  "font-weight": "typography",
  "line-height": "typography",
  "letter-spacing": "typography",
  "text-transform": "typography",
  "text-decoration": "typography",
  // No representation in the Specs Styles model:
  "animation-duration": null,
  "autoplay-duration": null,
  transition: null,
  repeat: null,
  space: null,
  gutter: null,
  "space-before": null,
  "space-after": null,
};

/** Specs `TokenReference.$type` inferred from the CSS property. */
const CSS_TO_DTCG_TYPE = {
  textColor: "color",
  backgroundColor: "color",
  strokes: "color",
  cornerRadius: "dimension",
  strokeWeight: "dimension",
  padding: "dimension",
  itemSpacing: "dimension",
  width: "dimension",
  height: "dimension",
  minWidth: "dimension",
  maxWidth: "dimension",
  minHeight: "dimension",
  maxHeight: "dimension",
  opacity: "number",
  effects: "shadow",
  typography: "typography",
  aspectRatio: "number",
  textAlignHorizontal: "string",
};

/**
 * CSS typography property → inline `Typography` field.
 * `null` = Specs has no field for it. Notably `font-weight`: Figma models weight
 * as part of the *style name* (`fontStyle: "Bold"`), so a numeric CSS weight has
 * no lossless target (register T5).
 */
const TYPOGRAPHY_FIELD = {
  font: "$reference", // CSS `font` shorthand == a named text style
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  "text-transform": "textCase",
  "text-decoration": "textDecoration",
  "font-weight": null,
};

const PLAIN_PX = /^-?\d+(?:\.\d+)?px$/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Mechanical CSS-custom-property → DTCG dot path.
 *
 * NOTE: this is the unresolved question in PRD §15 item 7. The branding layer has
 * a real DTCG source, but the semantic layer does not, so this derivation is
 * structural only and is reported as `unverified`.
 */
export function tokenToDtcgPath(customProperty) {
  return customProperty.replace(/^--/, "").split("-").filter(Boolean).join(".");
}

export function loadSpecsStyleProperties(schemaDir) {
  const styles = JSON.parse(
    readFileSync(`${schemaDir}/styles.schema.json`, "utf8"),
  );
  return new Set(Object.keys(styles.definitions?.Styles?.properties ?? {}));
}

/**
 * Build a `Styles` object for one anatomy element from its tokens.
 * Returns the styles plus a per-token decision log.
 */
export function buildStyles(tokens, validStyleProperties) {
  const styles = {};
  const decisions = [];

  // `typography` is either a TokenReference (named text style) OR an inline
  // object — never both. Collect candidates and resolve at the end.
  let typographyRef = null;
  const typographyInline = {};

  for (const token of tokens) {
    const target = CSS_TO_SPECS[token.property];
    const meta = token.meta ?? {};

    // 1. The CSS property has no Specs counterpart at all.
    if (target === null || target === undefined) {
      decisions.push({
        token: token.token,
        outcome: "omitted",
        reason: `no Styles property for CSS '${token.property}'`,
      });
      continue;
    }

    // 2. Guard against drift between our map and the actual Specs schema.
    if (!validStyleProperties.has(target)) {
      decisions.push({
        token: token.token,
        outcome: "omitted",
        reason: `'${target}' is not a Styles property in this schema version`,
      });
      continue;
    }

    // 3. Interaction states have no home in a static Styles snapshot.
    if (token.state) {
      decisions.push({
        token: token.token,
        outcome: "displaced",
        reason: `state ':${token.state}' has no Styles representation`,
      });
      continue;
    }

    // 4. Design modifiers belong on a variant, not the default element.
    if (token.modifier) {
      decisions.push({
        token: token.token,
        outcome: "variant",
        reason: `modifier '${token.modifier}' routed to variants[]`,
      });
      continue;
    }

    // 5. Token references — the good path.
    if (meta.referencedToken) {
      // A `component-ref` points at another component's --dsa- token, not at a
      // design token. Emitting it would produce a `$token` path that resolves to
      // nothing in any DTCG file (PRD §6, register T12).
      if (meta.valueType === "component-ref") {
        decisions.push({
          token: token.token,
          outcome: "unresolvable",
          reason: `references component token '${meta.referencedToken}', which has no DTCG counterpart`,
        });
        continue;
      }

      const $type = CSS_TO_DTCG_TYPE[target] ?? "string";
      const reference = {
        $token: tokenToDtcgPath(meta.referencedToken),
        $type,
      };

      if (target === "typography") {
        const field = TYPOGRAPHY_FIELD[token.property];
        if (field === null || field === undefined) {
          decisions.push({
            token: token.token,
            outcome: "omitted",
            reason: `Specs Typography has no field for CSS '${token.property}' (Figma encodes weight in fontStyle)`,
          });
          continue;
        }
        if (field === "$reference") typographyRef = reference;
        else typographyInline[field] = reference;
        decisions.push({
          token: token.token,
          outcome: "emitted",
          styleProperty: `typography.${field}`,
          $token: reference.$token,
          $type,
          derivation: "unverified",
        });
        continue;
      }

      if (target === "padding") {
        decisions.push({
          token: token.token,
          outcome: "lossy",
          reason:
            "padding is a Sides object; a single token cannot fill top/end/bottom/start",
        });
        continue;
      }

      if (target === "strokes") {
        decisions.push({
          token: token.token,
          outcome: "lossy",
          reason:
            "strokes is an array of paint objects; needs stroke composition",
        });
        continue;
      }

      styles[target] = reference;
      decisions.push({
        token: token.token,
        outcome: "emitted",
        styleProperty: target,
        $token: reference.$token,
        $type,
        derivation: "unverified",
      });
      continue;
    }

    // 6. Literals — only emit what is provably lossless.
    const value = String(meta.defaultValue ?? "").trim();
    if (PLAIN_PX.test(value)) {
      styles[target] = Number.parseFloat(value);
      decisions.push({
        token: token.token,
        outcome: "emitted",
        styleProperty: target,
        literal: styles[target],
      });
    } else if (PLAIN_NUMBER.test(value)) {
      styles[target] = Number.parseFloat(value);
      decisions.push({
        token: token.token,
        outcome: "emitted",
        styleProperty: target,
        literal: styles[target],
      });
    } else {
      decisions.push({
        token: token.token,
        outcome: "omitted",
        reason: /calc\(|var\(/.test(value)
          ? "computed value (calc/var) — Styles allows literal or TokenReference only"
          : `literal '${value}' has no lossless Styles representation`,
      });
    }
  }

  // Resolve the typography oneOf: a named text style wins over inline fields.
  if (typographyRef) {
    styles.typography = typographyRef;
    for (const field of Object.keys(typographyInline)) {
      decisions.push({
        token: `typography.${field}`,
        outcome: "displaced",
        reason:
          "component references a named text style; inline field cannot coexist",
      });
    }
  } else if (Object.keys(typographyInline).length) {
    styles.typography = typographyInline;
  }

  return { styles, decisions };
}
