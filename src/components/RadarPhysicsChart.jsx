import React from 'react';

export function RadarPhysicsChart({ physics }) {
  if (!physics) {
    return (
      <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
        No data
      </div>
    );
  }

  // Descriptors: VEC, delta, omega, dChi, density_calc, Tm_avg
  const VEC = physics.VEC ?? 6;
  const delta = physics.delta ?? 0;
  const omega = physics.omega ?? 1;
  const dChi = physics.dChi ?? 0;
  const density = physics.density_calc ?? 5;
  const Tm = physics.Tm_avg ?? 1000;

  // Normalization helper (returns 0 to 1)
  const norm = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));

  // Define 6 axes
  const axes = [
    { label: 'VEC', val: norm(VEC, 2, 12) },
    { label: 'δ (Size)', val: norm(delta, 0, 12) },
    { label: 'Ω (Omega)', val: norm(omega, 0, 8) },
    { label: 'Δχ (Elect.)', val: norm(dChi, 0, 0.4) },
    { label: 'Density', val: norm(density, 1, 15) },
    { label: 'Tm (Melting)', val: norm(Tm, 400, 3600) }
  ];

  const size = 260;
  const center = size / 2;
  const maxRadius = 90;

  // Generate vertices for concentric grid lines (at 25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  
  const getCoordinates = (index, value) => {
    const angle = (index * 2 * Math.PI) / 6 - Math.PI / 2;
    const r = value * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Build the polygon points for actual data
  const dataPoints = axes.map((axis, i) => getCoordinates(i, axis.val));
  const dataPathString = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary-container)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary-container)" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        {/* Outer Circular Glow */}
        <circle cx={center} cy={center} r={maxRadius} fill="url(#radar-glow)" />

        {/* Concentric Grid Polygons */}
        {gridLevels.map((level, lvlIdx) => {
          const points = Array.from({ length: 6 }).map((_, i) => {
            const p = getCoordinates(i, level);
            return `${p.x},${p.y}`;
          }).join(' ');
          
          return (
            <polygon
              key={lvlIdx}
              points={points}
              fill="none"
              stroke="var(--outline-variant)"
              strokeWidth="0.75"
              strokeOpacity={0.4 + level * 0.4}
              strokeDasharray={lvlIdx === 3 ? 'none' : '3,3'}
            />
          );
        })}

        {/* Axis Lines */}
        {Array.from({ length: 6 }).map((_, i) => {
          const end = getCoordinates(i, 1.0);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="var(--outline-variant)"
              strokeWidth="0.75"
              strokeOpacity="0.5"
            />
          );
        })}

        {/* Data Shaded Area */}
        {dataPathString && (
          <polygon
            points={dataPathString}
            fill="rgba(0, 229, 255, 0.15)"
            stroke="var(--primary-container)"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0px 0px 6px rgba(0, 229, 255, 0.4))' }}
          />
        )}

        {/* Data Points markers */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#ffffff"
            stroke="var(--primary-container)"
            strokeWidth="1.5"
          />
        ))}

        {/* Labels */}
        {axes.map((axis, i) => {
          const offset = 18;
          const labelPos = getCoordinates(i, 1.15);
          
          // Micro-adjustment for text alignment
          let textAnchor = 'middle';
          let dy = '0.35em';
          
          if (Math.abs(labelPos.x - center) < 5) {
            textAnchor = 'middle';
          } else if (labelPos.x > center) {
            textAnchor = 'start';
          } else {
            textAnchor = 'end';
          }

          return (
            <text
              key={i}
              x={labelPos.x}
              y={labelPos.y}
              dy={dy}
              textAnchor={textAnchor}
              fill="var(--on-surface-variant)"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: '600',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
