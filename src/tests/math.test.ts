import { describe, it, expect } from 'vitest';
import {
  complex,
  div,
  zToGamma,
  gammaToZ,
  applyComponent,
  findLMatchSuggestions,
  findSingleStubMatch,
  calculateSWR,
  getNormalizedValue,
} from '../utils/mathUtils';
import { runMathTests } from '../utils/smithTestsRunner';

describe('Smith Chart Mathematics (Blue Pill & Red Pill)', () => {
  it('passes all baseline reference assertions', () => {
    const results = runMathTests();
    for (const r of results) {
      expect(r.passed, r.name).toBe(true);
    }
  });

  it('Blue Pill: analytic L-match brings arbitrary load close to Z0 = 50 Ω', () => {
    const zActual = complex(25, -40);
    const freq = 1e9;
    const z0 = 50;
    const sols = findLMatchSuggestions(zActual, freq, z0);
    expect(sols.length).toBeGreaterThan(0);

    const sol = sols[0];
    let zNorm = complex(zActual.re / z0, zActual.im / z0);
    for (const step of sol.steps) {
      zNorm = applyComponent(zNorm, step.type, step.value, freq, z0);
    }
    expect(zNorm.re).toBeCloseTo(1.0, 1);
    expect(Math.abs(zNorm.im)).toBeLessThan(0.1);
  });

  it('Blue Pill: single-stub shunt tuner solves valid electrical lengths (d/λ, l/λ)', () => {
    const sols = findSingleStubMatch(complex(75, 45), 50);
    expect(sols.length).toBe(4);
    for (const s of sols) {
      expect(s.lineDistanceLambda).toBeGreaterThanOrEqual(0);
      expect(s.lineDistanceLambda).toBeLessThan(0.5);
      expect(s.stubLengthLambda).toBeGreaterThanOrEqual(0);
      expect(s.stubLengthLambda).toBeLessThan(0.5);
    }

    // Special case r === Z0 yields 1 d/λ (2 stub types)
    const rEqZ0 = findSingleStubMatch(complex(50, -35), 50);
    expect(rEqZ0.length).toBe(2);
  });

  it('Blue Pill: half-wavelength transmission line returns identical impedance', () => {
    const zStart = complex(1.6, -0.7);
    const zEnd = applyComponent(zStart, 'tline_series', 0.5, 1e9, 50);
    expect(zEnd.re).toBeCloseTo(zStart.re, 4);
    expect(zEnd.im).toBeCloseTo(zStart.im, 4);
  });

  it('Red Pill: handles division by zero, NaN, invalid stub inputs, and negative component inputs safely', () => {
    const d = div(complex(1, 0), complex(0, 0));
    expect(Number.isFinite(d.re)).toBe(true);

    expect(findSingleStubMatch(complex(0, 25), 50)).toEqual([]);
    expect(findSingleStubMatch(complex(NaN, 10), 50)).toEqual([]);
    expect(findSingleStubMatch(complex(50, 10), -10)).toEqual([]);

    expect(getNormalizedValue('series_l', -5, 1e9, 50)).toBe(0);
    expect(getNormalizedValue('series_c', NaN, 1e9, 50)).toBe(0);
    expect(getNormalizedValue('series_r', 50, 0, 50)).toBe(0);

    const openGamma = zToGamma(complex(1e9, 0));
    expect(calculateSWR(openGamma)).toBe(99.9);
    expect(gammaToZ(complex(1, 0)).re).toBeGreaterThan(1e5);
  });
});
