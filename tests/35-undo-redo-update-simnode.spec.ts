import { test, expect } from '@playwright/test';
import { canvasPane, getYamlContent } from './utils';
import { SIM_POS, addContextMenuItem, nodeByLabel, undoViaContextMenu, redoViaContextMenu } from './lag-utils';

test('Undo/redo update SimNode name', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  // Add a SimNode
  await addContextMenuItem(page, SIM_POS, 'Add SimNode');
  await nodeByLabel(page, 'testman1').waitFor();

  // Click on the SimNode to select it
  await nodeByLabel(page, 'testman1').click();

  // Wait for properties panel to appear and focus the name field
  await page.getByLabel('Name').waitFor({ state: 'visible' });
  
  // Update the name via the properties panel
  const nameField = page.getByLabel('Name');
  await nameField.click();
  await nameField.fill('testman-renamed');
  
  // Trigger blur to save the change
  await page.keyboard.press('Tab');
  
  // Wait for the node to be renamed
  await nodeByLabel(page, 'testman-renamed').waitFor();

  // Check YAML has the new name
  await page.getByRole('tab', { name: 'YAML' }).click();
  let yaml = await getYamlContent(page);
  expect(yaml).toContain('name: testman-renamed');
  expect(yaml).not.toContain('name: testman1');

  // Switch back to canvas
  await page.getByRole('tab', { name: 'Canvas' }).click();

  // Undo the rename
  await undoViaContextMenu(page);
  await nodeByLabel(page, 'testman1').waitFor();

  // Check YAML reverted to old name
  await page.getByRole('tab', { name: 'YAML' }).click();
  yaml = await getYamlContent(page);
  expect(yaml).toContain('name: testman1');
  expect(yaml).not.toContain('name: testman-renamed');

  // Switch back to canvas
  await page.getByRole('tab', { name: 'Canvas' }).click();

  // Redo the rename
  await redoViaContextMenu(page);
  await nodeByLabel(page, 'testman-renamed').waitFor();

  // Check YAML has the new name again
  await page.getByRole('tab', { name: 'YAML' }).click();
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

  // Click on the SimNode to select it
  await nodeByLabel(page, 'testman1').click();

  // Wait for properties panel and template selector to appear
  await page.getByLabel('Template').waitFor({ state: 'visible' });

  // Get initial YAML to compare
  await page.getByRole('tab', { name: 'YAML' }).click();
  const initialYaml = await getYamlContent(page);
  
  // Switch back to canvas
  await page.getByRole('tab', { name: 'Canvas' }).click();

  // Change the template
  await page.getByLabel('Template').click();
  
  // Wait for menu to open and select a template
  // The template dropdown should have options - select 'None' first if there's a default, 
  // or select a specific template if available
  const menuItems = await page.getByRole('option').all();
  
  // Find a template that's not the current one
  let targetTemplate: string | null = null;
  for (const item of menuItems) {
    const text = await item.textContent();
    if (text && text !== 'None') {
      targetTemplate = text;
      await item.click();
      break;
    }
  }

  // If we found and selected a template, verify the change
  if (targetTemplate) {
    // Wait a bit for the update to propagate
    await page.waitForTimeout(100);

    // Check YAML updated
    await page.getByRole('tab', { name: 'YAML' }).click();
    const updatedYaml = await getYamlContent(page);
    expect(updatedYaml).not.toBe(initialYaml);

    // Switch back to canvas
    await page.getByRole('tab', { name: 'Canvas' }).click();

    // Undo the template change
    await undoViaContextMenu(page);
    
    // Wait a bit for undo to propagate
    await page.waitForTimeout(100);

    // Check YAML reverted
    await page.getByRole('tab', { name: 'YAML' }).click();
    let yaml = await getYamlContent(page);
    expect(yaml).toBe(initialYaml);

    // Switch back to canvas
    await page.getByRole('tab', { name: 'Canvas' }).click();

    // Redo the template change
    await redoViaContextMenu(page);
    
    // Wait a bit for redo to propagate
    await page.waitForTimeout(100);

    // Check YAML has the change again
    await page.getByRole('tab', { name: 'YAML' }).click();
    yaml = await getYamlContent(page);
    expect(yaml).toBe(updatedYaml);
  }
});
