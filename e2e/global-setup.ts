import fs from 'node:fs';
import path from 'node:path';

const API_URL = 'http://localhost:3000/api/v1';

/**
 * Global setup: registers a single fresh user for all freshUserTest fixtures.
 * Writes the tokens to a temp file so every test file can read them.
 */
async function globalSetup(): Promise<void> {
  const email = `e2e-shared-${Date.now()}@test.groceryhack.com`;
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'testpass123', postal_code: 'M5V 2T6' }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Global setup: registration failed — ${data.message}`);
  }

  const tokensPath = path.join(__dirname, '.e2e-tokens.json');
  fs.writeFileSync(tokensPath, JSON.stringify({
    token: data.token,
    refreshToken: data.refresh_token,
  }));

  // Save token separately for use by the edit recipe seeder
  const editRecipeSeedPath = path.join(__dirname, '.e2e-edit-recipe-seed.json');
  fs.writeFileSync(editRecipeSeedPath, JSON.stringify({ token: data.token }));

  // Seed a recipe for the edit tests (recipe-form-edit.spec.ts)
  await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
    body: JSON.stringify({
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
    }),
  });
}

export default globalSetup;
