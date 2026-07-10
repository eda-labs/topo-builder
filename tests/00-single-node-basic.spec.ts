import { test, expect } from '@playwright/test';

import { canvasPane, getNodeCount, getYamlContent, expectYamlToMatchFixture } from './utils';

test('Add a single node', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await canvasPane(page).click();
  await canvasPane(page).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();

  const nodes = await getNodeCount(page);
  expect(nodes).toBe(1);

  const yaml = await getYamlContent(page);
  expectYamlToMatchFixture(yaml, '00-single-node.yaml');
});
