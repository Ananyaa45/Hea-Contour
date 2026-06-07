import React, { useState, useEffect } from 'react';
import { calculateAlloyProperties } from '../services/alloyCalculator';

export function RandomAlloyTable({ family, elements, setComp, setData }) {
  const [sampleSize, setSampleSize] = useState(50);
  const [diversityFilter, setDiversityFilter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  const itemsPerPage = 8;

  // Run initial generation on load or element change
  useEffect(() => {
    generateSamplings();
  }, [family, elements]);

  const generateSamplings = () => {
    setLoading(true);
    
    // Simulate generation delay
    setTimeout(() => {
      const generated = [];
      const numSamples = sampleSize;
      
      let attempts = 0;
      while (generated.length < numSamples && attempts < numSamples * 8) {
        attempts++;
        
        // Pick 3 to 5 random elements from the selected family
        const activeCount = Math.floor(Math.random() * 2) + 4; // 4 or 5 elements
        const shuffled = [...elements].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(activeCount, elements.length));
        
        // Generate random proportions summing to 100%
        let remainder = 100;
        const comp = {};
        
        selected.forEach((el, index) => {
          if (index === selected.length - 1) {
            comp[el] = Number(remainder.toFixed(1));
          } else {
            // Give each element at least 5% and at most remainder - (5 * other_elements)
            const min = 5;
            const max = remainder - (selected.length - 1 - index) * 5;
            const val = min + Math.random() * (max - min);
            comp[el] = Number(val.toFixed(1));
            remainder -= val;
          }
        });
        
        // Fill other elements of the family with 0
        elements.forEach(el => {
          if (comp[el] === undefined) comp[el] = 0;
        });

        // Calculate physics
        const props = calculateAlloyProperties(comp);
        if (!props) continue;

        // Quality score: combinations of high YS, reasonable density and solid solution phase
        const ys = props.ml.YS_pred;
        const hv = props.ml.HV_pred;
        const rho = props.physics.density_calc;
        const omega = props.physics.omega;
        
        // Normalize components
        const normYS = Math.min(1, ys / 1400);
        const normHV = Math.min(1, hv / 600);
        const normRho = Math.max(0, Math.min(1, (12 - rho) / 10)); // lighter is better
        const normStability = (props.physics.structure !== 'Intermetallic' && omega >= 1.0) ? 1.0 : 0.3;
        
        const score = Number((normYS * 0.4 + normHV * 0.3 + normRho * 0.15 + normStability * 0.15).toFixed(2));

        // Diversity filter check
        if (diversityFilter && generated.length > 0) {
          // Check Euclidean distance to existing alloys
          let isTooSimilar = false;
          for (const existing of generated) {
            let distSq = 0;
            elements.forEach(el => {
              distSq += Math.pow((comp[el] ?? 0) - (existing.comp[el] ?? 0), 2);
            });
            const dist = Math.sqrt(distSq);
            if (dist < 12) { // 12% difference threshold
              isTooSimilar = true;
              break;
            }
          }
          if (isTooSimilar) continue;
        }

        generated.push({
          comp,
          physics: props.physics,
          ml: props.ml,
          score
        });
      }

      // Sort by score
      generated.sort((a, b) => b.score - a.score);
      setCandidates(generated);
      setSelectedCandidate(generated[0] || null);
      setCurrentPage(1);
      setLoading(false);
    }, 800);
  };

  const selectRow = (alloy) => {
    setSelectedCandidate(alloy);
    setComp(alloy.comp);
    
    // Recalculate properties for global app state
    const result = calculateAlloyProperties(alloy.comp);
    setData(result);
  };

  // Pagination logic
  const totalPages = Math.ceil(candidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCandidates = candidates.slice(startIndex, startIndex + itemsPerPage);

  // Success Probability calculation
  const stableCount = candidates.filter(c => c.physics.structure !== 'Intermetallic' && c.physics.omega >= 1.0).length;
  const successRate = candidates.length > 0 ? ((stableCount / candidates.length) * 100).toFixed(1) : 0;

  // Chart boundaries for Pareto Front plotting
  const allYs = candidates.map(c => c.ml.YS_pred);
  const allHv = candidates.map(c => c.ml.HV_pred);
  const minYs = allYs.length > 0 ? Math.min(...allYs) * 0.9 : 200;
  const maxYs = allYs.length > 0 ? Math.max(...allYs) * 1.1 : 1500;
  const minHv = allHv.length > 0 ? Math.min(...allHv) * 0.9 : 100;
  const maxHv = allHv.length > 0 ? Math.max(...allHv) * 1.1 : 700;

  return (
    <div className="dashboard-grid">
      {/* Parameter Controls Panel */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel relative overflow-hidden" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="scan-line"></div>
          <h3 className="font-display" style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-container)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>tune</span>
            Explore Parameters
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="font-display" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Sample Size</label>
            <select 
              value={sampleSize} 
              onChange={(e) => setSampleSize(Number(e.target.value))}
            >
              <option value={30}>30 Candidates</option>
              <option value={50}>50 Candidates</option>
              <option value={100}>100 Candidates</option>
              <option value={200}>200 Candidates</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
            <div>
              <span className="font-display" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--on-surface)' }}>Diversity Filter</span>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Euclidean distance check</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={diversityFilter} 
                onChange={(e) => setDiversityFilter(e.target.checked)} 
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '12px', borderTop: '1px solid var(--outline-variant)' }}>
            <label className="font-display" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: '600' }}>Family Constrains</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {elements.map(el => (
                <span key={el} style={{ padding: '3px 8px', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  {el}
                </span>
              ))}
            </div>
          </div>

          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '12px' }} 
            onClick={generateSamplings}
            disabled={loading}
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`} style={{ fontSize: '20px' }}>
              {loading ? 'sync' : 'autorenew'}
            </span>
            {loading ? 'Sampling Space...' : 'Generate samplings'}
          </button>
        </div>

        {/* Sampling Stats */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>Stable Solution Ratio</span>
            <span className="font-mono" style={{ color: 'var(--secondary-container)', fontWeight: 'bold' }}>{successRate}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'var(--surface-container-highest)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${successRate}%`, height: '100%', background: 'var(--secondary-container)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>
      </aside>

      {/* Results Presentation Grid */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--on-surface)' }}>Candidate Alloys</h3>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', background: 'var(--surface-container-high)', padding: '2px 8px', borderRadius: '4px' }}>
              {candidates.length} samples
            </span>
          </div>
          
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Rank</th>
                  <th>Composition (at.%)</th>
                  <th style={{ textAlign: 'right' }}>YS (MPa)</th>
                  <th style={{ textAlign: 'right' }}>Hardness (HV)</th>
                  <th>Structure</th>
                  <th style={{ textAlign: 'right' }}>Quality Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)' }}>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: '28px', verticalAlign: 'middle', marginRight: '8px' }}>sync</span>
                      Running Monte Carlo simulations...
                    </td>
                  </tr>
                ) : paginatedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)' }}>No candidates generated</td>
                  </tr>
                ) : (
                  paginatedCandidates.map((alloy, idx) => {
                    const globalRank = startIndex + idx + 1;
                    const isSelected = selectedCandidate && JSON.stringify(selectedCandidate.comp) === JSON.stringify(alloy.comp);
                    const compStr = Object.entries(alloy.comp)
                      .filter(([_, v]) => v > 0)
                      .map(([k, v]) => `${k}${v.toFixed(0)}`)
                      .join(' ');
                    
                    return (
                      <tr 
                        key={idx} 
                        onClick={() => selectRow(alloy)}
                        style={{ 
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                          boxShadow: isSelected ? 'inset 4px 0 0 var(--primary-container)' : 'none'
                        }}
                      >
                        <td style={{ color: isSelected ? 'var(--primary-container)' : 'inherit' }}>#{globalRank}</td>
                        <td style={{ fontWeight: 'bold' }}>{compStr}</td>
                        <td style={{ textAlign: 'right' }}>{alloy.ml.YS_pred}</td>
                        <td style={{ textAlign: 'right' }}>{alloy.ml.HV_pred}</td>
                        <td>
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '3px', 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            border: '1px solid',
                            background: alloy.physics.structure.includes('FCC') && alloy.physics.structure.includes('BCC') ? 'rgba(0,229,255,0.08)' : alloy.physics.structure === 'FCC' ? 'rgba(117,253,0,0.08)' : 'rgba(215,240,254,0.08)',
                            borderColor: alloy.physics.structure.includes('FCC') && alloy.physics.structure.includes('BCC') ? 'var(--primary-container)' : alloy.physics.structure === 'FCC' ? 'var(--secondary-container)' : 'var(--tertiary-container)',
                            color: alloy.physics.structure.includes('FCC') && alloy.physics.structure.includes('BCC') ? 'var(--primary-container)' : alloy.physics.structure === 'FCC' ? 'var(--secondary-container)' : 'var(--tertiary-container)'
                          }}>
                            {alloy.physics.structure}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: alloy.score >= 0.75 ? 'var(--secondary-container)' : alloy.score >= 0.5 ? 'var(--primary-container)' : 'var(--on-surface-variant)' }}>
                          {alloy.score.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-container-lowest)', borderTop: '1px solid var(--outline-variant)' }}>
              <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ minHeight: '32px', padding: '0 8px', margin: 0 }}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ minHeight: '32px', padding: '0 8px', margin: 0 }}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Candidate Properties & Simulated Pareto Plot */}
        {selectedCandidate && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--primary-container)' }}>Selected Candidate Properties</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>VEC</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{selectedCandidate.physics.VEC}</div>
                </div>
                <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Density</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                    {selectedCandidate.physics.density_calc} <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>g/cm³</span>
                  </div>
                </div>
                <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Delta Mismatch</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{selectedCandidate.physics.delta}%</div>
                </div>
                <div style={{ background: 'var(--surface-container-low)', padding: '10px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Omega Parameter</span>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{selectedCandidate.physics.omega}</div>
                </div>
              </div>
            </div>

            {/* Custom Pareto Front Scatter Plot using SVG */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--on-surface)' }}>Property Space Distribution (YS vs HV)</h4>
              
              <div style={{ height: '220px', width: '100%', position: 'relative', background: 'var(--surface-container-lowest)', borderRadius: '6px', border: '1px solid var(--outline-variant)', overflow: 'hidden' }}>
                <svg width="100%" height="100%">
                  {/* Grid Lines */}
                  {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
                    <React.Fragment key={i}>
                      {/* Vertical grid lines */}
                      <line 
                        x1={`${f * 100}%`} 
                        y1="5%" 
                        x2={`${f * 100}%`} 
                        y2="90%" 
                        stroke="var(--outline-variant)" 
                        strokeWidth="0.5" 
                        strokeOpacity="0.25" 
                      />
                      {/* Horizontal grid lines */}
                      <line 
                        x1="5%" 
                        y1={`${f * 100}%`} 
                        x2={`${95}%`} 
                        y2={`${f * 100}%`} 
                        stroke="var(--outline-variant)" 
                        strokeWidth="0.5" 
                        strokeOpacity="0.25" 
                      />
                    </React.Fragment>
                  ))}

                  {/* Candidate scatter points */}
                  {!loading && candidates.map((c, i) => {
                    const xPct = 10 + norm(c.ml.YS_pred, minYs, maxYs) * 80; // scale 10% to 90%
                    const yPct = 90 - norm(c.ml.HV_pred, minHv, maxHv) * 80; // invert y scale (90% to 10%)
                    const isSelected = selectedCandidate && JSON.stringify(selectedCandidate.comp) === JSON.stringify(c.comp);
                    const isTopScore = c.score >= 0.78;

                    return (
                      <circle
                        key={i}
                        cx={`${xPct}%`}
                        cy={`${yPct}%`}
                        r={isSelected ? 6 : isTopScore ? 4.5 : 3}
                        fill={isSelected ? '#ffffff' : isTopScore ? 'var(--secondary-container)' : 'rgba(0, 229, 255, 0.4)'}
                        stroke={isSelected ? 'var(--primary-container)' : isTopScore ? 'var(--secondary-container)' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => selectRow(c)}
                      >
                        <title>{`YS: ${c.ml.YS_pred} MPa, HV: ${c.ml.HV_pred} HV`}</title>
                      </circle>
                    );
                  })}
                </svg>
                
                {/* Axes label labels */}
                <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)' }}>
                  YIELD STRENGTH (MPa) →
                </div>
                <div style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left center', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>
                  HARDNESS (HV) →
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Coordinate normalizer for scatter plot
function norm(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
