# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EDA Topology Builder — a visual editor for creating Nokia EDA NetworkTopology YAML configurations. Users design network topologies on a graph canvas and the app bidirectionally syncs with YAML. Built with Astro (static output), React 19, TypeScript (strict), and Zustand.

## Commands

```bash
npm run dev            # Start dev server at http://localhost:4321
npm run build          # Generate types from schema + Astro build → dist/
npm run lint           # TypeScript type-check + ESLint (src/)
npm run lint:fix       # Auto-fix ESLint issues
npm run typecheck      # TypeScript only (tsc --noEmit)
npm run generate-types # Regenerate src/types/schema.ts from src/static/schema.json
npm run test:e2e       # Playwright E2E tests (requires dev server running)
npm run test:e2e:ui    # Playwright interactive UI mode
```

Run a single E2E test: `npx playwright test tests/<file>.spec.ts`

## Architecture

### Tech Stack
- **Framework**: Astro 5 (static site generator) with React integration
- **UI**: React 19 + MUI 7 + Tailwind CSS 4
- **Graph Canvas**: @xyflow/react (ReactFlow) for node/edge visualization
- **State**: Zustand with persist middleware (localStorage)
- **YAML**: js-yaml for parsing, ajv for schema validation, Monaco editor for editing
- **Testing**: Playwright (Chromium, Firefox, WebKit)

### State Management — Zustand Slice Pattern
The store is composed of domain slices in `src/lib/store/`:
- `createStore.ts` — Composes all slices into `TopologyStore`, manages ID generation, paste logic, undo/redo
- `nodes.ts`, `links.ts`, `lags.ts`, `esiLags.ts`, `simNodes.ts` — Domain CRUD
- `templates.ts` — Node/link/simNode template management
- `selection.ts` — Multi-select state for nodes, edges, member links, LAGs
- `history.ts` — Undo/redo stack (50-item limit)

The store is a singleton exported as `useTopologyStore` from `createStore.ts`.

### YAML ↔ UI Conversion
`src/lib/yaml-converter/` handles bidirectional conversion:
- `yamlToUi.ts` — Parses YAML string → `UIState` (validates against `src/static/schema.json`)
- `uiToYaml.ts` — Exports `UIState` → YAML string
- Node positions are stored as internal labels (`topobuilder.eda.labs/x`, `topobuilder.eda.labs/y`)

### Type Generation
`src/types/schema.ts` is **auto-generated** — do not edit manually. Run `npm run generate-types` after modifying `src/static/schema.json`. The script extracts enums and interfaces from the JSON Schema.

### Component Hierarchy
```
TopologyEditor (main React component, src/components/TopologyEditor.tsx)
├── ReactFlow canvas
│   ├── TopoNode / SimNode (src/components/nodes/)
│   └── LinkEdge / BundleEdge / EsiLagEdge (src/components/edges/)
├── PropertiesPanel (right drawer with editors)
│   ├── NodeEditor / EdgeEditor / SimNodeEditor (src/components/panels/)
│   └── Template panels
├── YamlEditor (Monaco-based, syncs via yamlRefreshCounter)
└── ContextMenu (right-click actions)
```

### Edge Types
Three edge types with distinct rendering and data models:
- **normal** — Simple point-to-point link with member links
- **lag** — Link Aggregation Group bundling multiple member links
- **esilag** — Ethernet Segment Identifier LAG (multi-homed, 2-4 leaves)

## Code Conventions

### ESLint Rules (enforced)
- Strict TypeScript: no non-null assertions, consistent type imports (`import type`)
- Max cognitive complexity: 15; max file length: 1000 lines (src/ only)
- Import order: builtin → external → internal → parent → sibling → index
- 2-space indent, single quotes, semicolons, trailing commas in multiline
- JSX uses double quotes
- No nested ternaries

### Naming
- Names (topology, namespace, nodes) must match DNS-1123: `/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/` (max 63 chars)
- Default interfaces: `ethernet-1-1` (topo nodes), `eth1` (sim nodes)
- Internal labels use prefix `topobuilder.eda.labs/`

### Testing
- E2E tests live in `tests/` with shared utilities in `tests/utils.ts` and `tests/lag-utils.ts`
- Test IDs are centralized in `src/lib/testIds.ts`
- Tests run against the dev server on port 4321
