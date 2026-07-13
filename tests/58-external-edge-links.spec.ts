import { test, expect } from '@playwright/test';

import { canvasPane, expectYamlEquals, getEdgeCount } from './utils';
import { NODE1_POS, addContextMenuItem } from './lag-utils';

test('Edge links cable to an external node and export as single-endpoint links', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');

  // Add an edge link via the node's edge-links modal — this spawns the external peer.
  await page.getByTestId('edge-links-button').first().click();
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByTestId('topology-external-external1')).toBeVisible();
  expect(await getEdgeCount(page)).toBe(1);

  // The external node stays out of the YAML; the cable exports as an edge link.
  await expectYamlEquals(page, '58-external-edge-links.yaml');
});

test('Deleting the external node removes its edge links', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await page.getByTestId('edge-links-button').first().click();
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  const external = page.getByTestId('topology-external-external1');
  await external.waitFor();
  await external.click();
  await external.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete External Node' }).click();

  await expect(external).toHaveCount(0);
  expect(await getEdgeCount(page)).toBe(0);
});

test('External node from the palette cables via drag and round-trips through YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, { x: 520, y: 640 }, 'Add External Node');

  // Drag a cable from the first free faceplate port onto the external node's border handle.
  const portBox = await page.locator('.fp-port-free').first().boundingBox();
  const extBox = await page.getByTestId('topology-external-external1').boundingBox();
  if (!portBox || !extBox) throw new Error('Could not locate port or external node');
  await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(extBox.x, extBox.y + extBox.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => getEdgeCount(page)).toBe(1);
  await expectYamlEquals(page, '58-external-edge-links.yaml');
});
