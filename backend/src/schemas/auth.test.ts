import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.js';

describe('registerSchema', () => {
  it('accepts valid input and transforms to camelCase', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.postalCode).toBe('L8P 1A1');
    // Should not have snake_case keys
    expect((result as Record<string, unknown>).postal_code).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      display_name: 'Test User',
      budget: 100,
      dietary_restrictions: ['vegetarian'],
      max_stores: 2,
      household_size: 4,
    });
    expect(result.displayName).toBe('Test User');
    expect(result.budget).toBe(100);
    expect(result.dietaryRestrictions).toEqual(['vegetarian']);
    expect(result.maxStores).toBe(2);
    expect(result.householdSize).toBe(4);
  });

  it('rejects missing email', () => {
    expect(() => registerSchema.parse({
      password: 'password123',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('rejects missing password', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('rejects missing postal_code', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
    })).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() => registerSchema.parse({
      email: 'not-an-email',
      password: 'password123',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('rejects empty string email', () => {
    expect(() => registerSchema.parse({
      email: '',
      password: 'password123',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('rejects password shorter than 8 chars', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'short',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('rejects password of exactly 7 chars', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'abcdefg',
      postal_code: 'L8P 1A1',
    })).toThrow();
  });

  it('accepts password of exactly 8 chars', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'abcdefgh',
      postal_code: 'L8P 1A1',
    });
    expect(result.password).toBe('abcdefgh');
  });

  it('rejects invalid max_stores value', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      max_stores: 3,
    })).toThrow();
  });

  it('rejects max_stores of 0', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      max_stores: 0,
    })).toThrow();
  });

  it('accepts max_stores of 1', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      max_stores: 1,
    });
    expect(result.maxStores).toBe(1);
  });

  it('accepts max_stores of 2', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      max_stores: 2,
    });
    expect(result.maxStores).toBe(2);
  });

  it('leaves maxStores undefined when not provided', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
    });
    expect(result.maxStores).toBeUndefined();
  });

  it('leaves householdSize undefined when not provided', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
    });
    expect(result.householdSize).toBeUndefined();
  });

  it('rejects household_size below 1', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      household_size: 0,
    })).toThrow();
  });

  it('rejects household_size above 12', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      household_size: 13,
    })).toThrow();
  });

  it('rejects non-integer household_size', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      household_size: 2.5,
    })).toThrow();
  });

  it('rejects negative budget', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      budget: -10,
    })).toThrow();
  });

  it('rejects zero budget', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'L8P 1A1',
      budget: 0,
    })).toThrow();
  });

  it('rejects postal_code shorter than 3 chars', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: 'AB',
    })).toThrow();
  });

  it('rejects postal_code longer than 10 chars', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      postal_code: '12345678901',
    })).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.parse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password123');
  });

  it('rejects missing email', () => {
    expect(() => loginSchema.parse({ password: 'password123' })).toThrow();
  });

  it('rejects missing password', () => {
    expect(() => loginSchema.parse({ email: 'test@example.com' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => loginSchema.parse({ email: 'bad', password: 'password123' })).toThrow();
  });

  it('rejects empty password', () => {
    expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
  });

  it('transforms to camelCase', () => {
    const result = loginSchema.parse({
      email: 'test@example.com',
      password: 'x',
    });
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('password');
  });
});

describe('refreshSchema', () => {
  it('accepts valid input and transforms to camelCase', () => {
    const result = refreshSchema.parse({ refresh_token: 'some-token' });
    expect(result.refreshToken).toBe('some-token');
    expect((result as Record<string, unknown>).refresh_token).toBeUndefined();
  });

  it('rejects missing refresh_token', () => {
    expect(() => refreshSchema.parse({})).toThrow();
  });

  it('rejects empty refresh_token', () => {
    expect(() => refreshSchema.parse({ refresh_token: '' })).toThrow();
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    const result = forgotPasswordSchema.parse({ email: 'test@example.com' });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects invalid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'bad' })).toThrow();
  });

  it('rejects empty email', () => {
    expect(() => forgotPasswordSchema.parse({ email: '' })).toThrow();
  });

  it('rejects missing email', () => {
    expect(() => forgotPasswordSchema.parse({})).toThrow();
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid input and transforms to camelCase', () => {
    const result = resetPasswordSchema.parse({
      token: 'reset-token-123',
      new_password: 'newpass123',
    });
    expect(result.token).toBe('reset-token-123');
    expect(result.newPassword).toBe('newpass123');
    expect((result as Record<string, unknown>).new_password).toBeUndefined();
  });

  it('rejects short new_password', () => {
    expect(() => resetPasswordSchema.parse({
      token: 'reset-token-123',
      new_password: 'short',
    })).toThrow();
  });

  it('rejects missing token', () => {
    expect(() => resetPasswordSchema.parse({
      new_password: 'newpass123',
    })).toThrow();
  });

  it('rejects empty token', () => {
    expect(() => resetPasswordSchema.parse({
      token: '',
      new_password: 'newpass123',
    })).toThrow();
  });

  it('rejects missing new_password', () => {
    expect(() => resetPasswordSchema.parse({
      token: 'reset-token-123',
    })).toThrow();
  });
});
