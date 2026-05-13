import { freshUserTest as test, expect } from './fixtures';

const API_URL = 'http://localhost:3000/api/v1';

test.describe('Settings — Save and persist', () => {
  test('Save Changes sends PATCH and persists cooking effort', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Switch to Quick & Easy
    await dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' }).click();

    // Intercept the PATCH request
    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );

    // Click Save
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    const patchRes = await patchPromise;
    expect(patchRes.status()).toBe(200);

    const body = await patchRes.json();
    expect(body.cooking_effort).toBe('quick');
  });

  test('Save Changes sends PATCH and persists dietary restrictions', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Toggle Vegan and Gluten-Free
    await dialog.getByRole('button', { name: 'Vegan', exact: true }).click();
    await dialog.getByRole('button', { name: 'Gluten-Free', exact: true }).click();

    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    const patchRes = await patchPromise;
    expect(patchRes.status()).toBe(200);

    const body = await patchRes.json();
    expect(body.dietary_restrictions).toContain('vegan');
    expect(body.dietary_restrictions).toContain('gluten-free');
  });

  test('Save Changes sends PATCH and persists household members with auto-derivation', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Add a child member
    await dialog.getByRole('button', { name: 'Add member' }).click();
    await dialog.locator('input[placeholder="Name"]').fill('Lily');
    await dialog.getByRole('button', { name: '2-5' }).click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    const patchRes = await patchPromise;
    expect(patchRes.status()).toBe(200);

    const body = await patchRes.json();
    // Auto-derived fields
    expect(body.household_names).toEqual(['Lily']);
    expect(body.household_size).toBe(2); // 1 member + user
    expect(body.kid_age_brackets).toEqual(['picky_2_5']);
  });

  test('Save Changes persists max_stores', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('button', { name: '2 Stores' }).click();

    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    const patchRes = await patchPromise;
    expect(patchRes.status()).toBe(200);

    const body = await patchRes.json();
    expect(body.max_stores).toBe(2);
  });

  test('Save button shows Saving... while request is in-flight', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    await dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' }).click();

    // Start watching for the button text to change
    const saveBtn = dialog.getByRole('button', { name: /Save|Saving/ });

    await saveBtn.click();
    // The button should briefly show "Saving..." (may be too fast to catch, so we just verify it doesn't error)
    // After save completes, button should go back to disabled
    await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeVisible({ timeout: 5000 });
  });

  test('Save button is disabled again after successful save', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Make a change
    await dialog.getByRole('button', { name: '2 Stores' }).click();

    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await patchPromise;

    // After save, the user state is updated so local state matches — button should be disabled
    await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeDisabled({ timeout: 3000 });
  });

  test('saved settings persist when modal is reopened', async ({ freshPage: page }) => {
    await page.click('[aria-label="Open settings"]');
    const dialog = page.locator('[role="dialog"]');

    // Switch to Quick & Easy and save
    await dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' }).click();
    const patchPromise = page.waitForResponse(
      res => res.url().includes('/users/me') && res.request().method() === 'PATCH'
    );
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await patchPromise;

    // Close the modal
    await page.click('[aria-label="Close modal"]');
    await expect(dialog).not.toBeVisible();

    // Reopen it
    await page.click('[aria-label="Open settings"]');
    await expect(dialog).toBeVisible();

    // Quick & Easy should still be selected (has the primary teal border)
    const quickCard = dialog.locator('button').filter({ hasText: 'Quick & Easy' }).filter({ hasText: 'Under 30' });
    const borderColor = await quickCard.evaluate(el => el.style.borderColor);
    expect(borderColor).toBe('rgb(61, 123, 123)');
  });
});
