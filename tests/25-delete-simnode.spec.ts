import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount, expectYamlEquals } from './utils';
import { SIM_POS, addContextMenuItem, nodeByLabel, clickNodeHeader } from './lag-utils';

test('Delete SimNode', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();
  expect(await getNodeCount(page)).toBe(1);

  // Delete via context menu
  await clickNodeHeader(page, 'testman1', { button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Node' }).click();

  expect(await getNodeCount(page)).toBe(0);

  await expectYamlEquals(page, '25-delete-simnode.yaml');
});
