import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { NODE1_POS, NODE2_POS, EMPTY_POS, addContextMenuItem, nodeByLabel } from './lag-utils';
import { canvasPane, getNodeCount, getYamlContent } from './utils';

test('Delete node, undo, redo', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await nodeByLabel(page, 'leaf2').waitFor();

  expect(await getNodeCount(page)).toBe(2);

  // Delete leaf2 via node context menu.
  await nodeByLabel(page, 'leaf2').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Node' }).click();

  expect(await getNodeCount(page)).toBe(1);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const afterDelete = yaml.load(await getYamlContent(page)) as { spec?: { nodes?: Array<{ name: string }> } };
  const namesAfterDelete = (afterDelete?.spec?.nodes ?? []).map((n) => n.name);
  expect(namesAfterDelete).toEqual(['leaf1']);

  // Undo deletion from the pane context menu.
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Undo' }).click();

  expect(await getNodeCount(page)).toBe(2);

  // Redo deletion.
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Redo' }).click();

  expect(await getNodeCount(page)).toBe(1);
});

