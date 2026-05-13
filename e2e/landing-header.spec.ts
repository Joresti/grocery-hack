import { seedUserTest as test, expect } from './fixtures';

test.describe('Landing page — Header with settings icon', () => {
  test('header shows logo, greeting, savings badge, and settings icon', async ({ seedPage: page }) => {
    const header = page.locator('.gh-header');
    await expect(header).toBeVisible();

    // Logo
    await expect(header.locator('.gh-header-logo')).toContainText('GroceryHack');

    // Greeting
    await expect(header.locator('.gh-header-greeting')).toBeVisible();

    // Savings badge
    await expect(header.locator('.gh-header-savings-btn')).toBeVisible();

    // Settings icon (gear/sliders)
    await expect(header.locator('.gh-header-settings-btn')).toBeVisible();
    await expect(header.locator('.gh-header-settings-btn svg')).toBeVisible();
  });

  test('settings icon is in the right section of the header', async ({ seedPage: page }) => {
    const rightSection = page.locator('.gh-header-right');
    await expect(rightSection).toBeVisible();

    // Both savings badge and settings icon should be inside .gh-header-right
    await expect(rightSection.locator('.gh-header-savings-btn')).toBeVisible();
    await expect(rightSection.locator('.gh-header-settings-btn')).toBeVisible();
  });

  test('settings icon has proper touch target size', async ({ seedPage: page }) => {
    const settingsBtn = page.locator('.gh-header-settings-btn');
    const box = await settingsBtn.boundingBox();
    expect(box).not.toBeNull();
    // Minimum 44x44 touch target
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
