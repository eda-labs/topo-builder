import { test, expect } from '@playwright/test';
import {
  NODE1_POS,
  NODE2_POS,
  addContextMenuItem,
  clickEdgeBetween,
  connectNodes,
  copySelected,
  openEdgeContextMenu,
  parseLinks,
  pasteSelected,
} from './lag-utils';
import { getYamlContent } from './utils';

test('Add a link to an existing LAG', async ({ page }) => {
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

  await page.waitForFunction(() =>
    document.querySelectorAll('.react-flow__edges path[stroke="transparent"]').length >= 2,
  );
  const memberPaths = page.locator('.react-flow__edges path[stroke="transparent"]');
  await memberPaths.nth(0).click();
  await memberPaths.nth(1).click({ modifiers: ['Shift'] });

  await memberPaths.nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create Local LAG' }).click();

  const lagPath = page.locator('.react-flow__edges path[stroke="transparent"]').first();
  await lagPath.click();
  const endpointsHeader = page.getByText(/^Endpoints/).first();
  await endpointsHeader.locator('..').getByRole('button', { name: 'Add' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const links = parseLinks(await getYamlContent(page));
  const lagLink = links.find((link) => link.name?.includes('lag'));

  expect(lagLink).toBeTruthy();
  expect(lagLink?.endpoints?.length).toBe(6);
});
