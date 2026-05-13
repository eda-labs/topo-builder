import { readFile } from 'node:fs/promises';

import { test, expect, type Page } from '@playwright/test';

import { canvasPane, loadExpectedYaml } from './utils';

const MAX_COMPACT_SVG_BYTES = 100 * 1024;

async function importYaml(page: Page, yamlInput: string): Promise<void> {
  await page.evaluate(async (yamlStr: string) => {
    // @ts-expect-error Vite dev path
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.importFromYaml(yamlStr);
    state.triggerYamlRefresh();
  }, yamlInput);
  await page.waitForTimeout(500);
}

async function exportSvg(page: Page, configure?: () => Promise<void>): Promise<string> {
  await page.getByRole('button', { name: 'Export SVG' }).click();
  await expect(page.getByRole('dialog', { name: 'Export SVG' })).toBeVisible();
  await configure?.();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('SVG download path is not available');
  return readFile(path, 'utf8');
}

async function loadFixtureAndExport(page: Page, fixture: string): Promise<string> {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await importYaml(page, loadExpectedYaml(fixture));
  return exportSvg(page);
}

async function hasNonBackgroundPixels(page: Page, svg: string): Promise<boolean> {
  return page.evaluate(async (svgText: string) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const [r0, g0, b0, a0] = data;
    for (let index = 4; index < data.length; index += 4) {
      const changed = data[index] !== r0
        || data[index + 1] !== g0
        || data[index + 2] !== b0
        || data[index + 3] !== a0;
      if (changed && data[index + 3] > 0) return true;
    }
    return false;
  }, svg);
}

test('SVG export is compact and semantic for a basic topology', async ({ page }) => {
  const svg = await loadFixtureAndExport(page, '02-two-nodes-isl-link.yaml');

  expect(Buffer.byteLength(svg, 'utf8')).toBeLessThan(MAX_COMPACT_SVG_BYTES);
  expect(svg).not.toContain('<foreignObject');
  expect(svg).toContain('leaf1');
  expect(svg).toContain('leaf2');
  expect(svg).toContain('<path');
  expect(svg).toContain('export-edge');
  expect(svg).toContain('topology-node');
  expect(await hasNonBackgroundPixels(page, svg)).toBe(true);
});

test('SVG export covers sim-node dashed links', async ({ page }) => {
  const svg = await loadFixtureAndExport(page, '27-lag-simnode-local.yaml');

  expect(Buffer.byteLength(svg, 'utf8')).toBeLessThan(MAX_COMPACT_SVG_BYTES);
  expect(svg).not.toContain('<foreignObject');
  expect(svg).toContain('testman1');
  expect(svg).toContain('stroke-dasharray="5 5"');
});

test('SVG export includes annotations with topology content', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await importYaml(page, loadExpectedYaml('02-two-nodes-isl-link.yaml'));
  await page.evaluate(async () => {
    // @ts-expect-error Vite dev path
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.addAnnotation({
      type: 'text',
      text: 'Rack A',
      fontSize: 14,
      fontColor: '#bcd0fb',
      position: { x: 120, y: 180 },
    });
    state.addAnnotation({
      type: 'shape',
      shapeType: 'rectangle',
      position: { x: 150, y: 250 },
      width: 260,
      height: 120,
      strokeColor: '#314354',
      fillColor: '#1A222E',
      strokeWidth: 1,
      strokeStyle: 'solid',
    });
  });

  const svg = await exportSvg(page);

  expect(Buffer.byteLength(svg, 'utf8')).toBeLessThan(MAX_COMPACT_SVG_BYTES);
  expect(svg).toContain('Rack A');
  expect(svg).toContain('<rect');
  expect(svg).toContain('annotations-shapes');
  expect(svg).toContain('annotations-text');
});

test('SVG export can omit the canvas background', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();
  await importYaml(page, loadExpectedYaml('02-two-nodes-isl-link.yaml'));

  const svg = await exportSvg(page, async () => {
    await page.getByLabel('Transparent background').check();
  });

  expect(Buffer.byteLength(svg, 'utf8')).toBeLessThan(MAX_COMPACT_SVG_BYTES);
  expect(svg).not.toContain('topobuilder-dot-grid');
  expect(svg).not.toContain('fill="#101824"');
  expect(svg).toContain('leaf1');
  expect(svg).toContain('leaf2');
});
