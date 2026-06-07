// HEA Contour Physics & Mechanical Properties Calculator
// Based on established materials science rules of mixtures, thermodynamic properties, and solid solution models.

export const ELEMENT_DATABASE = {
  Al: { name: 'Aluminum', r: 143, VEC: 3, chi: 1.61, Tm: 933, rho: 2.70 },
  Ni: { name: 'Nickel', r: 125, VEC: 10, chi: 1.91, Tm: 1728, rho: 8.90 },
  Fe: { name: 'Iron', r: 126, VEC: 8, chi: 1.83, Tm: 1811, rho: 7.87 },
  Cr: { name: 'Chromium', r: 128, VEC: 6, chi: 1.66, Tm: 2180, rho: 7.19 },
  Co: { name: 'Cobalt', r: 125, VEC: 9, chi: 1.88, Tm: 1768, rho: 8.90 },
  Mn: { name: 'Manganese', r: 127, VEC: 7, chi: 1.55, Tm: 1519, rho: 7.21 },
  Cu: { name: 'Copper', r: 128, VEC: 11, chi: 1.90, Tm: 1358, rho: 8.96 },
  
  Li: { name: 'Lithium', r: 152, VEC: 1, chi: 0.98, Tm: 453, rho: 0.53 },
  Mg: { name: 'Magnesium', r: 160, VEC: 2, chi: 1.31, Tm: 923, rho: 1.74 },
  Sc: { name: 'Scandium', r: 164, VEC: 3, chi: 1.36, Tm: 1814, rho: 2.99 },
  Ti: { name: 'Titanium', r: 147, VEC: 4, chi: 1.54, Tm: 1941, rho: 4.51 },
  
  Mo: { name: 'Molybdenum', r: 139, VEC: 6, chi: 2.16, Tm: 2896, rho: 10.28 },
  Nb: { name: 'Niobium', r: 146, VEC: 5, chi: 1.60, Tm: 2750, rho: 8.57 },
  Ta: { name: 'Tantalum', r: 146, VEC: 5, chi: 1.50, Tm: 3290, rho: 16.69 },
  W:  { name: 'Tungsten',  r: 139, VEC: 6, chi: 2.36, Tm: 3695, rho: 19.25 }
};

// Pairwise liquid mixing enthalpies (dH_mix in kJ/mol) for binary alloys
const BINARY_ENTHALPY_DATABASE = {
  Al: { Ni: -22, Fe: -11, Cr: -10, Co: -19, Ti: -17, Mg: -2, Mn: -19, Cu: -1, Li: -4, Sc: -18, Mo: -5, Nb: -18, Ta: -19, W: -13 },
  Co: { Cr: -4, Fe: -1, Ni: 0, Mn: -5, Cu: 6, Ti: -28, Mo: -5, Nb: -25, Ta: -24, W: -15 },
  Cr: { Fe: -1, Ni: -7, Mn: 2, Cu: 12, Ti: -7, Mo: 0, Nb: -7, Ta: -7, W: 0 },
  Fe: { Ni: -2, Mn: 0, Cu: 13, Ti: -17, Mo: -2, Nb: -16, Ta: -15, W: -8 },
  Ni: { Mn: -8, Cu: 2, Ti: -35, Mo: -7, Nb: -30, Ta: -29, W: -9 },
  Ti: { Mg: 16, Li: 32, Sc: 0, Mo: -4, Nb: 2, Ta: 1, W: 0, Cu: -9, Mn: -8 },
  Mo: { Nb: 0, Ta: 0, W: 0, Cu: 19, Mn: 5, Mg: 24 },
  Nb: { Ta: 0, W: 0, Cu: 3, Mn: -4, Mg: 31 },
  Ta: { W: 0, Cu: 2, Mn: -3, Mg: 32 },
  W:  { Cu: 23, Mn: 1, Mg: 36 }
};

// Retrieve mixing enthalpy between two elements
function getBinaryEnthalpy(el1, el2) {
  if (el1 === el2) return 0;
  if (BINARY_ENTHALPY_DATABASE[el1]?.[el2] !== undefined) {
    return BINARY_ENTHALPY_DATABASE[el1][el2];
  }
  if (BINARY_ENTHALPY_DATABASE[el2]?.[el1] !== undefined) {
    return BINARY_ENTHALPY_DATABASE[el2][el1];
  }
  // Fallback estimation using electronegativity (Pauling) & atomic radius difference
  const ch1 = ELEMENT_DATABASE[el1]?.chi ?? 1.8;
  const ch2 = ELEMENT_DATABASE[el2]?.chi ?? 1.8;
  const r1 = ELEMENT_DATABASE[el1]?.r ?? 130;
  const r2 = ELEMENT_DATABASE[el2]?.r ?? 130;
  
  const dChi = ch1 - ch2;
  const sizeDiff = (r1 - r2) / ((r1 + r2) / 2);
  
  return Math.round(-96.5 * dChi * dChi + 10 * sizeDiff * sizeDiff);
}

// Gas constant R in J/(mol K)
const R = 8.3144;

export function calculateAlloyProperties(composition) {
  // 1. Filter out elements with zero concentration and normalize
  const validElements = [];
  let sum = 0;
  
  for (const el in composition) {
    const val = Number(composition[el]);
    if (val > 0 && ELEMENT_DATABASE[el]) {
      validElements.push({ el, pct: val });
      sum += val;
    }
  }
  
  if (validElements.length === 0 || sum === 0) {
    return null;
  }
  
  // Normalize atomic fractions (sum of c_i = 1)
  const fractions = {};
  validElements.forEach(item => {
    fractions[item.el] = item.pct / sum;
  });
  
  // 2. Average Atomic Radius (r_bar) & Mismatch (delta)
  let r_bar = 0;
  validElements.forEach(item => {
    r_bar += fractions[item.el] * ELEMENT_DATABASE[item.el].r;
  });
  
  let deltaSqSum = 0;
  validElements.forEach(item => {
    const ratio = ELEMENT_DATABASE[item.el].r / r_bar;
    deltaSqSum += fractions[item.el] * Math.pow(1 - ratio, 2);
  });
  const delta = 100 * Math.sqrt(deltaSqSum); // in %
  
  // 3. Valence Electron Concentration (VEC)
  let VEC = 0;
  validElements.forEach(item => {
    VEC += fractions[item.el] * ELEMENT_DATABASE[item.el].VEC;
  });
  
  // 4. Density (rule of mixtures)
  let density = 0;
  validElements.forEach(item => {
    density += fractions[item.el] * ELEMENT_DATABASE[item.el].rho;
  });
  
  // 5. Melting Temperature (Tm)
  let Tm = 0;
  validElements.forEach(item => {
    Tm += fractions[item.el] * ELEMENT_DATABASE[item.el].Tm;
  });
  
  // 6. Electronegativity Difference (dChi)
  let chi_bar = 0;
  validElements.forEach(item => {
    chi_bar += fractions[item.el] * ELEMENT_DATABASE[item.el].chi;
  });
  
  let chiSqSum = 0;
  validElements.forEach(item => {
    chiSqSum += fractions[item.el] * Math.pow(ELEMENT_DATABASE[item.el].chi - chi_bar, 2);
  });
  const dChi = Math.sqrt(chiSqSum);
  
  // 7. Entropy of Mixing (dS_mix in J/mol K)
  let dS_mix = 0;
  validElements.forEach(item => {
    const c = fractions[item.el];
    dS_mix += -R * c * Math.log(c);
  });
  
  // 8. Enthalpy of Mixing (dH_mix in kJ/mol)
  let dH_mix = 0;
  for (let i = 0; i < validElements.length; i++) {
    for (let j = i + 1; j < validElements.length; j++) {
      const elA = validElements[i].el;
      const elB = validElements[j].el;
      const cA = fractions[elA];
      const cB = fractions[elB];
      const omegaAB = getBinaryEnthalpy(elA, elB);
      dH_mix += 4 * omegaAB * cA * cB;
    }
  }
  
  // 9. Omega Stability Parameter (omega)
  // omega = Tm * dS_mix / |dH_mix * 1000|
  let omega = 999;
  if (Math.abs(dH_mix) > 0.0001) {
    omega = (Tm * dS_mix) / (Math.abs(dH_mix) * 1000);
  }
  
  // 10. Phase Prediction
  // Establish thresholds:
  // Solid Solution (SS) region is typically delta <= 6.6% and omega >= 1.1.
  // BCC/FCC stability depends heavily on VEC.
  let structure = 'Intermetallic';
  let phase = 'Intermetallic Phase';
  let phase_fractions = { FCC: '0%', BCC: '0%', HCP: '0%' };
  
  const isSolidSolution = (delta <= 6.6 && omega >= 1.1) || (delta <= 4.0);
  
  if (isSolidSolution) {
    if (VEC >= 8.0) {
      structure = 'FCC';
      phase = 'Stable FCC Solid Solution';
      phase_fractions = { FCC: '100%', BCC: '0%', HCP: '0%' };
    } else if (VEC < 6.87) {
      structure = 'BCC';
      phase = 'Stable BCC Solid Solution';
      phase_fractions = { FCC: '0%', BCC: '100%', HCP: '0%' };
    } else {
      structure = 'FCC + BCC';
      phase = 'Mixed FCC + BCC Phase';
      // Calculate split
      const bccFrac = Math.round((8.0 - VEC) / (8.0 - 6.87) * 100);
      const fccFrac = 100 - bccFrac;
      phase_fractions = { FCC: `${fccFrac}%`, BCC: `${bccFrac}%`, HCP: '0%' };
    }
  } else {
    // Intermetallic / amorphous region
    if (delta > 8.0 && omega < 1.0) {
      structure = 'Amorphous';
      phase = 'Metallic Glass / Amorphous';
      phase_fractions = { FCC: '0%', BCC: '0%', HCP: '0%' };
    } else {
      structure = 'IM + SS';
      phase = 'Mixed Solid Solution & Intermetallics';
      // Approximate partition
      if (VEC >= 7.5) {
        phase_fractions = { FCC: '40%', BCC: '10%', HCP: '0%' };
      } else {
        phase_fractions = { FCC: '10%', BCC: '40%', HCP: '0%' };
      }
    }
  }
  
  // 11. Yield Strength (YS) & Hardness (HV) estimation
  // Solid Solution Strengthening scales with:
  // - lattice mismatch (delta^1.5)
  // - concentration of hardening elements (Al, Ti increase strength)
  // - melting temperature (associated with shear modulus)
  let baseYS = 250; // Base strength in MPa
  
  // Contribution from atomic size mismatch (lattice strain)
  const mismatchStrengthening = 180 * Math.pow(delta, 1.3);
  
  // Element specific strengthening
  let chemicalHardening = 0;
  validElements.forEach(item => {
    const c = fractions[item.el];
    if (item.el === 'Al') chemicalHardening += 750 * c;
    if (item.el === 'Ti') chemicalHardening += 1200 * c;
    if (item.el === 'Mo') chemicalHardening += 500 * c;
    if (item.el === 'W')  chemicalHardening += 650 * c;
    if (item.el === 'Nb') chemicalHardening += 450 * c;
    if (item.el === 'Ta') chemicalHardening += 400 * c;
    if (item.el === 'Cr') chemicalHardening += 150 * c;
    if (item.el === 'Co') chemicalHardening += 80 * c;
  });
  
  // Phase structure modifier
  let phaseFactor = 1.0;
  if (structure === 'BCC') phaseFactor = 1.45; // BCC is harder but less ductile
  if (structure === 'FCC') phaseFactor = 0.75; // FCC is soft and ductile
  if (structure === 'FCC + BCC') phaseFactor = 1.15;
  if (structure === 'IM + SS') phaseFactor = 1.35; // Intermetallics increase strength, drop ductility
  
  const YS_pred = Math.round((baseYS + mismatchStrengthening + chemicalHardening) * phaseFactor);
  
  // Hardness (HV) correlates strongly with yield strength for solid solutions (HV ~ 0.3 * YS or higher for hard phases)
  let hardnessRatio = 0.32;
  if (structure === 'BCC') hardnessRatio = 0.38;
  if (structure === 'IM + SS') hardnessRatio = 0.45;
  if (structure === 'Amorphous') hardnessRatio = 0.50;
  
  const HV_pred = Math.round(YS_pred * hardnessRatio + (delta * 10));
  
  // 12. Explanation generation
  let explanation = '';
  if (structure.includes('FCC') && !structure.includes('BCC')) {
    explanation = 'Ductile single-phase FCC structure. Ideal for cryogenic toughness and high formability, but yields at lower stresses.';
  } else if (structure.includes('BCC') && !structure.includes('FCC')) {
    explanation = 'High strength BCC structure strengthened by lattice friction. Tends to be hard but susceptible to low-temperature brittleness.';
  } else if (structure === 'FCC + BCC') {
    explanation = 'Dual-phase FCC+BCC composite structure. Achieves an optimal balance of high tensile strength and moderate ductility.';
  } else {
    explanation = 'Brittle intermetallic compounds present. High hardness and wear resistance, but poor mechanical toughness.';
  }
  
  return {
    physics: {
      VEC: Number(VEC.toFixed(2)),
      density_calc: Number(density.toFixed(2)),
      Tm_avg: Math.round(Tm),
      delta: Number(delta.toFixed(2)),
      dChi: Number(dChi.toFixed(3)),
      omega: Number(omega.toFixed(2)),
      structure,
      phase,
      phase_fractions,
      explanation
    },
    ml: {
      YS_pred,
      HV_pred
    }
  };
}
