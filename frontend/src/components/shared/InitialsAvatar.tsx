import React, { useMemo } from 'react';
import { fonts, fontWeights, colors } from '../../theme/tokens';

interface InitialsAvatarProps {
  name: string;
  size?: number;
}

const AVATAR_COLORS = [
  '#3D7B7B',
  '#C9A84C',
  '#1A7F37',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#0ea5e9',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') {
    return '?';
  }
  if (parts.length === 1) {
    return (parts[0] ?? '?').charAt(0).toUpperCase();
  }
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export const InitialsAvatar = React.memo(function InitialsAvatar({
  name,
  size = 24,
}: InitialsAvatarProps): React.ReactElement {
  const initials = useMemo(() => getInitials(name), [name]);
  const bgColor = useMemo(() => {
    const index = hashString(name) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  }, [name]);

  const fontSize = Math.max(size * 0.4, 10);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: bgColor,
    color: colors.white,
    fontFamily: fonts.heading,
    fontWeight: fontWeights.semibold,
    fontSize,
    lineHeight: 1,
    userSelect: 'none',
    flexShrink: 0,
  };

  return (
    <span style={style} aria-label={`Avatar for ${name}`}>
      {initials}
    </span>
  );
});
