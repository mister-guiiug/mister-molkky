interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = 'var(--primary)',
  max,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={2}
          y1={height - 2}
          x2={width - 2}
          y2={height - 2}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    );
  }

  const upper = max ?? Math.max(...values, 1);
  const dx = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const pad = 2;
  const points = values.map((v, i) => {
    const x = pad + i * dx;
    const y = height - pad - ((v / upper) * (height - pad * 2));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const lastX = pad + (values.length - 1) * dx;
  const lastY =
    height - pad - ((values[values.length - 1]! / upper) * (height - pad * 2));

  return (
    <svg width={width} height={height} aria-hidden>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={1.6} fill={color} />
    </svg>
  );
}
