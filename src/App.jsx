import React, { useState, useEffect } from 'react';
import { CompositionSliders } from './components/CompositionSliders';
import { RadarPhysicsChart } from './components/RadarPhysicsChart';
import { TernaryPhaseDiagram } from './components/TernaryPhaseDiagram';
import { RandomAlloyTable } from './components/RandomAlloyTable';
import { OptimizationResults } from './components/OptimizationResults';
import { AnalyticsVisualizations } from './components/AnalyticsVisualizations';
import { useRealTimeCalculation } from './hooks/useRealTimeCalculation';

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

const parseCompositionFormula = (text, currentElements, currentComp) => {
  const regex = /([A-Z][a-z]?)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/g;
  let match;
  const parsed = {};
  
  while ((match = regex.exec(text)) !== null) {
    const el = match[1];
    const val = parseFloat(match[2]);
    parsed[el] = val;
  }
  
  const parsedKeys = Object.keys(parsed);
  if (parsedKeys.length === 0) {
    return { valid: false, error: "Enter elements and composition values, e.g. Co30 Cr30" };
  }
  
  for (const el of parsedKeys) {
    if (!currentElements.includes(el)) {
      return { valid: false, error: `'${el}' is not in the active alloy family.` };
    }
    if (parsed[el] < 0 || parsed[el] > 100) {
      return { valid: false, error: `Composition for '${el}' must be between 0% and 100%.` };
    }
  }
  
  const parsedSum = parsedKeys.reduce((sum, el) => sum + parsed[el], 0);
  if (parsedSum > 100) {
    return { valid: false, error: `Total composition (${parsedSum.toFixed(1)}%) cannot exceed 100%.` };
  }
  
  const unspecifiedKeys = currentElements.filter(k => !parsedKeys.includes(k));
  
  if (unspecifiedKeys.length === 0) {
    if (Math.abs(parsedSum - 100) > 0.05) {
      return { valid: false, error: `Total composition must sum to exactly 100% (currently ${parsedSum.toFixed(1)}%).` };
    }
    return { valid: true, composition: parsed };
  }
  
  const remainder = 100 - parsedSum;
  const unspecifiedSum = unspecifiedKeys.reduce((sum, k) => sum + (currentComp[k] ?? 0), 0);
  
  const newComp = { ...currentComp };
  parsedKeys.forEach(k => {
    newComp[k] = parsed[k];
  });
  
  if (unspecifiedSum > 0) {
    unspecifiedKeys.forEach(k => {
      newComp[k] = Number(((currentComp[k] / unspecifiedSum) * remainder).toFixed(1));
    });
  } else {
    unspecifiedKeys.forEach(k => {
      newComp[k] = Number((remainder / unspecifiedKeys.length).toFixed(1));
    });
  }
  
  const currentSum = Object.values(newComp).reduce((a, b) => a + b, 0);
  const diff = 100 - currentSum;
  if (Math.abs(diff) > 0.01 && unspecifiedKeys.length > 0) {
    const lastKey = unspecifiedKeys[unspecifiedKeys.length - 1];
    newComp[lastKey] = Number((newComp[lastKey] + diff).toFixed(1));
  }
  
  return { valid: true, composition: newComp };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'explore', 'optimize', 'analyze'
  const [selectedType, setSelectedType] = useState("Transitional HEA");
  const [selectedFamily, setSelectedFamily] = useState("Al-Co-Cr-Fe-Ni");
  const [selectedAlloy, setSelectedAlloy] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [formulaError, setFormulaError] = useState(null);
  const [isFormulaFocused, setIsFormulaFocused] = useState(false);
  const [lockedElements, setLockedElements] = useState({});

  // Initialize composition based on selected preset
  const [comp, setComp] = useState({
    Al: 20, Co: 20, Cr: 20, Fe: 20, Ni: 20
  });

  const { data, setData } = useRealTimeCalculation(comp);

  // Sync formula input text with composition changes (unless user is actively typing)
  useEffect(() => {
    if (!isFormulaFocused) {
      const formatted = Object.entries(comp)
        .filter(([_, val]) => val > 0)
        .map(([el, val]) => `${el}${val.toFixed(1)}`)
        .join(' ');
      setFormulaInput(formatted);
      setFormulaError(null);
    }
  }, [comp, isFormulaFocused]);

  const handleFormulaChange = (text) => {
    setFormulaInput(text);
    
    if (text.trim() === '') {
      setFormulaError(null);
      setLockedElements({});
      return;
    }
    
    const parseResult = parseCompositionFormula(text, currentElements, comp);
    if (parseResult.valid) {
      setComp(parseResult.composition);
      setFormulaError(null);
      
      // Auto-lock elements that were explicitly specified in the typed formula
      const regex = /([A-Z][a-z]?)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/g;
      let match;
      const parsedLocks = {};
      while ((match = regex.exec(text)) !== null) {
        parsedLocks[match[1]] = true;
      }
      setLockedElements(parsedLocks);
    } else {
      setFormulaError(parseResult.error);
    }
  };

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
    setLockedElements({});
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

    // Zero out other elements
    Object.keys(comp).forEach(el => {
      if (randomized[el] === undefined) randomized[el] = 0;
    });

    setComp(randomized);
    setLockedElements({});
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
          <button 
            className="btn-secondary" 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === 'home' ? 'var(--primary-container)' : 'var(--on-surface-variant)', 
              fontSize: '11px', 
              fontFamily: 'var(--font-mono)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase',
              borderBottom: activeTab === 'home' ? '2px solid var(--primary-container)' : 'none',
              borderRadius: 0,
              padding: '8px 4px',
              margin: 0,
              minHeight: 'auto'
            }}
            onClick={() => setActiveTab('home')}
          >
            Dashboard
          </button>
          <button 
            className="btn-secondary" 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === 'explore' ? 'var(--primary-container)' : 'var(--on-surface-variant)', 
              fontSize: '11px', 
              fontFamily: 'var(--font-mono)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase',
              borderBottom: activeTab === 'explore' ? '2px solid var(--primary-container)' : 'none',
              borderRadius: 0,
              padding: '8px 4px',
              margin: 0,
              minHeight: 'auto'
            }}
            onClick={() => setActiveTab('explore')}
          >
            Explore
          </button>
          <button 
            className="btn-secondary" 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === 'optimize' ? 'var(--primary-container)' : 'var(--on-surface-variant)', 
              fontSize: '11px', 
              fontFamily: 'var(--font-mono)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase',
              borderBottom: activeTab === 'optimize' ? '2px solid var(--primary-container)' : 'none',
              borderRadius: 0,
              padding: '8px 4px',
              margin: 0,
              minHeight: 'auto'
            }}
            onClick={() => setActiveTab('optimize')}
          >
            Optimize
          </button>
          <button 
            className="btn-secondary" 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: activeTab === 'analyze' ? 'var(--primary-container)' : 'var(--on-surface-variant)', 
              fontSize: '11px', 
              fontFamily: 'var(--font-mono)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase',
              borderBottom: activeTab === 'analyze' ? '2px solid var(--primary-container)' : 'none',
              borderRadius: 0,
              padding: '8px 4px',
              margin: 0,
              minHeight: 'auto'
            }}
            onClick={() => setActiveTab('analyze')}
          >
            Analyze
          </button>
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
        {/* Render View Tabs */}
        {activeTab === 'home' && (
          <div className="dashboard-grid">
            
            {/* Left composition panel */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel relative overflow-hidden" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="scan-line"></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="font-display" style={{ fontSize: '15px', fontWeight: 'bold' }}>Composition</h3>
                    {Object.values(lockedElements).some(v => v) && (
                      <button
                        onClick={() => setLockedElements({})}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary-container)',
                          fontSize: '11px',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          margin: 0,
                          minHeight: 'auto',
                          fontWeight: '500'
                        }}
                      >
                        Unlock All
                      </button>
                    )}
                  </div>
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

                {/* Manual Formula Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <label className="font-display" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: '600' }}>
                    Manual Formula Input
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Co30 Cr30"
                    value={formulaInput}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    onFocus={() => setIsFormulaFocused(true)}
                    onBlur={() => setIsFormulaFocused(false)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: 'var(--surface-container-lowest)',
                      border: formulaError ? '1px solid var(--error)' : '1px solid var(--outline-variant)',
                      color: 'var(--on-surface)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                  {formulaError && (
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--error)', marginTop: '2px' }}>
                      ⚠️ {formulaError}
                    </span>
                  )}
                </div>

                {/* Sliders components list */}
                <div style={{ marginTop: '8px' }}>
                  <CompositionSliders 
                    comp={comp} 
                    setComp={setComp} 
                    lockedElements={lockedElements}
                    setLockedElements={setLockedElements}
                    setSelectedRandom={() => {}} 
                  />
                </div>

                {/* Compute / random actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--outline-variant)' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleRandomize}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shuffle</span>
                    Randomize Alloy
                  </button>
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
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary-container)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100px' }}>
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
