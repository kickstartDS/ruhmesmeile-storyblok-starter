let counter = 0;

/** Monotonic id, used to give an element a stable handle when it has no id. */
export const uid = () => `ks-${(counter += 1)}`;
