import React, { useState, useEffect } from 'react';

export function CompositionSliders({ comp, setComp, lockedElements = {}, setLockedElements, setSelectedRandom }) {
  const [sliderError, setSliderError] = useState(null);
  const [localInputs, setLocalInputs] = useState({});
  const [focusedElement, setFocusedElement] = useState(null);

  // Sync local input values with composition changes (except for the active focused input)
  useEffect(() => {
    const newInputs = {};
    Object.keys(comp).forEach(el => {
      if (el !== focusedElement) {
        newInputs[el] = comp[el].toFixed(1);
      } else {
        newInputs[el] = localInputs[el];
      }
    });
    setLocalInputs(prev => ({ ...prev, ...newInputs }));
  }, [comp, focusedElement]);

  const toggleLock = (el) => {
    if (setLockedElements) {
      setLockedElements(prev => ({ ...prev, [el]: !prev[el] }));
    }
  };

  const handleChange = (el, val) => {
    setSelectedRandom && setSelectedRandom(null);
    
    if (isNaN(val) || val < 0 || val > 100) {
      setSliderError(`Value for ${el} must be between 0% and 100%.`);
      return;
    }
    setSliderError(null);

    // Auto-lock the element the user is editing so it doesn't change on subsequent edits
    if (setLockedElements) {
      setLockedElements(prev => ({ ...prev, [el]: true }));
    }

    setComp(prev => {
      let updated = { ...prev };
      
      // Elements that are locked (excluding the one being edited)
      const lockedKeys = Object.keys(prev).filter(k => k !== el && lockedElements[k]);
      // Elements that are unlocked
      const unlockedKeys = Object.keys(prev).filter(k => k !== el && !lockedElements[k]);
      
      const lockedSum = lockedKeys.reduce((sum, k) => sum + (prev[k] ?? 0), 0);
      
      // Check if new value exceeds the remaining budget
      if (val + lockedSum > 100) {
        setSliderError(`Sum of locked elements & ${el} (${(val + lockedSum).toFixed(1)}%) cannot exceed 100%.`);
        return prev; // Reject changes
      }
      
      const remainder = 100 - val - lockedSum;
      
      if (unlockedKeys.length === 0) {
        // If all other elements are locked, we cannot adjust this unless we unlock something
        setSliderError(`All other elements are locked. Unlock at least one element to adjust.`);
        return prev; // Reject changes
      }
      
      const unlockedSum = unlockedKeys.reduce((sum, k) => sum + (prev[k] ?? 0), 0);
      
      if (unlockedSum > 0 && remainder >= 0) {
        unlockedKeys.forEach(k => {
          updated[k] = Number(((prev[k] / unlockedSum) * remainder).toFixed(1));
        });
      } else if (unlockedKeys.length > 0 && remainder >= 0) {
        unlockedKeys.forEach(k => {
          updated[k] = Number((remainder / unlockedKeys.length).toFixed(1));
        });
      }
      updated[el] = val;

      // Final sum correction to ensure total sums to exactly 100.0%
      const currentSum = Object.values(updated).reduce((a, b) => a + b, 0);
      const diff = 100 - currentSum;
      if (Math.abs(diff) > 0.01 && unlockedKeys.length > 0) {
        const lastKey = unlockedKeys[unlockedKeys.length - 1];
        updated[lastKey] = Number((updated[lastKey] + diff).toFixed(1));
      }

      return updated;
    });
  };

  const handleInputChange = (el, valString) => {
    setLocalInputs(prev => ({ ...prev, [el]: valString }));

    if (valString.trim() === '') {
      handleChange(el, 0);
      return;
    }

    const val = parseFloat(valString);
    if (!isNaN(val)) {
      handleChange(el, val);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Object.keys(comp).map(el => {
        const val = comp[el] ?? 0;
        const displayVal = localInputs[el] !== undefined ? localInputs[el] : val.toFixed(1);
        const isLocked = !!lockedElements[el];
        
        return (
          <div key={el} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => toggleLock(el)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    margin: 0,
                    cursor: 'pointer',
                    color: isLocked ? 'var(--primary-container)' : 'var(--outline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'auto',
                    transition: 'color 0.2s ease'
                  }}
                  title={isLocked ? "Unlock element value" : "Lock element value"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {isLocked ? 'lock' : 'lock_open'}
                  </span>
                </button>
                <span className="font-mono" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--on-surface-variant)' }}>
                  {el}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={displayVal}
                  onChange={(e) => handleInputChange(el, e.target.value)}
                  onFocus={() => setFocusedElement(el)}
                  onBlur={() => setFocusedElement(null)}
                  style={{
                    width: '64px',
                    background: 'var(--surface-container-lowest)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '4px',
                    color: 'var(--primary-container)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    textAlign: 'right',
                    padding: '2px 6px',
                    outline: 'none',
                    MozAppearance: 'textfield'
                  }}
                />
                <span className="font-mono" style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={val}
              onChange={(e) => handleChange(el, parseFloat(e.target.value))}
            />
          </div>
        );
      })}
      {sliderError && (
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px', textAlign: 'center' }}>
          ⚠️ {sliderError}
        </span>
      )}
    </div>
  );
}
