import React from 'react';

interface SpinnerIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

const spinKeyframes = `
@keyframes gh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

let styleInjected = false;

function injectSpinStyle(): void {
  if (styleInjected || typeof document === 'undefined') {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = spinKeyframes;
  document.head.appendChild(styleEl);
  styleInjected = true;
}

export const SpinnerIcon = React.memo(function SpinnerIcon({
  size = 24,
  color = 'currentColor',
  style,
  ...props
}: SpinnerIconProps): React.ReactElement {
  injectSpinStyle();

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
      style={{
        animation: 'gh-spin 1s linear infinite',
        ...style,
      }}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
});
