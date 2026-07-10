import type { Page } from '@playwright/test';
import yaml from 'js-yaml';

import {
  topologyEdgeKey,
  topologyEdgeTestId,
  topologyLagTestId,
  topologyMemberLinkTestId,
  topologyNodeTestId,
  topologySimNodeTestId,
} from '../src/lib/testIds';

import { canvasPane } from './utils';

// v2 front-panel nodes are wider than the old 80x80 boxes (a 7220 IXR-D3L is ~400px),
// so the canonical positions keep clear of each other's footprints.
export const NODE1_POS = { x: 200, y: 300 };
export const NODE2_POS = { x: 640, y: 300 };
export const NODE3_POS = { x: 400, y: 480 };
export const SIM_POS = { x: 420, y: 120 };
export const EMPTY_POS = { x: 60, y: 60 };

type YamlDoc = { spec?: { links?: Array<{ name?: string; endpoints?: unknown[] }> } };

export const parseLinks = (yamlText: string): Array<{ name?: string; endpoints?: unknown[] }> => {
  const doc = yaml.load(yamlText) as YamlDoc | undefined;
  return doc?.spec?.links ?? [];
};

export const nodeByLabel = (page: Page, label: string) =>
  page
    .locator(
      `[data-testid="${topologyNodeTestId(label)}"], [data-testid="${topologySimNodeTestId(label)}"]`,
    )
    .first();

export const getNodeCenter = async (page: Page, label: string) => {
  const box = await nodeByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Could not find node ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const edgeByLabels = (page: Page, a: string, b: string) =>
  page.getByTestId(topologyEdgeTestId(a, b));

export const memberLinkByIndex = (page: Page, a: string, b: string, memberIndex: number) =>
  page.getByTestId(topologyMemberLinkTestId(a, b, memberIndex));

export const firstLagByLabels = (page: Page, a: string, b: string) => {
  const key = topologyEdgeKey(a, b);
  return page.locator(`[data-testid^="topology-lag-${key}-"]`).first();
};

export const lagByName = (page: Page, a: string, b: string, lagName: string) =>
  page.getByTestId(topologyLagTestId(a, b, lagName));

export const selectEdgesByNames = async (page: Page, pairs: Array<[string, string]>) => {
  await page.evaluate(async edgePairs => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    const edgeIds: string[] = [];
    for (const [a, b] of edgePairs) {
      const edge = state.edges.find((e: { data?: { sourceNode?: string; targetNode?: string } }) => {
        const src = e.data?.sourceNode;
        const dst = e.data?.targetNode;
        return (src === a && dst === b) || (src === b && dst === a);
      });
      if (edge) edgeIds.push(edge.id);
    }
    if (edgeIds.length === 0) return;
    state.selectEdge(edgeIds[0], false);
    for (let i = 1; i < edgeIds.length; i++) {
      state.selectEdge(edgeIds[i], true);
    }
  }, pairs);
};

// v2 renders every member link as its own cable; a locator's bounding-box centre often misses
// the 10px stroke (or sits under a node), so clicks sample actual points along the path.
export const clickPathAt = async (
  page: Page,
  locator: ReturnType<Page['locator']>,
  options: { button?: 'left' | 'right'; modifiers?: Array<'Shift' | 'Alt' | 'Control' | 'Meta'> } = {},
) => {
  const handle = await locator.first().elementHandle();
  if (!handle) throw new Error('path not found');
  const pt = await handle.evaluate(el => {
    let p = el as SVGGeometryElement;
    // an edge wrapper <g> matched: sample its first real path instead
    if (typeof p.getTotalLength !== 'function') {
      const inner = el.querySelector('path');
      if (!inner) return null;
      p = inner as SVGGeometryElement;
    }
    const total = p.getTotalLength();
    for (let f = 0.08; f <= 0.92; f += 0.04) {
      const m = p.getPointAtLength(total * f);
      const ctm = p.getScreenCTM();
      if (!ctm) return null;
      const sp = new DOMPoint(m.x, m.y).matrixTransform(ctm);
      const under = document.elementFromPoint(sp.x, sp.y);
      if (under === p || under?.closest?.('.react-flow__edge')) return { x: sp.x, y: sp.y };
    }
    return null;
  });
  if (!pt) throw new Error('no visible point on path');
  for (const mod of options.modifiers ?? []) await page.keyboard.down(mod);
  await page.mouse.click(pt.x, pt.y, { button: options.button ?? 'left' });
  for (const mod of options.modifiers ?? []) await page.keyboard.up(mod);
};

// A path belonging to the edge between two nodes: a member cable when the edge renders
// port-anchored cables, else the edge's own path (ESI-LAG, non-panel fallbacks).
const edgePathByLabels = (page: Page, a: string, b: string) => {
  const key = topologyEdgeKey(a, b);
  return page.locator(
    `[data-testid^="topology-memberlink-${key}-"], [data-testid^="topology-lag-${key}-"], [data-testid="topology-edge-${key}"], [data-testid="topology-edge-${key}"] path`,
  );
};

export const clickEdgeBetween = async (
  page: Page,
  sourceLabel: string,
  targetLabel: string,
  options: { button?: 'left' | 'right'; modifiers?: Array<'Shift' | 'Alt' | 'Control' | 'Meta'> } = {},
) => {
  await clickPathAt(page, edgePathByLabels(page, sourceLabel, targetLabel), options);
};

export const connectNodes = async (page: Page, sourceLabel: string, targetLabel: string) => {
  const source = nodeByLabel(page, sourceLabel);
  const target = nodeByLabel(page, targetLabel);

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error(`Could not get bounds for ${sourceLabel} or ${targetLabel}`);
  }

  await page.mouse.move(sourceBox.x + sourceBox.width, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
};

export const addContextMenuItem = async (page: Page, position: { x: number; y: number }, label: string) => {
  await page.getByTestId('topology-canvas').locator('.react-flow__pane').click({ button: 'right', position });
  await page.getByRole('menuitem', { name: label }).click();
};

export const copySelected = async (page: Page) => {
  await page.getByRole('menuitem', { name: 'Copy' }).click();
};

export const pasteSelected = async (page: Page) => {
  await page.getByRole('menuitem', { name: 'Paste' }).click();
};

export const openEdgeContextMenu = async (page: Page, sourceLabel: string, targetLabel: string) => {
  await clickEdgeBetween(page, sourceLabel, targetLabel, { button: 'right' });
};

export async function addTwoNodesAndConnect(page: Page): Promise<void> {
  await addContextMenuItem(page, NODE1_POS, 'Add Node');
  await addContextMenuItem(page, NODE2_POS, 'Add Node');
  await connectNodes(page, 'leaf1', 'leaf2');
  await page.waitForFunction(
    () => document.querySelectorAll('.react-flow__edge').length === 1,
  );
}

export async function createLocalLagBetween(page: Page, nodeA: string, nodeB: string): Promise<void> {
  await clickEdgeBetween(page, nodeA, nodeB);
  await openEdgeContextMenu(page, nodeA, nodeB);
  await copySelected(page);
  await openEdgeContextMenu(page, nodeA, nodeB);
  await pasteSelected(page);

  // v2 renders member links as individual cables right away — no bundle chip to expand.
  await memberLinkByIndex(page, nodeA, nodeB, 0).waitFor();
  await memberLinkByIndex(page, nodeA, nodeB, 1).waitFor();

  await clickPathAt(page, memberLinkByIndex(page, nodeA, nodeB, 0));
  await clickPathAt(page, memberLinkByIndex(page, nodeA, nodeB, 1), { modifiers: ['Shift'] });

  await clickPathAt(page, memberLinkByIndex(page, nodeA, nodeB, 1), { button: 'right', modifiers: ['Shift'] });
  await page.getByRole('menuitem', { name: 'Create Local LAG' }).click();
}

// v2 nodes are front panels: their body is full of port cells (connection handles), so
// selecting or dragging a node targets its header strip instead of the element centre.
export const clickNodeHeader = async (page: Page, label: string, options: { button?: 'left' | 'right' } = {}) => {
  const box = await nodeByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Could not find node ${label}`);
  await page.mouse.click(box.x + Math.min(60, box.width / 4), box.y + 10, options);
};

export const dragNodeBy = async (page: Page, label: string, dx: number, dy: number) => {
  const box = await nodeByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Could not find node ${label}`);
  const startX = box.x + Math.min(60, box.width / 4);
  const startY = box.y + 10;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
};

export async function undoViaContextMenu(page: Page): Promise<void> {
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Undo' }).click();
}

export async function redoViaContextMenu(page: Page): Promise<void> {
  await canvasPane(page).click({ button: 'right', position: EMPTY_POS });
  await page.getByRole('menuitem', { name: 'Redo' }).click();
}
