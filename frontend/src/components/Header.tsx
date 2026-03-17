import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { SavingsCounter } from './shared/SavingsCounter';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';

interface HeaderProps {
  savingsThisWeek?: number;
  savingsYtd?: number;
}

export function Header({ savingsThisWeek = 0, savingsYtd = 0 }: HeaderProps): React.ReactElement {
  const { user } = useAuth();
  const displayName = user?.displayName || 'there';

  return (
    <>
      <style>{`
        .gh-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: ${colors.white};
          border-bottom: 1px solid ${colors.border};
          padding: 14px ${spacing.containerPadding} 12px;
        }
        .gh-header-inner {
          max-width: ${spacing.containerMaxWidth};
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .gh-header-logo {
          font-family: ${fonts.heading};
          font-size: 1.4rem;
          font-weight: ${fontWeights.bold};
          color: ${colors.primary};
          letter-spacing: -0.5px;
          margin: 0;
          line-height: 1.2;
          white-space: nowrap;
        }
        .gh-header-logo-hack {
          letter-spacing: -2.5px;
        }
        .gh-header-greeting {
          font-family: ${fonts.body};
          font-size: 0.8rem;
          font-weight: ${fontWeights.regular};
          color: ${colors.textMuted};
          margin-top: 1px;
        }
        .gh-header-savings {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }
        .gh-header-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background-color: ${colors.primaryLight};
          border-radius: ${radii.pill};
          padding: 5px 12px;
          white-space: nowrap;
        }
        .gh-header-badge-label {
          font-family: ${fonts.body};
          font-size: 0.7rem;
          font-weight: ${fontWeights.medium};
          color: ${colors.textMuted};
        }
        .gh-header-badge-value {
          font-family: ${fonts.heading};
          font-size: 0.85rem;
          font-weight: ${fontWeights.bold};
          color: ${colors.primary};
        }

        /* Tablet and small phones */
        @media (max-width: 375px) {
          .gh-header {
            padding: 10px 14px 8px;
          }
          .gh-header-inner {
            gap: 8px;
          }
          .gh-header-logo {
            font-size: 1.15rem;
          }
          .gh-header-greeting {
            font-size: 0.75rem;
          }
          .gh-header-savings {
            gap: 4px;
          }
          .gh-header-badge {
            padding: 4px 8px;
            gap: 3px;
          }
          .gh-header-badge-label {
            font-size: 0.75rem;
          }
          .gh-header-badge-value {
            font-size: 0.8rem;
          }
        }
        @media (max-width: 320px) {
          .gh-header-logo {
            font-size: 1.05rem;
          }
          .gh-header-greeting {
            display: none;
          }
          .gh-header-badge {
            padding: 3px 6px;
          }
          .gh-header-badge-label {
            font-size: 0.75rem;
          }
          .gh-header-badge-value {
            font-size: 0.8rem;
          }
        }
      `}</style>
      <header className="gh-header">
        <div className="gh-header-inner">
          <div className="gh-header-left">
            <h1 className="gh-header-logo">
              Grocery<span className="gh-header-logo-hack">Hack</span>
            </h1>
            <p className="gh-header-greeting">Hey {displayName}!</p>
          </div>

          <div className="gh-header-savings">
            <div className="gh-header-badge">
              <span className="gh-header-badge-label">Week</span>
              <span className="gh-header-badge-value">
                <SavingsCounter value={savingsThisWeek} prefix="$" />
              </span>
            </div>
            <div className="gh-header-badge">
              <span className="gh-header-badge-label">Year</span>
              <span className="gh-header-badge-value">
                <SavingsCounter value={savingsYtd} prefix="$" />
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
