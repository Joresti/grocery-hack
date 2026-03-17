import React from 'react';

interface ShareIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export const ShareIcon = React.memo(function ShareIcon({
  size = 24,
  color = 'currentColor',
  ...props
}: ShareIconProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
});
