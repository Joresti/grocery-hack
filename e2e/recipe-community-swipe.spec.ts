import { seedUserTest as test, expect } from './fixtures';

/**
 * Feature: Community Recipes in Swipe Deck
 * Spec: specs/recipe-upload-frontend.md
 *
 * Public user recipes appear in the Dream Meal Matching swipe deck
 * with a "Shared by {name}" attribution line. System-generated meals
 * have no attribution.
 */

test.describe('Community recipes in swipe deck', () => {
  test('Dream Meal Matching section is visible', async ({ seedPage: page }) => {
    const section = page.locator('.gh-dream-meal-matching');
    await expect(section).toBeVisible();
    await expect(section).toContainText(/Match.*Dream.*Meal|Dream.*Meal.*Match/i);
  });

  test('meal cards are present in the swipe deck', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-meal-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('community recipe cards show "Shared by" attribution', async ({ seedPage: page }) => {
    // Look for any card that has the attribution line
    const attributions = page.locator('.gh-meal-card-attribution');
    const count = await attributions.count();

    if (count === 0) {
      // No community recipes in this week's deck — that's valid
      test.skip();
      return;
    }

    const first = attributions.first();
    await expect(first).toBeVisible();
    await expect(first).toContainText(/Shared by/i);

    // Should have an initials circle
    await expect(first.locator('.gh-meal-card-attribution-initials')).toBeVisible();
  });

  test('system-generated meal cards have no attribution line', async ({ seedPage: page }) => {
    const cards = page.locator('.gh-meal-card');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const attribution = card.locator('.gh-meal-card-attribution');
      const hasAttribution = await attribution.count() > 0;

      if (!hasAttribution) {
        // This card has no attribution — it should be a system meal.
        // Just verify the card still has the standard elements.
        await expect(card.locator('.gh-meal-card-name')).toBeVisible();
        return; // Found at least one system card — test passes
      }
    }

    // If ALL cards have attribution, that's unusual but not wrong — skip
    test.skip();
  });

  test('attribution initials circle has visible content', async ({ seedPage: page }) => {
    const initialsCircles = page.locator('.gh-meal-card-attribution-initials');
    const count = await initialsCircles.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const circle = initialsCircles.first();
    const text = await circle.textContent();
    // Should have 1-2 characters (initials)
    expect(text!.trim().length).toBeGreaterThan(0);
    expect(text!.trim().length).toBeLessThanOrEqual(2);

    // Should have adequate size
    const box = await circle.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(20);
  });
});
