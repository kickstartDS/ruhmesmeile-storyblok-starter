# Design System Component Builder MCP Server

An MCP (Model Context Protocol) server that provides instructions and templates for building UI components following the kickstartDS Design System patterns.

Part of the [kickstartDS Storyblok Starter](../../README.md) monorepo.

## Features

This MCP server exposes tools to help LLMs understand and generate code for:

- **Component Structure**: Standard file organization for components
- **JSON Schema First Development**: Schema templates for defining component APIs
- **React Patterns**: Pure functional components with Context pattern
- **Client-Side Behavior**: Separated JavaScript for DOM interactions
- **SCSS/BEM Styling**: Design Token layers and BEM naming conventions
- **Storybook Integration**: Story templates and documentation

## Installation

From the monorepo root:

```bash
pnpm install
pnpm --filter component-builder-mcp build
```

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "design-system-component-builder": {
      "command": "node",
      "args": ["/path/to/component-builder-mcp/dist/index.js"]
    }
  }
}
```

### With VS Code + Copilot

Add to your VS Code settings:

```json
{
  "mcp.servers": {
    "design-system-component-builder": {
      "command": "node",
      "args": [
        "${workspaceFolder}/packages/component-builder-mcp/dist/index.js"
      ]
    }
  }
}
```

## Available Tools (10 base; 16 with a contract set)

The six contract tools are advertised only when `DESIGN_SYSTEM_CONTRACTS_DIR`
points at a generated `contracts/` directory — otherwise they are withheld
rather than advertised and failing. See `scripts/contracts/README.md` in the
design-system package for how to generate one.

### `get_ui_building_instructions`

Get comprehensive instructions for building UI components. **Always call this first** before any component development work.

### `get_component_structure`

Get the standard file structure and creation order for a new component.

### `get_json_schema_template`

Generate a JSON Schema template for defining component props. The schema is the source of truth for component APIs.

### `get_react_component_template`

Get a React component template following the Design System patterns (pure functional, forwardRef, Context pattern).

### `get_client_behavior_template`

Get templates for adding client-side JavaScript behavior to components using the kickstartDS Component class.

### `get_scss_template`

Get SCSS templates with BEM naming and Design Token layers.

### `get_storybook_template`

Get Storybook story templates with schema integration.

### `list_component_contracts` _(contract set required)_

List every component with a derived Component Contract, with coverage and issue counts.

### `get_component_brief` _(contract set required)_

The Markdown brief for one component — the token-cheap front door. Call this first for "what is this component and how do I configure it".

### `get_component_contract` _(contract set required)_

The full derived contract, or one section of it (`api`, `anatomy`, `axes`, `default`, `variants`, `bindings`, `composition`, `coverage`, `issues`).

### `get_component_anatomy` _(contract set required)_

Observed parts, their tokens, and composition/slots only.

### `get_prop_visual_impact` _(contract set required)_

`bindings` + `axes`: how a prop becomes visible (`mechanism`), which parts it touches, and the templated token names to reach for.

### `lint_component_contracts` _(contract set required)_

Every issue the contracts derived across the design system (e.g. an enum value with no matching token segment).

## Available Resources (5)

| Resource                       | Description                              |
| ------------------------------ | ---------------------------------------- |
| `design-system://instructions` | UI building instructions                 |
| `design-system://token-architecture` | Token layer architecture docs      |
| `design-system://components`   | Component catalog listing                |
| `contracts://format-guide`     | How to read a Component Contract         |
| `contracts://index`            | The published contract set and addresses |

## Design System Patterns

### Component File Structure

Each component lives in its own folder with colocated files:

```
src/components/{component-name}/
├── {ComponentName}Component.tsx     # React implementation
├── {ComponentName}Props.ts          # TypeScript types (generated)
├── {ComponentName}Defaults.ts       # Default prop values
├── {component-name}.schema.json     # JSON Schema (source of truth)
├── {component-name}.scss            # Component styles
├── _{component-name}-tokens.scss    # Design Tokens
├── {ComponentName}.stories.tsx      # Storybook stories
├── {ComponentName}.mdx              # Documentation
└── js/                              # Client behavior (optional)
    └── {ComponentName}.client.js
```

### JSON Schema First

Component APIs are defined in JSON Schema, then types are generated:

1. Create `{component-name}.schema.json`
2. Run `pnpm run schema` to generate TypeScript types
3. Implement the component using generated types

### Pure React Components

Components are pure functions with no local state:

- Use `forwardRef` for ref forwarding
- Use Context pattern for component overrides
- Use `deepMergeDefaults` for prop defaults
- Client-side behavior is separated into `.client.js` files

### Design Token Layers

```
Branding Tokens (--ks-brand-*)
         ↓
Semantic Tokens (--ks-*)
         ↓
Component Tokens (--dsa-*)
```

## Related

- [kickstartDS](https://www.kickstartds.com/) - The underlying Design System framework
- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol specification

## License

(MIT OR Apache-2.0)
