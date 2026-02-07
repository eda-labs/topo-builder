import { test } from '@playwright/test';

import { canvasPane, expectYamlEquals } from './utils';
import { NODE1_POS, NODE2_POS, SIM_POS, addContextMenuItem, connectNodes } from './lag-utils';

test('Renaming node template cascades to nodes', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a node (uses "leaf" template by default)
  await addContextMenuItem(page, NODE1_POS, 'Add Node');

  // Rename the "leaf" template via store
  await page.evaluate(async () => {
    // @ts-expect-error - Vite dev import
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.updateNodeTemplate('leaf', { name: 'access' });
  });

  await expectYamlEquals(page, '44-rename-node-template.yaml');
});

test('Renaming link template cascades to links', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add two nodes and connect them (uses "isl" template by default)
  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

  // Rename the "isl" link template
  await page.evaluate(async () => {
    // @ts-expect-error - Vite dev import
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.updateLinkTemplate('isl', { name: 'backbone' });
  });

  await expectYamlEquals(page, '44-rename-link-template.yaml');
});

test('Renaming simNode template cascades to simNodes', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a SimNode (uses "testman" template by default)
  await addContextMenuItem(page, SIM_POS, 'Add SimNode');

  // Rename the "testman" simNode template
  await page.evaluate(async () => {
    // @ts-expect-error - Vite dev import
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.updateSimNodeTemplate('testman', { name: 'traffic-gen' });
  });

  await expectYamlEquals(page, '44-rename-simnode-template.yaml');
});
