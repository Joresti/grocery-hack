import { freshUserTest as test, expect } from './fixtures';

// Active border = rgb(61, 123, 123) — the primary teal, no alpha
// Inactive border = rgba(61, 123, 123, 0.08) — primaryLight, with alpha
const ACTIVE_BORDER = 'rgb(61, 123, 123)';

test.describe('Settings — Cooking Style', () => {
  test('three cooking style options are visible', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText('Quick & Easy')).toBeVisible();
    await expect(dialog.getByText('Under 30 minutes total')).toBeVisible();
    await expect(dialog.getByText('Balanced')).toBeVisible();
    await expect(dialog.getByText('Under 60 minutes total')).toBeVisible();
    await expect(dialog.getByText('Best Recipes')).toBeVisible();
    await expect(dialog.getByText('No time limit')).toBeVisible();
  });

  test('Balanced is selected by default for new users', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const balancedCard = dialog.locator('button').filter({ hasText: 'Balanced' }).filter({ hasText: 'Under 60' });
    const borderColor = await balancedCard.evaluate(el => el.style.borderColor);
    expect(borderColor).toBe(ACTIVE_BORDER);

    const quickCard = dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' });
    const quickBorder = await quickCard.evaluate(el => el.style.borderColor);
    expect(quickBorder).not.toBe(ACTIVE_BORDER);
  });

  test('clicking a different cooking style switches the selection', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const quickCard = dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' });
    const balancedCard = dialog.locator('button').filter({ hasText: 'Balanced' }).filter({ hasText: 'Under 60' });

    await quickCard.click();

    const quickBorder = await quickCard.evaluate(el => el.style.borderColor);
    expect(quickBorder).toBe(ACTIVE_BORDER);

    const balancedBorder = await balancedCard.evaluate(el => el.style.borderColor);
    expect(balancedBorder).not.toBe(ACTIVE_BORDER);
  });

  test('unselected cards do not have black borders after switching', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const quickCard = dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' });
    const bestCard = dialog.locator('button').filter({ hasText: 'Best Recipes' }).filter({ hasText: 'No time' });

    await quickCard.click();
    await bestCard.click();

    // Quick & Easy should NOT be active and should NOT be black
    const quickBorder = await quickCard.evaluate(el => el.style.borderColor);
    expect(quickBorder).not.toBe(ACTIVE_BORDER);
    expect(quickBorder).not.toBe('rgb(0, 0, 0)');
    expect(quickBorder).not.toBe('black');

    // Best Recipes should be active
    const bestBorder = await bestCard.evaluate(el => el.style.borderColor);
    expect(bestBorder).toBe(ACTIVE_BORDER);
  });

  test('switching cooking style enables Save Changes', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });

    await expect(saveBtn).toBeDisabled();
    await dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' }).click();
    await expect(saveBtn).toBeEnabled();
  });

  test('selecting the already-active style does not enable Save', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });

    await dialog.locator('button').filter({ hasText: 'Balanced' }).filter({ hasText: 'Under 60' }).click();
    await expect(saveBtn).toBeDisabled();
  });
});
