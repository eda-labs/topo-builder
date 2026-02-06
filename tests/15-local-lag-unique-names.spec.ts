import { test, expect } from '@playwright/test';
import {
  NODE1_POS,
  NODE2_POS,
  addContextMenuItem,
  clickEdgeBetween,
  connectNodes,
  copySelected,
  memberLinkByIndex,
  openEdgeContextMenu,
  pasteSelected,
} from './lag-utils';
import { getYamlContent, loadExpectedYaml } from './utils';

test('Multiple LAGs between same nodes get unique names', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');

  // Create first edge (right→left handles) with 2 member links
  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

  await clickEdgeBetween(page, 'leaf1', 'leaf2');
  await openEdgeContextMenu(page, 'leaf1', 'leaf2');
  await copySelected(page);
  await openEdgeContextMenu(page, 'leaf1', 'leaf2');
  await pasteSelected(page);

  // Expand, select both member links, create first LAG
  await page.waitForSelector('[title*="links - click to expand"]');
  await page.getByTitle(/links - click to expand/i).click();

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 0).waitFor();
  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).waitFor();

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 0).click();
  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).click({ modifiers: ['Shift'] });

  await memberLinkByIndex(page, 'leaf1', 'leaf2', 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Create Local LAG' }).click();

  // Create second edge (different handles) + LAG via store to avoid testid collisions
  await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();

    const leaf1 = state.nodes.find((n: { data: { name: string } }) => n.data.name === 'leaf1');
    const leaf2 = state.nodes.find((n: { data: { name: string } }) => n.data.name === 'leaf2');
    if (!leaf1 || !leaf2) throw new Error('Could not find leaf nodes');

    // Add second edge at different handles
    state.addEdge({
      source: leaf1.id,
      target: leaf2.id,
      sourceHandle: 'bottom',
      targetHandle: 'top-target',
    });

    // Find the new non-LAG edge between the pair
    const updatedState = mod.useTopologyStore.getState();
    const edge2 = updatedState.edges.find(
      (e: { data?: { edgeType?: string; sourceNode?: string; targetNode?: string } }) =>
        e.data?.edgeType !== 'lag' &&
        ((e.data?.sourceNode === 'leaf1' && e.data?.targetNode === 'leaf2') ||
          (e.data?.sourceNode === 'leaf2' && e.data?.targetNode === 'leaf1')),
    );
    if (!edge2?.data?.memberLinks?.[0]) throw new Error('Could not find second edge');

    // Add a second member link
    const firstLink = edge2.data.memberLinks[0];
    state.addMemberLink(edge2.id, {
      name: `${edge2.data.targetNode}-${edge2.data.sourceNode}-extra`,
      template: firstLink.template,
      sourceInterface: 'ethernet-1-99',
      targetInterface: 'ethernet-1-99',
    });

    // Create LAG from both member links on edge 2
    state.createLagFromMemberLinks(edge2.id, [0, 1]);
  });

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);

  expect(yaml).toBe(loadExpectedYaml('15-local-lag-unique-names.yaml'));
});
