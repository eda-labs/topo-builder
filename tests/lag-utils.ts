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

export const NODE1_POS = { x: 200, y: 300 };
export const NODE2_POS = { x: 600, y: 300 };
export const NODE3_POS = { x: 400, y: 470 };
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
  await page.evaluate(async (edgePairs) => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store.ts');
    const state = mod.useTopologyStore.getState();
    const edgeIds: string[] = [];
    for (const [a, b] of edgePairs as Array<[string, string]>) {
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

export const clickEdgeBetween = async (
  page: Page,
  sourceLabel: string,
  targetLabel: string,
  options: { button?: 'left' | 'right'; modifiers?: Array<'Shift' | 'Alt' | 'Control' | 'Meta'> } = {},
) => {
  await edgeByLabels(page, sourceLabel, targetLabel).click({ ...options, force: true });
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
