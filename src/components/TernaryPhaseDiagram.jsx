import React from 'react';

export function TernaryPhaseDiagram({ composition, structure }) {
  if (!composition) {
    return (
      <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
        No data
      </div>
    );
  }

  // Get top 3 elements by composition to map to the 3 corners of the ternary diagram
  const elements = Object.keys(composition).map(key => ({
    name: key,
    val: composition[key] ?? 0
  })).sort((a, b) => b.val - a.val).slice(0, 3);

  // If we have fewer than 3 elements, pad with default ones
  while (elements.length < 3) {
    const defaultEl = ['Fe', 'Ni', 'Co', 'Cr', 'Al'].find(el => !elements.some(e => e.name === el));
    elements.push({ name: defaultEl || 'X', val: 0 });
  }

  const elA = elements[0].name;
  const elB = elements[1].name;
  const elC = elements[2].name;

  // Get raw values
  const valA = composition[elA] ?? 0;
  const valB = composition[elB] ?? 0;
  const valC = composition[elC] ?? 0;
  
  const sum = valA + valB + valC;
  
  // Normalize fractions (must sum to 1.0)
  let cA = 0.33, cB = 0.33, cC = 0.34;
  if (sum > 0) {
    cA = valA / sum;
    cB = valB / sum;
    cC = valC / sum;
  }

  // Equilateral triangle layout properties
  const width = 280;
  const height = 230;
  
  // Vertices coordinates
  const vA = { x: 140, y: 30 };   // Top corner (Element A)
  const vB = { x: 40,  y: 190 };  // Bottom-Left corner (Element B)
  const vC = { x: 240, y: 190 };  // Bottom-Right corner (Element C)

  // Map barycentric coordinates to Cartesian coordinates
  const markerX = cA * vA.x + cB * vB.x + cC * vC.x;
  const markerY = cA * vA.y + cB * vB.y + cC * vC.y;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Phase Region Gradients */}
          <linearGradient id="fcc-area" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--inverse-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--outline-variant)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="bcc-area" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--secondary-container)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--outline-variant)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Phase Stability Background Regions (Contour Lines Representation) */}
        {/* FCC Stable region (bottom right) */}
        <path
          d={`M ${vC.x} ${vC.y} L 160 110 L 110 190 Z`}
          fill="rgba(0, 229, 255, 0.08)"
          stroke="var(--outline-variant)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* BCC Stable region (top left) */}
        <path
          d={`M ${vA.x} ${vA.y} L 110 130 L 70 190 Z`}
          fill="rgba(117, 253, 0, 0.08)"
          stroke="var(--outline-variant)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Equal distance grids */}
        {/* 20% grid lines */}
        {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
          // Parallel to BC (horizontal lines)
          const y = vA.y + f * (vB.y - vA.y);
          const xL = vA.x - f * (vA.x - vB.x);
          const xR = vA.x + f * (vC.x - vA.x);
          return (
            <line
              key={i}
              x1={xL}
              y1={y}
              x2={xR}
              y2={y}
              stroke="var(--outline-variant)"
              strokeWidth="0.5"
              strokeOpacity="0.25"
            />
          );
        })}

        {/* Triangle Boundary Outline */}
        <polygon
          points={`${vA.x},${vA.y} ${vB.x},${vB.y} ${vC.x},${vC.y}`}
          fill="none"
          stroke="var(--outline)"
          strokeWidth="1.5"
        />

        {/* Current Composition Marker dot with glow */}
        <circle
          cx={markerX}
          cy={markerY}
          r="8"
          fill="rgba(0, 229, 255, 0.25)"
          stroke="var(--primary-container)"
          strokeWidth="2.5"
          className="pulse-glow"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="3"
          fill="#ffffff"
        />

        {/* Vertex Corner Labels (Element Names) */}
        <text x={vA.x} y={vA.y - 10} textAnchor="middle" fill="var(--primary-container)" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 'bold' }}>
          {elA}
        </text>
        <text x={vB.x - 12} y={vB.y + 6} textAnchor="end" fill="var(--on-surface)" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 'bold' }}>
          {elB}
        </text>
        <text x={vC.x + 12} y={vC.y + 6} textAnchor="start" fill="var(--on-surface)" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 'bold' }}>
          {elC}
        </text>

        {/* Labels detail helper text */}
        <text x={vA.x} y={vA.y + 4} textAnchor="middle" fill="var(--on-surface-variant)" style={{ fontFamily: 'var(--font-mono)', fontSize: '7px' }}>
          100%
        </text>
        <text x={vB.x} y={vB.y + 14} textAnchor="middle" fill="var(--on-surface-variant)" style={{ fontFamily: 'var(--font-mono)', fontSize: '7px' }}>
          100%
        </text>
        <text x={vC.x} y={vC.y + 14} textAnchor="middle" fill="var(--on-surface-variant)" style={{ fontFamily: 'var(--font-mono)', fontSize: '7px' }}>
          100%
        </text>
      </svg>
      
      {/* Legend Overlay */}
      <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)', marginTop: '-8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', background: 'rgba(0, 229, 255, 0.2)', border: '1px solid var(--primary)', borderRadius: '1px' }}></span>
          <span>FCC STABLE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', background: 'rgba(117, 253, 0, 0.2)', border: '1px solid var(--secondary-container)', borderRadius: '1px' }}></span>
          <span>BCC STABLE</span>
        </div>
      </div>
    </div>
  );
}
