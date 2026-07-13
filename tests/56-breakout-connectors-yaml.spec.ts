import { test, expect } from '@playwright/test';

import { canvasPane, getYamlContent } from './utils';

// Resolved in the browser by Vite; passed as an argument so the Node-side
// typecheck does not try to resolve it as a module.
const STORE_MODULE = '/src/lib/store/index.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface StoreModule { useTopologyStore: { getState: () => any } }

// Zoom in on a node until the interactive port cells replace the summary canvas.
async function zoomToPorts(page: import('@playwright/test').Page, nodeTestId: string): Promise<void> {
  const node = page.getByTestId(nodeTestId);
  await node.waitFor();
  for (let i = 0; i < 10; i++) {
    const box = await node.boundingBox();
    if (!box) throw new Error(`no bounding box for ${nodeTestId}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(100);
    if (await page.locator('.fp-port-free').count() > 0) return;
  }
  throw new Error('ports never became interactive');
}

test('SR OS breakout emits a connector component in the YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await page.evaluate(async (storeModule) => {
    const { useTopologyStore } = await import(storeModule) as StoreModule;
    useTopologyStore.getState().addCatalogNode({ x: 300, y: 200 }, {
      platform: '7750 SR-1',
      nodeProfile: 'sros-ghcr-25.7.r1',
      namePrefix: 'sr1',
      components: [{ kind: 'mda', slot: '1', type: 'me6-100gb-qsfp28' }],
    });
  }, STORE_MODULE);

  await zoomToPorts(page, 'topology-node-sr11');
  await page.locator('.fp-port-free').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Break out into 4 × 25G' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('kind: connector');
  expect(yaml).toContain('slot: 1-a-1');
  expect(yaml).toContain('type: c4-25g');
});

test('SR Linux breakout offers speeds and lands in the breakout annotation', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await page.evaluate(async (storeModule) => {
    const { useTopologyStore } = await import(storeModule) as StoreModule;
    useTopologyStore.getState().addNode({ x: 300, y: 200 }, 'leaf');
  }, STORE_MODULE);

  await zoomToPorts(page, 'topology-node-leaf1');
  const port3 = page.locator('.fp-port-free', { hasText: /^3$/ }).first();
  await port3.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Break out into 4 × 10G' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('topobuilder.eda.labs/breakouts: 3:4x10');
});

test('cabling an SR Linux breakout channel derives a breakout link template', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await page.evaluate(async (storeModule) => {
    const { useTopologyStore } = await import(storeModule) as StoreModule;
    const store = useTopologyStore.getState();
    store.addNode({ x: 200, y: 400 }, 'leaf');
    store.addNode({ x: 700, y: 100 }, 'spine');
    const state = useTopologyStore.getState();
    const leaf = state.nodes.find((n: { data: { name: string } }) => n.data.name === 'leaf1');
    const spine = state.nodes.find((n: { data: { name: string } }) => n.data.name === 'spine1');
    if (!leaf || !spine) throw new Error('nodes missing');
    state.updateNode(leaf.id, { breakouts: { 3: 4 } });
    useTopologyStore.getState().onConnect({
      source: leaf.id,
      target: spine.id,
      sourceHandle: 'port:3_2',
      targetHandle: 'port:1-target',
    });
    useTopologyStore.getState().triggerYamlRefresh();
  }, STORE_MODULE);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('name: isl-l4x25g');
  expect(yaml).toContain('topobuilder.eda.labs/breakout-variant: isl');
  expect(yaml).toContain('channels: 4');
  expect(yaml).toContain('speed: 25G');
  expect(yaml).toContain('interface: ethernet-1-3-2');
  expect(yaml).toContain('template: isl-l4x25g');
});
