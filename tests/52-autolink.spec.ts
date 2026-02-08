import { test, expect } from '@playwright/test';

import { canvasPane, getYamlContent, getEdgeCount, getNodeCount } from './utils';
import { addContextMenuItem, nodeByLabel, NODE1_POS, NODE2_POS, NODE3_POS, SIM_POS, parseLinks } from './lag-utils';

test.describe('AutoLink', () => {
  test('connects leaf to spine with ISL template', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add a leaf node
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();

    // Add a second node and change it to spine
    await addContextMenuItem(page, NODE2_POS, 'Add Node');
    await nodeByLabel(page, 'leaf2').waitFor();
    await nodeByLabel(page, 'leaf2').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Template' }).hover();
    await page.getByRole('menuitem', { name: 'spine', exact: true }).click();
    await nodeByLabel(page, 'spine1').waitFor();

    expect(await getNodeCount(page)).toBe(2);
    expect(await getEdgeCount(page)).toBe(0);

    // Click AutoLink
    await page.getByRole('button', { name: 'AutoLink' }).click();

    // Verify one edge was created
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);
    expect(await getEdgeCount(page)).toBe(1);

    // Verify YAML has ISL template
    await page.getByRole('tab', { name: 'YAML' }).click();
    const yaml = await getYamlContent(page);
    const links = parseLinks(yaml);
    expect(links).toHaveLength(1);
    expect(links[0].name).toContain('spine1');
    expect(links[0].name).toContain('leaf1');
    expect((links[0] as Record<string, unknown>).template).toBe('isl');
  });

  test('connects simNode to topo node with edge template', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add a leaf node
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();

    // Add a simNode
    await addContextMenuItem(page, SIM_POS, 'Add SimNode');
    await nodeByLabel(page, 'testman1').waitFor();

    expect(await getEdgeCount(page)).toBe(0);

    // Click AutoLink
    await page.getByRole('button', { name: 'AutoLink' }).click();

    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);
    expect(await getEdgeCount(page)).toBe(1);

    // Verify YAML has edge template
    await page.getByRole('tab', { name: 'YAML' }).click();
    const yaml = await getYamlContent(page);
    const links = parseLinks(yaml);
    expect(links).toHaveLength(1);
    expect((links[0] as Record<string, unknown>).template).toBe('edge');
  });

  test('does not create duplicate links', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add leaf + spine
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, NODE2_POS, 'Add Node');
    await nodeByLabel(page, 'leaf2').waitFor();
    await nodeByLabel(page, 'leaf2').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Template' }).hover();
    await page.getByRole('menuitem', { name: 'spine', exact: true }).click();
    await nodeByLabel(page, 'spine1').waitFor();

    // Click AutoLink twice
    await page.getByRole('button', { name: 'AutoLink' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);
    await page.getByRole('button', { name: 'AutoLink' }).click();

    // Still only one edge
    expect(await getEdgeCount(page)).toBe(1);
    await page.getByRole('tab', { name: 'YAML' }).click();
    const yaml = await getYamlContent(page);
    const links = parseLinks(yaml);
    expect(links).toHaveLength(1);
  });

  test('does not link leaf-leaf or spine-spine', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add two leaf nodes
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, NODE2_POS, 'Add Node');
    await nodeByLabel(page, 'leaf2').waitFor();

    // Click AutoLink - no spine nodes, so no links should be created
    await page.getByRole('button', { name: 'AutoLink' }).click();

    // No edges
    expect(await getEdgeCount(page)).toBe(0);
  });

  test('connects multiple leaves to multiple spines', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add two leaf nodes
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, NODE2_POS, 'Add Node');
    await nodeByLabel(page, 'leaf2').waitFor();

    // Add a spine node
    await addContextMenuItem(page, NODE3_POS, 'Add Node');
    await nodeByLabel(page, 'leaf3').waitFor();
    await nodeByLabel(page, 'leaf3').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Template' }).hover();
    await page.getByRole('menuitem', { name: 'spine', exact: true }).click();
    await nodeByLabel(page, 'spine1').waitFor();

    expect(await getNodeCount(page)).toBe(3);

    // Click AutoLink
    await page.getByRole('button', { name: 'AutoLink' }).click();

    // 2 leaves x 1 spine = 2 edges
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 2);
    expect(await getEdgeCount(page)).toBe(2);

    await page.getByRole('tab', { name: 'YAML' }).click();
    const yaml = await getYamlContent(page);
    const links = parseLinks(yaml);
    expect(links).toHaveLength(2);
    expect(links.every(l => (l as Record<string, unknown>).template === 'isl')).toBe(true);
  });
});
