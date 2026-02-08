import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { canvasPane, getEdgeCount } from './utils';
import {
  addContextMenuItem,
  connectNodes,
  NODE1_POS,
  NODE2_POS,
  nodeByLabel,
} from './lag-utils';

/**
 * Connect from sourceLabel's LEFT handle to targetLabel's RIGHT handle.
 * This is the reverse direction of connectNodes (which goes right→left).
 */
async function connectNodesReverse(page: Page, sourceLabel: string, targetLabel: string) {
  const source = nodeByLabel(page, sourceLabel);
  const target = nodeByLabel(page, targetLabel);
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error(`Could not get bounds for ${sourceLabel} or ${targetLabel}`);

  // Drag from left side of source to right side of target
  await page.mouse.move(sourceBox.x, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

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

    // Connect leaf2 → leaf1 through the SAME handle positions (left side of leaf2 to right side of leaf1)
    await connectNodesReverse(page, 'leaf2', 'leaf1');

    // Should still be 1 edge (bundled), not 2 separate edges
    expect(await getEdgeCount(page)).toBe(1);

    // The bundle should show "2 links" indicator
    await page.waitForSelector('[title*="links - click to expand"]');
  });
});
