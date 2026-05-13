import { freshUserTest as test, expect } from './fixtures';

test.describe('Settings — Dietary Restrictions', () => {
  test('all dietary restriction options are visible', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const expected = [
      'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free',
      'Halal', 'Kosher', 'Shellfish-Free', 'Egg-Free', 'Soy-Free', 'Low-Sodium',
    ];
    for (const label of expected) {
      await expect(dialog.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('no dietary restrictions are selected by default', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Vegetarian button should have white-ish background (inactive)
    const btn = dialog.getByRole('button', { name: 'Vegetarian', exact: true });
    const bg = await btn.evaluate(el => el.style.backgroundColor);
    // Inactive: not the primary teal
    expect(bg).not.toBe('rgb(61, 123, 123)');
  });

  test('clicking a dietary toggle selects it', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const veganBtn = dialog.getByRole('button', { name: 'Vegan', exact: true });
    await veganBtn.click();

    // After clicking, the button should have the primary teal background
    const bg = await veganBtn.evaluate(el => el.style.backgroundColor);
    expect(bg).toContain('rgb(61, 123, 123)');
  });

  test('clicking a selected dietary toggle deselects it', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    const glutenBtn = dialog.getByRole('button', { name: 'Gluten-Free', exact: true });

    // Select it
    await glutenBtn.click();
    let bg = await glutenBtn.evaluate(el => el.style.backgroundColor);
    expect(bg).toContain('rgb(61, 123, 123)');

    // Deselect it
    await glutenBtn.click();
    bg = await glutenBtn.evaluate(el => el.style.backgroundColor);
    expect(bg).not.toBe('rgb(61, 123, 123)');
  });

  test('toggling dietary restrictions enables Save Changes', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');
    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });

    await expect(saveBtn).toBeDisabled();

    await dialog.getByRole('button', { name: 'Halal', exact: true }).click();
    await expect(saveBtn).toBeEnabled();
  });

  test('no member dietary note when no members have restrictions', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await expect(dialog.getByText('meals will also exclude these')).not.toBeVisible();
  });
});
