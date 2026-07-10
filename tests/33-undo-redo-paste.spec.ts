import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount } from './utils';
import { EMPTY_POS, NODE1_POS, addContextMenuItem, clickNodeHeader, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo paste', async ({ page, browserName }) => {
  test.skip(!!process.env.CI, 'Keyboard clipboard events unreliable in headless CI');
  test.skip(browserName === 'webkit', 'WebKit clipboard paste unreliable');
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await clickNodeHeader(page, 'leaf1');

  await page.mouse.move(EMPTY_POS.x, EMPTY_POS.y);
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');

  await expect.poll(() => getNodeCount(page), { timeout: 5000 }).toBe(2);

  // Undo paste
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(1);

  // Redo paste
  await redoViaContextMenu(page);
  await expect.poll(() => getNodeCount(page), { timeout: 5000 }).toBe(2);
});
