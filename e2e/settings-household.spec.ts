import { freshUserTest as test, expect } from './fixtures';

test.describe('Settings — Household Members', () => {
  test('shows 1 person (just the user) when no members added', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText('1 person in household (including you)')).toBeVisible();
  });

  test('can add a household member', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Click "Add member"
    await dialog.getByRole('button', { name: 'Add member' }).click();

    // Fill in name
    await dialog.locator('input[placeholder="Name"]').fill('Lily');

    // Select age bracket "2-5"
    await dialog.getByRole('button', { name: '2-5' }).click();

    // Click Add
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    // Member should appear in the list
    await expect(dialog.getByText('Lily', { exact: true })).toBeVisible();
    await expect(dialog.getByText('2-5', { exact: true })).toBeVisible();

    // Household count updates
    await expect(dialog.getByText('2 people in household (including you)')).toBeVisible();
  });

  test('can add multiple members and they all appear', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Add first member
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Tom');
    await dialog.getByRole('button', { name: 'Adult' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    // Add second member
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Lily');
    await dialog.getByRole('button', { name: '2-5' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Tom', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Lily', { exact: true })).toBeVisible();
    await expect(dialog.getByText('3 people in household (including you)')).toBeVisible();
  });

  test('can remove a household member', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Add a member first
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Tom');
    await dialog.getByRole('button', { name: 'Adult' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.getByText('Tom')).toBeVisible();

    // Remove the member
    await dialog.getByRole('button', { name: 'Remove Tom' }).click();
    await expect(dialog.getByText('Tom')).not.toBeVisible();
    await expect(dialog.getByText('1 person in household (including you)')).toBeVisible();
  });

  test('cancel button hides the add member form', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await expect(dialog.locator('input[placeholder="Name"]')).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog.locator('input[placeholder="Name"]')).not.toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add member' })).toBeVisible();
  });

  test('adding a child member shows Kids Summary', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Initially no Kids Summary section
    await expect(dialog.getByText('Kids Summary')).not.toBeVisible();

    // Add a child
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Lily');
    await dialog.getByRole('button', { name: '2-5' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    // Kids Summary appears
    await expect(dialog.getByText('Kids Summary')).toBeVisible();
    await expect(dialog.getByText('Lily (age 2-5): Kid-friendly meals prioritized')).toBeVisible();
  });

  test('Save Changes is enabled after adding a member', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });

    // Initially disabled
    await expect(saveBtn).toBeDisabled();

    // Add a member
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Tom');
    await dialog.getByRole('button', { name: 'Adult' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    // Now enabled
    await expect(saveBtn).toBeEnabled();
  });
});
