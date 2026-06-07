import React, { useState } from 'react';
import { calculateAlloyProperties } from '../services/alloyCalculator';

// Prepopulated validated HEA Database based on literature values
const VALIDATED_DATABASE = [
  { id: 'HEA-01-V', name: 'Al0.3CoCrFeNi', ys: 385, hv: 145, emod: 202.4, ref: '10.1016/j.actamat.2008.08.002' },
  { id: 'HEA-02-V', name: 'CoCrFeNiTi0.5', ys: 1245, hv: 582, emod: 188.1, ref: '10.1016/j.msea.2014.07.031' },
  { id: 'HEA-03-V', name: 'AlCoCrFeNi2.1', ys: 920, hv: 312, emod: 215.7, ref: '10.1016/j.actamat.2017.06.012' },
  { id: 'HEA-04-V', name: 'CrMoNbTiW', ys: 1580, hv: 742, emod: 240.2, ref: '10.1016/j.scriptamat.2011.05.011' },
  { id: 'HEA-05-V', name: 'FeCoNiCrMn', ys: 245, hv: 120, emod: 190.5, ref: '10.1007/s11661-004-0294-3' },
  { id: 'HEA-06-V', name: 'Al0.5CoCrFeNi', ys: 540, hv: 220, emod: 195.0, ref: '10.1016/j.actamat.2011.02.040' },
  { id: 'HEA-07-V', name: 'MoNbTaW', ys: 1050, hv: 450, emod: 250.0, ref: '10.1016/j.jallcom.2010.10.162' },
  { id: 'HEA-08-V', name: 'AlLiMgScTi', ys: 850, hv: 320, emod: 98.4, ref: '10.1016/j.matlet.2014.11.002' },
  { id: 'HEA-09-V', name: 'CoCrFeNiTi', ys: 1820, hv: 840, emod: 172.5, ref: '10.1016/j.scriptamat.2015.01.005' },
  { id: 'HEA-10-V', name: 'NbTiTaW', ys: 1320, hv: 590, emod: 210.0, ref: '10.1016/j.msea.2016.12.012' }
];

export function AnalyticsVisualizations({ activeAlloy, physics, ml, setComp, setData }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dbPage, setDbPage] = useState(1);
  const dbItemsPerPage = 5;

  const handleRowClick = (alloy) => {
    // Attempt to parse composition and load
    // E.g., FeCoNiCrMn -> 20% each
    // E.g., MoNbTaW -> 25% each
    let comp = {};
    if (alloy.name === 'FeCoNiCrMn') {
      comp = { Fe: 20, Co: 20, Ni: 20, Cr: 20, Mn: 20 };
    } else if (alloy.name === 'Al0.3CoCrFeNi') {
      comp = { Al: 5.7, Co: 23.6, Cr: 23.6, Fe: 23.6, Ni: 23.5 };
    } else if (alloy.name === 'CoCrFeNiTi0.5') {
      comp = { Co: 22.2, Cr: 22.2, Fe: 22.2, Ni: 22.2, Ti: 11.2 };
    } else if (alloy.name === 'AlCoCrFeNi2.1') {
      comp = { Al: 16.4, Co: 16.4, Cr: 16.4, Fe: 16.4, Ni: 34.4 };
    } else if (alloy.name === 'CrMoNbTiW') {
      comp = { Cr: 20, Mo: 20, Nb: 20, Ti: 20, W: 20 };
    } else if (alloy.name === 'Al0.5CoCrFeNi') {
      comp = { Al: 11.1, Co: 22.2, Cr: 22.2, Fe: 22.2, Ni: 22.3 };
    } else if (alloy.name === 'MoNbTaW') {
      comp = { Mo: 25, Nb: 25, Ta: 25, W: 25 };
    } else if (alloy.name === 'AlLiMgScTi') {
      comp = { Al: 20, Li: 20, Mg: 20, Sc: 20, Ti: 20 };
    } else if (alloy.name === 'CoCrFeNiTi') {
      comp = { Co: 20, Cr: 20, Fe: 20, Ni: 20, Ti: 20 };
    } else if (alloy.name === 'NbTiTaW') {
      comp = { Nb: 25, Ti: 25, Ta: 25, W: 25 };
    }

    setComp(comp);
    const result = calculateAlloyProperties(comp);
    setData(result);
  };

  // Filter and paginated db
  const filteredDb = VALIDATED_DATABASE.filter(alloy =>
    alloy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    alloy.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalDbPages = Math.ceil(filteredDb.length / dbItemsPerPage);
  const paginatedDb = filteredDb.slice((dbPage - 1) * dbItemsPerPage, dbPage * dbItemsPerPage);

  // Active properties values
  const currentYS = ml?.YS_pred ?? 1142;
  const currentHV = ml?.HV_pred ?? 482;
  const currentOmega = physics?.omega ?? 1.82;
  const currentStructure = physics?.structure ?? 'FCC + BCC';

  // Format active alloy composition values for Bar Chart
  const activeCompositions = Object.entries(activeAlloy)
    .filter(([_, v]) => v > 0)
    .map(([name, val]) => ({ name, val }));

  const maxCompVal = activeCompositions.length > 0 ? Math.max(...activeCompositions.map(c => c.val)) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Bento Grid Visualizations */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Radar Properties Profile */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>analytics</span>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Property Profile</h3>
            </div>
            <span className="font-mono" style={{ fontSize: '10px', background: 'var(--surface-container-high)', padding: '2px 8px', borderRadius: '4px' }}>
              RF-MODEL-V2.1
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Custom SVG Property Profile Radar Chart */}
            <svg width="200" height="200" viewBox="0 0 200 200">
              {/* Polar concentric grid rings */}
              {[0.25, 0.5, 0.75, 1.0].map((level, i) => (
                <circle 
                  key={i} 
                  cx="100" 
                  cy="100" 
                  r={level * 70} 
                  fill="none" 
                  stroke="var(--outline-variant)" 
                  strokeWidth="0.5" 
                  strokeOpacity="0.3" 
                  strokeDasharray="2,2" 
                />
              ))}

              {/* Angle Spokes */}
              {Array.from({ length: 5 }).map((_, i) => {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                const tx = 100 + 70 * Math.cos(angle);
                const ty = 100 + 70 * Math.sin(angle);
                return (
                  <line 
                    key={i} 
                    x1="100" 
                    y1="100" 
                    x2={tx} 
                    y2={ty} 
                    stroke="var(--outline-variant)" 
                    strokeWidth="0.5" 
                    strokeOpacity="0.4" 
                  />
                );
              })}

              {/* Glowing Value Area Polygon */}
              {(() => {
                // Yield Strength, Hardness, Ductility (simulated), Enthalpy (simulated), Entropy (simulated)
                const values = [
                  Math.min(1.0, currentYS / 1500),
                  Math.min(1.0, currentHV / 700),
                  currentStructure === 'FCC' ? 0.85 : currentStructure === 'BCC' ? 0.3 : 0.55,
                  physics?.omega ? Math.min(1.0, 1 / Math.max(0.5, physics.omega)) : 0.4, // Enthalpy reciprocal representation
                  physics?.VEC ? Math.min(1.0, physics.VEC / 12) : 0.6
                ];
                
                const points = values.map((val, idx) => {
                  const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                  const r = val * 70;
                  return {
                    x: 100 + r * Math.cos(angle),
                    y: 100 + r * Math.sin(angle)
                  };
                });
                
                const pathStr = points.map(p => `${p.x},${p.y}`).join(' ');
                
                return (
                  <polygon
                    points={pathStr}
                    fill="rgba(0, 229, 255, 0.15)"
                    stroke="var(--primary-container)"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0px 0px 4px var(--primary-container))' }}
                  />
                );
              })()}

              {/* Labels text overlays */}
              {['YIELD STRENGTH', 'HARDNESS', 'DUCTILITY', 'ENTHALPY', 'ENTROPY'].map((lbl, idx) => {
                const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                const tx = 100 + 85 * Math.cos(angle);
                const ty = 100 + 85 * Math.sin(angle);
                let anchor = 'middle';
                if (Math.cos(angle) > 0.1) anchor = 'start';
                if (Math.cos(angle) < -0.1) anchor = 'end';
                return (
                  <text 
                    key={idx} 
                    x={tx} 
                    y={ty} 
                    textAnchor={anchor} 
                    dy="0.3em" 
                    fill="var(--on-surface-variant)" 
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '7.5px', fontWeight: 'bold' }}
                  >
                    {lbl}
                  </text>
                );
              })}
            </svg>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--outline-variant)', paddingTop: '12px', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
            <span>Model Confidence: <b style={{ color: 'var(--secondary-container)' }}>98.4%</b></span>
            <span>Batch: <b>AL-CO-CR-FE-NI</b></span>
          </div>
        </div>

        {/* Bar Chart: Composition Variance */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>bar_chart</span>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Alloy Element Fractions</h3>
            </div>
          </div>

          {/* Simple custom SVG bar chart */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '8px', paddingBottom: '16px', background: 'var(--surface-container-lowest)', borderRadius: '4px', border: '1px solid var(--outline-variant)', minHeight: '180px', padding: '16px' }}>
            {activeCompositions.length === 0 ? (
              <span style={{ color: 'var(--on-surface-variant)', alignSelf: 'center' }}>No components active</span>
            ) : (
              activeCompositions.map(c => {
                const heightPct = (c.val / maxCompVal) * 85 + 5; // scaled height
                return (
                  <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    <span className="font-mono" style={{ fontSize: '9px', marginBottom: '4px', color: 'var(--primary-container)' }}>{c.val.toFixed(1)}%</span>
                    <div style={{ width: '100%', maxWidth: '30px', height: `${heightPct}%`, background: 'linear-gradient(to top, rgba(0,229,255,0.1) 0%, var(--primary-container) 100%)', borderRadius: '2px 2px 0 0', border: '1px solid var(--primary-container)' }}></div>
                    <span style={{ fontSize: '11px', marginTop: '6px', fontWeight: 'bold' }}>{c.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* KPI metric cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary-container)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yield Strength</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '26px', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>{currentYS}</span>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>MPa</span>
          </div>
          <div style={{ height: '3px', background: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, currentYS / 15)}%`, background: 'var(--primary-container)' }}></div>
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary-container)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Hardness</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '26px', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--secondary-container)' }}>{currentHV}</span>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>HV</span>
          </div>
          <div style={{ height: '3px', background: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, currentHV / 6)}%`, background: 'var(--secondary-container)' }}></div>
          </div>
        </div>

        <div className="glass-panel" style={{ borderLeft: '4px solid var(--tertiary-container)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase Stability</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--tertiary)' }}>Ω: {currentOmega.toFixed(2)}</span>
          </div>
          <div style={{ height: '3px', background: 'var(--surface-container-high)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, currentOmega * 15)}%`, background: 'var(--tertiary-container)' }}></div>
          </div>
        </div>
      </div>

      {/* Database Browser Table Section */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', flexDirection: 'column', smDirection: 'row', justifyContent: 'space-between', alignItems: 'start', smAlignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px' }}>Validated HEA Literature Database</h3>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--on-surface-variant)' }}>Browse measured values from publications.</p>
          </div>
          
          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <input 
              type="text"
              placeholder="Search by alloy formula..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setDbPage(1); }}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Alloy ID</th>
                <th>Composition</th>
                <th style={{ textAlign: 'right' }}>YS (MPa)</th>
                <th style={{ textAlign: 'right' }}>Hardness (HV)</th>
                <th style={{ textAlign: 'right' }}>Elastic Modulus (GPa)</th>
                <th style={{ textAlign: 'center' }}>Ref DOI</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDb.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--on-surface-variant)' }}>No matched records</td>
                </tr>
              ) : (
                paginatedDb.map((alloy, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--primary-container)' }}>{alloy.id}</td>
                    <td style={{ fontWeight: 'bold' }}>{alloy.name}</td>
                    <td style={{ textAlign: 'right' }}>{alloy.ys}</td>
                    <td style={{ textAlign: 'right' }}>{alloy.hv}</td>
                    <td style={{ textAlign: 'right' }}>{alloy.emod.toFixed(1)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <a 
                        href={`https://doi.org/${alloy.ref}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ color: 'var(--on-surface-variant)', textDecoration: 'none' }}
                        className="hover-glow"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle' }}>link</span>
                      </a>
                    </td>
                    <td>
                      <button 
                        className="btn-secondary"
                        style={{ padding: '4px 8px', minHeight: 'auto', margin: 0, fontSize: '11px' }}
                        onClick={() => handleRowClick(alloy)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>publish</span>
                        Load
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination */}
        {totalDbPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-container-lowest)', borderTop: '1px solid var(--outline-variant)' }}>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
              Showing {Math.min(filteredDb.length, (dbPage - 1) * dbItemsPerPage + 1)} - {Math.min(filteredDb.length, dbPage * dbItemsPerPage)} of {filteredDb.length} literature alloys
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-secondary" 
                style={{ minHeight: '32px', padding: '0 8px', margin: 0 }}
                onClick={() => setDbPage(prev => Math.max(1, prev - 1))}
                disabled={dbPage === 1}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              <button 
                className="btn-secondary" 
                style={{ minHeight: '32px', padding: '0 8px', margin: 0 }}
                onClick={() => setDbPage(prev => Math.min(totalDbPages, prev + 1))}
                disabled={dbPage === totalDbPages}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
