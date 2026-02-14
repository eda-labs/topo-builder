# EDA Topology Builder

Topology Builder UI for the [Nokia EDA](https://eda.dev) platform allows users to create the input YAML for the topology workflow in a graphical way.

**Not an official Nokia product.**

## Development

- Install: `npm ci`
- Run app: `npm run dev`
- Build static app: `npm run build`
- Typecheck: `npm run typecheck`

## Library Package

This repo can also be built as a reusable npm package: `@eda-labs/topo-builder`.

- Build package artifacts: `npm run build:lib`
- Output: `dist/lib/index.js`, `dist/lib/index.d.ts`, `dist/lib/styles.css`

Example usage:

```tsx
import { TopologyEditor } from '@eda-labs/topo-builder';
import '@eda-labs/topo-builder/styles.css';

export function Dashboard() {
  return <TopologyEditor />;
}
```

For VS Code webviews, you can replace the built-in Monaco YAML tab with a custom panel:

```tsx
<TopologyEditor renderYamlPanel={() => <MyVscodeYamlPanel />} />
```
