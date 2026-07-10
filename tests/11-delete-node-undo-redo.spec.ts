import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';

import { NODE1_POS, NODE2_POS, addContextMenuItem, nodeByLabel, undoViaContextMenu, redoViaContextMenu, clickNodeHeader } from './lag-utils';
import { canvasPane, getNodeCount, getYamlContent } from './utils';

test('Delete node, undo, redo', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await nodeByLabel(page, 'leaf2').waitFor();

  expect(await getNodeCount(page)).toBe(2);

  // Delete leaf2 via node context menu.
  await clickNodeHeader(page, 'leaf2', { button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Node' }).click();

  expect(await getNodeCount(page)).toBe(1);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const afterDelete = yaml.load(await getYamlContent(page)) as { spec?: { nodes?: Array<{ name: string }> } };
  const namesAfterDelete = (afterDelete?.spec?.nodes ?? []).map(n => n.name);
  expect(namesAfterDelete).toEqual(['leaf1']);

  // Undo deletion.
  await undoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(2);

  // Redo deletion.
  await redoViaContextMenu(page);
  expect(await getNodeCount(page)).toBe(1);
});
