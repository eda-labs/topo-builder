import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount } from './utils';
import { SIM_POS, addContextMenuItem, nodeByLabel, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo add SimNode', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();
  expect(await getNodeCount(page)).toBe(1);

  await undoViaContextMenu(page);
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(0);

  await redoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(1);
});
