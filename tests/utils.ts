import type { Page } from '@playwright/test';


export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByTestId('topology-canvas').waitFor();
  // Pane is still ReactFlow-internal; we scope it under a stable wrapper.
  await page.getByTestId('topology-canvas').locator('.react-flow__pane').waitFor();
  await page.getByTestId('yaml-editor').locator('.monaco-editor .view-lines').waitFor();
}

export async function getYamlContent(page: Page): Promise<string> {
  await page.getByTestId('yaml-editor').locator('.monaco-editor .view-lines').waitFor();
  const content = await page.evaluate(() => {
    const models = (window as any).monaco?.editor?.getModels();
    return models?.[0]?.getValue() || '';
  });
  return content.trimEnd();
}

export async function getNodeCount(page: Page): Promise<number> {
  // Counts both device nodes and sim nodes (both render via BaseNode).
  return page.locator('[data-testid^="topology-node-"], [data-testid^="topology-simnode-"]').count();
}

export async function getEdgeCount(page: Page): Promise<number> {
  // Only counts collapsed "topology edges" (not expanded member links / lag paths).
  return page.locator('[data-testid^="topology-edge-"]').count();
}

export function canvasPane(page: Page) {
  return page.getByTestId('topology-canvas').locator('.react-flow__pane');
}
