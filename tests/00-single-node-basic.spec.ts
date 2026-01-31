import { test, expect } from '@playwright/test';
import { canvasPane, getNodeCount, getYamlContent } from './utils';

test('Add a single node', async ({ page }) => {
    await page.goto('/');
    await canvasPane(page).waitFor();
    await canvasPane(page).click();
    await canvasPane(page).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add Node' }).click();

    await page.getByRole('tab', { name: 'YAML' }).click();

    const nodes = await getNodeCount(page);
    expect(nodes).toBe(1);

    const yaml = await getYamlContent(page);

    expect(yaml).toBe(`apiVersion: topologies.eda.nokia.com/v1alpha1
kind: NetworkTopology
metadata:
  name: my-topology
  namespace: eda
spec:
  operation: replaceAll
  nodeTemplates:
    - name: leaf
      labels:
        eda.nokia.com/role: leaf
        eda.nokia.com/security-profile: managed
        topobuilder.eda.labs/name-prefix: leaf
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D3L
    - name: spine
      labels:
        eda.nokia.com/role: spine
        eda.nokia.com/security-profile: managed
        topobuilder.eda.labs/name-prefix: spine
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D5
  nodes:
    - name: leaf1
      template: leaf
      labels:
        topobuilder.eda.labs/x: "390"
        topobuilder.eda.labs/y: "330"
  linkTemplates:
    - name: isl
      type: interSwitch
      speed: 25G
      encapType: "null"
      labels:
        eda.nokia.com/role: interSwitch
    - name: edge
      type: edge
      encapType: dot1q
      labels:
        eda.nokia.com/role: edge
  links: []
  simulation:
    simNodeTemplates:
      - name: testman
        type: TestMan
      - name: multitool
        type: Linux
        image: ghcr.io/srl-labs/network-multitool:latest
    simNodes: []`);
});
