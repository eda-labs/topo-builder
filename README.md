# EDA Topology Builder

Topology Builder UI for the [Nokia EDA](https://eda.dev) platform allows users to create the input YAML for the topology workflow in a graphical way.

**Not an official Nokia product.**

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
