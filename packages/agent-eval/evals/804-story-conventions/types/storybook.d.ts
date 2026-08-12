/**
 * Minimal Storybook types.
 *
 * This design system documents every component with a story, and the component
 * builder's own template opens with `import { Meta, StoryObj } from
 * "@storybook/react-vite"`. Storybook itself is far too heavy to install into
 * an eval sandbox, so without these declarations the story this task asks for
 * would fail `tsc` with TS2307 — the fixture penalising work it commissioned.
 *
 * Unlike every other fixture's copy, this one is load-bearing: 804 is the one
 * task that does ask for a story. The declarations are still deliberately
 * permissive and still assert nothing about story quality — they exist to let
 * the file compile, not to describe what a good one looks like. Everything this
 * task actually grades is checked by running the module, not by typechecking
 * it.
 */

declare module "@storybook/react-vite" {
  /** Story metadata — the component under test and its shared configuration. */
  export interface Meta<TComponent = unknown> {
    title?: string;
    component?: TComponent;
    subcomponents?: Record<string, unknown>;
    args?: Record<string, unknown>;
    argTypes?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    decorators?: unknown[];
    tags?: string[];
    render?: (args: never) => unknown;
  }

  /** A single story derived from a `Meta`. */
  export interface StoryObj<TMeta = unknown> {
    name?: string;
    args?: Record<string, unknown>;
    argTypes?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    decorators?: unknown[];
    tags?: string[];
    render?: (args: never) => unknown;
    play?: (context: never) => unknown | Promise<unknown>;
  }
}

declare module "@storybook/react" {
  export { Meta, StoryObj } from "@storybook/react-vite";
}
