import { test, expect } from '@playwright/test';
import { waitForAppReady, getYamlContent } from './utils';

test('Node numbering after switching template', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await waitForAppReady(page);

  const pane = page.locator('.react-flow__pane');
  const paneBox = await pane.boundingBox();
  if (!paneBox) {
    throw new Error('Could not determine pane bounds');
  }

  const getEmptyPoint = async () => {
    const nodeHandles = await page.locator('.react-flow__node').elementHandles();
    let maxRight = paneBox.x + 20;
    for (const handle of nodeHandles) {
      const box = await handle.boundingBox();
      if (box) maxRight = Math.max(maxRight, box.x + box.width);
    }
    const x = Math.min(paneBox.x + paneBox.width - 10, maxRight + 80);
    const y = paneBox.y + 40;
    return { x, y };
  };

  const openPaneMenu = async () => {
    const { x, y } = await getEmptyPoint();
    await page.mouse.click(x, y);
    await page.mouse.click(x, y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Add Node' }).waitFor();
  };

  // Add leaf1
  await openPaneMenu();
  await page.getByRole('menuitem', { name: 'Add Node' }).click();
  await page.waitForSelector('.react-flow__node');

  // Add leaf2
  await openPaneMenu();
  await page.getByRole('menuitem', { name: 'Add Node' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 2);

  // Change leaf2 to spine via context menu
  await page.locator('.react-flow__node', { hasText: 'leaf2' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Template' }).hover();
  await page.getByRole('menuitem', { name: 'spine', exact: true }).click();

  // Add another node -> should be leaf2 again (no leaf3)
  await openPaneMenu();
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);

  expect(yaml).toContain('name: leaf1');
  expect(yaml).toContain('name: spine1');
  expect(yaml).toContain('name: leaf2');
  expect(yaml).not.toContain('name: leaf3');
});
