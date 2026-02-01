import { test, expect } from '@playwright/test';
import { waitForAppReady } from './utils';
import { addContextMenuItem, NODE1_POS, NODE2_POS } from './lag-utils';

// Firefox has issues with keyboard.down('Shift') during drag operations
test('shift+drag box selection selects multiple nodes', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox shift+drag behavior differs');
  await page.goto('/');
  await waitForAppReady(page);

  // Add 2 nodes at different positions
  await addContextMenuItem(page, NODE1_POS, 'Add Node');  // x:200, y:300
  await addContextMenuItem(page, NODE2_POS, 'Add Node');  // x:600, y:300

  // Wait for nodes to be rendered
  const node1 = page.getByTestId('topology-node-leaf1');
  const node2 = page.getByTestId('topology-node-leaf2');
  await node1.waitFor();
  await node2.waitFor();

  // Get actual node bounding boxes
  const box1 = await node1.boundingBox();
  const box2 = await node2.boundingBox();
  if (!box1 || !box2) throw new Error('Could not get node bounds');

  // Create selection box that encompasses both nodes with padding
  const padding = 50;
  const startX = Math.min(box1.x, box2.x) - padding;
  const startY = Math.min(box1.y, box2.y) - padding;
  const endX = Math.max(box1.x + box1.width, box2.x + box2.width) + padding;
  const endY = Math.max(box1.y + box1.height, box2.y + box2.height) + padding;

  await page.keyboard.down('Shift');
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  // Wait for selection to propagate to the store
  await page.waitForFunction(async () => {
    const mod = await import('/src/lib/store.ts');
    const state = mod.useTopologyStore.getState();
    return state.nodes.filter((n: { selected?: boolean }) => n.selected).length >= 1;
  }, { timeout: 5000 });

  const selectedCount = await page.evaluate(async () => {
    const mod = await import('/src/lib/store.ts');
    const state = mod.useTopologyStore.getState();
    return state.nodes.filter((n: { selected?: boolean }) => n.selected).length;
  });

  // Shift+drag selection should select both nodes
  expect(selectedCount).toBe(2);
});
