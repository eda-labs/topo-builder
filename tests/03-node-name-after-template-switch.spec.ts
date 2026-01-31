import { test, expect } from '@playwright/test';
import { waitForAppReady, getYamlContent } from './utils';
import { NODE1_POS, NODE2_POS, NODE3_POS, addContextMenuItem, nodeByLabel } from './lag-utils';

test('Node numbering after switching template', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Add leaf1
  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await nodeByLabel(page, 'leaf1').waitFor();

  // Add leaf2
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await nodeByLabel(page, 'leaf2').waitFor();

  // Change leaf2 to spine via context menu
  await nodeByLabel(page, 'leaf2').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Template' }).hover();
  await page.getByRole('menuitem', { name: 'spine', exact: true }).click();

  // Add another node -> should be leaf2 again (no leaf3)
  await addContextMenuItem(page, NODE3_POS, 'Add Node');

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);

  expect(yaml).toContain('name: leaf1');
  expect(yaml).toContain('name: spine1');
  expect(yaml).toContain('name: leaf2');
  expect(yaml).not.toContain('name: leaf3');
});
