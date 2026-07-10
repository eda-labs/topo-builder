import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount } from './utils';
import { SIM_POS, addContextMenuItem, nodeByLabel, undoViaContextMenu, redoViaContextMenu, clickNodeHeader } from './lag-utils';

test('Undo/redo delete SimNode', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();
  expect(await getNodeCount(page)).toBe(1);

  // Delete SimNode
  await clickNodeHeader(page, 'testman1', { button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Node' }).click();
  expect(await getNodeCount(page)).toBe(0);

  // Undo restores it
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(1);

  // Redo deletes again
  await redoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(0);
});
