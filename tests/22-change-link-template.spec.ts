import { test } from '@playwright/test';

import { canvasPane, expectYamlEquals } from './utils';
import { addTwoNodesAndConnect, clickEdgeBetween } from './lag-utils';

test('Change link template from isl to edge', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addTwoNodesAndConnect(page);

  // Select edge, right-click, change template
  await clickEdgeBetween(page, 'leaf1', 'leaf2');
  await clickEdgeBetween(page, 'leaf1', 'leaf2', { button: 'right' });
  await page.getByRole('menuitem', { name: 'Template', exact: true }).hover();
  await page.getByRole('menuitem', { name: 'edge', exact: true }).click();

  await expectYamlEquals(page, '22-change-link-template.yaml');
});
