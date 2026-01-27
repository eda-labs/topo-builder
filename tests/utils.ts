import type { Page } from '@playwright/test';


export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('.react-flow__pane');
  await page.waitForSelector('.monaco-editor .view-lines');
}

export async function getYamlContent(page: Page): Promise<string> {
  await page.waitForSelector('.monaco-editor .view-lines');
  const content = await page.evaluate(() => {
    const models = (window as any).monaco?.editor?.getModels();
    return models?.[0]?.getValue() || '';
  });
  return content.trimEnd();
}

export async function getNodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

export async function getEdgeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__edge').count();
}
