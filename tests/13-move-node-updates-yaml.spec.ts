import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';

import { NODE1_POS, addContextMenuItem, dragNodeBy } from './lag-utils';
import { canvasPane, getYamlContent } from './utils';

test('Move node updates YAML coordinates', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await page.getByTestId('topology-node-leaf1').waitFor();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const before = yaml.load(await getYamlContent(page)) as {
    spec?: { nodes?: Array<{ name: string; annotations?: Record<string, string> }> };
  };
  const beforeNode = (before?.spec?.nodes ?? []).find(n => n.name === 'leaf1');
  expect(beforeNode).toBeTruthy();

  const xBefore = Number(beforeNode?.annotations?.['topobuilder.eda.labs/x']);
  const yBefore = Number(beforeNode?.annotations?.['topobuilder.eda.labs/y']);
  expect(Number.isFinite(xBefore)).toBeTruthy();
  expect(Number.isFinite(yBefore)).toBeTruthy();

  // Drag node to a new position (by the header — the panel body is port cells).
  await dragNodeBy(page, 'leaf1', 150, 90);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const after = yaml.load(await getYamlContent(page)) as {
    spec?: { nodes?: Array<{ name: string; annotations?: Record<string, string> }> };
  };
  const afterNode = (after?.spec?.nodes ?? []).find(n => n.name === 'leaf1');
  expect(afterNode).toBeTruthy();

  const xAfter = Number(afterNode?.annotations?.['topobuilder.eda.labs/x']);
  const yAfter = Number(afterNode?.annotations?.['topobuilder.eda.labs/y']);
  expect(Number.isFinite(xAfter)).toBeTruthy();
  expect(Number.isFinite(yAfter)).toBeTruthy();

  expect(xAfter !== xBefore || yAfter !== yBefore).toBeTruthy();
});
