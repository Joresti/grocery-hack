import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../services/api';
import type { AuthResponse } from '@groceryhack/shared/types';

const pageStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing.containerPadding,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: '40px 32px',
  width: '100%',
  maxWidth: '400px',
};

const logoStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '1.65rem',
  fontWeight: fontWeights.bold,
  color: colors.primary,
  textAlign: 'center',
  marginBottom: '8px',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.9rem',
  color: colors.textMuted,
  textAlign: 'center',
  marginBottom: '32px',
};

const labelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.85rem',
  fontWeight: fontWeights.medium,
  color: colors.text,
  display: 'block',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: fonts.body,
  fontSize: '0.95rem',
  color: colors.text,
  backgroundColor: colors.white,
  border: `1.5px solid ${colors.border}`,
  borderRadius: radii.input,
  padding: '12px 14px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: fonts.body,
  fontSize: '0.95rem',
  fontWeight: fontWeights.semibold,
  color: colors.white,
  backgroundColor: colors.primary,
  border: 'none',
  borderRadius: radii.pill,
  padding: '14px',
  cursor: 'pointer',
  boxShadow: shadows.button,
  minHeight: spacing.touchTargetMin,
  transition: 'all 0.2s ease',
  marginTop: '24px',
};

const errorStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.85rem',
  color: colors.danger,
  backgroundColor: colors.dangerLight,
  padding: '10px 14px',
  borderRadius: radii.input,
  marginBottom: '16px',
};

const linkRowStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '20px',
  fontFamily: fonts.body,
  fontSize: '0.85rem',
  color: colors.textMuted,
};

const linkStyle: React.CSSProperties = {
  color: colors.primary,
  fontWeight: fontWeights.semibold,
  textDecoration: 'none',
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
};

export default function RegisterPage(): React.ReactElement {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        email,
        password,
        postal_code: postalCode,
      };
      if (displayName.trim()) body['display_name'] = displayName.trim();
      if (budget) body['budget'] = parseFloat(budget);

      const data = await api.post<AuthResponse>('/auth/register', body);
      login(data.token, data.refreshToken, data.user);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, displayName, postalCode, budget, login, navigate]);

  return (
    <div style={pageStyle}>
      <form style={cardStyle} onSubmit={handleSubmit}>
        <h1 style={logoStyle}>GroceryHack</h1>
        <p style={subtitleStyle}>Create your account</p>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="displayName">Name</label>
          <input
            id="displayName"
            type="text"
            style={inputStyle}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div style={rowStyle}>
          <div style={{ ...fieldGroupStyle, flex: 1 }}>
            <label style={labelStyle} htmlFor="postalCode">Postal Code</label>
            <input
              id="postalCode"
              type="text"
              style={inputStyle}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="L8P 1A1"
              required
              autoComplete="postal-code"
            />
          </div>
          <div style={{ ...fieldGroupStyle, flex: 1 }}>
            <label style={labelStyle} htmlFor="budget">Weekly Budget</label>
            <input
              id="budget"
              type="number"
              style={inputStyle}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="$100"
              min={0}
              step={5}
            />
          </div>
        </div>

        <button
          type="submit"
          style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <div style={linkRowStyle}>
          Already have an account?{' '}
          <Link to="/login" style={linkStyle}>Sign in</Link>
        </div>
      </form>
    </div>
  );
}
