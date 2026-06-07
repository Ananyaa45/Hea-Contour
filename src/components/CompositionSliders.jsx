import React from 'react';

export function CompositionSliders({ comp, setComp, autoNormalize, setSelectedRandom }) {
  const handleChange = (el, val) => {
    setSelectedRandom(null);
    setComp(prev => {
      let updated = { ...prev, [el]: val };
      if (autoNormalize) {
        // Find sum excluding current element to distribute remainder
        const otherKeys = Object.keys(prev).filter(k => k !== el);
        const otherSum = otherKeys.reduce((a, b) => a + prev[b], 0);
        const remainder = 100 - val;

        if (otherSum > 0 && remainder >= 0) {
          otherKeys.forEach(k => {
            updated[k] = Number(((prev[k] / otherSum) * remainder).toFixed(1));
          });
        } else if (otherKeys.length > 0) {
          // If other sum was 0, split evenly
          otherKeys.forEach(k => {
            updated[k] = Number((remainder / otherKeys.length).toFixed(1));
          });
        }
        updated[el] = val;
      }
      return updated;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Object.keys(comp).map(el => {
        const val = comp[el] ?? 0;
        return (
          <div key={el} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-mono" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--on-surface-variant)' }}>
                {el}
              </span>
              <span className="font-mono" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-container)' }}>
                {val.toFixed(1)}%
              </span>
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
    </div>
  );
}
