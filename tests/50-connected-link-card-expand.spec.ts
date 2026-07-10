import { test, expect } from '@playwright/test';

import { canvasPane } from './utils';
import {
  addTwoNodesAndConnect,
  createLocalLagBetween,
  addContextMenuItem,
  clickNodeHeader,
  connectNodes,
  EMPTY_POS,
  NODE1_POS,
  SIM_POS,
  nodeByLabel,
} from './lag-utils';

test.describe('Connected link cards expand bundle on click', () => {
  test('Clicking standalone link card from node panel expands and shows link detail', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    await addTwoNodesAndConnect(page);

    // Add a second member link via store to create a 2-link bundle
    await page.evaluate(async () => {
      // @ts-expect-error - Vite serves source files at this path in dev mode
      const mod = await import('/src/lib/store/index.ts');
      const state = mod.useTopologyStore.getState();
      const edge = state.edges[0];
      if (!edge?.data?.memberLinks?.[0]) throw new Error('No edge found');
      state.addMemberLink(edge.id, {
        name: `${edge.data.sourceNode}-${edge.data.targetNode}-2`,
        template: edge.data.memberLinks[0].template,
        sourceInterface: 'ethernet-1-2',
        targetInterface: 'ethernet-1-2',
      });
    });

    // v2: member cables render individually — wait for the second one
    await page.waitForSelector('[data-testid$="-1"][data-testid^="topology-memberlink-"]');

    // Click empty space to deselect everything
    await canvasPane(page).click({ position: EMPTY_POS });

    // Click leaf1 node to show its NodeEditor
    await clickNodeHeader(page, 'leaf1');

    // Verify the Connected Links section is visible
    await expect(page.getByText('Connected Links')).toBeVisible();

    // Click the first standalone link card by its name
    await page.getByText('leaf1-leaf2-1', { exact: true }).click();

    // The EdgeEditor should show the link detail view with Endpoints section
    await expect(page.getByText('Endpoints')).toBeVisible();
    await expect(page.getByTestId('link-endpoint-a-0')).toBeVisible();
    // "Select a link to edit" should NOT be visible
    await expect(page.getByText('Select a link to edit')).not.toBeVisible();
  });

  test('Clicking LAG card from node panel expands and shows LAG editor', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    await addTwoNodesAndConnect(page);
    await createLocalLagBetween(page, 'leaf1', 'leaf2');

    // Click empty space to deselect everything
    await canvasPane(page).click({ position: EMPTY_POS });

    // Click leaf1 node to show its NodeEditor
    await clickNodeHeader(page, 'leaf1');

    // Verify the Connected Links section and LAG card are visible
    await expect(page.getByText('Connected Links')).toBeVisible();
    await expect(page.getByText('leaf1-leaf2-lag-1')).toBeVisible();

    // Click the LAG card by its name
    await page.getByText('leaf1-leaf2-lag-1').click();

    // The EdgeEditor should now show the LAG editor view
    // LAG editor has an Endpoints section with an Add button
    const endpointsHeader = page.getByText(/^Endpoints/).first();
    await expect(endpointsHeader).toBeVisible();
    await expect(endpointsHeader.locator('..').getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('Clicking standalone link card from SimNode panel expands and shows link detail', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Create node + simnode + connect
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, SIM_POS, 'Add SimNode');
    await nodeByLabel(page, 'testman1').waitFor();
    await connectNodes(page, 'leaf1', 'testman1');
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

    // Add a second member link to create a bundle
    await page.evaluate(async () => {
      // @ts-expect-error - Vite serves source files at this path in dev mode
      const mod = await import('/src/lib/store/index.ts');
      const state = mod.useTopologyStore.getState();
      const edge = state.edges.find(
        (e: { data?: { sourceNode?: string; targetNode?: string } }) =>
          (e.data?.sourceNode === 'leaf1' && e.data?.targetNode === 'testman1') ||
          (e.data?.sourceNode === 'testman1' && e.data?.targetNode === 'leaf1'),
      );
      if (!edge?.data?.memberLinks?.[0]) throw new Error('No edge found');
      state.addMemberLink(edge.id, {
        name: `${edge.data.sourceNode}-${edge.data.targetNode}-2`,
        template: edge.data.memberLinks[0].template,
        sourceInterface: 'ethernet-1-2',
        targetInterface: 'eth2',
      });
    });

    await page.waitForSelector('[data-testid$="-1"][data-testid^="topology-memberlink-"]');
    await canvasPane(page).click({ position: EMPTY_POS });

    // Click testman1 simnode to show its SimNodeEditor
    await clickNodeHeader(page, 'testman1');
    await expect(page.getByText('Connected Links')).toBeVisible();

    // Get first link name and click it
    const firstLinkCard = page.locator('text=/testman1-leaf1-1|leaf1-testman1-1/').first();
    await firstLinkCard.click();

    // The EdgeEditor should show the link detail view
    await expect(page.getByText('Endpoints')).toBeVisible();
    await expect(page.getByTestId('link-endpoint-a-0')).toBeVisible();
    await expect(page.getByText('Select a link to edit')).not.toBeVisible();
  });

  test('Clicking LAG card from SimNode panel expands and shows LAG editor', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Create node + simnode + connect + create LAG (via store, as copy/paste copies simnode)
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, SIM_POS, 'Add SimNode');
    await nodeByLabel(page, 'testman1').waitFor();
    await connectNodes(page, 'leaf1', 'testman1');
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

    await page.evaluate(async () => {
      // @ts-expect-error - Vite serves source files at this path in dev mode
      const mod = await import('/src/lib/store/index.ts');
      const state = mod.useTopologyStore.getState();
      const edge = state.edges.find(
        (e: { data?: { sourceNode?: string; targetNode?: string } }) =>
          (e.data?.sourceNode === 'leaf1' && e.data?.targetNode === 'testman1') ||
          (e.data?.sourceNode === 'testman1' && e.data?.targetNode === 'leaf1'),
      );
      if (!edge?.data?.memberLinks?.[0]) throw new Error('No edge found');
      state.addMemberLink(edge.id, {
        name: `${edge.data.sourceNode}-${edge.data.targetNode}-2`,
        template: edge.data.memberLinks[0].template,
        sourceInterface: 'ethernet-1-2',
        targetInterface: 'eth2',
      });
      state.createLagFromMemberLinks(edge.id, [0, 1]);
    });

    await canvasPane(page).click({ position: EMPTY_POS });

    // Click testman1 simnode to show its SimNodeEditor
    await clickNodeHeader(page, 'testman1');
    await expect(page.getByText('Connected Links')).toBeVisible();

    // Find and click the LAG card by its name
    const lagCard = page.locator('text=/lag-1$/').first();
    await lagCard.click();

    // The EdgeEditor should show the LAG editor view
    const endpointsHeader = page.getByText(/^Endpoints/).first();
    await expect(endpointsHeader).toBeVisible();
    await expect(endpointsHeader.locator('..').getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('Clicking standalone link next to LAG in same bundle expands and shows link detail', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    await addTwoNodesAndConnect(page);

    // Add 2 more member links (3 total), then LAG links 0+1, leaving link 2 standalone
    await page.evaluate(async () => {
      // @ts-expect-error - Vite serves source files at this path in dev mode
      const mod = await import('/src/lib/store/index.ts');
      const state = mod.useTopologyStore.getState();
      const edge = state.edges[0];
      if (!edge?.data?.memberLinks?.[0]) throw new Error('No edge found');
      const first = edge.data.memberLinks[0];
      state.addMemberLink(edge.id, {
        name: `${edge.data.sourceNode}-${edge.data.targetNode}-2`,
        template: first.template,
        sourceInterface: 'ethernet-1-2',
        targetInterface: 'ethernet-1-2',
      });
      state.addMemberLink(edge.id, {
        name: `${edge.data.sourceNode}-${edge.data.targetNode}-3`,
        template: first.template,
        sourceInterface: 'ethernet-1-3',
        targetInterface: 'ethernet-1-3',
      });
      state.createLagFromMemberLinks(edge.id, [0, 1]);
    });

    await page.waitForSelector('[data-testid$="-1"][data-testid^="topology-memberlink-"]');
    await canvasPane(page).click({ position: EMPTY_POS });

    // Click leaf1 node to show its NodeEditor
    await clickNodeHeader(page, 'leaf1');
    await expect(page.getByText('Connected Links')).toBeVisible();

    // The standalone link (index 2, not in the LAG) should be visible
    const standaloneCard = page.getByText('leaf2-leaf1-3', { exact: true });
    await expect(standaloneCard).toBeVisible();

    // Click the standalone link card
    await standaloneCard.click();

    // The EdgeEditor should show the link detail view
    await expect(page.getByText('Endpoints')).toBeVisible();
    await expect(page.getByTestId('link-endpoint-a-0')).toBeVisible();
    await expect(page.getByText('Select a link to edit')).not.toBeVisible();
  });
});
