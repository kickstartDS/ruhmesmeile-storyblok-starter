import type { JSONSchema7 } from "json-schema";

/** Flatten a nested props object into the dotted keys Storybook controls use. */
export declare const pack: (
  props: Record<string, unknown>,
) => Record<string, unknown>;

/** Reverse `pack`, rebuilding the nested props object from dotted keys. */
export declare const unpack: (
  args: Record<string, unknown>,
) => Record<string, unknown>;

/** Apply `unpack` to a story's args before handing them to the component. */
export declare const unpackDecorator: (
  story: (context: never) => unknown,
  context: { args: Record<string, unknown> },
) => unknown;

/** Derive `argTypes` and default `args` for a component from its JSON Schema. */
export declare const getArgsShared: (schema: JSONSchema7) => {
  argTypes: Record<string, unknown>;
  args: Record<string, unknown>;
};
