declare module "virtual:trial" {
  // Written as an inline `import(...)` type rather than an `import type`
  // statement: inside an ambient `declare module` block a relative specifier
  // resolves against the *module name*, not this file, so the statement form
  // silently yields `any` — and `skipLibCheck` hides the resolution failure.
  // Every story then typechecks against nothing.
  const manifest: import("../manifest").TrialManifest;
  export default manifest;
}

declare module "virtual:trial-component" {
  /** Compiled CSS for the produced component, or "" when it has none. */
  export const styles: string;
  /** Why a stylesheet failed to compile — a result, not a build error. */
  export const styleErrors: string[];
  export const ambientStyles: string;
  export const ambientSources: string[];
  /** Imported for side effects: `define()` registers the behaviour. */
  export const clientModules: unknown[];
  /** The produced module's full namespace — its export shape is not guaranteed. */
  export const exports_: Record<string, unknown>;
  /** The produced `*Defaults` module, used as story args. */
  export const defaults_: Record<string, unknown>;
}
