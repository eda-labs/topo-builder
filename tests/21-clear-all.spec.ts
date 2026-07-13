import { test } from '@playwright/test';

import { canvasPane, expectYamlEquals } from './utils';
import { EMPTY_POS, addTwoNodesAndConnect } from './lag-utils';

test('Clear all resets to base YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add some content
  await addTwoNodesAndConnect(page);

  // Clear All via context menu, confirming the safety dialog
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Clear All' }).click();
  await page.getByTestId('clear-all-confirm-button').click();

  await expectYamlEquals(page, '21-clear-all.yaml');
});
