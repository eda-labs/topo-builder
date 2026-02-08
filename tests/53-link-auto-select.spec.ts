import { test, expect } from '@playwright/test';

import { canvasPane } from './utils';
import { addContextMenuItem, connectNodes, NODE1_POS, NODE2_POS } from './lag-utils';

test('Newly created link is auto-selected and shows Endpoints in panel', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await connectNodes(page, 'leaf1', 'leaf2');

  await expect(page.getByText('Endpoints')).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId('link-endpoint-a-0')).toBeVisible();
});
