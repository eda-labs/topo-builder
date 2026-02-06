import { test, expect } from '@playwright/test';
import { canvasPane, getYamlContent, loadExpectedYaml } from './utils';
import { addContextMenuItem, NODE1_POS } from './lag-utils';

test('Base YAML restored after deleting YAML content', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a node so we have some state
  await addContextMenuItem(page, NODE1_POS, 'Add Node');

  // Delete all YAML content via the store — simulates user clearing the editor
  await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    mod.useTopologyStore.getState().importFromYaml('');
  });

  // Add a node — should use restored base template (leaf prefix, not node-)
  await addContextMenuItem(page, NODE1_POS, 'Add Node');

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);

  expect(yaml).toBe(loadExpectedYaml('16-base-yaml-after-clear-reload.yaml'));
});
