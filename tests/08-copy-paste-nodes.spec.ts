import { test } from '@playwright/test';

import { EMPTY_POS, NODE1_POS, addContextMenuItem, clickNodeHeader } from './lag-utils';
import { expectYamlEquals } from './utils';

test('Copy/paste nodes', async ({ page, browserName }) => {
  test.skip(!!process.env.CI, 'Keyboard clipboard events unreliable in headless CI');
  test.skip(browserName === 'webkit', 'WebKit clipboard paste unreliable');
  await page.goto('/');
  await page.waitForSelector('.react-flow__pane');

  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await clickNodeHeader(page, 'leaf1');

  await page.mouse.move(EMPTY_POS.x, EMPTY_POS.y);
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');

  await expectYamlEquals(page, '08-copy-paste-nodes.yaml');
});
