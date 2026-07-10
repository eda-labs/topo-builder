import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { expect, type Page } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadExpectedYaml(filename: string): string {
  const filepath = join(__dirname, filename);
  return readFileSync(filepath, 'utf-8').trimEnd();
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByTestId('topology-canvas').waitFor();
  // Pane is still ReactFlow-internal; we scope it under a stable wrapper.
  await page.getByTestId('topology-canvas').locator('.react-flow__pane').waitFor();
}

export async function getYamlContent(page: Page): Promise<string> {
  // Generate the YAML from the live store exactly the way the editor does — reading the
  // Monaco buffer would couple every test to the CDN-loaded editor being up.
  const content = await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const storeMod = await import('/src/lib/store/index.ts');
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const converter = await import('/src/lib/yaml-converter.ts');
    const s = storeMod.useTopologyStore.getState();
    return converter.exportToYaml({
      topologyName: s.topologyName,
      namespace: s.namespace,
      operation: s.operation,
      nodes: s.nodes,
      edges: s.edges,
      nodeTemplates: s.nodeTemplates,
      linkTemplates: s.linkTemplates,
      simulation: s.simulation,
      annotations: s.annotations,
      disableAnnotations: s.disableAnnotations,
      schemaVersion: s.schemaVersion,
    }) as string;
  });
  return content.trimEnd();
}

export async function getNodeCount(page: Page): Promise<number> {
  // Counts both device nodes and sim nodes (both render via BaseNode).
  return page.locator('[data-testid^="topology-node-"], [data-testid^="topology-simnode-"]').count();
}

export async function getEdgeCount(page: Page): Promise<number> {
  // Only counts collapsed "topology edges" (not expanded member links / lag paths).
  return page.locator('[data-testid^="topology-edge-"]').count();
}

export function canvasPane(page: Page) {
  return page.getByTestId('topology-canvas').locator('.react-flow__pane');
}

// Node coordinates depend on canvas geometry (node footprints changed with v2's front panels),
// so YAML comparisons normalise the position annotations and assert everything else exactly.
export function normalizeCoordinates(yamlText: string): string {
  return yamlText.replace(/(topobuilder\.eda\.labs\/[xy]): "-?\d+"/g, '$1: "X"');
}

export function expectYamlToMatchFixture(yaml: string, fixtureFilename: string): void {
  expect(normalizeCoordinates(yaml)).toBe(normalizeCoordinates(loadExpectedYaml(fixtureFilename)));
}

export async function expectYamlEquals(page: Page, fixtureFilename: string): Promise<void> {
  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expectYamlToMatchFixture(yaml, fixtureFilename);
}
