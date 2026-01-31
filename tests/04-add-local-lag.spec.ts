import { test, expect } from '@playwright/test';
import {
  NODE1_POS,
  NODE2_POS,
  addContextMenuItem,
  clickEdgeBetween,
  connectNodes,
  copySelected,
  memberLinkByIndex,
  openEdgeContextMenu,
  parseLinks,
  pasteSelected,
} from './lag-utils';
import { getYamlContent } from './utils';

test('Add a local LAG from bundled links', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');

  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

  await clickEdgeBetween(page, 'leaf1', 'leaf2');
  await openEdgeContextMenu(page, 'leaf1', 'leaf2');
  await copySelected(page);
  await openEdgeContextMenu(page, 'leaf1', 'leaf2');
  await pasteSelected(page);

  await page.waitForSelector('[title*="links - click to expand"]');
  await page.getByTitle(/links - click to expand/i).click();

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 0).waitFor();
  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).waitFor();

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 0).click();
  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).click({ modifiers: ['Shift'] });

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create Local LAG' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const links = parseLinks(await getYamlContent(page));
  const lagLink = links.find((link) => link.name?.includes('lag'));

  expect(lagLink).toBeTruthy();
  expect(lagLink?.endpoints?.length).toBe(4);
});
