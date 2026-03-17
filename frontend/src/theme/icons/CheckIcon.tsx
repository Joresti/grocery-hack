import React from 'react';

interface CheckIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export const CheckIcon = React.memo(function CheckIcon({
  size = 24,
  color = 'currentColor',
  ...props
}: CheckIconProps): React.ReactElement {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
});
