import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';

import { addTwoNodesAndConnect } from './lag-utils';
import { getEdgeCount, getNodeCount, getYamlContent, waitForAppReady } from './utils';

test('Copy/paste selection of nodes and links', async ({ page, browserName }) => {
  test.skip(!!process.env.CI, 'Keyboard clipboard events unreliable in headless CI');
  test.skip(browserName === 'firefox', 'Firefox shift+drag behavior differs');
  await page.goto('/');
  await waitForAppReady(page);

  await addTwoNodesAndConnect(page);

  // Wait for nodes to be rendered
  const node1 = page.getByTestId('topology-node-leaf1');
  const node2 = page.getByTestId('topology-node-leaf2');
  await node1.waitFor();
  await node2.waitFor();

  // Get actual node bounding boxes for shift-drag selection
  const box1 = await node1.boundingBox();
  const box2 = await node2.boundingBox();
  if (!box1 || !box2) throw new Error('Could not get node bounds');

  // Create selection box that encompasses both nodes with padding
  const padding = 50;
  const startX = Math.min(box1.x, box2.x) - padding;
  const startY = Math.min(box1.y, box2.y) - padding;
  const endX = Math.max(box1.x + box1.width, box2.x + box2.width) + padding;
  const endY = Math.max(box1.y + box1.height, box2.y + box2.height) + padding;

  // Shift+drag to select both nodes and edge
  await page.keyboard.down('Shift');
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  // Wait for selection to propagate to the store
  await page.waitForFunction(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    return state.nodes.filter((n: { selected?: boolean }) => n.selected).length === 2 &&
      state.edges.filter((e: { selected?: boolean }) => e.selected).length === 1;
  }, { timeout: 5000 });

  // Copy selection
  await page.keyboard.press('ControlOrMeta+c');
  await page.waitForTimeout(100);

  // Move mouse to paste position (below the selection area)
  const pasteX = (startX + endX) / 2;
  const pasteY = endY + 150;
  await page.mouse.move(pasteX, pasteY);

  // Paste
  await page.keyboard.press('ControlOrMeta+v');

  // Wait for pasted nodes to appear
  await expect.poll(() => getNodeCount(page), { timeout: 10000 }).toBe(4);
  await expect.poll(() => getEdgeCount(page), { timeout: 10000 }).toBe(2);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yamlContent = await getYamlContent(page);

  // Parse YAML and verify structure (coordinates vary due to paste position)
  const doc = yaml.load(yamlContent) as {
    spec?: {
      nodes?: Array<{ name: string }>;
      links?: Array<{ name: string }>;
    };
  };

  const nodeNames = (doc?.spec?.nodes ?? []).map(n => n.name).sort();
  const linkNames = (doc?.spec?.links ?? []).map(l => l.name).sort();

  expect(nodeNames).toEqual(['leaf1', 'leaf2', 'leaf3', 'leaf4']);
  expect(linkNames).toEqual(['leaf1-leaf2-1', 'leaf3-leaf4-1']);
});
