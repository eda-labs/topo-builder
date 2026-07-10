# EDA Topology Builder

Topology Builder UI for the [Nokia EDA](https://eda.dev) platform allows users to create the input YAML for the topology workflow in a graphical way.

**Not an official Nokia product.**

## v2: front-panel mode

On this branch, nodes whose platform (or template platform) has known faceplate geometry render as
true-to-hardware **front panels** — port cages at their real on-panel positions, derived from the
cable-map stencil metadata (`src/generated/frontpanel-meta.json`; geometry only, no heavy SVGs).

- **Port-level cabling**: drag from a free port to a free port on another node to cable those exact
  interfaces (`ethernet-1-<port>`; SR OS connector naming when the node profile is SROS). Clicking a
  free port and then another free port works too. Dragging from the chassis border keeps the classic
  behaviour: the next free interface is picked automatically.
- **Cables anchor at their ports**: every member link renders as its own cable attached to its port
  on the faceplate; used ports are coloured (green = fabric link, purple = sim edge, blue = edge
  link), and clicking a used port or cable selects that member link.
- **Breakouts**: right-click a free cage to break it out into 2/4/8 channels; channels cable
  individually as `ethernet-<lc>-<port>-<channel>`. Breakouts are stored in the
  `topobuilder.eda.labs/breakouts` node annotation and re-inferred from channelised interface
  names when importing hand-written YAML.
- **Elbow cables**: cables route orthogonally by default; the canvas control toggles
  elbow/curved routing.
- **Member-level delete**: clicking or right-clicking a cable selects just that member link —
  Delete (or "Delete Link") removes only it; "Delete All Links (N)" removes the whole bundle.
- **Template palette**: a hover-expanding rail on the canvas lists node/sim templates with a mini
  front-panel preview — drag one onto the canvas (or click) to add a node; pin it open if you
  prefer.
- **Zoom-aware detail**: zoomed out, panels paint as a lightweight canvas with the same footprint;
  zoomed in, ports become interactive.
- Platforms without faceplate metadata (and sim nodes) keep the v1 icon rendering, and the YAML
  in/out is unchanged — ports are inferred from the member-link interface names.

Known limitation: the SVG export still draws the v1 abstract node boxes.

## Package

The reusable React package is published to GitHub Packages as `@eda-labs/topo-builder`.

Consumers need an `.npmrc` that maps the `@eda-labs` scope to GitHub Packages:

```ini
@eda-labs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install with a GitHub token that can read the private package:

```sh
GITHUB_TOKEN=$(gh auth token) npm install @eda-labs/topo-builder
```
