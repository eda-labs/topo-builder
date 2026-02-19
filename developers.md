# Development

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

Theming override example:

```tsx
import { TopologyEditor } from '@eda-labs/topo-builder';

export function Dashboard() {
  return (
    <TopologyEditor
      themeOptions={{
        palette: {
          mode: 'light',
          primary: { main: '#0B6E4F' },
          background: { default: '#F5F7FA', paper: '#FFFFFF' },
          text: { primary: '#102A43', secondary: '#486581' },
        },
        typography: {
          fontFamily: '"IBM Plex Sans", sans-serif',
        },
      }}
      styleVariables={{
        '--color-link-stroke': '#7B8794',
        '--color-node-border-selected': '#0B6E4F',
        '--xy-background-color': '#FFFFFF',
      }}
    />
  );
}
```

For VS Code webviews, you can replace the built-in Monaco YAML tab with a custom panel:

```tsx
<TopologyEditor renderYamlPanel={() => <MyVscodeYamlPanel />} />
```
