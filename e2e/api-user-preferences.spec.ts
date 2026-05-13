import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000/api/v1';

async function registerUser(): Promise<{ token: string; refreshToken: string }> {
  const email = `api-test-${Date.now()}@test.groceryhack.com`;
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'testpass123', postal_code: 'M5V 2T6' }),
  });
  const data = await res.json();
  return { token: data.token, refreshToken: data.refresh_token };
}

async function patchUser(token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getUser(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

test.describe('API — User preferences (PATCH /users/me)', () => {
  test('new user has default cooking_effort and empty kid_age_brackets', async () => {
    const { token } = await registerUser();
    const user = await getUser(token);

    expect(user.cooking_effort).toBe('moderate');
    expect(user.kid_age_brackets).toEqual([]);
    expect(user.household_size).toBe(1);
    expect(user.household_members).toEqual([]);
  });

  test('PATCH cooking_effort to quick', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, { cooking_effort: 'quick' });

    expect(user.cooking_effort).toBe('quick');
  });

  test('PATCH cooking_effort to ambitious', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, { cooking_effort: 'ambitious' });

    expect(user.cooking_effort).toBe('ambitious');
  });

  test('PATCH household_members auto-derives household_names', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, {
      household_members: [
        { name: 'Lily', age_bracket: 'picky_2_5', dietary_restrictions: [] },
        { name: 'Tom', age_bracket: 'adult', dietary_restrictions: [] },
      ],
    });

    expect(user.household_names).toEqual(['Lily', 'Tom']);
  });

  test('PATCH household_members auto-derives household_size (+1 for user)', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, {
      household_members: [
        { name: 'A', age_bracket: 'adult', dietary_restrictions: [] },
        { name: 'B', age_bracket: 'adult', dietary_restrictions: [] },
      ],
    });

    expect(user.household_size).toBe(3); // 2 members + user
  });

  test('PATCH household_members auto-derives kid_age_brackets', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, {
      household_members: [
        { name: 'Baby', age_bracket: 'under_2', dietary_restrictions: [] },
        { name: 'Lily', age_bracket: 'picky_2_5', dietary_restrictions: [] },
        { name: 'Tom', age_bracket: 'adult', dietary_restrictions: [] },
      ],
    });

    expect(user.kid_age_brackets).toContain('under_2');
    expect(user.kid_age_brackets).toContain('picky_2_5');
    expect(user.kid_age_brackets).not.toContain('adult');
  });

  test('PATCH household_members deduplicates kid_age_brackets', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, {
      household_members: [
        { name: 'Kid1', age_bracket: 'picky_2_5', dietary_restrictions: [] },
        { name: 'Kid2', age_bracket: 'picky_2_5', dietary_restrictions: [] },
      ],
    });

    expect(user.kid_age_brackets).toEqual(['picky_2_5']);
  });

  test('PATCH dietary_restrictions persists array', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, {
      dietary_restrictions: ['vegan', 'gluten-free'],
    });

    expect(user.dietary_restrictions).toContain('vegan');
    expect(user.dietary_restrictions).toContain('gluten-free');
  });

  test('PATCH max_stores to 2', async () => {
    const { token } = await registerUser();
    const user = await patchUser(token, { max_stores: 2 });

    expect(user.max_stores).toBe(2);
  });

  test('landing endpoint returns new user fields', async () => {
    const { token } = await registerUser();

    // Set some preferences first
    await patchUser(token, {
      cooking_effort: 'quick',
      household_members: [
        { name: 'Lily', age_bracket: 'picky_2_5', dietary_restrictions: ['dairy-free'] },
      ],
    });

    const res = await fetch(`${API_URL}/landing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    expect(data.user.cooking_effort).toBe('quick');
    expect(data.user.kid_age_brackets).toEqual(['picky_2_5']);
    expect(data.user.household_size).toBe(2);
  });
});
