import { test, expect } from '@playwright/test';
import { canvasPane, getYamlContent } from './utils';
import { SIM_POS, addContextMenuItem, nodeByLabel, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo update SimNode name', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a SimNode
  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();

  // Rename the simNode programmatically
  await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    state.updateSimNode('testman1', { name: 'testman-renamed' });
  });

  // Wait for the node to be renamed
  await nodeByLabel(page, 'testman-renamed').waitFor();

  // Check YAML has the new name
  await page.getByRole('tab', { name: 'YAML' }).click();
  let yaml = await getYamlContent(page);
  expect(yaml).toContain('name: testman-renamed');
  expect(yaml).not.toContain('name: testman1');

  // Undo the rename
  await undoViaContextMenu(page);
  await nodeByLabel(page, 'testman1').waitFor();

  // Check YAML reverted to old name
  yaml = await getYamlContent(page);
  expect(yaml).toContain('name: testman1');
  expect(yaml).not.toContain('name: testman-renamed');

  // Redo the rename
  await redoViaContextMenu(page);
  await nodeByLabel(page, 'testman-renamed').waitFor();

  // Check YAML has the new name again
  yaml = await getYamlContent(page);
  expect(yaml).toContain('name: testman-renamed');
  expect(yaml).not.toContain('name: testman1');
});

test('Undo/redo update SimNode template', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a SimNode
  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();

  // Get initial YAML to compare
  await page.getByRole('tab', { name: 'YAML' }).click();
  const initialYaml = await getYamlContent(page);

  // Change the template programmatically
  const templateName = await page.evaluate(async () => {
    // @ts-expect-error - Vite serves source files at this path in dev mode
    const mod = await import('/src/lib/store/index.ts');
    const state = mod.useTopologyStore.getState();
    const templates = state.simulation.simNodeTemplates;
    if (templates.length > 0) {
      const template = templates[0].name;
      state.updateSimNode('testman1', { template });
      return template;
    }
    return null;
  });

  // Only continue if we have a template to test with
  if (templateName) {
    // Check YAML updated
    let yaml = await getYamlContent(page);
    expect(yaml).not.toBe(initialYaml);

    // Undo the template change
    await undoViaContextMenu(page);

    // Check YAML reverted
    yaml = await getYamlContent(page);
    expect(yaml).toBe(initialYaml);

    // Redo the template change
    await redoViaContextMenu(page);

    // Check YAML has the change again
    yaml = await getYamlContent(page);
    expect(yaml).not.toBe(initialYaml);
  }
});
