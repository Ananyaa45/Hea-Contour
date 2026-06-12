import React, { useState, useEffect } from 'react';

export function CompositionSliders({ comp, setComp, autoNormalize, setSelectedRandom }) {
  // State for locked elements: { [elSymbol]: boolean }
  const [locked, setLocked] = useState({});
  // Local state to store raw input strings so users can type decimals (e.g., '6.', '60.') without parser reset
  const [inputValues, setInputValues] = useState({});

  // Reset locks and inputs if elements in composition change (e.g. preset changed)
  const elementKeys = Object.keys(comp).join(',');
  useEffect(() => {
    setLocked({});
    const initialInputs = {};
    for (const key in comp) {
      initialInputs[key] = (comp[key] ?? 0).toFixed(1);
    }
    setInputValues(initialInputs);
  }, [elementKeys]);

  // Synchronize local input string state when comp is updated from outside (like preset selection)
  useEffect(() => {
    const nextInputs = {};
    for (const key in comp) {
      if (inputValues[key] === undefined || parseFloat(inputValues[key]) !== comp[key]) {
        nextInputs[key] = (comp[key] ?? 0).toFixed(1);
      } else {
        nextInputs[key] = inputValues[key];
      }
    }
    setInputValues(prev => ({ ...prev, ...nextInputs }));
  }, [comp]);

  const toggleLock = (el) => {
    setLocked(prev => ({
      ...prev,
      [el]: !prev[el]
    }));
  };

  const handleUpdate = (el, val) => {
    setSelectedRandom(null);
    
    // Automatically lock this element because it is being manually edited
    setLocked(prev => ({
      ...prev,
      [el]: true
    }));

    setComp(prev => {
      // Find sum of locked elements (excluding the one being changed)
      const lockedKeys = Object.keys(prev).filter(k => (locked[k] || k === el) && k !== el);
      const sumLocked = lockedKeys.reduce((sum, k) => sum + (prev[k] ?? 0), 0);
      
      // Target value is clamped to remaining allowed percentage
      const maxVal = 100 - sumLocked;
      const clampedVal = Math.max(0, Math.min(val, maxVal));
      
      const updated = { ...prev };
      updated[el] = clampedVal;
      
      if (autoNormalize) {
        // Find unlocked elements (excluding the one being changed)
        const unlockedKeys = Object.keys(prev).filter(k => !locked[k] && k !== el);
        const sumUnlocked = unlockedKeys.reduce((sum, k) => sum + (prev[k] ?? 0), 0);
        const remainder = 100 - clampedVal - sumLocked;
        
        if (sumUnlocked > 0 && remainder >= 0) {
          unlockedKeys.forEach(k => {
            updated[k] = Number(((prev[k] / sumUnlocked) * remainder).toFixed(1));
          });
        } else if (unlockedKeys.length > 0 && remainder >= 0) {
          // If sum was 0, distribute remainder equally
          unlockedKeys.forEach(k => {
            updated[k] = Number((remainder / unlockedKeys.length).toFixed(1));
          });
        }
      }
      
      return updated;
    });
  };

  const handleInputChange = (el, stringVal) => {
    // Save raw string in local state first
    setInputValues(prev => ({
      ...prev,
      [el]: stringVal
    }));

    const val = parseFloat(stringVal);
    if (!isNaN(val)) {
      handleUpdate(el, val);
    }
  };

  const handleInputBlur = (el) => {
    // On blur, reset input string to the formatted numeric value
    setInputValues(prev => ({
      ...prev,
      [el]: (comp[el] ?? 0).toFixed(1)
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Object.keys(comp).map(el => {
        const val = comp[el] ?? 0;
        const isLocked = !!locked[el];
        const displayVal = inputValues[el] !== undefined ? inputValues[el] : val.toFixed(1);
        
        return (
          <div key={el} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Clickable Lock Icon */}
                <button
                  type="button"
                  onClick={() => toggleLock(el)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    minHeight: 'auto',
                    cursor: 'pointer',
                    color: isLocked ? 'var(--primary-container)' : 'var(--on-surface-variant)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={isLocked ? 'Unlock Element' : 'Lock Element'}
                >
                  <span 
                    className="material-symbols-outlined" 
                    style={{ 
                      fontSize: '16px',
                      filter: isLocked ? 'drop-shadow(0 0 3px var(--primary-container))' : 'none'
                    }}
                  >
                    {isLocked ? 'lock' : 'lock_open'}
                  </span>
                </button>
                
                <span className="font-mono" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--on-surface-variant)' }}>
                  {el}
                </span>
              </div>
              
              {/* Manual Entry Number Input Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <input
                  type="text"
                  value={displayVal}
                  onChange={(e) => handleInputChange(el, e.target.value)}
                  onBlur={() => handleInputBlur(el)}
                  style={{
                    width: '60px',
                    background: 'var(--surface-container-high)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '4px',
                    color: 'var(--primary-container)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'right',
                    padding: '2px 6px',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>%</span>
              </div>
            </div>
            
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={val}
              onChange={(e) => handleUpdate(el, parseFloat(e.target.value))}
              style={{
                cursor: 'pointer'
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
