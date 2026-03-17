import React from 'react';

interface PlusIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export const PlusIcon = React.memo(function PlusIcon({
  size = 24,
  color = 'currentColor',
  ...props
}: PlusIconProps): React.ReactElement {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
});
