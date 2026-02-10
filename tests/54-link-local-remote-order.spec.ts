import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';

import { canvasPane, getYamlContent } from './utils';
import { addTwoNodesAndConnect } from './lag-utils';

type Endpoint = { local?: { node?: string }; remote?: { node?: string } };
type Link = { name?: string; endpoints?: Endpoint[] };
type YamlDoc = { spec?: { links?: Link[] } };

test('link local/remote node order matches the link name', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await addTwoNodesAndConnect(page);

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yamlText = await getYamlContent(page);
  const doc = yaml.load(yamlText) as YamlDoc;
  const links = doc?.spec?.links ?? [];
  expect(links.length).toBeGreaterThan(0);

  for (const link of links) {
    const name = link.name;
    expect(name).toBeDefined();
    for (const ep of link.endpoints ?? []) {
      if (!ep.local?.node || !ep.remote?.node) continue;
      const localNode = ep.local.node;
      const remoteNode = ep.remote.node;
      // Link name should start with localNode-remoteNode
      expect(name).toMatch(new RegExp(`^${localNode}-${remoteNode}-`));
    }
  }
});
