/**
 * A cut-down slice of @kickstartds/design-system.
 *
 * Deliberately plain JavaScript built on `createElement` rather than JSX: the
 * package is consumed straight out of node_modules, so shipping it as source
 * that needs a transform would make the fixture depend on how vitest happens to
 * treat linked dependencies. This just imports.
 *
 * The API shape mirrors the real design system — forwardRef everywhere, BEM
 * `dsa-` class names, props rather than children for text content.
 */

import { createElement, forwardRef } from "react";

/** Icons are decorative here; the label next to them carries the meaning. */
export const Icon = forwardRef(function Icon({ icon, ...rest }, ref) {
  return createElement("span", {
    ...rest,
    ref,
    "aria-hidden": "true",
    "data-icon": icon,
    className: `dsa-icon dsa-icon--${icon}`,
  });
});

export const Button = forwardRef(function Button(
  {
    label,
    variant = "primary",
    size = "medium",
    icon,
    type = "button",
    ...rest
  },
  ref,
) {
  return createElement(
    "button",
    {
      ...rest,
      ref,
      type,
      className: `dsa-button dsa-button--${variant} dsa-button--${size}`,
    },
    icon ? createElement(Icon, { icon, key: "icon" }) : null,
    createElement(
      "span",
      { className: "dsa-button__label", key: "label" },
      label,
    ),
  );
});

export const Headline = forwardRef(function Headline(
  { text, level = "h2", spaceAfter = "small", ...rest },
  ref,
) {
  return createElement(
    level,
    {
      ...rest,
      ref,
      className: `dsa-headline dsa-headline--${level} dsa-headline--space-${spaceAfter}`,
    },
    text,
  );
});

export const Text = forwardRef(function Text({ text, ...rest }, ref) {
  return createElement("p", { ...rest, ref, className: "dsa-text" }, text);
});
