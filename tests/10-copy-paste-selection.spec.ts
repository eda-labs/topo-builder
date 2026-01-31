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

  // Ensure keyboard shortcuts target the canvas, not the Monaco editor (which can capture Ctrl/Cmd shortcuts in CI).
  await page.locator('.react-flow__pane').click({ position: EMPTY_POS });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());

  await page.keyboard.press('ControlOrMeta+a');
  await page.waitForFunction(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store.ts');
    const state = mod.useTopologyStore.getState();
    return state.nodes.filter((n: { selected?: boolean }) => n.selected).length === 2 &&
      state.edges.filter((e: { selected?: boolean }) => e.selected).length === 1;
  });
  await page.keyboard.press('ControlOrMeta+c');
  await page.waitForFunction(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store.ts');
    const clipboard = mod.useTopologyStore.getState().clipboard;
    return clipboard.nodes.length === 2 && clipboard.edges.length === 1;
  });
  await page.mouse.move(EMPTY_POS.x + 200, EMPTY_POS.y + 200);
  await page.keyboard.press('ControlOrMeta+v');

  await expect.poll(() => getNodeCount(page)).toBe(4);
  await expect.poll(() => getEdgeCount(page)).toBe(2);
});
