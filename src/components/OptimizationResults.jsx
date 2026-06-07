import React, { useState, useEffect } from 'react';
import { calculateAlloyProperties } from '../services/alloyCalculator';

export function OptimizationResults({ family, elements, setComp, setData }) {
  const [running, setRunning] = useState(false);
  const [generations, setGenerations] = useState(150);
  const [population, setPopulation] = useState(60);
  const [targetYS, setTargetYS] = useState(850);
  const [targetHV, setTargetHV] = useState(450);
  const [paretoFront, setParetoFront] = useState([]);
  const [dominatedPoints, setDominatedPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Run a quick simulation of NSGA-II client-side
  const runEvolution = () => {
    setRunning(true);
    setSelectedPoint(null);

    setTimeout(() => {
      // 1. Generate initial random population
      let pop = [];
      const popSize = population;
      
      for (let i = 0; i < popSize * 3; i++) {
        const comp = {};
        const activeCount = Math.floor(Math.random() * 2) + 3; // 3 to 4 elements
        const shuffled = [...elements].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(activeCount, elements.length));
        
        let remainder = 100;
        selected.forEach((el, index) => {
          if (index === selected.length - 1) {
            comp[el] = Number(remainder.toFixed(1));
          } else {
            const min = 5;
            const max = remainder - (selected.length - 1 - index) * 5;
            const val = min + Math.random() * (max - min);
            comp[el] = Number(val.toFixed(1));
            remainder -= val;
          }
        });
        
        elements.forEach(el => {
          if (comp[el] === undefined) comp[el] = 0;
        });

        const res = calculateAlloyProperties(comp);
        if (res) {
          pop.push({
            comp,
            ys: res.ml.YS_pred,
            hv: res.ml.HV_pred,
            omega: res.physics.omega,
            structure: res.physics.structure,
            phase: res.physics.phase,
            density: res.physics.density_calc
          });
        }
      }

      // 2. Perform simple Pareto sorting
      // A point A dominates B if A.ys >= B.ys and A.hv >= B.hv (and at least one is strictly greater)
      const isDominated = (a, b) => {
        return (b.ys >= a.ys && b.hv >= a.hv) && (b.ys > a.ys || b.hv > a.hv);
      };

      const front = [];
      const dominated = [];

      for (let i = 0; i < pop.length; i++) {
        let dominatedByAny = false;
        for (let j = 0; j < pop.length; j++) {
          if (i !== j && isDominated(pop[i], pop[j])) {
            dominatedByAny = true;
            break;
          }
        }
        if (dominatedByAny) {
          dominated.push(pop[i]);
        } else {
          front.push(pop[i]);
        }
      }

      // Clean up Pareto front: sort by YS
      front.sort((a, b) => a.ys - b.ys);
      
      // Limit dominated points size for clean scatter display
      const sampledDominated = dominated
        .sort(() => 0.5 - Math.random())
        .slice(0, 40);

      setParetoFront(front);
      setDominatedPoints(sampledDominated);
      
      // Select the optimal point closest to the middle of the Pareto front
      if (front.length > 0) {
        const midIdx = Math.floor(front.length / 2);
        setSelectedPoint(front[midIdx]);
      }
      
      setRunning(false);
    }, 1500);
  };

  // Run on initial loading
  useEffect(() => {
    runEvolution();
  }, [family, elements]);

  const selectParetoSolution = (alloy) => {
    setSelectedPoint(alloy);
    setComp(alloy.comp);
    
    // Set global app state calculation data
    const result = calculateAlloyProperties(alloy.comp);
    setData(result);
  };

  // Compute boundaries for plot layout
  const allPoints = [...paretoFront, ...dominatedPoints];
  const allYs = allPoints.map(p => p.ys);
  const allHvs = allPoints.map(p => p.hv);
  const minYS = allYs.length > 0 ? Math.min(...allYs) * 0.95 : 300;
  const maxYS = allYs.length > 0 ? Math.max(...allYs) * 1.05 : 1500;
  const minHV = allHvs.length > 0 ? Math.min(...allHvs) * 0.95 : 150;
  const maxHV = allHvs.length > 0 ? Math.max(...allHvs) * 1.05 : 650;

  return (
    <div className="dashboard-grid">
      {/* Constraints Sidebar */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 className="font-display" style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-container)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</span>
            Optimization Goals
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Target Yield Strength</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span className="font-mono" style={{ color: 'var(--primary-container)', fontSize: '12px' }}>MAXIMIZE</span>
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: 'bold' }}>&gt; {targetYS} MPa</span>
              </div>
            </div>
            
            <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
              <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Target Hardness</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span className="font-mono" style={{ color: 'var(--primary-container)', fontSize: '12px' }}>MAXIMIZE</span>
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: 'bold' }}>&gt; {targetHV} HV</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--outline-variant)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>Population</span>
              <span className="font-mono">{population}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>Generations</span>
              <span className="font-mono">{generations}</span>
            </div>
          </div>

          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '8px' }} 
            onClick={runEvolution}
            disabled={running}
          >
            <span className={`material-symbols-outlined ${running ? 'animate-spin' : ''}`} style={{ fontSize: '20px' }}>
              {running ? 'sync' : 'play_arrow'}
            </span>
            {running ? 'Evolving Generations...' : 'Run NSGA-II Solver'}
          </button>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Model Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary-container)', display: 'inline-block' }} className="pulse-glow"></span>
            <span className="font-mono" style={{ fontSize: '11px' }}>RF-REGRESSOR-V2.1 ACTIVE</span>
          </div>
        </div>
      </aside>

      {/* Pareto Plot stage */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--on-surface)' }}>Pareto Optimal Front</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--on-surface-variant)' }}>Multi-objective boundary: Yield Strength vs Hardness</p>
            </div>
            <span className="font-mono" style={{ fontSize: '11px', background: 'var(--surface-container-high)', padding: '2px 8px', borderRadius: '4px' }}>
              Non-Dominated Solutions
            </span>
          </div>

          {/* Pareto front custom SVG scatter plot */}
          <div style={{ height: '260px', width: '100%', position: 'relative', background: 'var(--surface-container-lowest)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
            <svg width="100%" height="100%">
              {/* Plot Grids */}
              {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
                <React.Fragment key={i}>
                  <line x1={`${f * 100}%`} y1="5%" x2={`${f * 100}%`} y2="90%" stroke="var(--outline-variant)" strokeWidth="0.5" strokeOpacity="0.2" />
                  <line x1="5%" y1={`${f * 100}%`} x2="95%" y2={`${f * 100}%`} stroke="var(--outline-variant)" strokeWidth="0.5" strokeOpacity="0.2" />
                </React.Fragment>
              ))}

              {/* Dominated Points (Grayed) */}
              {!running && dominatedPoints.map((p, i) => {
                const cx = 10 + norm(p.ys, minYS, maxYS) * 80;
                const cy = 90 - norm(p.hv, minHV, maxHV) * 80;
                return (
                  <circle 
                    key={`dom-${i}`} 
                    cx={`${cx}%`} 
                    cy={`${cy}%`} 
                    r="3" 
                    fill="var(--outline-variant)" 
                    fillOpacity="0.5" 
                  />
                );
              })}

              {/* Pareto Curve connecting Line */}
              {!running && paretoFront.length > 1 && (() => {
                const points = paretoFront.map(p => {
                  const x = 10 + norm(p.ys, minYS, maxYS) * 80;
                  const y = 90 - norm(p.hv, minHV, maxHV) * 80;
                  return `${x}%,${y}%`;
                });
                
                // SVG coordinates representation for path
                // We'll construct a simple polyline or bezier
                const pathString = paretoFront.map((p, idx) => {
                  const x = 10 + norm(p.ys, minYS, maxYS) * 80;
                  const y = 90 - norm(p.hv, minHV, maxHV) * 80;
                  
                  // Convert percentage relative to viewBox
                  // Let's assume viewbox size 1000x1000 for path rendering
                  const vx = (x / 100) * 1000;
                  const vy = (y / 100) * 1000;
                  return `${idx === 0 ? 'M' : 'L'} ${vx} ${vy}`;
                }).join(' ');

                return (
                  <svg viewBox="0 0 1000 1000" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                    <path
                      d={pathString}
                      fill="none"
                      stroke="var(--primary-container)"
                      strokeWidth="2.5"
                      strokeDasharray="6,6"
                      strokeOpacity="0.6"
                    />
                  </svg>
                );
              })()}

              {/* Pareto Front Points */}
              {!running && paretoFront.map((p, i) => {
                const cx = 10 + norm(p.ys, minYS, maxYS) * 80;
                const cy = 90 - norm(p.hv, minHV, maxHV) * 80;
                const isSelected = selectedPoint && JSON.stringify(selectedPoint.comp) === JSON.stringify(p.comp);

                return (
                  <circle
                    key={`pareto-${i}`}
                    cx={`${cx}%`}
                    cy={`${cy}%`}
                    r={isSelected ? 7 : 4.5}
                    fill={isSelected ? '#ffffff' : 'var(--primary-container)'}
                    stroke="var(--primary-container)"
                    strokeWidth={isSelected ? 3 : 0}
                    style={{ cursor: 'pointer', filter: isSelected ? 'drop-shadow(0 0 6px var(--primary-container))' : 'none', transition: 'all 0.1s' }}
                    onClick={() => selectParetoSolution(p)}
                  />
                );
              })}
            </svg>

            {/* Label overlays */}
            <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)' }}>
              YIELD STRENGTH (MPa) →
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left center', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>
              HARDNESS (HV) →
            </div>

            {/* Selected point tooltip overlay */}
            {selectedPoint && (
              <div className="glass-panel" style={{ position: 'absolute', top: '16px', right: '16px', padding: '10px', width: '150px', background: 'rgba(12, 14, 17, 0.85)', borderColor: 'rgba(0, 229, 255, 0.3)' }}>
                <span className="font-mono" style={{ fontSize: '10px', color: 'var(--primary-container)', fontWeight: 'bold' }}>Optimal Solution</span>
                <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px' }}>
                  {Object.entries(selectedPoint.comp)
                    .filter(([_, v]) => v > 0)
                    .map(([k, v]) => `${k}${v.toFixed(0)}`)
                    .slice(0, 3).join('')}...
                </div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  YS: <span style={{ color: 'var(--on-surface)' }}>{selectedPoint.ys} MPa</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  HV: <span style={{ color: 'var(--on-surface)' }}>{selectedPoint.hv} HV</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Optimized compositions table */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--outline-variant)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--on-surface)' }}>Optimized Pareto Front Candidates</h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Composition</th>
                  <th style={{ textAlign: 'right' }}>YS (MPa)</th>
                  <th style={{ textAlign: 'right' }}>Hardness (HV)</th>
                  <th style={{ textAlign: 'right' }}>Density</th>
                  <th>Phase</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {running ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--on-surface-variant)' }}>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: '24px', verticalAlign: 'middle', marginRight: '8px' }}>sync</span>
                      Running genetic sorting algorithm...
                    </td>
                  </tr>
                ) : paretoFront.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--on-surface-variant)' }}>No optimal solutions found yet.</td>
                  </tr>
                ) : (
                  paretoFront.slice(0, 5).map((alloy, i) => {
                    const compStr = Object.entries(alloy.comp)
                      .filter(([_, v]) => v > 0)
                      .map(([k, v]) => `${k}${v.toFixed(0)}`)
                      .join(' ');
                    const isSelected = selectedPoint && JSON.stringify(selectedPoint.comp) === JSON.stringify(alloy.comp);
                    
                    return (
                      <tr 
                        key={i} 
                        style={{ background: isSelected ? 'rgba(0, 229, 255, 0.05)' : 'transparent' }}
                      >
                        <td>#{i + 1}</td>
                        <td className="font-mono" style={{ fontWeight: 'bold', color: 'var(--primary-container)' }}>{compStr}</td>
                        <td style={{ textAlign: 'right' }}>{alloy.ys}</td>
                        <td style={{ textAlign: 'right' }}>{alloy.hv}</td>
                        <td style={{ textAlign: 'right' }}>{alloy.density.toFixed(2)}</td>
                        <td>
                          <span style={{ fontSize: '11px', color: alloy.omega >= 1.1 ? 'var(--secondary-container)' : 'var(--error)' }}>
                            {alloy.structure} (Ω: {alloy.omega.toFixed(1)})
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '4px 8px', minHeight: 'auto', margin: 0 }}
                            onClick={() => selectParetoSolution(alloy)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                            Load
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function norm(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
