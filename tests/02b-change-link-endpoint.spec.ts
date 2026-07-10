import { test, expect } from '@playwright/test';

import { canvasPane, getYamlContent, expectYamlToMatchFixture } from './utils';
import { NODE1_POS, NODE2_POS, EMPTY_POS, addContextMenuItem, connectNodes } from './lag-utils';

test('Change link endpoint', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(
    () => document.querySelectorAll('.react-flow__edge').length === 1,
  );

  // Selection switches to the "Edit" tab automatically; update the (leaf1) endpoint explicitly.
  await page.getByTestId('link-endpoint-a-0').fill('ethernet-1-3');

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);

  expectYamlToMatchFixture(yaml, '02-change-link-endpoint.yaml');
});
