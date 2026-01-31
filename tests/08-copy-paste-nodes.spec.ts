import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { EMPTY_POS, NODE1_POS, addContextMenuItem, nodeByLabel } from './lag-utils';
import { getNodeCount, getYamlContent } from './utils';

test('Copy/paste nodes', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await nodeByLabel(page, 'leaf1').click();

  await page.mouse.move(EMPTY_POS.x, EMPTY_POS.y);
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');

  expect(await getNodeCount(page)).toBe(2);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const doc = yaml.load(await getYamlContent(page)) as { spec?: { nodes?: Array<{ name: string }> } };
  const names = (doc?.spec?.nodes || []).map((node) => node.name);
  expect(names).toEqual(expect.arrayContaining(['leaf1', 'leaf1-copy']));
});
