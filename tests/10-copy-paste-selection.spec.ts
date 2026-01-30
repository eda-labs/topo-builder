import { test, expect } from '@playwright/test';
import { EMPTY_POS, NODE1_POS, NODE2_POS, addContextMenuItem, connectNodes } from './lag-utils';
import { getEdgeCount, getNodeCount } from './utils';

test('Copy/paste selection of nodes and links', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');

  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  await page.mouse.move(EMPTY_POS.x + 200, EMPTY_POS.y + 200);
  await page.keyboard.press('ControlOrMeta+v');

  expect(await getNodeCount(page)).toBe(4);
  expect(await getEdgeCount(page)).toBe(2);
});
