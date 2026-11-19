import { describe, it, expect } from 'vitest';
import {
  simulateEyeDiagram,
  simulateConstellation,
  analyzePoleZeroFilter,
} from '../utils/signalsDspMath';

describe('Signals, Modulation & DSP Math (Blue Pill & Red Pill)', () => {
  it('Blue Pill & Red Pill: Eye diagram opens with high BW/low jitter and closes under severe impairments', () => {
    const open = simulateEyeDiagram({
      modulation: 'nrz',
      dataRateGbps: 10,
      bandwidthGhz: 15,
      jitterPs: 1.5,
      deterministicJitterPs: 1.0,
      noiseMv: 8,
      swingMv: 800,
      seed: 101,
    });
    expect(open.status).toBe('Eye Open');
    expect(open.eyeHeightMv).toBeGreaterThan(450);
    expect(open.berRiskLabel).toBe('Low (<1e-9)');

    const closed = simulateEyeDiagram({
      modulation: 'pam4',
      dataRateGbps: 25,
      bandwidthGhz: 1.2,
      jitterPs: 22,
      deterministicJitterPs: 14,
      noiseMv: 95,
      swingMv: 800,
      seed: 101,
    });
    expect(closed.status).toBe('Eye Closed');
    expect(closed.eyeHeightMv).toBeLessThan(open.eyeHeightMv);
    expect(closed.zeroCrossingJitterPs).toBeGreaterThan(open.zeroCrossingJitterPs);
    expect(closed.berEstimate).toBeGreaterThan(open.berEstimate);
    expect(closed.berRiskLabel).toBe('High');
  });

  it('Blue Pill & Red Pill: Constellation diagram measures EVM (dB), SER, and phase/amplitude distortion', () => {
    const clean = simulateConstellation({
      scheme: 'QPSK',
      snrDb: 26,
      phaseOffsetDeg: 0,
      symbolCount: 256,
      seed: 77,
    });
    expect(clean.symbolErrors).toBe(0);
    expect(clean.evmPercent).toBeLessThan(8);
    expect(clean.evmDb).toBeLessThan(-20);
    expect(clean.rmsPhaseErrorDeg).toBeLessThan(5);

    const noisy64 = simulateConstellation({
      scheme: '64-QAM',
      snrDb: 4,
      phaseOffsetDeg: 18,
      symbolCount: 512,
      seed: 77,
    });
    expect(noisy64.symbolErrors).toBeGreaterThan(50);
    expect(noisy64.empiricalSer).toBeGreaterThan(0.1);
    expect(noisy64.rmsPhaseErrorDeg).toBeGreaterThan(15);
    expect(noisy64.rmsAmplitudeErrorPct).toBeGreaterThan(10);
  });

  it('Blue Pill & Red Pill: z-Plane Pole-Zero filter verifies notch attenuation, passband/stopband, phase linearity, and unstable poles', () => {
    // Notch at w = pi/2 (z = +/- j)
    const notch = analyzePoleZeroFilter(
      [
        { re: 0, im: 0.85 },
        { re: 0, im: -0.85 },
      ],
      [
        { re: 0, im: 1.0 },
        { re: 0, im: -1.0 },
      ]
    );
    expect(notch.stability).toBe('Stable');
    expect(notch.passbandGainDb).toBeCloseTo(0, 1);
    expect(notch.stopbandAttenDb).toBeLessThan(-35);
    expect(['Linear', 'Near-Linear', 'Non-Linear']).toContain(notch.phaseLinearityLabel);
    const midIdx = Math.floor(notch.magnitudeDb.length / 2); // w = pi/2 (fNorm = 0.25)
    expect(notch.magnitudeDb[midIdx]).toBeLessThan(-35);

    const firZeroOnly = analyzePoleZeroFilter([], [{ re: -0.5, im: 0 }]);
    expect(firZeroOnly.phaseLinearityLabel).toBe('Linear');

    const unstable = analyzePoleZeroFilter([{ re: 1.15, im: 0 }], []);
    expect(unstable.stability).toBe('Unstable');
    expect(unstable.maxPoleRadius).toBeGreaterThan(1);
  });
});
