import { test, expect } from '@playwright/test';
import { canvasPane, expectYamlEquals } from './utils';
import { addTwoNodesAndConnect, createLocalLagBetween } from './lag-utils';

test('Remove link from LAG dissolves it', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addTwoNodesAndConnect(page);
  await createLocalLagBetween(page, 'leaf1', 'leaf2');

  // Remove one link from LAG via store (dissolves the LAG since <2 links remain)
  await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    const edge = state.edges.find(
      (e: { data?: { lagGroups?: unknown[] } }) => e.data?.lagGroups && e.data.lagGroups.length > 0,
    );
    if (!edge?.data?.lagGroups?.[0]) throw new Error('Could not find LAG edge');
    state.removeLinkFromLag(edge.id, edge.data.lagGroups[0].id, 0);
  });

  await expectYamlEquals(page, '26-remove-link-from-lag.yaml');
});

test('Removing last LAG group resets edgeType to normal', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addTwoNodesAndConnect(page);
  await createLocalLagBetween(page, 'leaf1', 'leaf2');

  // Verify edge starts as LAG, then dissolve it and check edgeType resets
  const edgeType = await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    const edge = state.edges.find(
      (e: { data?: { lagGroups?: unknown[] } }) => e.data?.lagGroups && e.data.lagGroups.length > 0,
    );
    if (!edge?.data?.lagGroups?.[0]) throw new Error('Could not find LAG edge');
    if (edge.data.edgeType !== 'lag') throw new Error(`Expected edgeType 'lag' before removal, got '${edge.data.edgeType}'`);

    state.removeLinkFromLag(edge.id, edge.data.lagGroups[0].id, 0);

    const updated = mod.useTopologyStore.getState().edges.find((e: { id: string }) => e.id === edge.id);
    return updated?.data?.edgeType;
  });

  expect(edgeType).toBe('normal');
});
