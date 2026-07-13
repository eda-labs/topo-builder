import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount, getEdgeCount } from './utils';
import { EMPTY_POS, addTwoNodesAndConnect, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo clear all', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addTwoNodesAndConnect(page);
  expect(await getNodeCount(page)).toBe(2);
  expect(await getEdgeCount(page)).toBe(1);

  // Cancelling the confirmation leaves the topology untouched
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Clear All' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await getNodeCount(page)).toBe(2);
  expect(await getEdgeCount(page)).toBe(1);

  // Clear All (confirming the safety dialog)
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Clear All' }).click();
  await page.getByTestId('clear-all-confirm-button').click();
  expect(await getNodeCount(page)).toBe(0);
  expect(await getEdgeCount(page)).toBe(0);

  // Undo restores everything
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(2);
  await expect.poll(() => getEdgeCount(page)).toBe(1);

  // Redo clears again
  await redoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(0);
  expect(await getEdgeCount(page)).toBe(0);
});
