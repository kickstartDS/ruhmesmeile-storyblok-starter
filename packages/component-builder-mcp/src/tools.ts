/**
 * MCP tool definitions for the component-builder server.
 *
 * Each entry follows the MCP Tool schema:
 *   { name, description, inputSchema, annotations }
 *
 * All tools in this server are read-only (they return documentation
 * and templates, never modify anything), so every tool carries
 * `readOnlyHint: true` and `destructiveHint: false`.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { contractsDir } from "./contracts.js";

/** Shared annotations — all tools are read-only and idempotent. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const ALL_TOOLS: Tool[] = [
  {
    name: "get_ui_building_instructions",
    description: `Get comprehensive instructions for building UI components in this Design System.

ALWAYS call this tool FIRST before doing any UI/frontend/React/component development, including:
- Adding new components
- Updating existing components
- Creating pages, screens, or layouts
- Working with component styling

This returns the foundational patterns and conventions used across all components.`,
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_component_structure",
    description: `Get the standard file structure and templates for creating a new Design System component.

Use this when you need to:
- Create a new component from scratch
- Understand what files are needed for a component
- Get boilerplate templates for component files

Requires the component name (PascalCase) and description.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description:
            "The PascalCase name of the component (e.g., 'Button', 'HeroSection')",
        },
        description: {
          type: "string",
          description: "A brief description of what the component does",
        },
      },
      required: ["componentName", "description"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_json_schema_template",
    description: `Get a JSON Schema template for defining component props.

JSON Schema is the source of truth for component APIs in this Design System.
All props, types, and validation rules are defined here first, then TypeScript types are generated from it.

Use this when:
- Creating a new component and need to define its props
- Adding new properties to an existing component
- Understanding the schema patterns used in this Design System`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        description: {
          type: "string",
          description: "Component description for the schema",
        },
        properties: {
          type: "array",
          description: "Array of property definitions to include",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Property name (camelCase)",
              },
              type: {
                type: "string",
                enum: ["string", "boolean", "number", "array", "object"],
                description: "JSON Schema type",
              },
              description: {
                type: "string",
                description: "Property description",
              },
              required: {
                type: "boolean",
                description: "Whether this property is required",
              },
              enum: {
                type: "array",
                items: { type: "string" },
                description: "Enum values for string properties",
              },
              default: { description: "Default value for the property" },
              format: {
                type: "string",
                description:
                  "Format hint (e.g., 'markdown', 'image', 'uri', 'icon')",
              },
            },
            required: ["name", "type", "description"],
          },
        },
      },
      required: ["componentName", "description"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_react_component_template",
    description: `Get a React component template following the Design System patterns.

This Design System uses:
- Purely functional (pure) React components with NO local state
- forwardRef for ref forwarding
- Context pattern for component overrides (Provider pattern)
- Deep merge of defaults with props
- Composition with kickstartDS base components where applicable

Use this when creating or modifying React component implementations.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        hasClientBehavior: {
          type: "boolean",
          description:
            "Whether the component needs client-side JavaScript behavior",
          default: false,
        },
        composesBaseComponent: {
          type: "boolean",
          description:
            "Whether this component wraps a kickstartDS base component",
          default: false,
        },
        baseComponentImport: {
          type: "string",
          description:
            "The import path for the base component (e.g., '@kickstartds/base/lib/button')",
        },
      },
      required: ["componentName"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_client_behavior_template",
    description: `Get templates for adding client-side JavaScript behavior to components.

This Design System separates concerns:
- React components are pure and handle rendering only
- Client-side interactivity is handled by separate JavaScript classes
- Uses kickstartDS Component class with lifecycle management
- Supports dynamic imports for code splitting
- Uses radio events for cross-component communication

Use this when a component needs:
- DOM manipulation
- Event listeners
- Dynamic behavior
- Integration with third-party libraries`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        identifier: {
          type: "string",
          description: "The component identifier (e.g., 'dsa.section')",
        },
        behaviorDescription: {
          type: "string",
          description: "Description of the client-side behavior needed",
        },
      },
      required: ["componentName", "identifier"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_scss_template",
    description: `Get SCSS/CSS templates following the Design System's styling patterns.

This Design System uses:
- BEM naming convention (Block__Element--Modifier)
- Design Token layers: branding → semantic → component tokens
- Component-scoped CSS custom properties (--dsa-component-name--property)
- Separate token definition files (_component-tokens.scss)
- Token extraction to JSON for documentation

Use this when:
- Creating styles for a new component
- Understanding the token architecture
- Adding responsive styles`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        cssClassName: {
          type: "string",
          description: "The BEM block class name (e.g., 'dsa-button')",
        },
        includeTokens: {
          type: "boolean",
          description: "Whether to include a component tokens file template",
          default: true,
        },
      },
      required: ["componentName", "cssClassName"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_storybook_template",
    description: `Get Storybook story templates for component documentation and testing.

This Design System uses Storybook with:
- Schema-driven args generation via getArgsShared
- JSON Schema integration for prop documentation
- Component tokens documentation via cssprops parameter
- Visual regression testing support

Use this when creating stories for new or existing components.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        defaultArgs: {
          type: "object",
          description: "Default args for the primary story",
        },
      },
      required: ["componentName"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_defaults_template",
    description: `Get a defaults file template for component default props.

Each component has a defaults file that:
- Defines default values matching JSON Schema defaults
- Uses DeepPartial type for partial default definitions
- Is merged with incoming props at runtime

Use this when creating the defaults configuration for a component.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        componentName: {
          type: "string",
          description: "The PascalCase name of the component",
        },
        defaults: {
          type: "object",
          description: "The default values object",
        },
      },
      required: ["componentName"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_token_architecture",
    description: `Get documentation on the Design Token architecture and layering system.

This Design System uses a three-layer token architecture:
1. Branding tokens (--ks-brand-*) - Core brand values
2. Semantic tokens (--ks-*) - Purpose-based tokens referencing branding
3. Component tokens (--dsa-*) - Component-specific tokens referencing semantic

Use this to understand how to properly use and create tokens.`,
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "list_existing_components",
    description: `List all existing components in the Design System with their file structures.

Use this to:
- Discover available components
- Find components to reference or extend
- Understand which components have client behavior`,
    inputSchema: {
      type: "object" as const,
      properties: {
        includeDetails: {
          type: "boolean",
          description: "Include detailed file lists for each component",
          default: false,
        },
      },
      required: [],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "list_component_contracts",
    description: `List every component that has a derived Component Contract, with its coverage score.

Use this to:
- Discover which components have contracts and how well evidenced they are
- Pick a component before calling get_component_brief
- See which components carry derived lint issues

A contract joins the component's API, its rendered DOM, and its design tokens, and says what changes visually when a prop is set.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        includeCoverage: {
          type: "boolean",
          description: "Include coverage score, variant count and issue count per component",
          default: true,
        },
      },
      required: [],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_component_brief",
    description: `Get the Markdown brief for one component — the token-cheap front door to its contract.

Use this FIRST when you need to know what a component is and how to configure it:
- which props have a visual impact and by which mechanism
- which token names to reach for
- which parts exist and when
- what the contract does and does not prove (coverage)

The brief is generated from the contract and is never edited. Call get_component_contract only when you need the full evidence.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Component contractId ('button', 'blog-aside') or display name ('Blog Aside')",
        },
      },
      required: ["name"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_component_contract",
    description: `Get the full derived Component Contract for one component, or one section of it.

The contract contains: api (props with role/axis), anatomy (observed parts and their tokens), axes (the api ↔ DOM class ↔ token segment join), default (resolved styles per part), variants (deltas backed by stories), bindings (prop → mechanism → parts), composition (slots and what they accept), coverage (what is proven).

Prefer get_component_brief for orientation; use this when you need specific evidence.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Component contractId or display name",
        },
        section: {
          type: "string",
          enum: [
            "api",
            "anatomy",
            "axes",
            "default",
            "variants",
            "bindings",
            "composition",
            "coverage",
            "issues",
            "generated",
          ],
          description: "Return only this section instead of the whole contract",
        },
      },
      required: ["name"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_component_anatomy",
    description: `Get only the anatomy and composition of a component contract.

Anatomy is the observed DOM tree: each part has a path, element, classes, role, presence (always/conditional/repeated), a gate when conditional, and the design tokens bound to it. Composition describes the component's slots: cardinality, item shape, accepted child components, and observed counts.

Use this for "what is this component made of" and "what can I put inside it" questions.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Component contractId or display name",
        },
      },
      required: ["name"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "get_prop_visual_impact",
    description: `Get the visual impact of a component's props: bindings (how each prop becomes visible) and axes (its value ↔ class ↔ token join).

Use this to answer:
- "what happens visually if I set variant=primary?"
- "is this prop themeable, and which token do I change?"
- "does this prop change the DOM or only a style?"

mechanism is one of content | presence | class-toggle | token-swap | attribute | element-swap | layout | none. templatedTokens use the axis values, e.g. --dsa-button_{variant}--background-color. Pass a prop name to focus on one.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Component contractId or display name",
        },
        prop: {
          type: "string",
          description: "Restrict to a single prop (e.g. 'variant')",
        },
      },
      required: ["name"],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "lint_component_contracts",
    description: `List every issue the contracts derived across the design system.

An issue is a computed defect, not a style opinion: an enum value with no matching token segment (e.g. a misspelled token), two spellings of the same part, an unresolved component-token chain. These are invisible to every other artifact.

Use this when auditing the design system or before trusting a token name.`,
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
];

/** Tools that only work when a contract set is configured. */
const CONTRACT_TOOL_NAMES: Record<string, true> = {
  list_component_contracts: true,
  get_component_brief: true,
  get_component_contract: true,
  get_component_anatomy: true,
  get_prop_visual_impact: true,
  lint_component_contracts: true,
};

/**
 * The advertised tool list.
 *
 * Contract tools are withheld entirely unless `DESIGN_SYSTEM_CONTRACTS_DIR` is
 * set. Advertising a tool whose handler can only say "not available" would put
 * the contract vocabulary into every arm's context and burn turns on calls that
 * cannot succeed — which is both a worse product and a confounded experiment.
 */
export const tools: Tool[] = ALL_TOOLS.filter(
  (tool) =>
    contractsDir() !== null || !Object.hasOwn(CONTRACT_TOOL_NAMES, tool.name),
);
