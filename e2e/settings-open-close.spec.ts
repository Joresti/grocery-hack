import { seedUserTest as test, expect } from './fixtures';

test.describe('Settings modal — open and close', () => {
  test('settings gear icon is visible in the header', async ({ seedPage: page }) => {
    const settingsBtn = page.locator('[aria-label="Open settings"]');
    await expect(settingsBtn).toBeVisible();
    // Should contain an SVG icon
    await expect(settingsBtn.locator('svg')).toBeVisible();
  });

  test('clicking the gear icon opens the settings modal', async ({ seedPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Settings');
  });

  test('settings modal has the four core sections', async ({ seedPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText('Household Members')).toBeVisible();
    await expect(dialog.getByText('Dietary Restrictions')).toBeVisible();
    await expect(dialog.getByText('Cooking Style')).toBeVisible();
    await expect(dialog.getByText('Store Preferences')).toBeVisible();
    // Kids Summary only appears when kids are in the household
  });

  test('settings modal has a Save Changes button', async ({ seedPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });
    await expect(saveBtn).toBeVisible();
    // Should be disabled by default (no changes)
    await expect(saveBtn).toBeDisabled();
  });

  test('clicking X closes the settings modal', async ({ seedPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.click('[aria-label="Close modal"]');
    await expect(dialog).not.toBeVisible();
  });

  test('clicking backdrop closes the settings modal', async ({ seedPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click the backdrop area (outside the modal content)
    await page.locator('[role="dialog"]').locator('..').click({ position: { x: 10, y: 10 } });
    await expect(dialog).not.toBeVisible();
  });
});
