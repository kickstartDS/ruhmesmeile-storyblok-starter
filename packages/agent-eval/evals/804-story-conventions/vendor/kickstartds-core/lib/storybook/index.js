/**
 * Storybook argument helpers.
 *
 * Storybook controls are flat: a control maps to one key in `args`. Component
 * props are not — they nest. `pack` flattens a props object into dotted keys so
 * every leaf gets its own control, `unpack` reverses it, and `getArgsShared`
 * derives the control metadata from a JSON Schema so the two stay in step with
 * the component's declared API rather than being maintained by hand.
 */

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

/** Flatten a nested props object into dotted keys Storybook can control. */
export const pack = (props) =>
  Object.entries(props).reduce((packed, [key, value]) => {
    const isArray = Array.isArray(value);
    if (isArray) packed[`${key}__count`] = value.length;

    if (isPlainObject(value) || isArray) {
      Object.entries(pack(value)).forEach(([nested, nestedValue]) => {
        packed[`${key}.${nested}`] = nestedValue;
      });
    } else {
      packed[key] = value;
    }

    return packed;
  }, {});

/** Reverse `pack`, rebuilding the nested props object from dotted keys. */
export const unpack = (args) => {
  const props = {};
  const counts = {};

  for (const [key, value] of Object.entries(args)) {
    if (key.endsWith("__count")) {
      counts[key.split("__count")[0]] = value;
      continue;
    }

    const path = key.split(".");
    path.reduce((node, segment, index, segments) => {
      if (node[segment] == null) {
        if (Array.isArray(node)) {
          const limit = counts[segments.slice(0, index).join(".")];
          const position = +segment;
          if (isNaN(position) || isNaN(limit) || position >= limit) {
            segments.splice(index);
            return node;
          }
        }
        const next = segments[index + 1];
        node[segment] = next == null ? value : isNaN(+next) ? {} : [];
      }
      return node[segment];
    }, props);
  }

  return props;
};

/** Apply `unpack` to a story's args before handing them to the component. */
export const unpackDecorator = (story, context) =>
  story({ ...context, args: unpack(context.args) });

const controlFor = (schema) => {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case "boolean":
      return { control: "boolean" };
    case "integer":
    case "number":
      return { control: { type: "number" } };
    case "string":
      return schema.enum?.length
        ? {
            options: schema.enum,
            control: {
              type: schema.enum.length > 5 ? "select" : "inline-radio",
            },
          }
        : { control: "text" };
    default:
      return { control: "object" };
  }
};

/**
 * Derive `argTypes` and default `args` for a component from its JSON Schema.
 *
 * Spread into a story's `meta` so that every documented prop turns up as a
 * labelled, typed control without being restated in the story file.
 */
export const getArgsShared = (schema) => {
  const argTypes = {};
  const args = {};

  const visit = (node, path, required) => {
    if ("const" in node) return;

    const type = Array.isArray(node.type) ? node.type[0] : node.type;

    if (type === "object" && node.properties) {
      if (path) argTypes[path] = { table: { disable: true } };
      for (const [key, child] of Object.entries(node.properties)) {
        if (Array.isArray(child) || typeof child === "boolean") continue;
        visit(child, path ? `${path}.${key}` : key, node.required ?? []);
      }
      return;
    }

    if (!path) return;

    argTypes[path] = {
      name: path,
      description: node.title
        ? `**${node.title}${node.description ? ":" : ""}**${
            node.description ? `\n\n${node.description}` : ""
          }`
        : undefined,
      type: {
        required: required.includes(path.split(".").pop()),
        name: type === "integer" ? "number" : type === "null" ? "object" : type,
      },
      table: { defaultValue: { summary: node.default } },
      ...controlFor(node),
    };

    const value = node.examples?.[0] ?? node.default;
    if (value != null) args[path] = value;
  };

  visit(schema, "", schema.required ?? []);

  return { argTypes, args };
};
