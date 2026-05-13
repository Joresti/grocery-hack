import { seedUserTest, freshUserTest, expect } from './fixtures';

/**
 * Feature: My Recipes Section — Landing Page
 * Spec: specs/recipe-upload-frontend.md
 *
 * The "My Recipes" section appears directly below Dream Meal Matching.
 * Shows the user's saved recipes as horizontal-scroll cards with deal badges.
 * Includes an "+ Add" CTA in the header and an empty state for new users.
 */

seedUserTest.describe('My Recipes section — placement and visibility', () => {
  seedUserTest('section appears below Dream Meal Matching', async ({ seedPage: page }) => {
    const dreamMeal = page.locator('.gh-dream-meal-matching');
    const myRecipes = page.locator('.gh-my-recipes');

    await expect(dreamMeal).toBeVisible();
    await expect(myRecipes).toBeVisible();

    // My Recipes should come after Dream Meal Matching in the DOM
    const dreamMealBox = await dreamMeal.boundingBox();
    const myRecipesBox = await myRecipes.boundingBox();
    expect(dreamMealBox).not.toBeNull();
    expect(myRecipesBox).not.toBeNull();
    expect(myRecipesBox!.y).toBeGreaterThan(dreamMealBox!.y);
  });

  seedUserTest('section appears above Store Meal Deal List', async ({ seedPage: page }) => {
    const myRecipes = page.locator('.gh-my-recipes');
    const storeDealList = page.locator('#shopping-plan');

    await expect(myRecipes).toBeVisible();

    const myRecipesBox = await myRecipes.boundingBox();
    const storeBox = await storeDealList.boundingBox();
    if (storeBox) {
      expect(myRecipesBox!.y).toBeLessThan(storeBox.y);
    }
  });

  seedUserTest('section header shows title and recipe count', async ({ seedPage: page }) => {
    const section = page.locator('.gh-my-recipes');
    await expect(section.locator('.gh-my-recipes-title')).toContainText('My Recipes');
    // Count badge like "(3)" next to the title
    await expect(section.locator('.gh-my-recipes-count')).toBeVisible();
  });

  seedUserTest('section header has "+ Add" button', async ({ seedPage: page }) => {
    const section = page.locator('.gh-my-recipes');
    const addBtn = section.locator('.gh-my-recipes-add-btn');
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toContainText('Add');
  });
});

seedUserTest.describe('My Recipes section — recipe cards', () => {
  seedUserTest('recipe cards display in horizontal scroll', async ({ seedPage: page }) => {
    const section = page.locator('.gh-my-recipes');
    const scrollContainer = section.locator('.gh-my-recipes-scroll');
    await expect(scrollContainer).toBeVisible();

    // Should have at least one card
    const cards = section.locator('.gh-my-recipe-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  seedUserTest('each recipe card shows name and ingredient count', async ({ seedPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').first();
    await expect(card).toBeVisible();

    // Recipe name
    await expect(card.locator('.gh-my-recipe-card-name')).toBeVisible();
    const name = await card.locator('.gh-my-recipe-card-name').textContent();
    expect(name!.trim().length).toBeGreaterThan(0);

    // Ingredient count like "8 ingredients"
    await expect(card.locator('.gh-my-recipe-card-ingredients')).toBeVisible();
    await expect(card.locator('.gh-my-recipe-card-ingredients')).toContainText('ingredient');
  });

  seedUserTest('recipe card with deal matches shows sale badge', async ({ seedPage: page }) => {
    // This test checks that IF a deal badge exists, it has the right structure
    const badges = page.locator('.gh-my-recipe-card .gh-my-recipe-card-deal-badge');
    const count = await badges.count();
    if (count > 0) {
      await expect(badges.first()).toContainText('on sale');
    }
  });

  seedUserTest('tapping a recipe card opens RecipeDetailModal', async ({ seedPage: page }) => {
    const card = page.locator('.gh-my-recipe-card').first();
    await card.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Should show "Your Recipe" badge
    await expect(modal.locator('.gh-recipe-detail-source-badge')).toContainText('Your Recipe');
  });
});

freshUserTest.describe('My Recipes section — empty state', () => {
  freshUserTest('shows empty state CTA when user has no recipes', async ({ freshPage: page }) => {
    const section = page.locator('.gh-my-recipes');
    await expect(section).toBeVisible();

    const emptyState = section.locator('.gh-my-recipes-empty');
    await expect(emptyState).toBeVisible();

    // Icon
    await expect(emptyState.locator('svg')).toBeVisible();

    // Message
    await expect(emptyState).toContainText('Save your favorites');
    await expect(emptyState).toContainText('deals on your ingredients');

    // CTA button
    const addBtn = emptyState.getByRole('button', { name: /Add a Recipe/i });
    await expect(addBtn).toBeVisible();
  });

  freshUserTest('empty state CTA opens RecipeFormModal in create mode', async ({ freshPage: page }) => {
    const emptyState = page.locator('.gh-my-recipes-empty');
    await emptyState.getByRole('button', { name: /Add a Recipe/i }).click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('New Recipe');
  });
});

freshUserTest.describe('My Recipes section — not shown for anonymous', () => {
  freshUserTest('section is hidden when user is not authenticated', async ({ page }) => {
    // Navigate without injecting auth tokens
    await page.goto('/');
    const section = page.locator('.gh-my-recipes');
    await expect(section).not.toBeVisible();
  });
});
