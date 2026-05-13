import fs from 'node:fs';
import path from 'node:path';

const API_URL = 'http://localhost:3000/api/v1';

const EDIT_RECIPE_DATA = {
  name: 'E2E Edit Test Recipe',
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
};

/**
 * Ensures exactly one recipe named "E2E Edit Test Recipe" exists for the
 * shared fresh user. Called before each test in recipe-form-edit.spec.ts
 * via the Playwright config's use.storageState hook.
 */
export async function ensureEditRecipe(): Promise<void> {
  const tokensPath = path.join(__dirname, '.e2e-tokens.json');
  if (!fs.existsSync(tokensPath)) return;

  const { token } = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  // List current recipes
  const listRes = await fetch(`${API_URL}/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return;

  const { recipes } = await listRes.json();
  const existing = (recipes as { id: string; name: string }[]).find(
    (r) => r.name === 'E2E Edit Test Recipe'
  );

  if (existing) return; // Recipe already exists with correct name

  // Delete any recipe with a modified name from the edit test
  for (const recipe of recipes as { id: string; name: string }[]) {
    if (recipe.name === 'E2E Edited Recipe Name') {
      await fetch(`${API_URL}/recipes/${recipe.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  // Create the recipe
  await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(EDIT_RECIPE_DATA),
  });
}

export default ensureEditRecipe;
