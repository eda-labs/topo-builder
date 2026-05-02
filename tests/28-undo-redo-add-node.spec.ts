import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount } from './utils';
import { NODE1_POS, addContextMenuItem, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo add node', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  expect(await getNodeCount(page)).toBe(1);

  await undoViaContextMenu(page);
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(0);

  await redoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(1);
});
