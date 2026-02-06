# Repository Guidelines

## Project Structure & Module Organization

- `src/pages/`: Astro entrypoints (for example `src/pages/index.astro`).
- `src/layouts/`: Astro layouts.
- `src/components/`: React UI components (subfolders: `edges/`, `nodes/`, `panels/`).
- `src/hooks/`: React hooks.
- `src/lib/`: shared logic (state in `src/lib/store/`, YAML conversion in `src/lib/yaml-converter/`).
- `src/styles/`: global styling (Tailwind via Vite).
- `src/static/`: bundled templates/schema inputs (for example `src/static/schema.json`, `src/static/base-template.yaml`).
- `public/`: static assets served as-is.
- `tests/`: Playwright end-to-end tests and YAML fixtures.
- `scripts/`: build helpers (notably `scripts/generate-types.js`).

## Build, Test, and Development Commands

- `npm ci`: install dependencies (CI uses this; `package-lock.json` is source of truth).
- `npm run dev`: start the Astro dev server (defaults to `http://localhost:4321`).
- `npm run build`: generate schema types, then build static output into `dist/`.
- `npm run preview`: serve `dist/` locally to validate the production build.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run lint` / `npm run lint:fix`: typecheck + ESLint on `src/` (with auto-fix).
- `npm run generate-types`: regenerate `src/types/schema.ts` from `src/static/schema.json`.
- `npm run test:e2e` (`:ui`, `:debug`): run Playwright tests (spins up `npm run dev`).

## Coding Style & Naming Conventions

- TypeScript: keep types strict; prefer separate `import type ...` (enforced).
- Formatting (ESLint): 2-space indentation, single quotes, semicolons, multiline trailing commas.
- Filenames: `src/components/**/*.tsx` must be `PascalCase`; `src/hooks/**/*.ts` must be `camelCase`.
- Generated code: do not hand-edit `src/types/schema.ts`; run `npm run generate-types`.

## Testing Guidelines

- Framework: Playwright (`@playwright/test`) with tests under `tests/`.
- Naming: follow the existing ordering pattern `tests/NN-scenario.spec.ts`; fixtures live beside tests as `tests/*.yaml`.
- Selectors: prefer stable `data-testid` hooks; centralize IDs/helpers in `src/lib/testIds.ts`.

## Commit & Pull Request Guidelines

- Commit messages in history are short and imperative (examples: “Add …”, “Fix …”, “Update …”, “Refactor …”); PR merges sometimes include `(#NN)`.
- Keep commits scoped; reference issues when applicable (`Fixes #NN`).
- PRs should include: a clear behavior summary, screenshots/screen recording for UI changes, and updated/added Playwright coverage for changed user flows.
- CI must pass on PRs: `npm run build`, `npm run lint`, `npm run test:e2e` (GitHub Actions uses Node 22 for PR checks).
