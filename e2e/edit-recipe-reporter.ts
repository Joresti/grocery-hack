import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const API_URL = 'http://localhost:3000/api/v1';

const EDIT_RECIPE = {
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
 * Custom reporter that re-seeds "E2E Edit Test Recipe" after each test
 * in recipe-form-edit.spec.ts. This compensates for the recipeId fixture
 * not being auto-resolved by Playwright's lazy fixture resolution.
 */
class EditRecipeReporter implements Reporter {
  private async ensureRecipe(): Promise<void> {
    const tokensPath = path.join(__dirname, '.e2e-tokens.json');
    if (!fs.existsSync(tokensPath)) return;

    const { token } = JSON.parse(fs.readFileSync(tokensPath, 'utf-8')) as { token: string };

    const listRes = await fetch(`${API_URL}/recipes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) return;

    const { recipes } = (await listRes.json()) as { recipes: { id: string; name: string }[] };
    const matching = recipes.filter(r => r.name === 'E2E Edit Test Recipe');

    // Already have exactly one — nothing to do
    if (matching.length === 1) return;

    // Delete ALL recipes (duplicates, renamed, stale) and re-create exactly one
    for (const r of recipes) {
      await fetch(`${API_URL}/recipes/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    await fetch(`${API_URL}/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(EDIT_RECIPE),
    });

    // Small delay to ensure the DB write completes before the test navigates
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async onTestEnd(test: TestCase, _result: TestResult): Promise<void> {
    // Re-seed after every test to ensure the edit recipe survives
    // freshUserTest deletions in other test files
    if (!test.location.file.includes('recipe-')) return;
    await this.ensureRecipe();
  }
}

export default EditRecipeReporter;
