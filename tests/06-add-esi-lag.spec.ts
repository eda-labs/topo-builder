import { test, expect } from '@playwright/test';
import {
  NODE1_POS,
  NODE2_POS,
  SIM_POS,
  addContextMenuItem,
  connectNodes,
  openEdgeContextMenu,
  parseLinks,
  selectEdgesByNames,
} from './lag-utils';
import { getYamlContent } from './utils';

test('Add an ESI LAG', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');

  await connectNodes(page, 'testman1', 'leaf1');
  await connectNodes(page, 'testman1', 'leaf2');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 2);

  await selectEdgesByNames(page, [
    ['testman1', 'leaf1'],
    ['testman1', 'leaf2'],
  ]);
  await openEdgeContextMenu(page, 'testman1', 'leaf2');
  await page.getByRole('menuitem', { name: 'Create ESI-LAG' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const links = parseLinks(await getYamlContent(page));
  const esiLag = links.find((link) => link.name?.includes('esi-lag'));

  expect(links.length).toBe(1);
  expect(esiLag).toBeTruthy();
  expect(esiLag?.endpoints?.length).toBe(2);
});
