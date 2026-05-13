import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api/v1';

const SEED_USER = {
  email: 'jessica@test.groceryhack.com',
  password: 'testpassword123',
};

interface AuthTokens {
  token: string;
  refreshToken: string;
}

async function loginViaApi(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${data.message}`);
  return { token: data.token, refreshToken: data.refresh_token };
}

function readSharedTokens(): AuthTokens {
  const tokensPath = path.join(__dirname, '.e2e-tokens.json');
  const raw = fs.readFileSync(tokensPath, 'utf-8');
  return JSON.parse(raw) as AuthTokens;
}

async function resetUserSettings(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      household_members: [],
      dietary_restrictions: [],
      cooking_effort: 'moderate',
      max_stores: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`Reset failed: ${(await res.json()).message}`);
  }
}

async function injectAuth(page: Page, tokens: AuthTokens): Promise<void> {
  await page.evaluate(({ token, refreshToken }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  }, tokens);
}

/** Navigate and wait for header, with one retry on failure */
async function loadLandingPage(page: Page, tokens: AuthTokens): Promise<void> {
  await page.goto('/');
  await injectAuth(page, tokens);
  await page.goto('/');
  try {
    await page.waitForSelector('.gh-header', { timeout: 10000 });
  } catch {
    // Retry once — reload the page
    await page.reload();
    await page.waitForSelector('.gh-header', { timeout: 15000 });
  }
}

async function ensureSeedRecipes(token: string): Promise<string[]> {
  // Check if jessica already has recipes
  const listRes = await fetch(`${API_URL}/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json();
  if (listData.recipes && listData.recipes.length > 0) {
    return []; // already has recipes, nothing to clean up
  }

  // Create seed recipes so recipe-related tests have data
  const recipes = [
    {
      name: 'Jessica\'s Chicken Stir Fry',
      ingredients: [
        { name: 'Chicken breast', quantity: '500', unit: 'g' },
        { name: 'Broccoli', quantity: '2', unit: 'cups' },
        { name: 'Soy sauce', quantity: '3', unit: 'tbsp' },
        { name: 'Garlic', quantity: '3', unit: 'cloves' },
        { name: 'Rice', quantity: '2', unit: 'cups' },
      ],
      steps: ['Dice the chicken', 'Stir fry with vegetables', 'Add sauce and serve over rice'],
      prep_time_minutes: 15,
      cook_time_minutes: 20,
      servings: 4,
      dietary_tags: ['High-Protein', 'Dairy-Free'],
      tips: 'Use sesame oil for extra flavor',
    },
    {
      name: 'Simple Veggie Pasta',
      ingredients: [
        { name: 'Pasta', quantity: '400', unit: 'g' },
        { name: 'Zucchini', quantity: '2', unit: 'medium' },
        { name: 'Cherry tomatoes', quantity: '1', unit: 'cup' },
        { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
        { name: 'Parmesan', quantity: '50', unit: 'g' },
      ],
      steps: ['Boil pasta', 'Sauté vegetables', 'Combine and top with cheese'],
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 4,
      dietary_tags: ['Vegetarian'],
    },
  ];

  const createdIds: string[] = [];
  for (const recipe of recipes) {
    const res = await fetch(`${API_URL}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(recipe),
    });
    if (res.ok) {
      const data = await res.json();
      createdIds.push(data.id as string);
    }
  }
  return createdIds;
}

async function cleanupSeedRecipes(token: string, ids: string[]): Promise<void> {
  for (const id of ids) {
    await fetch(`${API_URL}/recipes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

/**
 * Fixture: logs in as the seed user (jessica) who has a weekly plan,
 * liked meals, deals, etc. — full landing page content.
 */
export const seedUserTest = base.extend<{ seedPage: Page }>({
  seedPage: async ({ page }, use) => {
    const tokens = await loginViaApi(SEED_USER.email, SEED_USER.password);
    const seededIds = await ensureSeedRecipes(tokens.token);
    await loadLandingPage(page, tokens);
    await use(page);
    await cleanupSeedRecipes(tokens.token, seededIds);
  },
});

async function deleteAllUserRecipes(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  const recipes = data.recipes as { id: string }[];
  for (const recipe of recipes) {
    await fetch(`${API_URL}/recipes/${recipe.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

/**
 * Fixture: uses the shared fresh user (registered in globalSetup).
 * Resets settings to defaults and deletes all recipes before each test.
 */
export const freshUserTest = base.extend<{ freshPage: Page }>({
  freshPage: async ({ page }, use) => {
    const tokens = readSharedTokens();
    await resetUserSettings(tokens.token);
    await deleteAllUserRecipes(tokens.token);
    await loadLandingPage(page, tokens);
    await use(page);
  },
});

export { expect };
