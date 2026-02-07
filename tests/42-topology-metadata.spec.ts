import { test, expect } from '@playwright/test';
import { canvasPane, getYamlContent } from './utils';

const openSettings = (page: import('@playwright/test').Page) =>
  page.locator('header').getByLabel('Settings').click();

test('Settings dialog updates topology name and namespace in YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await openSettings(page);
  await page.getByRole('heading', { name: 'Settings' }).waitFor();

  const nameField = page.getByLabel('Topology Name');
  await nameField.clear();
  await nameField.fill('test-topology');

  const nsField = page.getByLabel('Namespace');
  await nsField.clear();
  await nsField.fill('test-ns');

  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('name: test-topology');
  expect(yaml).toContain('namespace: test-ns');
});

test('Settings dialog updates operation in YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await openSettings(page);
  await page.getByRole('heading', { name: 'Settings' }).waitFor();

  // MUI Select: click the displayed value within the dialog to open the dropdown
  await page.locator('[role="dialog"]').getByText('replaceAll').click();
  await page.getByRole('option', { name: 'create' }).click();

  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('operation: create');
});

test('Settings dialog cancel does not update YAML', async ({ page }) => {
  await page.goto('/');
  await canvasPane(page).waitFor();

  await openSettings(page);
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  const nameField = page.getByLabel('Topology Name');
  await nameField.clear();
  await nameField.fill('cancelled-name');

  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const yaml = await getYamlContent(page);
  expect(yaml).toContain('name: my-topology');
  expect(yaml).not.toContain('cancelled-name');
});
