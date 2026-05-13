import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Feature: RecipeFormModal — edit mode and delete flow
 * Spec: specs/recipe-upload-frontend.md
 *
 * These tests create a recipe via API, then test edit mode UI,
 * save changes flow, and the delete confirmation dialog.
 */

const API_URL = 'http://localhost:3000/api/v1';

interface AuthTokens {
  token: string;
  refreshToken: string;
}

function readSharedTokens(): AuthTokens {
  const tokensPath = path.join(__dirname, '.e2e-tokens.json');
  const raw = fs.readFileSync(tokensPath, 'utf-8');
  return JSON.parse(raw) as AuthTokens;
}

async function createRecipeViaApi(token: string, name: string): Promise<string> {
  const res = await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      ingredients: [
        { name: 'Test ingredient', quantity: '1', unit: 'cup' },
        { name: 'Another ingredient', quantity: '2', unit: 'tbsp' },
      ],
      steps: ['Step one', 'Step two'],
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 4,
      dietary_tags: ['Vegetarian'],
      tips: 'A test note',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create recipe failed: ${data.message}`);
  return data.id;
}

async function deleteRecipeViaApi(token: string, recipeId: string): Promise<void> {
  await fetch(`${API_URL}/recipes/${recipeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function injectAuthAndNavigate(page: Page, tokens: AuthTokens): Promise<void> {
  await page.goto('/');
  await page.evaluate(({ token, refreshToken }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  }, tokens);
  await page.goto('/');
  try {
    await page.waitForSelector('.gh-header', { timeout: 10000 });
  } catch {
    await page.reload();
    await page.waitForSelector('.gh-header', { timeout: 15000 });
  }
}

const test = base.extend<{ editPage: Page; recipeId: string; tokens: AuthTokens }>({
  tokens: async ({}, use) => {
    use(readSharedTokens());
  },
  recipeId: async ({ tokens }, use) => {
    const id = await createRecipeViaApi(tokens.token, 'E2E Edit Test Recipe');
    await use(id);
    // Cleanup: try to delete after test (may already be deleted)
    await deleteRecipeViaApi(tokens.token, id).catch(() => {});
  },
  editPage: async ({ page, tokens }, use) => {
    await injectAuthAndNavigate(page, tokens);
    await use(page);
  },
});

test.describe('RecipeFormModal — edit mode', () => {
  test('tapping a recipe card opens edit modal with "Edit Recipe" title', async ({ editPage: page }) => {
    // Find and tap the recipe card
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // Detail modal should open first — click edit button
    const detailModal = page.locator('[role="dialog"]');
    await expect(detailModal).toBeVisible();

    const editBtn = detailModal.getByRole('button', { name: /Edit Recipe/i });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Edit form modal should now be open
    const formModal = page.locator('[role="dialog"]');
    await expect(formModal).toBeVisible();
    await expect(formModal.locator('h2')).toHaveText('Edit Recipe');
  });

  test('edit mode pre-fills all fields from existing recipe', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    const modal = page.locator('[role="dialog"]');

    // Name should be pre-filled
    await expect(modal.locator('.gh-recipe-form-name input')).toHaveValue('E2E Edit Test Recipe');

    // Should have 2 ingredient rows
    await expect(modal.locator('.gh-ingredient-row')).toHaveCount(2);
    await expect(modal.locator('.gh-ingredient-row').first().locator('input[placeholder*="Ingredient" i]')).toHaveValue('Test ingredient');

    // Should have 2 step rows
    await expect(modal.locator('.gh-step-row')).toHaveCount(2);

    // Details should be filled
    const numberInputs = modal.locator('.gh-recipe-form-details input[type="number"]');
    await expect(numberInputs.nth(0)).toHaveValue('10');
    await expect(numberInputs.nth(1)).toHaveValue('20');
    await expect(numberInputs.nth(2)).toHaveValue('4');

    // Vegetarian tag should be active
    const vegTag = modal.locator('.gh-dietary-tag').filter({ hasText: 'Vegetarian' });
    await expect(vegTag).toHaveClass(/active/);
  });

  test('URL import section is NOT shown in edit mode', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    await expect(page.locator('.gh-recipe-form-import')).not.toBeVisible();
  });

  test('edit mode shows Delete and Save Changes buttons', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    const deleteBtn = page.getByRole('button', { name: /Delete Recipe/i });
    const saveBtn = page.getByRole('button', { name: /Save Changes/i });

    await expect(deleteBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();
  });

  test('editing name and saving updates the recipe', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    // Change the name
    const nameInput = page.locator('.gh-recipe-form-name input');
    await nameInput.clear();
    await nameInput.fill('E2E Edited Recipe Name');

    await page.getByRole('button', { name: /Save Changes/i }).click();

    // Modal should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Toast
    await expect(page.locator('.gh-toast')).toContainText(/Recipe saved|Changes saved/i);

    // Updated name should appear in My Recipes
    await expect(page.locator('.gh-my-recipe-card-name').filter({ hasText: 'E2E Edited Recipe Name' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('RecipeFormModal — delete flow', () => {
  test('delete button shows confirmation dialog', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    await page.getByRole('button', { name: /Delete Recipe/i }).click();

    // Confirmation dialog should appear
    const confirmDialog = page.locator('.gh-confirm-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Delete Recipe?');
    await expect(confirmDialog).toContainText("can't be undone");

    // Has Cancel and Delete buttons
    await expect(confirmDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('cancel in confirmation dialog returns to edit form', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();
    await page.getByRole('button', { name: /Delete Recipe/i }).click();

    const confirmDialog = page.locator('.gh-confirm-dialog');
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    // Confirmation should dismiss, edit form still open
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2')).toHaveText('Edit Recipe');
  });

  test('confirming delete removes recipe and closes modal', async ({ editPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' });
    await card.click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();
    await page.getByRole('button', { name: /Delete Recipe/i }).click();

    const confirmDialog = page.locator('.gh-confirm-dialog');
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    // Modal should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Toast
    await expect(page.locator('.gh-toast')).toContainText(/Recipe deleted/i);

    // Recipe should no longer appear in My Recipes
    await expect(page.locator('.gh-my-recipe-card').filter({ hasText: 'E2E Edit Test Recipe' })).not.toBeVisible({ timeout: 5000 });
  });
});
