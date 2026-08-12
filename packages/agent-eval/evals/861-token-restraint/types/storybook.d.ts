/**
 * Minimal Storybook types.
 *
 * This design system documents every component with a story, and the component
 * builder's own template opens with `import { Meta, StoryObj } from
 * "@storybook/react-vite"`. An agent that writes one is following the
 * convention it was told to follow — but Storybook itself is far too heavy to
 * install into an eval sandbox, so without these declarations that story fails
 * `tsc` with TS2307 and the toolchain score drops for a dependency the agent
 * was never given and could not add.
 *
 * That is the fixture penalising its own omission. These declarations exist
 * only to remove the penalty: they are deliberately permissive, they assert
 * nothing about story quality, and writing no story at all remains equally
 * fine. Nothing in any task asks for a story.
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
