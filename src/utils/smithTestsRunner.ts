import {
  complex,
  zToGamma,
  gammaToZ,
  zToY,
  calculateSWR,
  calculateReturnLoss,
  applyComponent,
} from './mathUtils';
import { TestResult } from '../types';

export const runMathTests = (): TestResult[] => {
  const results: TestResult[] = [];

  // Test 1: Matched load
  {
    const z = complex(1, 0);
    const gamma = zToGamma(z);
    const passed = Math.abs(gamma.re) < 1e-6 && Math.abs(gamma.im) < 1e-6;
    results.push({
      name: 'zToGamma: Matched Load (z = 1 => gamma = 0)',
      passed,
      expected: '0 + j0',
      actual: `${gamma.re.toFixed(4)} + j${gamma.im.toFixed(4)}`,
    });
  }

  // Test 2: Short circuit
  {
    const z = complex(0, 0);
    const gamma = zToGamma(z);
    const passed = Math.abs(gamma.re + 1) < 1e-6 && Math.abs(gamma.im) < 1e-6;
    results.push({
      name: 'zToGamma: Short Circuit (z = 0 => gamma = -1)',
      passed,
      expected: '-1.0000 + j0.0000',
      actual: `${gamma.re.toFixed(4)} + j${gamma.im.toFixed(4)}`,
    });
  }

  // Test 3: Gamma to Z (Matched load inverse)
  {
    const gamma = complex(0, 0);
    const z = gammaToZ(gamma);
    const passed = Math.abs(z.re - 1) < 1e-6 && Math.abs(z.im) < 1e-6;
    results.push({
      name: 'gammaToZ: Center of chart (gamma = 0 => z = 1)',
      passed,
      expected: '1.0000 + j0.0000',
      actual: `${z.re.toFixed(4)} + j${z.im.toFixed(4)}`,
    });
  }

  // Test 4: Gamma to Z (Short circuit inverse)
  {
    const gamma = complex(-1, 0);
    const z = gammaToZ(gamma);
    const passed = Math.abs(z.re) < 1e-6 && Math.abs(z.im) < 1e-6;
    results.push({
      name: 'gammaToZ: Left outer edge (gamma = -1 => z = 0)',
      passed,
      expected: '0.0000 + j0.0000',
      actual: `${z.re.toFixed(4)} + j${z.im.toFixed(4)}`,
    });
  }

  // Test 5: Admittance conversion
  {
    const z = complex(2, -1);
    const y = zToY(z);
    const passed = Math.abs(y.re - 0.4) < 1e-6 && Math.abs(y.im - 0.2) < 1e-6;
    results.push({
      name: 'zToY: 2 - j1 => 0.4 + j0.2',
      passed,
      expected: '0.4000 + j0.2000',
      actual: `${y.re.toFixed(4)} + j${y.im.toFixed(4)}`,
    });
  }

  // Test 6: VSWR Calculation
  {
    const gamma = complex(0.5, 0);
    const swr = calculateSWR(gamma);
    const passed = Math.abs(swr - 3) < 1e-6;
    results.push({
      name: 'calculateSWR: gamma = 0.5 => swr = 3.0',
      passed,
      expected: '3.0000',
      actual: swr.toFixed(4),
    });
  }

  // Test 7: Return Loss Calculation
  {
    const gamma = complex(0.1, 0);
    const rl = calculateReturnLoss(gamma);
    const passed = Math.abs(rl - 20) < 1e-6;
    results.push({
      name: 'calculateReturnLoss: gamma = 0.1 => rl = 20 dB',
      passed,
      expected: '20.0000',
      actual: rl.toFixed(4),
    });
  }

  // Test 8: Series Component Adding
  {
    const zStart = complex(1, 1);
    const zEnd = applyComponent(zStart, 'series_l', 10, 1.0e9, 50);
    const expectedIm = 1 + (2 * Math.PI * 1e9 * 10e-9) / 50;
    const passed = Math.abs(zEnd.re - 1.0) < 1e-6 && Math.abs(zEnd.im - expectedIm) < 1e-6;
    results.push({
      name: 'applyComponent: Series L 10nH at 1GHz',
      passed,
      expected: `1.0000 + j${expectedIm.toFixed(4)}`,
      actual: `${zEnd.re.toFixed(4)} + j${zEnd.im.toFixed(4)}`,
    });
  }

  // Test 9: Series Resistor Adding
  {
    const zStart = complex(1.2, 0.8);
    const zEnd = applyComponent(zStart, 'series_r', 40, 1.0e9, 50);
    const passed = Math.abs(zEnd.re - 2.0) < 1e-6 && Math.abs(zEnd.im - 0.8) < 1e-6;
    results.push({
      name: 'applyComponent: Series R 40Ω (Z0=50)',
      passed,
      expected: '2.0000 + j0.8000',
      actual: `${zEnd.re.toFixed(4)} + j${zEnd.im.toFixed(4)}`,
    });
  }

  // Test 10: Shunt Resistor Adding
  {
    const zStart = complex(1.0, 0.0);
    const zEnd = applyComponent(zStart, 'shunt_r', 50, 1.0e9, 50);
    const passed = Math.abs(zEnd.re - 0.5) < 1e-6 && Math.abs(zEnd.im) < 1e-6;
    results.push({
      name: 'applyComponent: Shunt R 50Ω (Z0=50)',
      passed,
      expected: '0.5000 + j0.0000',
      actual: `${zEnd.re.toFixed(4)} + j${zEnd.im.toFixed(4)}`,
    });
  }

  // Test 11: Quarter-wave transmission line inversion
  {
    const zStart = complex(2.0, 0.0);
    const zEnd = applyComponent(zStart, 'tline_series', 0.25, 1.0e9, 50);
    const passed = Math.abs(zEnd.re - 0.5) < 1e-5 && Math.abs(zEnd.im) < 1e-5;
    results.push({
      name: 'applyComponent: Quarter-wave Line (z=2 => z=0.5)',
      passed,
      expected: '0.5000 + j0.0000',
      actual: `${zEnd.re.toFixed(4)} + j${zEnd.im.toFixed(4)}`,
    });
  }

  return results;
};
