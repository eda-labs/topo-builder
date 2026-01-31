import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { NODE1_POS, NODE2_POS, EMPTY_POS, addContextMenuItem, connectNodes, openEdgeContextMenu } from './lag-utils';
import { canvasPane, getEdgeCount, getYamlContent } from './utils';

test('Delete link and undo', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');

  await connectNodes(page, 'leaf1', 'leaf2');
  await expect.poll(async () => getEdgeCount(page)).toBe(1);

  await openEdgeContextMenu(page, 'leaf1', 'leaf2');
  await page.getByRole('menuitem', { name: 'Delete Link' }).click();

  await expect.poll(async () => getEdgeCount(page)).toBe(0);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const afterDelete = yaml.load(await getYamlContent(page)) as { spec?: { links?: unknown[] } };
  expect(afterDelete?.spec?.links ?? []).toHaveLength(0);

  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Undo' }).click();

  await expect.poll(async () => getEdgeCount(page)).toBe(1);
});

