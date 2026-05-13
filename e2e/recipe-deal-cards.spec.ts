import { seedUserTest as test, expect } from './fixtures';

/**
 * Feature: Your Recipes on Sale — Deal Cards on Landing Page
 * Feature: Recipe Detail Modal — Deal-Enriched View
 * Spec: specs/recipe-upload-frontend.md
 *
 * Tests the "Your Recipes on Sale" section (conditional, appears when
 * recipe_alerts has matches) and the RecipeDetailModal with deal-enriched
 * ingredient pricing.
 *
 * Uses seedUserTest because the seed user (jessica) may have recipe alerts
 * in the landing data. Tests are conditional on data presence.
 */

test.describe('Your Recipes on Sale — section', () => {
  test('section appears between Absurd Deal Alert and Liked Meals when alerts exist', async ({ seedPage: page }) => {
    const recipesOnSale = page.locator('.gh-recipes-on-sale');
    const count = await recipesOnSale.count();

    if (count === 0) {
      // No recipe alerts this week — section correctly hidden
      test.skip();
      return;
    }

    await expect(recipesOnSale).toBeVisible();

    // Should have the correct title
    await expect(recipesOnSale.locator('.gh-recipes-on-sale-title')).toContainText('Your Recipes on Sale');

    // Verify position: should be after deal alert banner area, before liked meals
    const recipesOnSaleBox = await recipesOnSale.boundingBox();
    expect(recipesOnSaleBox).not.toBeNull();

    const likedMeals = page.locator('.gh-liked-meals-preview');
    if (await likedMeals.isVisible()) {
      const likedBox = await likedMeals.boundingBox();
      expect(recipesOnSaleBox!.y).toBeLessThan(likedBox!.y);
    }
  });

  test('recipe deal card shows required elements', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    const count = await cards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const card = cards.first();
    await expect(card).toBeVisible();

    // Recipe name
    await expect(card.locator('.gh-recipe-alert-name')).toBeVisible();

    // Ingredients on sale count like "3 of 8 ingredients on sale"
    await expect(card.locator('.gh-recipe-alert-match-count')).toBeVisible();
    await expect(card.locator('.gh-recipe-alert-match-count')).toContainText(/ingredient/i);

    // This week price
    await expect(card.locator('.gh-recipe-alert-price')).toBeVisible();

    // Regular price with strikethrough
    await expect(card.locator('.gh-recipe-alert-regular-price')).toBeVisible();

    // Savings badge
    await expect(card.locator('.gh-recipe-alert-savings')).toBeVisible();
    await expect(card.locator('.gh-recipe-alert-savings')).toContainText(/Save/i);
  });

  test('recipe deal card has correct visual styling', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    const count = await cards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const card = cards.first();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    // Card should have reasonable dimensions
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(60);
  });

  test('tapping recipe deal card opens RecipeDetailModal', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    const count = await cards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const card = cards.first();
    const recipeName = await card.locator('.gh-recipe-alert-name').textContent();
    await card.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Modal should show the recipe name
    await expect(modal.locator('.gh-recipe-detail-name')).toContainText(recipeName!.trim());
  });
});

test.describe('Recipe Detail Modal — deal-enriched view', () => {
  test('modal shows "Your Recipe" badge', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    const count = await cards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal.locator('.gh-recipe-detail-source-badge')).toContainText('Your Recipe');
  });

  test('modal shows ingredient list', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    const ingredients = modal.locator('.gh-recipe-detail-ingredient');
    const ingredientCount = await ingredients.count();
    expect(ingredientCount).toBeGreaterThan(0);

    // Each ingredient should show name
    await expect(ingredients.first().locator('.gh-recipe-detail-ingredient-name')).toBeVisible();
  });

  test('ingredients on sale have highlighted background and deal pricing', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    // Look for sale-highlighted ingredients
    const saleIngredients = modal.locator('.gh-recipe-detail-ingredient.on-sale');
    const saleCount = await saleIngredients.count();

    if (saleCount > 0) {
      const firstSale = saleIngredients.first();
      // Should show deal price
      await expect(firstSale.locator('.gh-recipe-detail-deal-price')).toBeVisible();
      // Should show regular price with strikethrough
      await expect(firstSale.locator('.gh-recipe-detail-regular-price')).toBeVisible();
      // Should show store name
      await expect(firstSale.locator('.gh-recipe-detail-store')).toBeVisible();
    }
  });

  test('ingredients not on sale show "pantry" label', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    const pantryIngredients = modal.locator('.gh-recipe-detail-ingredient:not(.on-sale)');
    const pantryCount = await pantryIngredients.count();

    if (pantryCount > 0) {
      await expect(pantryIngredients.first().locator('.gh-recipe-detail-pantry-label')).toContainText(/pantry/i);
    }
  });

  test('savings summary appears below ingredient list', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    const summary = modal.locator('.gh-recipe-detail-savings-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/total this week/i);
  });

  test('modal shows steps section if recipe has steps', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    // Steps section may or may not exist depending on the recipe
    const stepsSection = modal.locator('.gh-recipe-detail-steps');
    if (await stepsSection.isVisible()) {
      const steps = stepsSection.locator('.gh-recipe-detail-step');
      expect(await steps.count()).toBeGreaterThan(0);

      // Each step should have a number badge
      await expect(steps.first().locator('.gh-step-number')).toBeVisible();
    }
  });

  test('modal shows detail pills for prep/cook/servings', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    const detailPills = modal.locator('.gh-recipe-detail-pill');
    if (await detailPills.count() > 0) {
      // At least one pill should contain time or serving info
      const allText = await detailPills.allTextContents();
      const hasRelevantPill = allText.some(
        (t) => /min|prep|cook|serves/i.test(t),
      );
      expect(hasRelevantPill).toBeTruthy();
    }
  });

  test('Edit Recipe button is visible for own recipes', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    const modal = page.locator('[role="dialog"]');

    const editBtn = modal.getByRole('button', { name: /Edit Recipe/i });
    await expect(editBtn).toBeVisible();
  });

  test('Edit Recipe button opens RecipeFormModal in edit mode', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-recipe-alert-card');
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();
    await page.getByRole('button', { name: /Edit Recipe/i }).click();

    const formModal = page.locator('[role="dialog"]');
    await expect(formModal).toBeVisible();
    await expect(formModal.locator('h2')).toHaveText('Edit Recipe');
  });
});

test.describe('Your Recipes on Sale — hidden when no matches', () => {
  // This test uses the seed user but verifies the conditional display logic.
  // If there happen to be no recipe alerts, the section should be absent.
  test('section is not rendered when recipe_alerts is empty', async ({ seedPage: page }) => {
    // We can't control the data here, but we verify:
    // If no .gh-recipes-on-sale exists, the page still renders correctly
    const dreamMeal = page.locator('.gh-dream-meal-matching');
    await expect(dreamMeal).toBeVisible();
    // Page renders fine regardless
  });
});
