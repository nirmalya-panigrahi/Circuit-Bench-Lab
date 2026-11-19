import { describe, it, expect } from 'vitest';
import {
  analyzeBjtLoadLine,
  analyzeMosfetIV,
  analyzeDiodeIV,
  analyzeOpAmp,
  analyzeVtc,
} from '../utils/electronicsMath';

describe('Electronics Math Engines (Blue Pill & Red Pill)', () => {
  it('Blue Pill: BJT Q-point sits in Active region for balanced divider bias', () => {
    const res = analyzeBjtLoadLine({
      vcc: 12,
      rc: 1200,
      re: 470,
      r1: 22000,
      r2: 6800,
      rl: 2200,
      beta: 120,
      vinPeakMv: 15,
    });
    expect(res.region).toBe('Active');
    expect(res.vceq).toBeGreaterThan(2);
    expect(res.vceq).toBeLessThan(10);
    expect(res.clippingStatus).toBe('Clean Active');
    expect(res.maxUndistortedSwingPeak).toBeGreaterThan(1.5);
    expect(res.maxUndistortedSwingPp).toBeCloseTo(res.maxUndistortedSwingPeak * 2, 4);
  });

  it('Red Pill: BJT detects saturation, cutoff, and overdrive dual clipping', () => {
    const cutoff = analyzeBjtLoadLine({
      vcc: 12,
      rc: 1000,
      re: 500,
      r1: 100000,
      r2: 1000,
      rl: 2000,
      beta: 100,
      vinPeakMv: 20,
    });
    expect(cutoff.region).toBe('Cutoff');
    expect(cutoff.icqMa).toBe(0);
    expect(cutoff.maxUndistortedSwingPeak).toBe(0);

    const overdrive = analyzeBjtLoadLine({
      vcc: 12,
      rc: 1200,
      re: 470,
      r1: 22000,
      r2: 6800,
      rl: 2200,
      beta: 120,
      vinPeakMv: 180,
    });
    expect(overdrive.clippingStatus).toBe('Dual Clipping');
  });

  it('Blue Pill & Red Pill: MOSFET I-V tracks cutoff, triode, saturation, gm/ron, and thermal drift', () => {
    const cut = analyzeMosfetIV({ vgs: 0.5, vdsOp: 2.0, vth0: 1.0, tempK: 300, kn0Ma: 6, lambda: 0.04 });
    expect(cut.region).toBe('Cutoff');
    expect(cut.idOpMa).toBe(0);
    expect(cut.gmMs).toBe(0);
    expect(cut.ronOhms).toBeGreaterThan(1e5);

    const triode = analyzeMosfetIV({ vgs: 4.0, vdsOp: 0.8, vth0: 1.0, tempK: 300, kn0Ma: 6, lambda: 0.04 });
    expect(triode.region).toBe('Triode');
    expect(triode.gmMs).toBeGreaterThan(0);
    expect(triode.ronOhms).toBeLessThan(500);

    const satCold = analyzeMosfetIV({ vgs: 3.5, vdsOp: 3.5, vth0: 1.0, tempK: 260, kn0Ma: 6, lambda: 0.04 });
    const satHot = analyzeMosfetIV({ vgs: 3.5, vdsOp: 3.5, vth0: 1.0, tempK: 420, kn0Ma: 6, lambda: 0.04 });
    expect(satCold.region).toBe('Saturation');
    expect(satCold.knTMa).toBeGreaterThan(satHot.knTMa);
    expect(satCold.gmMs).toBeGreaterThan(5);
    expect(satCold.ronOhms).toBeGreaterThan(500);

    // Adversarial NaN / extreme negative temp clamped safely
    const safe = analyzeMosfetIV({ vgs: NaN, vdsOp: -5, vth0: 1.0, tempK: -100, kn0Ma: 0, lambda: -1 });
    expect(Number.isFinite(safe.idOpMa)).toBe(true);
    expect(Number.isFinite(safe.gmMs)).toBe(true);
  });

  it('Blue Pill & Red Pill: Diode Shockley equation converges with Rs, dynamic rd, and thermal voltage', () => {
    const res = analyzeDiodeIV({ tempK: 300, isNanoA: 1, ideality: 1.2, rsOhms: 5, vdOp: 0.75 });
    expect(res.vtMv).toBeCloseTo(25.85, 1);
    expect(res.idOpMa).toBeGreaterThan(1);
    expect(res.rdOhms).toBeGreaterThan(5);
    expect(res.rdOhms).toBeLessThan(100);

    const rev = analyzeDiodeIV({ tempK: 300, isNanoA: 1, ideality: 1.2, rsOhms: 0, vdOp: -2.8 });
    expect(rev.idOpMa).toBeLessThan(0);
    expect(rev.rdOhms).toBeGreaterThan(1e5);
  });

  it('Blue Pill & Red Pill: Op-Amp computes GBW bandwidth, loop gain margin, phase margin, and slew-rate distortion', () => {
    const clean = analyzeOpAmp({ aolDb: 100, gbwMhz: 10, rfR1Ratio: 9, slewRateVus: 20, vinPeakV: 0.1, sigFreqKhz: 50 });
    expect(clean.aclGain).toBe(10);
    expect(clean.f3dbHz).toBeCloseTo(1e6, -2);
    expect(clean.loopGainAtSigDb).toBeGreaterThan(20);
    expect(clean.phaseMarginDeg).toBeGreaterThan(45);
    expect(clean.isSlewLimited).toBe(false);

    const slewDistorted = analyzeOpAmp({ aolDb: 100, gbwMhz: 10, rfR1Ratio: 19, slewRateVus: 1.0, vinPeakV: 0.5, sigFreqKhz: 500 });
    expect(slewDistorted.isSlewLimited).toBe(true);
  });

  it('Blue Pill & Red Pill: CMOS VTC shifts VM with Wp/Wn sizing and computes positive noise margins', () => {
    const balanced = analyzeVtc({
      topology: 'cmos',
      vdd: 3.3,
      wpWnRatio: 2.5,
      vthN: 0.65,
      vthP: 0.65,
      bjtBeta: 100,
      bjtRcRbRatio: 0.25,
    });
    expect(balanced.vm).toBeCloseTo(1.65, 1);
    expect(balanced.nml).toBeGreaterThan(0.5);
    expect(balanced.nmh).toBeGreaterThan(0.5);
    expect(balanced.points[0].region).toContain('Cutoff');

    const strongP = analyzeVtc({
      topology: 'cmos',
      vdd: 3.3,
      wpWnRatio: 6.0,
      vthN: 0.65,
      vthP: 0.65,
      bjtBeta: 100,
      bjtRcRbRatio: 0.25,
    });
    expect(strongP.vm).toBeGreaterThan(balanced.vm);
  });
});
