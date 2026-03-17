export const colors = {
  primary: '#3D7B7B',
  primaryLight: 'rgba(61, 123, 123, 0.08)',
  primaryShadow: 'rgba(61, 123, 123, 0.15)',
  primaryHover: '#356c6c',
  accent: '#C9A84C',
  accentLight: 'rgba(201, 168, 76, 0.12)',
  bg: '#FAF9F6',
  white: '#FFFFFF',
  text: '#2D2D2D',
  textMuted: '#5A5A5A',
  border: 'rgba(61, 123, 123, 0.12)',
  borderSubtle: 'rgba(61, 123, 123, 0.06)',
  greenBadgeBg: '#E6F4EA',
  greenBadgeText: '#1A7F37',
  danger: '#DC2626',
  dangerLight: 'rgba(220, 38, 38, 0.08)',
  success: '#1A7F37',
} as const;

export const fonts = {
  heading: "'Sora', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const radii = {
  card: '16px',
  pill: '99px',
  modal: '20px',
  input: '10px',
} as const;

export const spacing = {
  containerMaxWidth: '720px',
  containerPadding: '24px',
  containerPaddingTablet: '20px',
  containerPaddingMobile: '16px',
  headerPaddingTop: '28px',
  headerPaddingBottom: '20px',
  sectionPadding: '32px',
  actionBarGap: '12px',
  cardPadding: '28px 32px',
  swipeCardPadding: '40px 48px',
  swipeCardPaddingMobile: '28px 24px',
  cardMarginBottom: '20px',
  ingredientRowPadding: '10px 0',
  touchTargetMin: '44px',
} as const;

export const shadows = {
  card: '0 4px 20px rgba(61, 123, 123, 0.15), 0 1px 4px rgba(0, 0, 0, 0.04)',
  cardHover: '0 8px 32px rgba(61, 123, 123, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06)',
  button: '0 2px 8px rgba(61, 123, 123, 0.15)',
  buttonHover: '0 4px 14px rgba(61, 123, 123, 0.15)',
} as const;

export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
} as const;

export const animations = {
  gentleSway: `
    @keyframes gentleSway {
      0%   { transform: rotate(0deg) translateX(0); }
      15%  { transform: rotate(1.2deg) translateX(4px); }
      30%  { transform: rotate(0deg) translateX(0); }
      45%  { transform: rotate(-1.2deg) translateX(-4px); }
      60%  { transform: rotate(0deg) translateX(0); }
      100% { transform: rotate(0deg) translateX(0); }
    }
  `,
  swipeSpring: 'cubic-bezier(.175, .885, .32, 1.275)',
  buttonHover: 'all 0.2s ease',
  cardHover: 'box-shadow 0.3s ease',
  modalEnter: 'all 250ms ease-out',
  modalExit: 'all 200ms ease-in',
} as const;
