// Pure physics & circuit mathematics for:
// - BJT Load-Line & Q-Point Analysis
// - Diode & MOSFET I-V Characteristic Curves
// - Op-Amp Frequency Response, GBW & Slew Rate
// - CMOS & BJT Voltage Transfer Characteristic (VTC) Curves

export interface BjtParams {
  vcc: number; // V (5 to 24)
  rc: number;  // Ohms (200 to 5000)
  re: number;  // Ohms (0 to 2000)
  r1: number;  // Ohms (5k to 100k)
  r2: number;  // Ohms (2k to 50k)
  rl: number;  // AC Load Ohms (500 to 20000)
  beta: number; // hFE (50 to 300)
  vinPeakMv: number; // AC input peak mV (0 to 150)
}

export interface BjtAnalysisResult {
  vth: number;
  rth: number;
  ibqMa: number;
  icqMa: number;
  vceq: number;
  icSatDcMa: number;
  icSatAcMa: number;
  vceCutoffAc: number;
  maxUndistortedSwingPeak: number;
  maxUndistortedSwingPp: number;
  region: 'Cutoff' | 'Active' | 'Saturation';
  clippingStatus:
    | 'Clean Active'
    | 'Cutoff Clipping'
    | 'Saturation Clipping'
    | 'Dual Clipping'
    | 'Device Saturated'
    | 'Device in Cutoff';
  dcLoadLine: { vce: number; icMa: number }[];
  acLoadLine: { vce: number; icMa: number }[];
  familyCurves: { ibUa: number; points: { vce: number; icMa: number }[] }[];
  waveform: { tMs: number; vce: number; vceIdeal: number }[];
  voutPeakSwing: number;
  voltageGain: number;
}

export function analyzeBjtLoadLine(params: BjtParams): BjtAnalysisResult {
  const vcc = Math.max(1, Number.isFinite(params.vcc) ? params.vcc : 12);
  const rc = Math.max(10, Number.isFinite(params.rc) ? params.rc : 1000);
  const re = Math.max(0, Number.isFinite(params.re) ? params.re : 470);
  const r1 = Math.max(100, Number.isFinite(params.r1) ? params.r1 : 22000);
  const r2 = Math.max(100, Number.isFinite(params.r2) ? params.r2 : 6800);
  const rl = Math.max(10, Number.isFinite(params.rl) ? params.rl : 2200);
  const beta = Math.max(10, Number.isFinite(params.beta) ? params.beta : 120);
  const vinPeakMv = Math.max(0, Number.isFinite(params.vinPeakMv) ? params.vinPeakMv : 25);

  const vbeOn = 0.7;
  const vceSat = 0.2;
  const va = 100;

  const vth = (vcc * r2) / (r1 + r2);
  const rth = (r1 * r2) / (r1 + r2);

  let ib = 0;
  let ic = 0;
  let vce = vcc;
  let region: BjtAnalysisResult['region'] = 'Active';

  if (vth <= vbeOn) {
    ib = 0;
    ic = 0;
    vce = vcc;
    region = 'Cutoff';
  } else {
    ib = (vth - vbeOn) / (rth + (beta + 1) * re);
    const icActive = beta * ib;
    const vceTest = vcc - icActive * rc - (icActive + ib) * re;
    if (vceTest <= vceSat) {
      region = 'Saturation';
      vce = vceSat;
      ic = Math.max(0, (vcc - vceSat) / (rc + re));
    } else {
      region = 'Active';
      ic = icActive;
      vce = vceTest;
    }
  }

  const icqMa = ic * 1000;
  const ibqMa = ib * 1000;
  const rDc = rc + re;
  const rAc = (rc * rl) / (rc + rl);
  const icSatDcMa = (vcc / rDc) * 1000;
  const icSatAcMa = (ic + vce / rAc) * 1000;
  const vceCutoffAc = vce + ic * rAc;

  // Max undistorted output voltage swing (symmetric peak limited by nearest boundary)
  const vMaxUpper = Math.min(vcc, vceCutoffAc);
  const headroomUpper = Math.max(0, vMaxUpper - vce);
  const headroomLower = Math.max(0, vce - vceSat);
  const maxUndistortedSwingPeak = region === 'Active' ? Math.min(headroomUpper, headroomLower) : 0;
  const maxUndistortedSwingPp = maxUndistortedSwingPeak * 2;

  const dcLoadLine = [
    { vce: 0, icMa: icSatDcMa },
    { vce: vcc, icMa: 0 },
  ];

  const acLoadLine = [
    { vce: vceSat, icMa: Math.max(0, (ic + (vce - vceSat) / rAc) * 1000) },
    {
      vce: Math.min(vcc * 1.4, vceCutoffAc),
      icMa: Math.max(0, (ic - (Math.min(vcc * 1.4, vceCutoffAc) - vce) / rAc) * 1000),
    },
  ];

  const maxIbRef = Math.max(ib * 2.0, (vcc / rDc / beta) * 1.2, 20e-6);
  const ibSteps = [0.2, 0.4, 0.6, 0.8, 1.0].map((f) => f * maxIbRef);
  const familyCurves = ibSteps.map((ibVal) => {
    const pts: { vce: number; icMa: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const v = (i / 40) * vcc;
      const satFactor = 1 - Math.exp(-v / 0.18);
      const icVal = beta * ibVal * satFactor * (1 + v / va);
      pts.push({ vce: v, icMa: icVal * 1000 });
    }
    return { ibUa: Number((ibVal * 1e6).toFixed(1)), points: pts };
  });

  const reDynamic = ic > 1e-6 ? 0.026 / ic : 1e6;
  const voltageGain = region === 'Active' ? rAc / Math.max(1, reDynamic + (re > 0 ? 12 : 0)) : 0;
  const vinPeakV = vinPeakMv / 1000;
  const voutPeakSwing = vinPeakV * voltageGain;

  let hitCutoff = false;
  let hitSat = false;
  const waveform: { tMs: number; vce: number; vceIdeal: number }[] = [];

  for (let i = 0; i <= 80; i++) {
    const tMs = (i / 80) * 2.0;
    const phase = 2 * Math.PI * 1.0 * tMs;
    const vceIdeal = vce - voutPeakSwing * Math.sin(phase);
    let vceActual = vceIdeal;
    if (vceActual >= vMaxUpper) {
      vceActual = vMaxUpper;
      if (voutPeakSwing > 0.05) hitCutoff = true;
    }
    if (vceActual <= vceSat) {
      vceActual = vceSat;
      if (voutPeakSwing > 0.05) hitSat = true;
    }
    waveform.push({ tMs, vce: vceActual, vceIdeal });
  }

  let clippingStatus: BjtAnalysisResult['clippingStatus'] = 'Clean Active';
  if (region === 'Cutoff') clippingStatus = 'Device in Cutoff';
  else if (region === 'Saturation') clippingStatus = 'Device Saturated';
  else if (hitCutoff && hitSat) clippingStatus = 'Dual Clipping';
  else if (hitCutoff) clippingStatus = 'Cutoff Clipping';
  else if (hitSat) clippingStatus = 'Saturation Clipping';

  return {
    vth,
    rth,
    ibqMa,
    icqMa,
    vceq: vce,
    icSatDcMa,
    icSatAcMa,
    vceCutoffAc,
    maxUndistortedSwingPeak,
    maxUndistortedSwingPp,
    region,
    clippingStatus,
    dcLoadLine,
    acLoadLine,
    familyCurves,
    waveform,
    voutPeakSwing,
    voltageGain,
  };
}

// ==========================================
// 4. Diode & MOSFET I-V Characteristic Curves
// ==========================================

export interface MosfetParams {
  vgs: number;
  vdsOp: number;
  vth0: number;
  tempK: number;
  kn0Ma: number;
  lambda: number;
}

export interface MosfetResult {
  vthT: number;
  knTMa: number;
  vov: number;
  vdsSat: number;
  idOpMa: number;
  gmMs: number;      // Transconductance dId/dVgs in mS (mA/V)
  ronOhms: number;   // Output / on-resistance dVds/dId in Ohms
  region: 'Cutoff' | 'Triode' | 'Saturation';
  curves: { vgs: number; points: { vds: number; idMa: number }[] }[];
  pinchoffBoundary: { vds: number; idMa: number }[];
}

export function analyzeMosfetIV(params: MosfetParams): MosfetResult {
  const tempK = Math.max(200, Math.min(550, Number.isFinite(params.tempK) ? params.tempK : 300));
  const vth0 = Number.isFinite(params.vth0) ? params.vth0 : 1.0;
  const kn0Ma = Math.max(0.1, Number.isFinite(params.kn0Ma) ? params.kn0Ma : 5.0);
  const lambda = Math.max(0, Number.isFinite(params.lambda) ? params.lambda : 0.04);
  const vgs = Math.max(0, Number.isFinite(params.vgs) ? params.vgs : 3.0);
  const vdsOp = Math.max(0, Math.min(5, Number.isFinite(params.vdsOp) ? params.vdsOp : 2.5));

  const vthT = Math.max(0.1, vth0 - 0.002 * (tempK - 300));
  const knTMa = kn0Ma * Math.pow(300 / tempK, 1.5);

  const evalId = (vg: number, vd: number): number => {
    const vov = vg - vthT;
    if (vov <= 0) return 0;
    if (vd < vov) {
      return knTMa * (vov * vd - 0.5 * vd * vd) * (1 + lambda * vd);
    }
    return 0.5 * knTMa * vov * vov * (1 + lambda * vd);
  };

  const vov = vgs - vthT;
  const vdsSat = Math.max(0, vov);
  const idOpMa = evalId(vgs, vdsOp);

  let region: MosfetResult['region'] = 'Cutoff';
  let gmMs = 0;
  let gdsMaPerV = 0;

  if (vov <= 0) {
    region = 'Cutoff';
    gmMs = 0;
    gdsMaPerV = 0;
  } else if (vdsOp < vov) {
    region = 'Triode';
    gmMs = knTMa * vdsOp * (1 + lambda * vdsOp);
    gdsMaPerV = knTMa * ((vov - vdsOp) * (1 + lambda * vdsOp) + lambda * (vov * vdsOp - 0.5 * vdsOp * vdsOp));
  } else {
    region = 'Saturation';
    gmMs = knTMa * vov * (1 + lambda * vdsOp);
    gdsMaPerV = 0.5 * knTMa * vov * vov * lambda;
  }

  const ronOhms = gdsMaPerV > 1e-6 ? 1000 / gdsMaPerV : 1e6;

  const vgsLevels = Array.from(new Set([1.0, 2.0, 3.0, 4.0, 5.0, Number(vgs.toFixed(2))])).sort((a, b) => a - b);
  const curves = vgsLevels.map((vg) => {
    const points: { vds: number; idMa: number }[] = [];
    for (let i = 0; i <= 50; i++) {
      const vd = (i / 50) * 5.0;
      points.push({ vds: vd, idMa: evalId(vg, vd) });
    }
    return { vgs: vg, points };
  });

  const pinchoffBoundary: { vds: number; idMa: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const vd = (i / 40) * 4.0;
    pinchoffBoundary.push({ vds: vd, idMa: 0.5 * knTMa * vd * vd * (1 + lambda * vd) });
  }

  return { vthT, knTMa, vov, vdsSat, idOpMa, gmMs, ronOhms, region, curves, pinchoffBoundary };
}

export interface DiodeParams {
  tempK: number;
  isNanoA: number;
  ideality: number;
  rsOhms: number;
  vdOp: number;
}

export interface DiodeResult {
  vtMv: number;
  idOpMa: number;
  rdOhms: number; // dynamic resistance dVd/dId
  kneeVoltage: number;
  points: { vd: number; idMa: number }[];
}

export function analyzeDiodeIV(params: DiodeParams): DiodeResult {
  const tempK = Math.max(200, Math.min(550, Number.isFinite(params.tempK) ? params.tempK : 300));
  const isNanoA = Math.max(1e-4, Number.isFinite(params.isNanoA) ? params.isNanoA : 1.0);
  const n = Math.max(1.0, Math.min(2.5, Number.isFinite(params.ideality) ? params.ideality : 1.2));
  const rs = Math.max(0, Number.isFinite(params.rsOhms) ? params.rsOhms : 5);
  const vdOp = Math.max(-3.0, Math.min(1.2, Number.isFinite(params.vdOp) ? params.vdOp : 0.7));

  const kB = 1.380649e-23;
  const q = 1.602176634e-19;
  const vt = (kB * tempK) / q;
  const isAmp = isNanoA * 1e-9 * Math.pow(2, (tempK - 300) / 10);

  const solveIdMa = (vd: number): number => {
    if (vd <= 0) {
      const rev = isAmp * (Math.exp(vd / (n * vt)) - 1);
      if (vd < -2.4) {
        return (rev - 0.005 * Math.pow(-2.4 - vd, 2)) * 1000;
      }
      return rev * 1000;
    }
    let id = Math.min(0.2, isAmp * (Math.exp(Math.min(vd / (n * vt), 35)) - 1));
    if (rs <= 1e-6) return Math.min(200, id * 1000);
    for (let iter = 0; iter < 25; iter++) {
      id = Math.max(0, id);
      const f = n * vt * Math.log(id / isAmp + 1) + id * rs - vd;
      const df = (n * vt) / (id + isAmp) + rs;
      const next = id - f / df;
      if (Math.abs(next - id) < 1e-9) {
        id = Math.max(0, next);
        break;
      }
      id = Math.max(0, Math.min(vd / rs + 0.01, next));
    }
    return Math.min(150, id * 1000);
  };

  const points: { vd: number; idMa: number }[] = [];
  for (let i = 0; i <= 80; i++) {
    const vd = -3.0 + (i / 80) * 4.2;
    points.push({ vd, idMa: solveIdMa(vd) });
  }

  const idOpMa = solveIdMa(vdOp);
  const idAmp = Math.max(1e-9, idOpMa / 1000);
  const rdOhms = vdOp > 0 ? (n * vt) / idAmp + rs : 1e6;
  const kneeVoltage = Math.max(0.1, n * vt * Math.log(0.001 / isAmp + 1));

  return {
    vtMv: vt * 1000,
    idOpMa,
    rdOhms,
    kneeVoltage,
    points,
  };
}

// ==========================================
// 8. Op-Amp Frequency Response & Gain-Bandwidth
// ==========================================

export interface OpAmpParams {
  aolDb: number;
  gbwMhz: number;
  rfR1Ratio: number; // Feedback ratio Rf/R1 (Closed-loop non-inverting gain = 1 + Rf/R1)
  slewRateVus: number;
  vinPeakV: number;
  sigFreqKhz: number;
}

export interface OpAmpResult {
  aclGain: number;
  fpHz: number;
  f3dbHz: number;
  fullPowerBwHz: number;
  aclDb: number;
  loopGainAtSigDb: number;
  phaseMarginDeg: number;
  isSlewLimited: boolean;
  requiredSlewVus: number;
  idealVoutPeak: number;
  actualVoutPeak: number;
  bodePoints: { freqHz: number; aolDb: number; aclDb: number; loopGainDb: number; phaseDeg: number }[];
  waveform: { tUs: number; idealV: number; actualV: number }[];
}

export function analyzeOpAmp(params: OpAmpParams): OpAmpResult {
  const aolDb = Math.max(40, Number.isFinite(params.aolDb) ? params.aolDb : 100);
  const gbwHz = Math.max(1e4, (Number.isFinite(params.gbwMhz) ? params.gbwMhz : 10) * 1e6);
  const rfR1Ratio = Math.max(0, Number.isFinite(params.rfR1Ratio) ? params.rfR1Ratio : 19);
  const aclGain = 1 + rfR1Ratio;
  const slewRateVus = Math.max(0.1, Number.isFinite(params.slewRateVus) ? params.slewRateVus : 5);
  const vinPeakV = Math.max(0.01, Number.isFinite(params.vinPeakV) ? params.vinPeakV : 0.2);
  const sigFreqHz = Math.max(100, (Number.isFinite(params.sigFreqKhz) ? params.sigFreqKhz : 200) * 1e3);

  const aolLin = Math.pow(10, aolDb / 20);
  const fpHz = gbwHz / aolLin;
  const f3dbHz = gbwHz / aclGain;
  const aclDb = 20 * Math.log10(aclGain);

  const bodePoints: { freqHz: number; aolDb: number; aclDb: number; loopGainDb: number; phaseDeg: number }[] = [];
  for (let i = 0; i <= 80; i++) {
    const exp = (i / 80) * 8;
    const f = Math.pow(10, exp);
    const magOl = aolLin / Math.sqrt(1 + Math.pow(f / fpHz, 2));
    const magCl = aclGain / Math.sqrt(1 + Math.pow(f / f3dbHz, 2));
    const olDb = 20 * Math.log10(Math.max(1e-3, magOl));
    const clDb = 20 * Math.log10(Math.max(1e-3, magCl));
    const phaseDeg =
      -(Math.atan(f / fpHz) * 180) / Math.PI -
      (Math.atan(f / (2 * gbwHz)) * 180) / Math.PI;
    bodePoints.push({
      freqHz: f,
      aolDb: olDb,
      aclDb: clDb,
      loopGainDb: Math.max(0, olDb - aclDb),
      phaseDeg,
    });
  }

  // Loop gain margin at operating signal frequency + phase margin at crossover f3db
  const aolSigDb = 20 * Math.log10(Math.max(1e-3, aolLin / Math.sqrt(1 + Math.pow(sigFreqHz / fpHz, 2))));
  const loopGainAtSigDb = aolSigDb - aclDb;
  const phaseAtCrossover =
    -(Math.atan(f3dbHz / fpHz) * 180) / Math.PI -
    (Math.atan(f3dbHz / (2 * gbwHz)) * 180) / Math.PI;
  const phaseMarginDeg = Math.max(0, 180 + phaseAtCrossover);

  const bwAtten = 1 / Math.sqrt(1 + Math.pow(sigFreqHz / f3dbHz, 2));
  const idealVoutPeak = vinPeakV * aclGain * bwAtten;
  const requiredSlewVus = (2 * Math.PI * sigFreqHz * idealVoutPeak) / 1e6;
  const isSlewLimited = requiredSlewVus > slewRateVus;
  const fullPowerBwHz = (slewRateVus * 1e6) / (2 * Math.PI * Math.max(0.01, idealVoutPeak));

  const periodUs = 1e6 / sigFreqHz;
  const steps = 160;
  const dtUs = (2 * periodUs) / steps;
  const waveform: { tUs: number; idealV: number; actualV: number }[] = [];

  let actualV = 0;
  let actualPeak = 0;
  for (let i = 0; i <= steps; i++) {
    const tUs = i * dtUs;
    const idealV = idealVoutPeak * Math.sin(2 * Math.PI * (tUs / periodUs));
    if (i === 0) {
      actualV = 0;
    } else {
      const maxDelta = slewRateVus * dtUs;
      const diff = idealV - actualV;
      if (Math.abs(diff) <= maxDelta) {
        actualV = idealV;
      } else {
        actualV += Math.sign(diff) * maxDelta;
      }
    }
    actualPeak = Math.max(actualPeak, Math.abs(actualV));
    waveform.push({ tUs, idealV, actualV });
  }

  return {
    aclGain,
    fpHz,
    f3dbHz,
    fullPowerBwHz,
    aclDb,
    loopGainAtSigDb,
    phaseMarginDeg,
    isSlewLimited,
    requiredSlewVus,
    idealVoutPeak,
    actualVoutPeak: actualPeak,
    bodePoints,
    waveform,
  };
}

// ==========================================
// 10. BJT / CMOS Voltage Transfer Characteristic (VTC)
// ==========================================

export type VtcTopology = 'cmos' | 'bjt';

export interface VtcParams {
  topology: VtcTopology;
  vdd: number;
  wpWnRatio: number;
  vthN: number;
  vthP: number;
  bjtBeta: number;
  bjtRcRbRatio: number;
}

export interface VtcResult {
  points: { vin: number; vout: number; iscMa: number; slope: number; region: string }[];
  voh: number;
  vol: number;
  vil: number;
  vih: number;
  vm: number;
  nml: number;
  nmh: number;
  peakGain: number;
  peakIscMa: number;
}

export function analyzeVtc(params: VtcParams): VtcResult {
  const vdd = Math.max(1.2, Math.min(10, Number.isFinite(params.vdd) ? params.vdd : 3.3));
  const wpWnRatio = Math.max(0.1, Math.min(10, Number.isFinite(params.wpWnRatio) ? params.wpWnRatio : 2.5));
  const vthN = Math.max(0.2, Math.min(vdd * 0.45, Number.isFinite(params.vthN) ? params.vthN : 0.6));
  const vthP = Math.max(0.2, Math.min(vdd * 0.45, Number.isFinite(params.vthP) ? params.vthP : 0.6));
  const bjtBeta = Math.max(10, Number.isFinite(params.bjtBeta) ? params.bjtBeta : 100);
  const bjtRcRbRatio = Math.max(0.02, Number.isFinite(params.bjtRcRbRatio) ? params.bjtRcRbRatio : 0.25);

  const steps = 160;
  const rawPoints: { vin: number; vout: number; iscMa: number; region: string }[] = [];

  if (params.topology === 'cmos') {
    const kr = wpWnRatio / 2.5;
    const knMa = 1.0;
    const kpMa = knMa * kr;
    const lambda = 0.04;

    const idN = (vin: number, vout: number) => {
      const vov = vin - vthN;
      if (vov <= 0) return 0;
      if (vout < vov) return knMa * (vov * vout - 0.5 * vout * vout) * (1 + lambda * vout);
      return 0.5 * knMa * vov * vov * (1 + lambda * vout);
    };

    const idP = (vin: number, vout: number) => {
      const vsg = vdd - vin;
      const vov = vsg - vthP;
      const vsd = vdd - vout;
      if (vov <= 0) return 0;
      if (vsd < vov) return kpMa * (vov * vsd - 0.5 * vsd * vsd) * (1 + lambda * vsd);
      return 0.5 * kpMa * vov * vov * (1 + lambda * vsd);
    };

    for (let i = 0; i <= steps; i++) {
      const vin = (i / steps) * vdd;
      let lo = 0;
      let hi = vdd;
      if (vin <= vthN) {
        lo = vdd;
        hi = vdd;
      } else if (vdd - vin <= vthP) {
        lo = 0;
        hi = 0;
      } else {
        for (let iter = 0; iter < 32; iter++) {
          const mid = 0.5 * (lo + hi);
          const diff = idN(vin, mid) - idP(vin, mid);
          if (diff > 0) hi = mid;
          else lo = mid;
        }
      }
      const vout = 0.5 * (lo + hi);
      const iscMa = Math.min(idN(vin, vout), idP(vin, vout));
      let region = 'Transition (Both Sat)';
      if (vin <= vthN) region = 'N: Cutoff · P: Triode';
      else if (vdd - vin <= vthP) region = 'N: Triode · P: Cutoff';
      else if (vout > vin - vthN && vdd - vout < vdd - vin - vthP) region = 'N: Sat · P: Triode';
      else if (vout < vin - vthN && vdd - vout > vdd - vin - vthP) region = 'N: Triode · P: Sat';
      rawPoints.push({ vin, vout, iscMa, region });
    }
  } else {
    const vbeOn = 0.7;
    const vceSat = 0.2;
    const rc = 1000;
    const rb = rc / bjtRcRbRatio;

    for (let i = 0; i <= steps; i++) {
      const vin = (i / steps) * vdd;
      if (vin <= vbeOn) {
        const subLeak = 0.02 * Math.exp((vin - vbeOn) / 0.05);
        const vout = Math.max(vceSat, vdd - subLeak);
        rawPoints.push({ vin, vout, iscMa: (subLeak / rc) * 1000, region: 'BJT Cutoff' });
      } else {
        const ib = (vin - vbeOn) / rb;
        const ic = bjtBeta * ib;
        const voutRaw = vdd - ic * rc;
        const vout = Math.max(vceSat, voutRaw);
        const icActual = (vdd - vout) / rc;
        rawPoints.push({
          vin,
          vout,
          iscMa: icActual * 1000,
          region: voutRaw <= vceSat ? 'BJT Saturation' : 'BJT Active',
        });
      }
    }
  }

  const voh = rawPoints[0].vout;
  const vol = rawPoints[rawPoints.length - 1].vout;

  let vm = vdd / 2;
  let minVmDiff = Infinity;
  let peakGain = 0;
  let peakIscMa = 0;
  let vil = vdd * 0.3;
  let vih = vdd * 0.7;
  let maxSlopeIdx = Math.floor(steps / 2);

  const points: VtcResult['points'] = rawPoints.map((p, i) => {
    if (Math.abs(p.vout - p.vin) < minVmDiff) {
      minVmDiff = Math.abs(p.vout - p.vin);
      vm = p.vin;
    }
    peakIscMa = Math.max(peakIscMa, p.iscMa);

    const prev = rawPoints[Math.max(0, i - 1)];
    const next = rawPoints[Math.min(rawPoints.length - 1, i + 1)];
    const dv = next.vin - prev.vin;
    const slope = dv > 1e-9 ? (next.vout - prev.vout) / dv : 0;
    if (-slope > peakGain) {
      peakGain = -slope;
      maxSlopeIdx = i;
    }
    return { ...p, slope };
  });

  let foundVil = false;
  for (let i = maxSlopeIdx; i >= 1; i--) {
    if (points[i].slope <= -1 && points[i - 1].slope > -1) {
      vil = points[i].vin;
      foundVil = true;
      break;
    }
  }
  if (!foundVil) vil = Math.max(0, vm - 0.15);

  let foundVih = false;
  for (let i = maxSlopeIdx; i < points.length - 1; i++) {
    if (points[i].slope <= -1 && points[i + 1].slope > -1) {
      vih = points[i].vin;
      foundVih = true;
      break;
    }
  }
  if (!foundVih) vih = Math.min(vdd, vm + 0.15);

  return {
    points,
    voh,
    vol,
    vil,
    vih,
    vm,
    nml: Math.max(0, vil - vol),
    nmh: Math.max(0, voh - vih),
    peakGain,
    peakIscMa,
  };
}
