import React, { useMemo } from 'react';

interface ConfettiEffectProps {
  active: boolean;
}

const PARTICLE_COUNT = 10;

const PALETTE = [
  '#3D7B7B', // primary
  '#C9A84C', // accent
  '#1A7F37', // success
  '#DC2626', // danger
  '#5A5A5A', // textMuted
  '#E6F4EA', // greenBadgeBg
  '#FAF9F6', // bg
  '#356c6c', // primaryHover
];

const confettiKeyframes = `
@keyframes gh-confetti-fall {
  0% {
    transform: translateY(-10px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}
`;

let confettiStyleInjected = false;

function injectConfettiStyle(): void {
  if (confettiStyleInjected || typeof document === 'undefined') {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = confettiKeyframes;
  document.head.appendChild(styleEl);
  confettiStyleInjected = true;
}

interface Particle {
  left: string;
  color: string;
  size: number;
  delay: string;
  duration: string;
  shape: 'circle' | 'square';
}

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      left: `${(i / PARTICLE_COUNT) * 100 + Math.random() * 10 - 5}%`,
      color: PALETTE[i % PALETTE.length] ?? '#3D7B7B',
      size: 6 + Math.random() * 6,
      delay: `${Math.random() * 0.5}s`,
      duration: `${1.5 + Math.random() * 1}s`,
      shape: i % 2 === 0 ? 'circle' : 'square',
    });
  }
  return particles;
}

export const ConfettiEffect = React.memo(function ConfettiEffect({
  active,
}: ConfettiEffectProps): React.ReactElement | null {
  injectConfettiStyle();

  const particles = useMemo(() => generateParticles(), []);

  if (!active) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 10001,
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle} aria-hidden="true">
      {particles.map((particle, index) => {
        const particleStyle: React.CSSProperties = {
          position: 'absolute',
          top: -10,
          left: particle.left,
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.shape === 'circle' ? '50%' : '2px',
          animation: `gh-confetti-fall ${particle.duration} ease-in ${particle.delay} forwards`,
        };
        return <div key={index} style={particleStyle} />;
      })}
    </div>
  );
});
