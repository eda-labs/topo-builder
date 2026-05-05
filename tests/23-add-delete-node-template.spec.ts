import { test } from '@playwright/test';

import { canvasPane, expectYamlEquals } from './utils';

test('Add and delete node templates', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a new template and delete spine via store
  await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();

    state.addNodeTemplate({
      name: 'borderleaf',
      labels: {
        'eda.nokia.com/role': 'leaf',
        'eda.nokia.com/security-profile': 'managed',
      },
      annotations: {
        'topobuilder.eda.labs/name-prefix': 'borderleaf',
      },
      nodeProfile: 'srlinux-ghcr-26.3.1',
      platform: '7220 IXR-D3L',
    });

    state.deleteNodeTemplate('spine');
  });

  await expectYamlEquals(page, '23-add-delete-node-template.yaml');
});
