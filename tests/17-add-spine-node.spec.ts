import { test } from '@playwright/test';

import { canvasPane, expectYamlEquals } from './utils';
import { NODE1_POS, NODE2_POS, addContextMenuItem, nodeByLabel, clickNodeHeader } from './lag-utils';

test('Add leaf and spine nodes', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await nodeByLabel(page, 'leaf1').waitFor();

  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await nodeByLabel(page, 'leaf2').waitFor();

  await clickNodeHeader(page, 'leaf2', { button: 'right' });
  await page.getByRole('menuitem', { name: 'Template' }).hover();
  await page.getByRole('menuitem', { name: 'spine', exact: true }).click();
  await nodeByLabel(page, 'spine1').waitFor();

  await expectYamlEquals(page, '17-add-spine-node.yaml');
});
