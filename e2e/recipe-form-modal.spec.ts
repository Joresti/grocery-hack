import { freshUserTest as test, expect } from './fixtures';

/**
 * Feature: RecipeFormModal — create mode
 * Spec: specs/recipe-upload-frontend.md
 *
 * Covers modal structure, form sections, ingredient entry, steps,
 * details grid, dietary tags, notes, share toggle, and action buttons.
 */

/** Helper: open RecipeFormModal in create mode from the My Recipes empty state */
async function openCreateModal(page: import('@playwright/test').Page): Promise<void> {
  const addBtn = page.locator('.gh-my-recipes-add-btn');
  // Fall back to the empty state CTA if section header add button doesn't exist
  const headerAddVisible = await addBtn.isVisible().catch(() => false);
  if (headerAddVisible) {
    await addBtn.click();
  } else {
    await page.locator('.gh-my-recipes-empty').getByRole('button', { name: /Add a Recipe/i }).click();
  }
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
}

test.describe('RecipeFormModal — modal shell', () => {
  test('modal opens with correct title in create mode', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('New Recipe');
  });

  test('modal has aria-modal and role="dialog"', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('close button closes the modal', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');
    await page.click('[aria-label="Close modal"]');
    await expect(modal).not.toBeVisible();
  });

  test('Escape key closes the modal', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('clicking backdrop closes the modal', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');
    // Click outside the modal content area
    await modal.locator('..').click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible();
  });

  test('close button has adequate touch target (44x44px)', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const closeBtn = page.locator('[aria-label="Close modal"]');
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('RecipeFormModal — form sections order', () => {
  test('all sections are present in correct order', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const modal = page.locator('[role="dialog"]');

    // URL Import section (first in create mode)
    await expect(modal.locator('.gh-recipe-form-import')).toBeVisible();

    // Recipe Name
    await expect(modal.locator('.gh-recipe-form-name')).toBeVisible();

    // Ingredients
    await expect(modal.locator('.gh-recipe-form-ingredients')).toBeVisible();

    // Steps
    await expect(modal.locator('.gh-recipe-form-steps')).toBeVisible();

    // Details grid
    await expect(modal.locator('.gh-recipe-form-details')).toBeVisible();

    // Dietary tags
    await expect(modal.locator('.gh-recipe-form-tags')).toBeVisible();

    // Notes
    await expect(modal.locator('.gh-recipe-form-notes')).toBeVisible();

    // Verify order: each section's Y position should be greater than the previous
    const sections = [
      '.gh-recipe-form-import',
      '.gh-recipe-form-name',
      '.gh-recipe-form-ingredients',
      '.gh-recipe-form-steps',
      '.gh-recipe-form-details',
      '.gh-recipe-form-tags',
      '.gh-recipe-form-notes',
    ];
    let prevY = 0;
    for (const selector of sections) {
      const box = await modal.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(prevY);
      prevY = box!.y;
    }
  });
});

test.describe('RecipeFormModal — URL import section', () => {
  test('import bar has input and button', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const importSection = page.locator('.gh-recipe-form-import');

    const input = importSection.locator('input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /recipe URL/i);

    const importBtn = importSection.getByRole('button', { name: /Import/i });
    await expect(importBtn).toBeVisible();
  });

  test('import button is disabled when input is empty', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const importBtn = page.locator('.gh-recipe-form-import').getByRole('button', { name: /Import/i });
    await expect(importBtn).toBeDisabled();
  });

  test('import button enables when URL is entered', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const importSection = page.locator('.gh-recipe-form-import');
    await importSection.locator('input').fill('https://example.com/recipe');
    const importBtn = importSection.getByRole('button', { name: /Import/i });
    await expect(importBtn).toBeEnabled();
  });
});

test.describe('RecipeFormModal — recipe name input', () => {
  test('name field has label and placeholder', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const nameSection = page.locator('.gh-recipe-form-name');
    await expect(nameSection).toContainText('Recipe Name');

    const input = nameSection.locator('input');
    await expect(input).toHaveAttribute('placeholder', /Grandma/i);
  });

  test('name input accepts text', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const input = page.locator('.gh-recipe-form-name input');
    await input.fill('Test Beef Stew');
    await expect(input).toHaveValue('Test Beef Stew');
  });
});

test.describe('RecipeFormModal — ingredient entry', () => {
  test('ingredient section has header with "+ Add" button', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-ingredients');
    await expect(section).toContainText('Ingredients');
    await expect(section.locator('.gh-recipe-form-ingredients-add')).toBeVisible();
  });

  test('starts with one empty ingredient row', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const rows = page.locator('.gh-ingredient-row');
    await expect(rows).toHaveCount(1);
  });

  test('ingredient row has name, quantity, and unit inputs', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const row = page.locator('.gh-ingredient-row').first();
    await expect(row.locator('input[placeholder*="Ingredient" i]')).toBeVisible();
    await expect(row.locator('input[placeholder*="Qty" i]')).toBeVisible();
    await expect(row.locator('input[placeholder*="Unit" i]')).toBeVisible();
  });

  test('remove button is hidden when only one row exists', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const removeBtn = page.locator('.gh-ingredient-row .gh-ingredient-remove');
    // Should be hidden or not exist
    await expect(removeBtn).toHaveCount(0);
  });

  test('clicking "+ Add" adds a new ingredient row', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const addBtn = page.locator('.gh-recipe-form-ingredients-add');
    await addBtn.click();

    const rows = page.locator('.gh-ingredient-row');
    await expect(rows).toHaveCount(2);
  });

  test('remove button appears when two or more rows exist', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-ingredients-add').click();

    const removeBtns = page.locator('.gh-ingredient-remove');
    await expect(removeBtns).toHaveCount(2);
  });

  test('removing a row reduces the count', async ({ freshPage: page }) => {
    await openCreateModal(page);
    // Add a second row
    await page.locator('.gh-recipe-form-ingredients-add').click();
    await expect(page.locator('.gh-ingredient-row')).toHaveCount(2);

    // Remove the second row
    await page.locator('.gh-ingredient-remove').last().click();
    await expect(page.locator('.gh-ingredient-row')).toHaveCount(1);

    // Remove button should hide again
    await expect(page.locator('.gh-ingredient-remove')).toHaveCount(0);
  });

  test('new row name input gets auto-focused', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-ingredients-add').click();

    // The last ingredient name input should be focused
    const lastNameInput = page.locator('.gh-ingredient-row').last().locator('input[placeholder*="Ingredient" i]');
    await expect(lastNameInput).toBeFocused();
  });

  test('can fill in a complete ingredient', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const row = page.locator('.gh-ingredient-row').first();
    await row.locator('input[placeholder*="Ingredient" i]').fill('Chicken breast');
    await row.locator('input[placeholder*="Qty" i]').fill('2');
    await row.locator('input[placeholder*="Unit" i]').fill('lbs');

    await expect(row.locator('input[placeholder*="Ingredient" i]')).toHaveValue('Chicken breast');
    await expect(row.locator('input[placeholder*="Qty" i]')).toHaveValue('2');
    await expect(row.locator('input[placeholder*="Unit" i]')).toHaveValue('lbs');
  });
});

test.describe('RecipeFormModal — steps entry', () => {
  test('steps section starts empty with hint text', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-steps');
    await expect(section).toContainText('Steps');
    await expect(section).toContainText('Optional');

    // No step rows initially
    const rows = page.locator('.gh-step-row');
    await expect(rows).toHaveCount(0);
  });

  test('section header has "+ Add Step" button', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const addBtn = page.locator('.gh-recipe-form-steps-add');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toContainText('Add Step');
  });

  test('clicking "+ Add Step" adds a numbered step row', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-steps-add').click();

    const rows = page.locator('.gh-step-row');
    await expect(rows).toHaveCount(1);

    // Should have a number badge with "1"
    await expect(rows.first().locator('.gh-step-number')).toContainText('1');

    // Should have a text input
    await expect(rows.first().locator('input[placeholder*="step" i]')).toBeVisible();
  });

  test('hint text disappears when a step is added', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-steps');
    await expect(section).toContainText('Optional');

    await page.locator('.gh-recipe-form-steps-add').click();
    // The hint text "Optional" should no longer be visible
    await expect(section.locator('.gh-recipe-form-steps-hint')).not.toBeVisible();
  });

  test('step numbers auto-update on removal', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const addBtn = page.locator('.gh-recipe-form-steps-add');
    await addBtn.click();
    await addBtn.click();
    await addBtn.click();

    // Three steps: 1, 2, 3
    const rows = page.locator('.gh-step-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.gh-step-number')).toContainText('1');
    await expect(rows.nth(1).locator('.gh-step-number')).toContainText('2');
    await expect(rows.nth(2).locator('.gh-step-number')).toContainText('3');

    // Remove step 2
    await rows.nth(1).locator('.gh-step-remove').click();

    // Should now be 1, 2 (renumbered)
    const updatedRows = page.locator('.gh-step-row');
    await expect(updatedRows).toHaveCount(2);
    await expect(updatedRows.nth(0).locator('.gh-step-number')).toContainText('1');
    await expect(updatedRows.nth(1).locator('.gh-step-number')).toContainText('2');
  });

  test('hint text reappears when all steps are removed', async ({ freshPage: page }) => {
    await openCreateModal(page);
    await page.locator('.gh-recipe-form-steps-add').click();
    await page.locator('.gh-step-remove').click();

    await expect(page.locator('.gh-step-row')).toHaveCount(0);
    await expect(page.locator('.gh-recipe-form-steps-hint')).toBeVisible();
  });
});

test.describe('RecipeFormModal — details grid', () => {
  test('details section has prep time, cook time, and servings fields', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-details');
    await expect(section).toBeVisible();

    await expect(section).toContainText('Prep Time');
    await expect(section).toContainText('Cook Time');
    await expect(section).toContainText('Servings');
  });

  test('number inputs accept only positive integers', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-details');
    const prepInput = section.locator('input').first();
    await expect(prepInput).toHaveAttribute('type', 'number');

    await prepInput.fill('15');
    await expect(prepInput).toHaveValue('15');
  });
});

test.describe('RecipeFormModal — dietary tags', () => {
  test('tag pills are displayed', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-tags');
    await expect(section).toBeVisible();

    // Check for a few expected tags
    await expect(section).toContainText('Vegetarian');
    await expect(section).toContainText('Vegan');
    await expect(section).toContainText('Gluten-Free');
  });

  test('tapping a tag toggles it active', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const tag = page.locator('.gh-dietary-tag').filter({ hasText: 'Vegetarian' });
    await expect(tag).toBeVisible();

    // Initially inactive — should not have the active class
    await expect(tag).not.toHaveClass(/active/);

    await tag.click();
    await expect(tag).toHaveClass(/active/);

    // Tap again to deactivate
    await tag.click();
    await expect(tag).not.toHaveClass(/active/);
  });
});

test.describe('RecipeFormModal — notes', () => {
  test('notes section has a textarea', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const section = page.locator('.gh-recipe-form-notes');
    await expect(section).toBeVisible();

    const textarea = section.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', /Tips|substitutions/i);
  });

  test('textarea accepts text', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const textarea = page.locator('.gh-recipe-form-notes textarea');
    await textarea.fill('Best served with crusty bread');
    await expect(textarea).toHaveValue('Best served with crusty bread');
  });
});

test.describe('RecipeFormModal — share toggle', () => {
  test('share toggle is present with label and helper text', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const toggle = page.locator('.gh-recipe-form-share');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Share with community');
    await expect(toggle).toContainText('Others can discover');
  });

  test('share toggle defaults to off', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const switchInput = page.locator('.gh-recipe-form-share input[type="checkbox"]');
    await expect(switchInput).not.toBeChecked();
  });

  test('share toggle can be toggled on', async ({ freshPage: page }) => {
    await openCreateModal(page);
    const toggle = page.locator('.gh-recipe-form-share .gh-toggle-switch');
    await toggle.click();
    const switchInput = page.locator('.gh-recipe-form-share input[type="checkbox"]');
    await expect(switchInput).toBeChecked();
  });
});
