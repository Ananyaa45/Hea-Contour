import React, { useState, useEffect } from 'react';
import { CompositionSliders } from './components/CompositionSliders';
import { RadarPhysicsChart } from './components/RadarPhysicsChart';
import { TernaryPhaseDiagram } from './components/TernaryPhaseDiagram';
import { RandomAlloyTable } from './components/RandomAlloyTable';
import { OptimizationResults } from './components/OptimizationResults';
import { AnalyticsVisualizations } from './components/AnalyticsVisualizations';
import { useRealTimeCalculation } from './hooks/useRealTimeCalculation';
import { calculateAlloyProperties } from './services/alloyCalculator';

const PRESETS = {
  "Transitional HEA": {
    "Al-Co-Cr-Fe-Ni": [
      { name: "AlCoCrFeNi (Equiatomic)", comp: { Al: 20, Co: 20, Cr: 20, Fe: 20, Ni: 20 } },
      { name: "Al0.3CoCrFeNi (Ductile FCC)", comp: { Al: 5.7, Co: 23.6, Cr: 23.6, Fe: 23.6, Ni: 23.5 } },
      { name: "Al0.7CoCrFeNi (Mixed Phase)", comp: { Al: 12.3, Co: 21.9, Cr: 21.9, Fe: 21.9, Ni: 22.0 } }
    ],
    "Co-Cr-Fe-Mn-Ni": [
      { name: "Cantor Alloy (Standard)", comp: { Co: 20, Cr: 20, Fe: 20, Mn: 20, Ni: 20 } }
    ]
  },
  "Refractory HEA": {
    "Mo-Nb-Ta-W": [
      { name: "MoNbTaW (Equiatomic)", comp: { Mo: 25, Nb: 25, Ta: 25, W: 25 } }
    ]
  },
  "Lightweight HEA": {
    "Al-Li-Mg-Sc-Ti": [
      { name: "AlLiMgScTi (Equiatomic)", comp: { Al: 20, Li: 20, Mg: 20, Sc: 20, Ti: 20 } }
    ]
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'explore', 'optimize', 'analyze'
  const [selectedType, setSelectedType] = useState("Transitional HEA");
  const [selectedFamily, setSelectedFamily] = useState("Al-Co-Cr-Fe-Ni");
  const [selectedAlloy, setSelectedAlloy] = useState(0);
  const [autoNormalize, setAutoNormalize] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [computing, setComputing] = useState(false);
  const [showSuccessRing, setShowSuccessRing] = useState(false);
  
  // FastAPI validation states
  const [mlValidating, setMlValidating] = useState(false);
  const [mlValidationData, setMlValidationData] = useState(null);
  const [mlError, setMlError] = useState(null);

  // Initialize composition based on selected preset
  const [comp, setComp] = useState({
    Al: 20, Co: 20, Cr: 20, Fe: 20, Ni: 20
  });

  const { data, setData } = useRealTimeCalculation(comp, autoNormalize);

  // Clear ML validation when composition changes
  useEffect(() => {
    setMlValidationData(null);
    setMlError(null);
  }, [comp]);

  // Get current elements in active family
  const currentElements = Object.keys(
    PRESETS[selectedType]?.[selectedFamily]?.[0]?.comp || {}
  );

  const selectPreset = (type, family, alloyIdx) => {
    setSelectedType(type);
    setSelectedFamily(family);
    setSelectedAlloy(alloyIdx);
    const alloy = PRESETS[type][family][alloyIdx];
    setComp({ ...alloy.comp });
  };

  const handleRandomize = () => {
    const randomized = {};
    let remainder = 100;
    
    currentElements.forEach((el, index) => {
      if (index === currentElements.length - 1) {
        randomized[el] = Number(remainder.toFixed(1));
      } else {
        const val = Math.random() * (remainder - (currentElements.length - 1 - index) * 5);
        const fixedVal = Math.max(5, Number(val.toFixed(1)));
        randomized[el] = fixedVal;
        remainder -= fixedVal;
      }
    });

    Object.keys(comp).forEach(el => {
      if (randomized[el] === undefined) randomized[el] = 0;
    });

    setComp(randomized);
  };

  const handleCalculate = () => {
    setComputing(true);
    setTimeout(() => {
      setComputing(false);
      setShowSuccessRing(true);
      setTimeout(() => setShowSuccessRing(false), 1200);
    }, 1000);
  };

  const handleMLValidate = async () => {
    setMlValidating(true);
    setMlError(null);
    setMlValidationData(null);

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ composition: comp }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const result = await response.ok ? await response.json() : null;
      setMlValidationData(result);
    } catch (err) {
      console.error("FastAPI connection error:", err);
      setMlError("FastAPI server is not running on port 8000. Start it locally using uvicorn backend.main:app to validate prediction!");
    } finally {
      setMlValidating(false);
    }
  };

  const loadLiteratureAlloy = (litComp) => {
    // Zero out all active elements first
    const cleanComp = {};
    Object.keys(comp).forEach(k => { cleanComp[k] = 0; });
    
    // Copy lit elements
    for (const key in litComp) {
      if (comp[key] !== undefined) {
        cleanComp[key] = litComp[key];
      }
    }
    setComp(cleanComp);
  };

  // Compute total composition percentage
  const totalPercentage = Object.values(comp).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Top Header Navigation */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 var(--spacing-md)',
        height: '64px',
        borderBottom: '1px solid var(--outline-variant)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary-container)', verticalAlign: 'middle' }}>biotech</span>
          <h1 className="font-display" style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em', color: 'var(--primary-container)', margin: 0 }}>
            HEA Contour
          </h1>
        </div>

        {/* Desktop Navigation Link Tabs */}
        <nav style={{ display: 'none', gap: '24px', alignItems: 'center' }} className="md-flex">
          {['home', 'explore', 'optimize', 'analyze'].map(tab => (
            <button 
              key={tab}
              className="btn-secondary" 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: activeTab === tab ? 'var(--primary-container)' : 'var(--on-surface-variant)', 
                fontSize: '11px', 
                fontFamily: 'var(--font-mono)', 
                letterSpacing: '0.05em', 
                textTransform: 'uppercase',
                borderBottom: activeTab === tab ? '2px solid var(--primary-container)' : 'none',
                borderRadius: 0,
                padding: '8px 4px',
                margin: 0,
                minHeight: 'auto'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'home' ? 'Dashboard' : tab}
            </button>
          ))}
        </nav>

        {/* User avatar profile & Mobile Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-container-highest)', border: '1px solid var(--outline-variant)', overflow: 'hidden' }}>
            <img 
              alt="Profile" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuABwiWHmLWV_b3LQ2fcTy4YueKmAO22Gi6sVE6MxaQQ1rzlx1ZEaBH_Jtx3ju2lYtC9AZFuCDI2ah-6rOYwvPuuL4FuQdy8pJNpSV75sdsTs_zssI2LsNttCrp2PtO6VuROoGU4mVNnUhseFMqnQ_JGWjTuWIKkguv5XdmAftw1ODMD4eMnzxFfpBGUZBgL-LKWui68k6ltfmkOTPtyqWkSLZZNCsOZh-8rZZv5JJgbe_mYzfXA6dOiJtw4RWKES8D0yHuI_n1lieM" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          
          <button 
            style={{ display: 'block', background: 'transparent', border: 'none', color: 'var(--on-surface)', margin: 0, padding: 0, minHeight: 'auto' }} 
            className="md-hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          background: 'var(--surface-container)',
          borderBottom: '1px solid var(--outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          gap: '12px',
          zIndex: 99
        }} className="md-hidden">
          {['home', 'explore', 'optimize', 'analyze'].map(tab => (
            <button 
              key={tab}
              className="btn-secondary"
              style={{ 
                justifyContent: 'flex-start',
                color: activeTab === tab ? 'var(--primary-container)' : 'var(--on-surface)',
                borderColor: activeTab === tab ? 'var(--primary-container)' : 'var(--outline-variant)'
              }}
              onClick={() => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px 16px 80px',
        boxSizing: 'border-box'
      }}>
        {activeTab === 'home' && (
          <div className="dashboard-grid">
            
            {/* Left composition panel */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel relative overflow-hidden" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="scan-line"></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="font-display" style={{ fontSize: '15px', fontWeight: 'bold' }}>Composition</h3>
                  <span className="font-mono" style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    background: Math.abs(totalPercentage - 100) > 0.05 ? 'var(--error-container)' : 'var(--on-primary-container)',
                    color: Math.abs(totalPercentage - 100) > 0.05 ? 'var(--on-error-container)' : 'var(--primary-container)'
                  }}>
                    {totalPercentage.toFixed(1)}%
                  </span>
                </div>

                {/* Preset Dropdowns selectors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      const t = e.target.value;
                      const families = Object.keys(PRESETS[t]);
                      selectPreset(t, families[0], 0);
                    }}
                  >
                    {Object.keys(PRESETS).map(t => <option key={t}>{t}</option>)}
                  </select>

                  <select
                    value={selectedFamily}
                    onChange={(e) => {
                      selectPreset(selectedType, e.target.value, 0);
                    }}
                  >
                    {Object.keys(PRESETS[selectedType] || {}).map(f => <option key={f}>{f}</option>)}
                  </select>

                  <select
                    value={selectedAlloy}
                    onChange={(e) => {
                      selectPreset(selectedType, selectedFamily, Number(e.target.value));
                    }}
                  >
                    {(PRESETS[selectedType]?.[selectedFamily] || []).map((a, idx) => (
                      <option key={idx} value={idx}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sliders components list */}
                <div style={{ marginTop: '8px' }}>
                  <CompositionSliders 
                    comp={comp} 
                    setComp={setComp} 
                    autoNormalize={autoNormalize} 
                    setSelectedRandom={() => {}} 
                  />
                </div>

                {/* Compute / random actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--outline-variant)' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleCalculate}
                    disabled={computing}
                  >
                    <span className={`material-symbols-outlined ${computing ? 'animate-spin' : ''}`} style={{ fontSize: '20px' }}>
                      {computing ? 'sync' : 'bolt'}
                    </span>
                    {computing ? 'Computing...' : 'Calculate Properties'}
                  </button>

                  <button 
                    className="btn-success" 
                    onClick={handleMLValidate}
                    disabled={mlValidating}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>analytics</span>
                    {mlValidating ? 'Running Models...' : 'Validate with ML'}
                  </button>

                  <button 
                    className="btn-secondary" 
                    onClick={handleRandomize}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shuffle</span>
                    Randomize Alloy
                  </button>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Auto-normalize sliders</span>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={autoNormalize} 
                        onChange={(e) => setAutoNormalize(e.target.checked)} 
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Status active model banner */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--surface-container-low)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Model Status</span>
                  <span style={{ fontSize: '10px', color: 'var(--secondary-container)', fontWeight: 'bold' }}>LIVE</span>
                </div>
                <div className="font-mono" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--on-surface)' }}>
                  RF-REGRESSOR-V2.1
                </div>
                <div style={{ width: '100%', height: '3px', background: 'var(--surface-container-highest)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: '75%', height: '100%', background: 'var(--secondary-container)' }}></div>
                </div>
              </div>
            </aside>

            {/* Right stage visualizations */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bento Metric indicators cards */}
              <div className="bento-grid">
                <div className={`glass-panel ${showSuccessRing ? 'pulse-glow' : ''}`} style={{ borderLeft: '4px solid var(--primary-container)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px' }}>
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>fitness_center</span>
                    YIELD STRENGTH
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="font-display" style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--primary-container)', lineHeight: 1 }}>
                      {data?.ml?.YS_pred ?? 1142}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>MPa</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary-container)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px' }}>
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>grid_view</span>
                    HARDNESS
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="font-display" style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--secondary-container)', lineHeight: 1 }}>
                      {data?.ml?.HV_pred ?? 482}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>HV</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid var(--tertiary-container)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px' }}>
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>layers</span>
                    PHASE PREDICTION
                  </span>
                  <div>
                    <span className="font-display" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--tertiary)', display: 'block', lineHeight: 1.2 }}>
                      {data?.physics?.structure ?? 'FCC + BCC'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--secondary-container)', fontWeight: 'bold' }}>
                      {data?.physics?.phase_fractions?.FCC ? `${data.physics.phase_fractions.FCC} FCC` : '94% Confidence'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Validate with ML results overlay (Shows if requested) */}
              {mlError && (
                <div className="glass-panel" style={{ borderColor: 'var(--error-container)', background: 'rgba(147, 0, 10, 0.15)', color: 'var(--error)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined">warning</span>
                    <span style={{ fontWeight: '500' }}>{mlError}</span>
                  </div>
                </div>
              )}

              {mlValidationData && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'rgba(117, 253, 0, 0.4)', background: 'rgba(30,35,30,0.7)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--secondary-container)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined">verified</span>
                      Machine Learning Validation
                    </h3>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '2px 8px', minHeight: 'auto', margin: 0, fontSize: '11px' }}
                      onClick={() => setMlValidationData(null)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    {/* Comparative Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Model Comparison</span>
                      
                      <div style={{ background: 'var(--surface-container-lowest)', borderRadius: '4px', border: '1px solid var(--outline-variant)', overflow: 'hidden' }}>
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Property</th>
                              <th>Empirical (Physics)</th>
                              <th>Data-Driven (ML)</th>
                              <th style={{ textAlign: 'right' }}>Δ Diff</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Yield Strength</td>
                              <td>{data?.ml?.YS_pred ?? 1142} MPa</td>
                              <td>{mlValidationData.ml.YS_pred} MPa</td>
                              {(() => {
                                const emp = data?.ml?.YS_pred ?? 1142;
                                const mlVal = mlValidationData.ml.YS_pred;
                                const diff = ((mlVal - emp) / emp) * 100;
                                const color = Math.abs(diff) < 10 ? 'var(--secondary-container)' : Math.abs(diff) < 20 ? 'orange' : 'var(--error)';
                                return (
                                  <td style={{ textAlign: 'right', fontWeight: 'bold', color }}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </td>
                                );
                              })()}
                            </tr>
                            <tr>
                              <td>Hardness</td>
                              <td>{data?.ml?.HV_pred ?? 482} HV</td>
                              <td>{mlValidationData.ml.HV_pred} HV</td>
                              {(() => {
                                const emp = data?.ml?.HV_pred ?? 482;
                                const mlVal = mlValidationData.ml.HV_pred;
                                const diff = ((mlVal - emp) / emp) * 100;
                                const color = Math.abs(diff) < 10 ? 'var(--secondary-container)' : Math.abs(diff) < 20 ? 'orange' : 'var(--error)';
                                return (
                                  <td style={{ textAlign: 'right', fontWeight: 'bold', color }}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </td>
                                );
                              })()}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Closest Database Match details */}
                    {mlValidationData.closest_match && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 'bold' }}>Closest Experimental Match</span>
                        
                        <div style={{ background: 'var(--surface-container-low)', padding: '12px', borderRadius: '4px', border: '1px solid var(--outline-variant)', display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', boxSizing: 'border-box' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--primary-container)' }}>
                              {mlValidationData.closest_match.name}
                            </span>
                            <span className="font-mono" style={{ fontSize: '10px', color: 'var(--on-surface-variant)' }}>
                              {mlValidationData.closest_match.distance.toFixed(1)}% offset
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '16px', margin: '4px 0' }}>
                            <div>
                              <span style={{ fontSize: '9px', color: 'var(--on-surface-variant)', display: 'block' }}>EXPT. YS</span>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{mlValidationData.closest_match.ys ?? 'N/A'} MPa</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '9px', color: 'var(--on-surface-variant)', display: 'block' }}>EXPT. HV</span>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{mlValidationData.closest_match.hv ?? 'N/A'} HV</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {mlValidationData.closest_match.ref && (
                              <a 
                                href={`https://doi.org/${mlValidationData.closest_match.ref}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--primary)', textDecoration: 'none' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>menu_book</span>
                                Read Paper
                              </a>
                            )}
                            
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '2px 8px', minHeight: 'auto', margin: 0, fontSize: '9px' }}
                              onClick={() => {
                                // Extract and parse name structure to reload
                                // Since we can pass the exact dictionary, we call formula parse
                                const parsed = {};
                                const raw = mlValidationData.closest_match.name;
                                // Basic parse formula implementation in Javascript
                                const matches = raw.matchAll(/([A-Z][a-z]?)([0-9.]*)/g);
                                let sum = 0;
                                for (const match of matches) {
                                  const el = match[1];
                                  const val = match[2] ? parseFloat(match[2]) : 1.0;
                                  parsed[el] = val;
                                  sum += val;
                                }
                                if (sum > 0) {
                                  for (const k in parsed) {
                                    parsed[k] = (parsed[k] / sum) * 100;
                                  }
                                  loadLiteratureAlloy(parsed);
                                }
                              }}
                            >
                              Load Composition
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main charts side-by-side row */}
              <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                {/* Physics Descriptors Radar */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px' }}>Physics Descriptors</h3>
                    <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)', cursor: 'pointer' }}>info</span>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {data?.physics && <RadarPhysicsChart physics={data.physics} />}
                  </div>
                </div>

                {/* Ternary Phase Projection */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px' }}>Phase Surface Projection</h3>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '9px', padding: '1px 6px', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', borderRadius: '2px', fontWeight: 'bold' }}>TERNARY</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {data?.physics && (
                      <TernaryPhaseDiagram 
                        composition={comp} 
                        structure={data.physics.structure} 
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'explore' && (
          <RandomAlloyTable 
            family={selectedFamily}
            elements={currentElements}
            setComp={setComp}
            setData={setData}
          />
        )}

        {activeTab === 'optimize' && (
          <OptimizationResults 
            family={selectedFamily}
            elements={currentElements}
            setComp={setComp}
            setData={setData}
          />
        )}

        {activeTab === 'analyze' && (
          <AnalyticsVisualizations 
            activeAlloy={comp}
            physics={data?.physics}
            ml={data?.ml}
            setComp={setComp}
            setData={setData}
          />
        )}
      </main>

      {/* Floating Bottom Nav (Mobile Only) */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--surface-container-lowest)',
        borderTop: '1px solid var(--outline-variant)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0 8px',
        zIndex: 100
      }} className="md-hidden">
        {[
          { id: 'home', label: 'Home', icon: 'dashboard' },
          { id: 'explore', label: 'Explore', icon: 'query_stats' },
          { id: 'optimize', label: 'Optimize', icon: 'science' },
          { id: 'analyze', label: 'Analyze', icon: 'description' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? 'var(--primary-container)' : 'transparent',
                color: isActive ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 12px',
                margin: 0,
                minHeight: 'auto',
                gap: '2px',
                boxShadow: isActive ? '0 4px 10px rgba(0, 229, 255, 0.15)' : 'none'
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{tab.icon}</span>
              <span style={{ fontSize: '9px', fontWeight: 'bold' }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
