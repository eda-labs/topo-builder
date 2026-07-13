import { test, expect } from '@playwright/test';

import { canvasPane, getEdgeCount } from './utils';
import {
  addContextMenuItem,
  connectNodes,
  NODE1_POS,
  NODE2_POS,
  nodeByLabel,
} from './lag-utils';

test.describe('Reverse direction connections bundle into the same edge', () => {
  test('Connecting A→B then B→A on same handles creates a 2-link bundle', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();

    // Add two nodes
    await addContextMenuItem(page, NODE1_POS, 'Add Node');
    await nodeByLabel(page, 'leaf1').waitFor();
    await addContextMenuItem(page, NODE2_POS, 'Add Node');
    await nodeByLabel(page, 'leaf2').waitFor();

    // Connect leaf1 → leaf2 (right side of leaf1 to left side of leaf2)
    await connectNodes(page, 'leaf1', 'leaf2');
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 1);

    // Connect leaf2 → leaf1 (reverse direction; port cables always bundle per node pair)
    await connectNodes(page, 'leaf2', 'leaf1');

    // Should still be 1 edge (bundled), not 2 separate edges
    expect(await getEdgeCount(page)).toBe(1);

    // v2: both member links render as their own cables
    await page.waitForSelector('[data-testid="topology-memberlink-leaf1--leaf2-0"]');
    await page.waitForSelector('[data-testid="topology-memberlink-leaf1--leaf2-1"]');
  });
});
