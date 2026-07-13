import { test, expect, type Page } from '@playwright/test';

import { addContextMenuItem, clickNodeHeader, nodeByLabel, NODE1_POS } from './lag-utils';
import { canvasPane, loadExpectedYaml } from './utils';

async function nodePosition(page: Page, name: string): Promise<{ x: number; y: number }> {
  return page.evaluate(async nodeName => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const { useTopologyStore } = await import('/src/lib/store/index.ts');
    const node = useTopologyStore.getState().nodes.find(
      (candidate: { data: { name?: string } }) => candidate.data.name === nodeName,
    );
    if (!node) throw new Error(`Missing node ${nodeName}`);
    return node.position;
  }, name);
}

test('node drag stays canvas-local until pointer up', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await addContextMenuItem(page, NODE1_POS, 'Add Node');

  const node = nodeByLabel(page, 'leaf1');
  await node.waitFor();
  await clickNodeHeader(page, 'leaf1');

  const initialStorePosition = await nodePosition(page, 'leaf1');
  const initialBox = await node.boundingBox();
  if (!initialBox) throw new Error('Could not measure leaf1');

  const startX = initialBox.x + Math.min(60, initialBox.width / 4);
  const startY = initialBox.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 150, startY + 90, { steps: 8 });

  // React Flow owns pointer-frequency coordinates. The persisted app store must remain untouched
  // while the pointer is down, otherwise every frame serializes and re-renders the whole app.
  expect(await nodePosition(page, 'leaf1')).toEqual(initialStorePosition);
  await expect.poll(async () => (await node.boundingBox())?.x ?? initialBox.x).toBeGreaterThan(initialBox.x + 100);

  await page.mouse.up();
  await expect.poll(() => nodePosition(page, 'leaf1')).not.toEqual(initialStorePosition);
});

test('a transient drag updates every ESI-LAG leaf path', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await page.evaluate(async yamlText => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const { useTopologyStore } = await import('/src/lib/store/index.ts');
    useTopologyStore.getState().importFromYaml(yamlText);
  }, loadExpectedYaml('06-add-esi-lag.yaml'));

  const leaf = nodeByLabel(page, 'leaf2');
  const visiblePaths = page.locator('.react-flow__edge path:not(.react-flow__edge-interaction)');
  await leaf.waitFor();
  await expect(visiblePaths).toHaveCount(2);

  const initialStorePosition = await nodePosition(page, 'leaf2');
  const initialPaths = await visiblePaths.evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  const box = await leaf.boundingBox();
  if (!box) throw new Error('Could not measure leaf2');

  const startX = box.x + Math.min(60, box.width / 4);
  const startY = box.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY + 75, { steps: 8 });

  expect(await nodePosition(page, 'leaf2')).toEqual(initialStorePosition);
  await expect.poll(
    () => visiblePaths.evaluateAll(paths => paths.map(path => path.getAttribute('d'))),
  ).not.toEqual(initialPaths);

  await page.mouse.up();
  await expect.poll(() => nodePosition(page, 'leaf2')).not.toEqual(initialStorePosition);
});
