import { createElement, useEffect, useRef } from "react";

/**
 * Marks an element as the mount point for a `define()`d behaviour.
 *
 * Spread onto the rendered root: it supplies the `ks-component` attribute the
 * client module looks for, plus a ref. Any forwarded ref is kept in sync, so a
 * component can stay a pure render function and still be addressable.
 */
export const useKsComponent = (identifier, ref, deps = []) => {
  const inner = useRef(null);

  useEffect(() => {
    if (typeof ref === "function") ref(inner.current);
    else if (ref) ref.current = inner.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);

  return { "ks-component": identifier, ref: inner };
};

/** Bind a fixed value to a context, for provider-based component overrides. */
export const createProvider = (context, value) => (props) =>
  createElement(context.Provider, { value, ...props });
