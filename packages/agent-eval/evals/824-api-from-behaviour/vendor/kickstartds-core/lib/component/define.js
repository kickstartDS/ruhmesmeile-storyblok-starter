const registry = new Map();
const instances = new WeakMap();

const hydrate = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return;

  for (const [identifier, Behaviour] of registry) {
    const selector = `[ks-component="${identifier}"]`;
    const matches = [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector),
    ];

    for (const element of matches) {
      let byIdentifier = instances.get(element);
      if (!byIdentifier) instances.set(element, (byIdentifier = new Map()));
      if (byIdentifier.has(identifier)) continue;
      byIdentifier.set(identifier, new Behaviour(element));
    }
  }
};

const teardown = (element) => {
  const byIdentifier = instances.get(element);
  if (!byIdentifier) return;
  for (const instance of byIdentifier.values()) instance.disconnect?.();
  instances.delete(element);
};

let observing = false;

const observe = () => {
  if (observing || typeof MutationObserver === "undefined") return;
  observing = true;

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) hydrate(node);
      for (const node of record.removedNodes) teardown(node);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
};

/**
 * Bind a behaviour class to every element carrying `ks-component="identifier"`.
 *
 * Existing elements are hydrated immediately; later ones are picked up by a
 * MutationObserver, so markup rendered after this module runs is covered
 * without re-initialising anything.
 */
export const define = (identifier, Behaviour) => {
  registry.set(identifier, Behaviour);
  if (typeof document === "undefined") return;
  hydrate(document.documentElement);
  observe();
};
