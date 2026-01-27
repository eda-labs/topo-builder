import { test, expect } from '@playwright/test';
import { getNodeCount, getEdgeCount, getYamlContent } from './utils';

const NODE1_POS = { x: 200, y: 300 };
const NODE2_POS = { x: 600, y: 300 };
const EMPTY_POS = { x: 50, y: 50 };

test('Add two nodes and connect them with a link', async ({ page }) => {
  await page.goto('http://localhost:4321/topo-builder');
  await page.waitForSelector('.react-flow__pane');

  await page.locator('.react-flow__pane').click({ button: 'right', position: NODE1_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.waitForSelector('.react-flow__node');
  await page.locator('.react-flow__pane').click({ position: EMPTY_POS });

  await page.locator('.react-flow__pane').click({ button: 'right', position: NODE2_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 2);

  expect(await getNodeCount(page)).toBe(2);

  const firstNode = page.locator('.react-flow__node').first();
  const secondNode = page.locator('.react-flow__node').last();

  const firstBounds = await firstNode.boundingBox();
  const secondBounds = await secondNode.boundingBox();

  if (!firstBounds || !secondBounds) {
    throw new Error('Could not get node bounds');
  }

  const sourceX = firstBounds.x + firstBounds.width;
  const sourceY = firstBounds.y + firstBounds.height / 2;
  const targetX = secondBounds.x;
  const targetY = secondBounds.y + secondBounds.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();

  expect(await getEdgeCount(page)).toBe(1);

  await page.getByRole('tab', { name: 'YAML' }).click();
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
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D3L
    - name: spine
      labels:
        eda.nokia.com/role: spine
        eda.nokia.com/security-profile: managed
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D5
  nodes:
    - name: node1
      template: leaf
      labels:
        topobuilder/x: "195"
        topobuilder/y: "300"
    - name: node2
      template: leaf
      labels:
        topobuilder/x: "345"
        topobuilder/y: "315"
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
  links:
    - name: node1-node2-1
      labels:
        topobuilder/edgeId: edge-1
        topobuilder/memberIndex: "0"
        topobuilder/srcHandle: left
        topobuilder/dstHandle: right-target
      endpoints:
        - local:
            node: node2
            interface: ethernet-1-1
          remote:
            node: node1
            interface: ethernet-1-1
      template: isl
  simulation:
    simNodeTemplates:
      - name: testman
        type: TestMan
      - name: multitool
        type: Linux
        image: ghcr.io/srl-labs/network-multitool:latest
    simNodes: []`);
});

test('Change link endpoint', async ({ page }) => {
  await page.goto('http://localhost:4321/topo-builder');
  await page.waitForSelector('.react-flow__pane');

  await page.locator('.react-flow__pane').click({ button: 'right', position: NODE1_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.waitForSelector('.react-flow__node');
  await page.locator('.react-flow__pane').click({ position: EMPTY_POS });

  await page.locator('.react-flow__pane').click({ button: 'right', position: NODE2_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 2);

  const firstNode = page.locator('.react-flow__node').first();
  const secondNode = page.locator('.react-flow__node').last();

  const firstBounds = await firstNode.boundingBox();
  const secondBounds = await secondNode.boundingBox();

  if (!firstBounds || !secondBounds) {
    throw new Error('Could not get node bounds');
  }

  const sourceX = firstBounds.x + firstBounds.width;
  const sourceY = firstBounds.y + firstBounds.height / 2;
  const targetX = secondBounds.x;
  const targetY = secondBounds.y + secondBounds.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();

  expect(await getEdgeCount(page)).toBe(1);
  
  await page.waitForTimeout(100);

  await page.keyboard.press('Backspace')
  await page.keyboard.press('3');
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'YAML' }).click();
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
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D3L
    - name: spine
      labels:
        eda.nokia.com/role: spine
        eda.nokia.com/security-profile: managed
      nodeProfile: srlinux-ghcr-25.10.1
      platform: 7220 IXR-D5
  nodes:
    - name: node1
      template: leaf
      labels:
        topobuilder/x: "195"
        topobuilder/y: "300"
    - name: node2
      template: leaf
      labels:
        topobuilder/x: "345"
        topobuilder/y: "315"
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
  links:
    - name: node1-node2-1
      labels:
        topobuilder/edgeId: edge-1
        topobuilder/memberIndex: "0"
        topobuilder/srcHandle: left
        topobuilder/dstHandle: right-target
      endpoints:
        - local:
            node: node2
            interface: ethernet-1-1
          remote:
            node: node1
            interface: ethernet-1-3
      template: isl
  simulation:
    simNodeTemplates:
      - name: testman
        type: TestMan
      - name: multitool
        type: Linux
        image: ghcr.io/srl-labs/network-multitool:latest
    simNodes: []`);
});
