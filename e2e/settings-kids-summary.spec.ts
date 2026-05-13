import { freshUserTest as test, expect } from './fixtures';

test.describe('Settings — Kids Summary', () => {
  test('Kids Summary section is hidden when no kids in household', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText('Kids Summary')).not.toBeVisible();
  });

  test('shows kid-friendly effect for picky_2_5 child', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Lily');
    await dialog.getByRole('button', { name: '2-5' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Kids Summary')).toBeVisible();
    await expect(dialog.getByText('Lily (age 2-5): Kid-friendly meals prioritized')).toBeVisible();
  });

  test('shows baby deal tracking for under_2 child', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Baby');
    await dialog.getByRole('button', { name: 'Under 2' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Baby: Baby food deals tracked')).toBeVisible();
  });

  test('shows expanding palate for 6-12 child', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Sam');
    await dialog.getByRole('button', { name: '6-12' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Sam (age 6-12): Expanding palate meals included')).toBeVisible();
  });

  test('shows teen-sized portions for 13+ teen', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Alex');
    await dialog.getByRole('button', { name: '13+' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Alex (age 13+): Teen-sized portions')).toBeVisible();
  });

  test('adult members do not show Kids Summary', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Tom');
    await dialog.getByRole('button', { name: 'Adult' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(dialog.getByText('Kids Summary')).not.toBeVisible();
  });

  test('removing the only child hides Kids Summary', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Add a child
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Lily');
    await dialog.getByRole('button', { name: '2-5' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.getByText('Kids Summary')).toBeVisible();

    // Remove the child
    await dialog.getByRole('button', { name: 'Remove Lily' }).click();
    await expect(dialog.getByText('Kids Summary')).not.toBeVisible();
  });
});
