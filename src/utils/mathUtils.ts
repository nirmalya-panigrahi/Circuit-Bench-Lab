import { Complex, MatchComponent, MatchingState, ComponentType } from '../types';

export const Z0_DEFAULT = 50; // Ohms
export const FREQ_DEFAULT = 1.0e9; // 1 GHz

export function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

export function add(c1: Complex, c2: Complex): Complex {
  return { re: c1.re + c2.re, im: c1.im + c2.im };
}

export function sub(c1: Complex, c2: Complex): Complex {
  return { re: c1.re - c2.re, im: c1.im - c2.im };
}

export function mul(c1: Complex, c2: Complex): Complex {
  return {
    re: c1.re * c2.re - c1.im * c2.im,
    im: c1.re * c2.im + c1.im * c2.re,
  };
}

export function div(c1: Complex, c2: Complex): Complex {
  const denom = c2.re * c2.re + c2.im * c2.im;
  if (!Number.isFinite(denom) || denom < 1e-12) {
    return { re: 1e9, im: 0 };
  }
  return {
    re: (c1.re * c2.re + c1.im * c2.im) / denom,
    im: (c1.im * c2.re - c1.re * c2.im) / denom,
  };
}

export function conj(c: Complex): Complex {
  return { re: c.re, im: -c.im };
}

export function magnitude(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

// Convert Normalized Impedance (z) to Reflection Coefficient (Gamma)
export function zToGamma(z: Complex): Complex {
  const num = sub(z, complex(1, 0));
  const den = add(z, complex(1, 0));
  return div(num, den);
}

// Convert Reflection Coefficient (Gamma) to Normalized Impedance (z)
export function gammaToZ(gamma: Complex): Complex {
  const num = add(complex(1, 0), gamma);
  const den = sub(complex(1, 0), gamma);
  return div(num, den);
}

// Convert Impedance (z) to Admittance (y)
export function zToY(z: Complex): Complex {
  return div(complex(1, 0), z);
}

// Convert Admittance (y) to Impedance (z)
export function yToZ(y: Complex): Complex {
  return div(complex(1, 0), y);
}

// Calculate normalized component value (or electrical degrees for transmission line)
export function getNormalizedValue(
  type: ComponentType,
  value: number, // nH for L, pF for C, Ohms for R, wavelengths for tline_series
  freq: number = FREQ_DEFAULT,
  z0: number = Z0_DEFAULT
): number {
  if (!Number.isFinite(value) || !Number.isFinite(freq) || !Number.isFinite(z0) || freq <= 0 || z0 <= 0) {
    return 0;
  }
  const omega = 2 * Math.PI * freq;
  if (value <= 0 && type !== 'tline_series') return 0;

  switch (type) {
    case 'series_l': {
      const x = omega * (value * 1e-9);
      return x / z0;
    }
    case 'series_c': {
      const x = -1 / (omega * (value * 1e-12));
      return x / z0;
    }
    case 'series_r': {
      return value / z0;
    }
    case 'shunt_l': {
      const b = -1 / (omega * (value * 1e-9));
      return b * z0;
    }
    case 'shunt_c': {
      const b = omega * (value * 1e-12);
      return b * z0;
    }
    case 'shunt_r': {
      return z0 / value;
    }
    case 'tline_series': {
      return Math.max(0, value) * 360; // electrical degrees
    }
    default:
      return 0;
  }
}

// Applies a matching component or transmission line segment and returns the resulting impedance
export function applyComponent(
  zStart: Complex,
  type: ComponentType,
  val: number,
  freq: number = FREQ_DEFAULT,
  z0: number = Z0_DEFAULT
): Complex {
  if (type === 'tline_series') {
    const clampedLen = Number.isFinite(val) ? Math.max(0, val) : 0;
    const gammaStart = zToGamma(zStart);
    const gammaRot = rotateOnLine(gammaStart, clampedLen);
    return gammaToZ(gammaRot);
  }

  const normVal = getNormalizedValue(type, val, freq, z0);

  if (type === 'series_l' || type === 'series_c') {
    return { re: zStart.re, im: zStart.im + normVal };
  } else if (type === 'series_r') {
    return { re: zStart.re + normVal, im: zStart.im };
  } else if (type === 'shunt_l' || type === 'shunt_c') {
    const yStart = zToY(zStart);
    const yNew = { re: yStart.re, im: yStart.im + normVal };
    return yToZ(yNew);
  } else if (type === 'shunt_r') {
    const yStart = zToY(zStart);
    const yNew = { re: yStart.re + normVal, im: yStart.im };
    return yToZ(yNew);
  } else {
    return zStart;
  }
}

// Generates intermediate points along the Smith Chart trajectory
export function generateTrajectory(
  zStart: Complex,
  type: ComponentType,
  val: number,
  steps: number = 30,
  freq: number = FREQ_DEFAULT,
  z0: number = Z0_DEFAULT
): Complex[] {
  const points: Complex[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const partialVal = val * t;
    points.push(applyComponent(zStart, type, partialVal, freq, z0));
  }
  return points;
}

// Rotates reflection coefficient along a transmission line toward generator (clockwise)
export function rotateOnLine(gamma: Complex, dWavelengths: number): Complex {
  const angle = -4 * Math.PI * dWavelengths;
  const rot = {
    re: Math.cos(angle),
    im: Math.sin(angle),
  };
  return mul(gamma, rot);
}

// Calculate Standing Wave Ratio (SWR) from Gamma
export function calculateSWR(gamma: Complex): number {
  const mag = magnitude(gamma);
  if (mag >= 0.999) return 99.9;
  return (1 + mag) / (1 - mag);
}

// Calculate Return Loss (dB)
export function calculateReturnLoss(gamma: Complex): number {
  const mag = magnitude(gamma);
  if (mag <= 1e-5) return 99.9;
  return -20 * Math.log10(mag);
}

// Generate the list of matching states from a load and matching component list
export function calculateMatchingPath(
  zLoad: Complex,
  components: MatchComponent[],
  freq: number = FREQ_DEFAULT,
  z0: number = Z0_DEFAULT
): MatchingState[] {
  const states: MatchingState[] = [];

  let currentZ = zLoad;
  let currentY = zToY(currentZ);
  let currentGamma = zToGamma(currentZ);

  states.push({
    label: 'Load',
    z: currentZ,
    y: currentY,
    gamma: currentGamma,
  });

  for (const comp of components) {
    currentZ = applyComponent(currentZ, comp.type, comp.value, freq, z0);
    currentY = zToY(currentZ);
    currentGamma = zToGamma(currentZ);

    const prettyNames: Record<string, string> = {
      series_l: `Series L (${comp.value} nH)`,
      series_c: `Series C (${comp.value} pF)`,
      series_r: `Series R (${comp.value} Ω)`,
      shunt_l: `Shunt L (${comp.value} nH)`,
      shunt_c: `Shunt C (${comp.value} pF)`,
      shunt_r: `Shunt R (${comp.value} Ω)`,
      tline_series: `Line (${comp.value} λ)`,
    };

    states.push({
      label: prettyNames[comp.type] || 'Match Stage',
      z: currentZ,
      y: currentY,
      gamma: currentGamma,
      componentId: comp.id,
    });
  }

  return states;
}

// Analytic calculation for single L-match (Series-Shunt or Shunt-Series options)
export function findLMatchSuggestions(
  zLoad: Complex,
  freq: number = FREQ_DEFAULT,
  z0: number = Z0_DEFAULT
): { description: string; steps: { type: 'series_l' | 'series_c' | 'shunt_l' | 'shunt_c'; value: number }[] }[] {
  const r = zLoad.re;
  const x = zLoad.im;
  const solutions: { description: string; steps: { type: 'series_l' | 'series_c' | 'shunt_l' | 'shunt_c'; value: number }[] }[] = [];

  if (!Number.isFinite(r) || !Number.isFinite(x) || !Number.isFinite(freq) || freq <= 0 || z0 <= 0) {
    return solutions;
  }

  const omega = 2 * Math.PI * freq;

  if (r > 0) {
    if (r >= z0) {
      const radical = r * (r * r + x * x - z0 * r);
      if (radical >= 0) {
        const root = Math.sqrt(radical);
        const b1 = (x + root / r) / (r * r + x * x);
        const b2 = (x - root / r) / (r * r + x * x);

        for (const B of [b1, b2]) {
          const yLoad = div(complex(1, 0), complex(r, x));
          const yNew = complex(yLoad.re, yLoad.im + B);
          const zNew = div(complex(1, 0), yNew);
          const X_series = -zNew.im;

          const steps: { type: 'series_l' | 'series_c' | 'shunt_l' | 'shunt_c'; value: number }[] = [];

          if (B > 0) {
            const C_val = (B / omega) * 1e12;
            steps.push({ type: 'shunt_c', value: Number(C_val.toFixed(2)) });
          } else if (B < 0) {
            const L_val = (-1 / (B * omega)) * 1e9;
            steps.push({ type: 'shunt_l', value: Number(L_val.toFixed(2)) });
          }

          if (X_series > 0) {
            const L_val = (X_series / omega) * 1e9;
            steps.push({ type: 'series_l', value: Number(L_val.toFixed(2)) });
          } else if (X_series < 0) {
            const C_val = (-1 / (X_series * omega)) * 1e12;
            steps.push({ type: 'series_c', value: Number(C_val.toFixed(2)) });
          }

          if (steps.length === 2 && steps[0].value > 0 && steps[1].value > 0) {
            solutions.push({
              description: `Shunt ${steps[0].type.includes('c') ? 'Capacitor' : 'Inductor'} then Series ${steps[1].type.includes('l') ? 'Inductor' : 'Capacitor'}`,
              steps,
            });
          }
        }
      }
    } else {
      const radical = r * (z0 - r);
      if (radical >= 0) {
        const root = Math.sqrt(radical);
        const x1 = -x + root;
        const x2 = -x - root;

        for (const X of [x1, x2]) {
          const zNew = complex(r, x + X);
          const yNew = div(complex(1, 0), zNew);
          const B_shunt = -yNew.im;

          const steps: { type: 'series_l' | 'series_c' | 'shunt_l' | 'shunt_c'; value: number }[] = [];

          if (X > 0) {
            const L_val = (X / omega) * 1e9;
            steps.push({ type: 'series_l', value: Number(L_val.toFixed(2)) });
          } else if (X < 0) {
            const C_val = (-1 / (X * omega)) * 1e12;
            steps.push({ type: 'series_c', value: Number(C_val.toFixed(2)) });
          }

          if (B_shunt > 0) {
            const C_val = (B_shunt / omega) * 1e12;
            steps.push({ type: 'shunt_c', value: Number(C_val.toFixed(2)) });
          } else if (B_shunt < 0) {
            const L_val = (-1 / (B_shunt * omega)) * 1e9;
            steps.push({ type: 'shunt_l', value: Number(L_val.toFixed(2)) });
          }

          if (steps.length === 2 && steps[0].value > 0 && steps[1].value > 0) {
            solutions.push({
              description: `Series ${steps[0].type.includes('l') ? 'Inductor' : 'Capacitor'} then Shunt ${steps[1].type.includes('c') ? 'Capacitor' : 'Inductor'}`,
              steps,
            });
          }
        }
      }
    }
  }

  return solutions;
}

export interface StubMatchSolution {
  topology: string;
  lineDistanceLambda: number;
  stubLengthLambda: number;
  stubType: 'Shorted Shunt Stub' | 'Open Shunt Stub';
}

// Compute single-stub shunt tuning solutions (distance d/λ from load + stub length l/λ)
export function findSingleStubMatch(
  zLoadActual: Complex,
  z0: number = Z0_DEFAULT
): StubMatchSolution[] {
  const r = zLoadActual.re;
  const x = zLoadActual.im;
  if (!Number.isFinite(r) || !Number.isFinite(x) || !Number.isFinite(z0) || z0 <= 0 || r <= 0) {
    return [];
  }

  // Solutions for t = tan(beta * d) so Re(Y_in) = 1/Z0
  const y0 = 1 / z0;
  let tValues: number[] = [];

  if (Math.abs(r - z0) < 1e-6) {
    tValues = [-x / (2 * z0)];
  } else {
    const disc = r * (Math.pow(z0 - r, 2) + x * x) / z0;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      tValues = [(x + root) / (r - z0), (x - root) / (r - z0)];
    }
  }

  const out: StubMatchSolution[] = [];
  tValues.forEach((t, idx) => {
    let dLambda = Math.atan(t) / (2 * Math.PI);
    if (dLambda < 0) dLambda += 0.5;

    const denom = r * r + Math.pow(x + z0 * t, 2);
    if (denom < 1e-12) return;
    const B = (r * r * t - (z0 - x * t) * (x + z0 * t)) / (z0 * denom);
    // Stub needs susceptance Bs = -B
    const bs = -B;

    // Shorted stub: Bs = -Y0 * cot(beta * l) => tan(beta * l) = -Y0 / Bs
    let lShort = Math.atan2(-y0, bs) / (2 * Math.PI);
    if (lShort < 0) lShort += 0.5;

    // Open stub: Bs = Y0 * tan(beta * l) => tan(beta * l) = Bs / Y0
    let lOpen = Math.atan2(bs, y0) / (2 * Math.PI);
    if (lOpen < 0) lOpen += 0.5;

    out.push({
      topology: `Solution ${idx + 1} (Shorted Stub)`,
      lineDistanceLambda: Number(dLambda.toFixed(4)),
      stubLengthLambda: Number(lShort.toFixed(4)),
      stubType: 'Shorted Shunt Stub',
    });
    out.push({
      topology: `Solution ${idx + 1} (Open Stub)`,
      lineDistanceLambda: Number(dLambda.toFixed(4)),
      stubLengthLambda: Number(lOpen.toFixed(4)),
      stubType: 'Open Shunt Stub',
    });
  });

  return out;
}
