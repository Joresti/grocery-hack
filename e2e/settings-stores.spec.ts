import { freshUserTest as test, expect } from './fixtures';

test.describe('Settings — Store Preferences', () => {
  test('max stores segmented control is visible', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByRole('button', { name: '1 Store' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '2 Stores' })).toBeVisible();
  });

  test('1 Store is selected by default for new users', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const oneStore = dialog.getByRole('button', { name: '1 Store' });
    const bg = await oneStore.evaluate(el => el.style.backgroundColor);
    expect(bg).toContain('rgb(61, 123, 123)');
  });

  test('clicking 2 Stores switches the selection', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const twoStores = dialog.getByRole('button', { name: '2 Stores' });
    await twoStores.click();

    const bg = await twoStores.evaluate(el => el.style.backgroundColor);
    expect(bg).toContain('rgb(61, 123, 123)');

    const oneStore = dialog.getByRole('button', { name: '1 Store' });
    const oneBg = await oneStore.evaluate(el => el.style.backgroundColor);
    expect(oneBg).not.toBe('rgb(61, 123, 123)');
  });

  test('switching max stores enables Save Changes', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });

    await expect(saveBtn).toBeDisabled();

    await dialog.getByRole('button', { name: '2 Stores' }).click();
    await expect(saveBtn).toBeEnabled();
  });
});
