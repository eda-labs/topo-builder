import { test, expect } from '@playwright/test';
import { canvasPane, getNodeCount, getEdgeCount, getYamlContent } from './utils';

const NODE1_POS = { x: 200, y: 300 };
const NODE2_POS = { x: 600, y: 300 };
const EMPTY_POS = { x: 50, y: 50 };

test('Add two nodes and connect them with a link', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await canvasPane(page).click({ button: 'right', position: NODE1_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByTestId('topology-node-leaf1').waitFor();
  await canvasPane(page).click({ position: EMPTY_POS });

  await canvasPane(page).click({ button: 'right', position: NODE2_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByTestId('topology-node-leaf2').waitFor();

  expect(await getNodeCount(page)).toBe(2);

  const firstNode = page.getByTestId('topology-node-leaf1');
  const secondNode = page.getByTestId('topology-node-leaf2');

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
        topobuilder.eda.labs/x: "195"
        topobuilder.eda.labs/y: "300"
    - name: leaf2
      template: leaf
      labels:
        topobuilder.eda.labs/x: "345"
        topobuilder.eda.labs/y: "315"
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
    - name: leaf1-leaf2-1
      labels:
        topobuilder.eda.labs/edgeId: edge-1
        topobuilder.eda.labs/memberIndex: "0"
        topobuilder.eda.labs/srcHandle: left
        topobuilder.eda.labs/dstHandle: right-target
      endpoints:
        - local:
            node: leaf2
            interface: ethernet-1-1
          remote:
            node: leaf1
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
  await page.goto('/');
  await canvasPane(page).waitFor();

  await canvasPane(page).click({ button: 'right', position: NODE1_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByTestId('topology-node-leaf1').waitFor();
  await canvasPane(page).click({ position: EMPTY_POS });

  await canvasPane(page).click({ button: 'right', position: NODE2_POS });
  await page.getByRole('menuitem', { name: 'Add Node' }).click();

  await page.getByTestId('topology-node-leaf2').waitFor();

  const firstNode = page.getByTestId('topology-node-leaf1');
  const secondNode = page.getByTestId('topology-node-leaf2');

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

  // Selection switches to the "Edit" tab automatically; update the (leaf1) endpoint explicitly.
  await page.getByTestId('link-endpoint-a-0').fill('ethernet-1-3');

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
        topobuilder.eda.labs/x: "195"
        topobuilder.eda.labs/y: "300"
    - name: leaf2
      template: leaf
      labels:
        topobuilder.eda.labs/x: "345"
        topobuilder.eda.labs/y: "315"
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
    - name: leaf1-leaf2-1
      labels:
        topobuilder.eda.labs/edgeId: edge-1
        topobuilder.eda.labs/memberIndex: "0"
        topobuilder.eda.labs/srcHandle: left
        topobuilder.eda.labs/dstHandle: right-target
      endpoints:
        - local:
            node: leaf2
            interface: ethernet-1-1
          remote:
            node: leaf1
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

// test('Create local LAG from multiple member links', async ({ page }) => {
//   await page.goto('http://localhost:4321/');
//   await page.waitForSelector('.react-flow__pane');

//   await page.locator('.react-flow__pane').click({ button: 'right', position: NODE1_POS });
//   await page.getByRole('menuitem', { name: 'Add Node' }).click();

//   await page.waitForSelector('.react-flow__node');
//   await page.locator('.react-flow__pane').click({ position: EMPTY_POS });

//   await page.locator('.react-flow__pane').click({ button: 'right', position: NODE2_POS });
//   await page.getByRole('menuitem', { name: 'Add Node' }).click();

//   await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 2);

//   const firstNode = page.locator('.react-flow__node').first();
//   const secondNode = page.locator('.react-flow__node').last();

//   const firstBounds = await firstNode.boundingBox();
//   const secondBounds = await secondNode.boundingBox();

//   if (!firstBounds || !secondBounds) {
//     throw new Error('Could not get node bounds');
//   }

//   const sourceX = firstBounds.x + firstBounds.width;
//   const sourceY = firstBounds.y + firstBounds.height / 2;
//   const targetX = secondBounds.x;
//   const targetY = secondBounds.y + secondBounds.height / 2;

//   await page.mouse.move(sourceX, sourceY);
//   await page.mouse.down();
//   await page.mouse.move(targetX, targetY, { steps: 10 });
//   await page.mouse.up();

//   expect(await getEdgeCount(page)).toBe(1);

//   // Select edge and copy/paste to create more member links
//   const edge = page.locator('.react-flow__edge').first();
//   await edge.click();
//   await page.waitForTimeout(100);

//   // Click on the pane to ensure focus is not on a text field
//   await page.locator('.react-flow__pane').click({ position: EMPTY_POS });
//   await edge.click();

//   // Copy and paste to add member links
//   await page.keyboard.press('ControlOrMeta+c');
//   await page.waitForTimeout(50);
//   await page.keyboard.press('ControlOrMeta+v');
//   await page.waitForTimeout(50);
//   await page.keyboard.press('ControlOrMeta+v');
//   await page.waitForTimeout(50);
//   await page.keyboard.press('ControlOrMeta+v');
//   await page.waitForTimeout(100);

//   // Click the link counter chip to expand the bundle
//   await page.locator('[title*="links - click to expand"]').click();
//   await page.waitForTimeout(100);

//   // expect(await getEdgeCount(page)).toBe(4);

//   // Shift select all the member links
//   const memberLinks = page.locator('.react-flow__edge-interaction');
//   const count = await memberLinks.count();
//   await memberLinks.first().click({ force: true });
//   for (let i = 1; i < count; i++) {
//     await memberLinks.nth(i).click({ modifiers: ['Shift'], force: true });
//   }

//   // Right-click to open context menu and create LAG
//   await memberLinks.last().click({ button: 'right', force: true });
//   await page.getByRole('menuitem', { name: 'Create Local LAG' }).click();

//   await page.getByRole('tab', { name: 'YAML' }).click();
//   const yaml = await getYamlContent(page);

//   expect(yaml).toContain('lagLinks:');
//   expect(yaml).toContain('lag-');
// });
