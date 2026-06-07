import { useState, useEffect } from 'react';
import { calculateAlloyProperties } from '../services/alloyCalculator';

export function useRealTimeCalculation(comp, autoNormalize) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const result = calculateAlloyProperties(comp);
    setData(result);
  }, [comp, autoNormalize]);

  return { data, setData };
}
