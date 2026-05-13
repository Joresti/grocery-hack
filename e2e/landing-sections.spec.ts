import { seedUserTest, freshUserTest, expect } from './fixtures';

/**
 * Feature: Landing Page Section Structure
 *
 * Hard assertions that all spec'd sections exist on the landing page.
 * If any section is missing, the test FAILS — no conditional skipping.
 *
 * Section order (specs/landing-page.md + specs/recipe-upload-frontend.md):
 *   Header
 *   Primary Actions
 *   Deal Alert Banner
 *   Your Recipes on Sale
 *   Dream Meal Matching
 *   My Recipes
 *   Liked Meals Preview
 *   Store Meal Deal List (Shopping List)
 *   Notable Deals
 */

seedUserTest.describe('Landing page — all sections present (seed user)', () => {
  seedUserTest('header is visible with logo and savings', async ({ seedPage: page }) => {
    const header = page.locator('.gh-header');
    await expect(header).toBeVisible();
    await expect(header.locator('.gh-header-logo')).toContainText('GroceryHack');
  });

  seedUserTest('primary action buttons are all visible', async ({ seedPage: page }) => {
    await expect(page.locator('.gh-actions-row')).toBeVisible();
    await expect(page.getByRole('button', { name: /Optimize/i })).toBeVisible();
    await expect(page.locator('.gh-feeling-lucky-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: /Shopping List/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Staples/i })).toBeVisible();
  });

  seedUserTest('Deal Alert Banner is visible with watchlist deals', async ({ seedPage: page }) => {
    const banner = page.locator('.gh-deal-alert-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/deal/i);
  });

  seedUserTest('Dream Meal Matching section is visible with swipe card', async ({ seedPage: page }) => {
    const section = page.locator('.gh-dream-meal-matching');
    await expect(section).toBeVisible();
    await expect(section.locator('.gh-meal-card')).toBeVisible();
  });

  seedUserTest('My Recipes section is visible with recipe cards', async ({ seedPage: page }) => {
    const section = page.locator('.gh-my-recipes');
    await expect(section).toBeVisible();
    await expect(section.locator('.gh-my-recipes-title')).toContainText('My Recipes');
    await expect(section.locator('.gh-my-recipe-card').first()).toBeVisible();
  });

  seedUserTest('Liked Meals Preview is visible with meal cards', async ({ seedPage: page }) => {
    const section = page.locator('.gh-liked-meals-preview');
    await expect(section).toBeVisible();
    await expect(section).toContainText('Liked Meals');
  });

  seedUserTest('Store Meal Deal List (Shopping List) is visible', async ({ seedPage: page }) => {
    const section = page.locator('.gh-store-meal-deal-list');
    await expect(section).toBeVisible({ timeout: 5000 });
  });

  seedUserTest('Notable Deals section is visible with deal cards', async ({ seedPage: page }) => {
    const section = page.locator('.gh-notable-deals');
    await expect(section).toBeVisible({ timeout: 5000 });
  });
});

seedUserTest.describe('Landing page — section order (seed user)', () => {
  seedUserTest('sections appear in correct vertical order', async ({ seedPage: page }) => {
    const header = page.locator('.gh-header');
    const actions = page.locator('.gh-actions-row');
    const banner = page.locator('.gh-deal-alert-banner');
    const dreamMeal = page.locator('.gh-dream-meal-matching');
    const myRecipes = page.locator('.gh-my-recipes');
    const shoppingList = page.locator('.gh-store-meal-deal-list');

    // All must be visible
    await expect(header).toBeVisible();
    await expect(actions).toBeVisible();
    await expect(dreamMeal).toBeVisible();
    await expect(myRecipes).toBeVisible();

    // Check vertical ordering
    const headerY = (await header.boundingBox())!.y;
    const actionsY = (await actions.boundingBox())!.y;
    const bannerY = (await banner.boundingBox())!.y;
    const dreamY = (await dreamMeal.boundingBox())!.y;
    const recipesY = (await myRecipes.boundingBox())!.y;
    const shoppingY = (await shoppingList.boundingBox())!.y;

    expect(headerY).toBeLessThan(actionsY);
    expect(actionsY).toBeLessThan(bannerY);
    expect(bannerY).toBeLessThan(dreamY);
    expect(dreamY).toBeLessThan(recipesY);
    expect(recipesY).toBeLessThan(shoppingY);
  });
});

freshUserTest.describe('Landing page — fresh user has core sections', () => {
  freshUserTest('header and actions visible', async ({ freshPage: page }) => {
    await expect(page.locator('.gh-header')).toBeVisible();
    await expect(page.getByRole('button', { name: /Optimize/i })).toBeVisible();
  });

  freshUserTest('Dream Meal Matching visible', async ({ freshPage: page }) => {
    await expect(page.locator('.gh-dream-meal-matching')).toBeVisible();
  });

  freshUserTest('My Recipes section visible', async ({ freshPage: page }) => {
    await expect(page.locator('.gh-my-recipes')).toBeVisible();
  });
});

freshUserTest.describe('Landing page — anonymous user sees nothing', () => {
  freshUserTest('no app sections visible when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.gh-dream-meal-matching')).not.toBeVisible();
    await expect(page.locator('.gh-my-recipes')).not.toBeVisible();
    await expect(page.locator('.gh-store-meal-deal-list')).not.toBeVisible();
  });
});
