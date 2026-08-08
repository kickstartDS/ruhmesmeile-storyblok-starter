/**
 * The produced component, rendered.
 *
 * This is the story the whole package exists to make possible: a reviewer can
 * interact with what the agent built, in the same browser tab as the evidence
 * of how it was built.
 *
 * Nothing here may assume the component is correct — that is what is being
 * reviewed. Its export shape, its props, its stylesheet and its client
 * behaviour are all things an agent can get wrong, so each is discovered
 * defensively and a failure is reported as content rather than thrown.
 */

import { Component as ReactComponent, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import manifest from "virtual:trial";
import {
  ambientSources,
  ambientStyles,
  defaults_,
  exports_,
  styleErrors,
  styles,
} from "virtual:trial-component";

import { Note, Page, Section } from "./ui";

type Renderable = (props: Record<string, unknown>) => ReactNode;

/** React marks `forwardRef`/`memo` results as objects, not functions. */
function isRenderable(value: unknown): boolean {
  if (typeof value === "function") return true;
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in (value as Record<string, unknown>)
  );
}

const pascal = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/**
 * Pick the component out of a module whose export shape is not guaranteed.
 *
 * Preference order matters: an agent that exports both a default and a named
 * helper should be rendered by its default, and one that exports several
 * components should be rendered by the one named after the task.
 */
function pickComponent(): { name: string; render: Renderable } | null {
  const name = pascal(manifest.component.slug);
  const candidates = [
    "default",
    `${name}Component`,
    name,
    ...Object.keys(exports_),
  ];

  for (const key of candidates) {
    const value = exports_[key];
    if (value && isRenderable(value)) {
      return { name: key, render: value as Renderable };
    }
  }

  return null;
}

/** The `*Defaults` module may default-export or name-export its object. */
function pickDefaults(): Record<string, unknown> {
  const direct = defaults_.default;
  if (direct && typeof direct === "object") {
    return direct as Record<string, unknown>;
  }

  for (const value of Object.values(defaults_)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return {};
}

/**
 * Values for required props that the defaults module does not cover.
 *
 * A `*Defaults` module carries configuration, not content: `832`'s disclosure
 * correctly defaults only `defaultOpen` and leaves `summary` and `content` to
 * the caller. Rendering with those undefined produces an empty box that looks
 * like a broken component but is really an empty story — the report would be
 * blaming the agent for the harness's omission.
 *
 * Each stand-in is the property's own schema description, so the placeholder
 * names the prop it stands in for and no copy is invented here.
 */
function placeholderArgs(
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const schema = manifest.component.schema;
  if (!schema) return {};

  const properties = schema.properties ?? {};
  const filled: Record<string, unknown> = {};

  for (const name of schema.required ?? []) {
    if (name in defaults) continue;

    const property = properties[name];
    if (!property) continue;

    const type = Array.isArray(property.type)
      ? property.type[0]
      : property.type;

    if (property.enum?.length) filled[name] = property.enum[0];
    else if (type === "boolean") filled[name] = false;
    else if (type === "number" || type === "integer") filled[name] = 1;
    else if (type === "array") filled[name] = [];
    else if (type === "object") filled[name] = {};
    else filled[name] = property.description ?? property.title ?? name;
  }

  return filled;
}

/** Storybook controls derived from the schema the fixture supplied. */
function argTypesFromSchema(): NonNullable<Meta["argTypes"]> {
  const properties = manifest.component.schema?.properties ?? {};
  const argTypes: NonNullable<Meta["argTypes"]> = {};

  for (const [name, property] of Object.entries(properties)) {
    const type = Array.isArray(property.type)
      ? property.type[0]
      : property.type;

    argTypes[name] = {
      description: property.description,
      control: property.enum
        ? { type: "select" }
        : type === "boolean"
          ? { type: "boolean" }
          : type === "number" || type === "integer"
            ? { type: "number" }
            : { type: "text" },
      ...(property.enum ? { options: property.enum } : {}),
      table: {
        category: manifest.component.schemaPath ? "schema" : "inferred",
      },
    };
  }

  return argTypes;
}

class Boundary extends ReactComponent<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Note tone="warn">
          The component threw while rendering: {this.state.error.message}
        </Note>
      );
    }
    return this.props.children;
  }
}

const picked = pickComponent();
const shippedDefaults = pickDefaults();
const stoodIn = placeholderArgs(shippedDefaults);

function Stage(props: Record<string, unknown>) {
  if (!picked) {
    return (
      <Page title="No renderable component">
        <Note tone="warn">
          {manifest.component.componentPath
            ? `${manifest.component.componentPath} exports nothing that React can render (${Object.keys(exports_).join(", ") || "no exports"}).`
            : "The agent produced no component file at the contracted location."}
        </Note>
      </Page>
    );
  }

  const Produced = picked.render;

  return (
    <>
      {/* Ambient first: the component's own tokens must win the cascade. */}
      {ambientStyles ? <style>{ambientStyles}</style> : null}
      {styles ? <style>{styles}</style> : null}
      {styleErrors.length ? (
        <div className="rp-page">
          <Note tone="warn">
            Stylesheet did not compile — the component renders unstyled:
            <br />
            {styleErrors.join("; ")}
          </Note>
        </div>
      ) : null}
      <div className="rp-stage">
        <Boundary>
          <Produced {...props} />
        </Boundary>
      </div>
    </>
  );
}

function Provenance() {
  const { component } = manifest;

  return (
    <Page
      title="What was rendered"
      subtitle="Files discovered by role, not by name — a misnamed file is still shown."
    >
      <Section heading="Files">
        <table className="rp-table">
          <tbody>
            <tr>
              <td>component</td>
              <td>{component.componentPath ?? "— none —"}</td>
              <td>
                {component.componentOnContract ? "on contract" : "off contract"}
              </td>
            </tr>
            <tr>
              <td>stylesheet</td>
              <td colSpan={2}>{component.stylePath ?? "— none —"}</td>
            </tr>
            <tr>
              <td>token partial</td>
              <td colSpan={2}>{component.tokenPath ?? "— none —"}</td>
            </tr>
            <tr>
              <td>client behaviour</td>
              <td colSpan={2}>
                {component.clientPaths.join(", ") || "— none —"}
              </td>
            </tr>
            <tr>
              <td>stories</td>
              <td colSpan={2}>
                {component.storyPaths.join(", ") || "— none —"}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section heading="Rendered export">
        <p className="rp-subtitle">
          {picked
            ? `${picked.name} from ${component.componentPath}`
            : "nothing renderable"}
        </p>
      </Section>

      <Section heading="Host-supplied context">
        <p className="rp-subtitle">
          No fixture ships a <code className="rp-code">--ks-*</code> token
          layer, so a trial's own SCSS resolves to nothing on its own. The
          report supplies the design system's layer so the component looks the
          way it would in the real system. Nothing here was graded.
        </p>
        <p className="rp-code">
          {ambientSources.join(", ") || "— none found —"}
        </p>
      </Section>

      <Section heading="Props">
        <p className="rp-subtitle">
          Defaults come from the agent's own defaults module. Placeholders are
          supplied by the report for required props it leaves to the caller —
          they are not part of what was graded.
        </p>
        <table className="rp-table">
          <tbody>
            {Object.entries({ ...shippedDefaults, ...stoodIn }).map(
              ([name, value]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <span
                      className={`rp-badge rp-badge--${name in stoodIn ? "muted" : "pass"}`}
                    >
                      {name in stoodIn ? "placeholder" : "default"}
                    </span>
                  </td>
                  <td className="rp-code">{JSON.stringify(value)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Section>
    </Page>
  );
}

const meta: Meta = {
  title: "Report/Component",
  parameters: { layout: "fullscreen" },
  argTypes: argTypesFromSchema(),
};

export default meta;

/** The component as the agent shipped it, with its own default props. */
export const Rendered: StoryObj = {
  args: { ...shippedDefaults, ...stoodIn },
  render: (args) => <Stage {...(args as Record<string, unknown>)} />,
};

export const Provenance_: StoryObj = {
  name: "Provenance",
  render: () => <Provenance />,
};
