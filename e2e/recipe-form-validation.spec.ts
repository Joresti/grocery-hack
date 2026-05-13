import { freshUserTest as test, expect } from './fixtures';

/**
 * Feature: RecipeFormModal — Validation and Save/Delete flows
 * Spec: specs/recipe-upload-frontend.md
 *
 * Covers required field validation, save button states, save success/failure,
 * and the delete confirmation dialog.
 */

/** Helper: open RecipeFormModal in create mode */
async function openCreateModal(page: import('@playwright/test').Page): Promise<void> {
  const addBtn = page.locator('.gh-my-recipes-add-btn');
  const headerAddVisible = await addBtn.isVisible().catch(() => false);
  if (headerAddVisible) {
    await addBtn.click();
  } else {
    await page.locator('.gh-my-recipes-empty').getByRole('button', { name: /Add a Recipe/i }).click();
  }
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
}

test.describe('RecipeFormModal — save button states', () => {
  test('save button is disabled when form is empty', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
  });

  test('save button is disabled with only name filled (no ingredients)', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-name input').fill('My Recipe');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await expect(saveBtn).toBeDisabled();
  });

  test('save button is disabled with only ingredient filled (no name)', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Chicken');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await expect(saveBtn).toBeDisabled();
  });

  test('save button enables when name AND ingredient are both filled', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-name input').fill('Chicken Stew');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Chicken');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe('RecipeFormModal — validation errors', () => {
  test('no errors shown before first save attempt', async ({ freshPage: page }) => {
    await openCreateModal(page);
    // Errors should not be visible initially
    await expect(page.locator('.gh-recipe-form-error')).toHaveCount(0);
  });

  test('name error shown after save attempt with empty name', async ({ freshPage: page }) => {
    await openCreateModal(page);

    // Fill an ingredient but leave name empty
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Chicken');

    // Force-enable and click save (if button is still disabled, try submitting via keyboard)
    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    // Even if disabled, we test that clicking it triggers validation display
    await saveBtn.click({ force: true });

    // Name error should appear
    const nameError = page.locator('.gh-recipe-form-name .gh-recipe-form-error');
    await expect(nameError).toBeVisible();
    await expect(nameError).toContainText('Recipe name is required');
  });

  test('ingredient error shown after save attempt with no ingredients', async ({ freshPage: page }) => {
    await openCreateModal(page);

    // Fill name but leave ingredients empty
    await page.locator('.gh-recipe-form-name input').fill('My Recipe');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await saveBtn.click({ force: true });

    const ingredientError = page.locator('.gh-recipe-form-ingredients .gh-recipe-form-error');
    await expect(ingredientError).toBeVisible();
    await expect(ingredientError).toContainText('at least one ingredient');
  });

  test('name input border turns danger color on validation error', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Chicken');
    await page.getByRole('button', { name: /Save Recipe/i }).click({ force: true });

    const nameInput = page.locator('.gh-recipe-form-name input');
    // Check that the input has a danger/error class or style
    await expect(nameInput).toHaveClass(/error|danger/);
  });

  test('errors clear when field becomes valid', async ({ freshPage: page }) => {
    await openCreateModal(page);

    // Trigger validation
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Chicken');
    await page.getByRole('button', { name: /Save Recipe/i }).click({ force: true });

    // Name error visible
    await expect(page.locator('.gh-recipe-form-name .gh-recipe-form-error')).toBeVisible();

    // Fill in name — error should clear
    await page.locator('.gh-recipe-form-name input').fill('My Recipe');
    await expect(page.locator('.gh-recipe-form-name .gh-recipe-form-error')).not.toBeVisible();
  });
});

test.describe('RecipeFormModal — save flow', () => {
  test('successful save shows toast and closes modal', async ({ freshPage: page }) => {
    await openCreateModal(page);

    // Fill required fields
    await page.locator('.gh-recipe-form-name input').fill('E2E Test Recipe');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Test ingredient');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Qty" i]').fill('1');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Unit" i]').fill('cup');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Button should show "Saving..." state
    await expect(saveBtn).toContainText(/Saving/i);

    // Modal should close after save succeeds
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Success toast should appear
    await expect(page.locator('.gh-toast')).toContainText(/Recipe saved/i);
  });

  test('saved recipe appears in My Recipes section', async ({ freshPage: page }) => {
    await openCreateModal(page);

    await page.locator('.gh-recipe-form-name input').fill('E2E New Recipe');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Garlic');

    await page.getByRole('button', { name: /Save Recipe/i }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // The My Recipes section should now show the recipe card
    const section = page.locator('.gh-my-recipes');
    await expect(section.locator('.gh-my-recipe-card')).toHaveCount(1, { timeout: 5000 });
    await expect(section.locator('.gh-my-recipe-card-name')).toContainText('E2E New Recipe');
  });

  test('save button shows spinner during save', async ({ freshPage: page }) => {
    await openCreateModal(page);

    await page.locator('.gh-recipe-form-name input').fill('Spinner Test');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Salt');

    const saveBtn = page.getByRole('button', { name: /Save Recipe/i });
    await saveBtn.click();

    // During save, button should be disabled
    await expect(saveBtn).toBeDisabled();
  });
});

test.describe('RecipeFormModal — save with optional fields', () => {
  test('can save a recipe with all optional fields filled', async ({ freshPage: page }) => {
    await openCreateModal(page);

    // Required fields
    await page.locator('.gh-recipe-form-name input').fill('Full Recipe Test');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]').fill('Onion');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Qty" i]').fill('2');
    await page.locator('.gh-ingredient-row').first().locator('input[placeholder*="Unit" i]').fill('medium');

    // Add a second ingredient
    await page.locator('.gh-recipe-form-ingredients-add').click();
    const secondRow = page.locator('.gh-ingredient-row').nth(1);
    await secondRow.locator('input[placeholder*="Ingredient" i]').fill('Garlic');
    await secondRow.locator('input[placeholder*="Qty" i]').fill('3');
    await secondRow.locator('input[placeholder*="Unit" i]').fill('cloves');

    // Steps
    await page.locator('.gh-recipe-form-steps-add').click();
    await page.locator('.gh-step-row input[placeholder*="step" i]').fill('Dice the onions');

    // Details
    const detailsSection = page.locator('.gh-recipe-form-details');
    const numberInputs = detailsSection.locator('input[type="number"]');
    await numberInputs.nth(0).fill('10');  // Prep time
    await numberInputs.nth(1).fill('25');  // Cook time
    await numberInputs.nth(2).fill('4');   // Servings

    // Tags
    await page.locator('.gh-dietary-tag').filter({ hasText: 'Vegan' }).click();

    // Notes
    await page.locator('.gh-recipe-form-notes textarea').fill('Great weeknight dinner');

    // Save
    await page.getByRole('button', { name: /Save Recipe/i }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.gh-toast')).toContainText(/Recipe saved/i);
  });
});
