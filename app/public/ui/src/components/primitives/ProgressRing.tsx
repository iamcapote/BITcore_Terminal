/**
 * Why: Visualize progress for research stages, mission steps, and rate limit meters in a compact primitive.
 * What: Renders an SVG-based ring supporting size variants and custom colors.
 * How: Derives circle geometry from props, animating stroke dash offset to reflect the current percentage.
 */

import type { CSSProperties } from 'react';

export type ProgressRingSize = 'sm' | 'md' | 'lg';

export interface ProgressRingProps {
  value: number;
  size?: ProgressRingSize;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

const SIZE_MAP: Record<ProgressRingSize, number> = {
  sm: 16,
  md: 24,
  lg: 32
};

export function ProgressRing({
  value,
  size = 'md',
  color = 'var(--color-accent-primary)',
  strokeWidth = 4,
  style
}: ProgressRingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = SIZE_MAP[size];
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const dimension = radius * 2 + strokeWidth * 2;

  return (
    <div style={{ width: dimension, height: dimension, display: 'inline-grid', placeItems: 'center', ...style }}>
      <svg
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
          style={{ transition: 'stroke-dashoffset var(--motion-transition-slow)' }}
        />
        <text
          x="50%"
          y="50%"
          dy="0.35em"
          textAnchor="middle"
          fill="var(--color-fg-primary)"
          fontSize="var(--typography-font-size-sm)"
          fontFamily="var(--typography-font-family-mono)"
        >
          {Math.round(clamped)}%
        </text>
      </svg>
    </div>
  );
}
