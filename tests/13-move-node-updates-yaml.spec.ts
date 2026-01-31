import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { NODE1_POS, addContextMenuItem } from './lag-utils';
import { canvasPane, getYamlContent } from './utils';

test('Move node updates YAML coordinates', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await page.getByTestId('topology-node-leaf1').waitFor();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const before = yaml.load(await getYamlContent(page)) as {
    spec?: { nodes?: Array<{ name: string; labels?: Record<string, string> }> };
  };
  const beforeNode = (before?.spec?.nodes ?? []).find((n) => n.name === 'leaf1');
  expect(beforeNode).toBeTruthy();

  const xBefore = Number(beforeNode?.labels?.['topobuilder.eda.labs/x']);
  const yBefore = Number(beforeNode?.labels?.['topobuilder.eda.labs/y']);
  expect(Number.isFinite(xBefore)).toBeTruthy();
  expect(Number.isFinite(yBefore)).toBeTruthy();

  // Drag node to a new position.
  const node = page.getByTestId('topology-node-leaf1');
  const box = await node.boundingBox();
  if (!box) throw new Error('Could not get node bounds');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 150, startY + 90, { steps: 10 });
  await page.mouse.up();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const after = yaml.load(await getYamlContent(page)) as {
    spec?: { nodes?: Array<{ name: string; labels?: Record<string, string> }> };
  };
  const afterNode = (after?.spec?.nodes ?? []).find((n) => n.name === 'leaf1');
  expect(afterNode).toBeTruthy();

  const xAfter = Number(afterNode?.labels?.['topobuilder.eda.labs/x']);
  const yAfter = Number(afterNode?.labels?.['topobuilder.eda.labs/y']);
  expect(Number.isFinite(xAfter)).toBeTruthy();
  expect(Number.isFinite(yAfter)).toBeTruthy();

  expect(xAfter !== xBefore || yAfter !== yBefore).toBeTruthy();
});
