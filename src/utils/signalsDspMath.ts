import { Complex } from '../types';

export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussianSample(rand: () => number): number {
  const u1 = Math.max(1e-12, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function erfcApprox(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const res = poly * Math.exp(-z * z);
  return x >= 0 ? res : 2 - res;
}

// ==========================================
// 5. Eye Diagram (Signal Integrity)
// ==========================================

export type EyeModulation = 'nrz' | 'pam4';

export interface EyeParams {
  modulation: EyeModulation;
  dataRateGbps: number;
  bandwidthGhz: number;
  jitterPs: number;              // RMS random jitter (RJ) in ps
  deterministicJitterPs?: number; // Duty-cycle / deterministic jitter (DJ) in ps
  noiseMv: number;
  swingMv: number;
  seed?: number;
}

export interface EyeSimulationResult {
  traces: number[][];
  samplesPerUi: number;
  eyeHeightMv: number;
  eyeWidthUi: number;
  eyeWidthPs: number;
  zeroCrossingJitterPs: number; // total pk-pk jitter at crossing
  berEstimate: number;
  berRiskLabel: 'Low (<1e-9)' | 'Moderate' | 'High';
  qFactor: number;
  snrDb: number;
  status: 'Eye Open' | 'Margin Degraded' | 'Eye Closed';
  uiPs: number;
}

export function simulateEyeDiagram(params: EyeParams): EyeSimulationResult {
  const modulation: EyeModulation = params.modulation === 'pam4' ? 'pam4' : 'nrz';
  const dataRateGbps = Math.max(0.5, Number.isFinite(params.dataRateGbps) ? params.dataRateGbps : 10);
  const bandwidthGhz = Math.max(0.2, Number.isFinite(params.bandwidthGhz) ? params.bandwidthGhz : 8);
  const jitterPs = Math.max(0, Number.isFinite(params.jitterPs) ? params.jitterPs : 4);
  const djPs = Math.max(0, Number.isFinite(params.deterministicJitterPs) ? (params.deterministicJitterPs ?? 0) : 4);
  const noiseMv = Math.max(0, Number.isFinite(params.noiseMv) ? params.noiseMv : 18);
  const swingMv = Math.max(100, Number.isFinite(params.swingMv) ? params.swingMv : 800);

  const symbolRateGhz = modulation === 'pam4' ? dataRateGbps / 2 : dataRateGbps;
  const uiPs = 1000 / symbolRateGhz;
  const jitterUi = jitterPs / uiPs;
  const djUi = djPs / uiPs;

  const samplesPerUi = 32;
  const totalSymbols = 110;
  const rand = createPrng(params.seed ?? 421337);

  const levels = modulation === 'nrz' ? [-1, 1] : [-1, -1 / 3, 1 / 3, 1];
  const halfSwing = swingMv / 2;
  const symbols: number[] = [];
  for (let i = 0; i < totalSymbols; i++) {
    const idx = Math.floor(rand() * levels.length);
    symbols.push(levels[idx] * halfSwing);
  }

  const totalSamples = totalSymbols * samplesPerUi;
  const rawWave = new Float64Array(totalSamples);

  for (let s = 0; s < totalSymbols; s++) {
    // Alternating deterministic DCD + Gaussian RJ
    const dcdOffset = (s % 2 === 0 ? 0.5 : -0.5) * djUi * samplesPerUi;
    const rjOffset = gaussianSample(rand) * jitterUi * samplesPerUi;
    const jitterShiftSamples = Math.max(
      -samplesPerUi * 0.45,
      Math.min(samplesPerUi * 0.45, dcdOffset + rjOffset)
    );
    const startIdx = Math.max(0, Math.round(s * samplesPerUi + jitterShiftSamples));
    const endIdx = Math.min(totalSamples, Math.round((s + 1) * samplesPerUi + jitterShiftSamples));
    for (let k = startIdx; k < endIdx; k++) {
      rawWave[k] = symbols[s];
    }
  }

  const fsGhz = symbolRateGhz * samplesPerUi;
  const dt = 1 / fsGhz;
  const rc = 1 / (2 * Math.PI * bandwidthGhz);
  const alpha = dt / (rc + dt);

  const filtered = new Float64Array(totalSamples);
  filtered[0] = rawWave[0];
  for (let i = 1; i < totalSamples; i++) {
    filtered[i] = filtered[i - 1] + alpha * (rawWave[i] - filtered[i - 1]);
  }

  const traces: number[][] = [];
  const traceLen = samplesPerUi * 2 + 1;
  const startSym = 6;
  const endSym = totalSymbols - 3;

  const centerIdx = Math.floor(samplesPerUi * 0.5);
  const upperSamples: number[] = [];
  const lowerSamples: number[] = [];

  for (let s = startSym; s < endSym; s += 2) {
    const offset = s * samplesPerUi;
    const trace: number[] = [];
    for (let k = 0; k < traceLen; k++) {
      const val = filtered[offset + k] + gaussianSample(rand) * noiseMv;
      trace.push(val);
    }
    traces.push(trace);

    const midVal = trace[centerIdx];
    if (modulation === 'nrz') {
      if (midVal >= 0) upperSamples.push(midVal);
      else lowerSamples.push(midVal);
    } else {
      if (midVal > 0 && midVal < halfSwing * 0.66) upperSamples.push(midVal);
      else if (midVal <= 0 && midVal > -halfSwing * 0.66) lowerSamples.push(midVal);
    }
  }

  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const std = (arr: number[], m: number) =>
    arr.length > 1 ? Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) : 1;

  const mu1 = upperSamples.length ? mean(upperSamples) : halfSwing / (modulation === 'pam4' ? 3 : 1);
  const mu0 = lowerSamples.length ? mean(lowerSamples) : -halfSwing / (modulation === 'pam4' ? 3 : 1);
  const s1 = std(upperSamples, mu1);
  const s0 = std(lowerSamples, mu0);

  const minUpper = upperSamples.length ? Math.min(...upperSamples) : mu1;
  const maxLower = lowerSamples.length ? Math.max(...lowerSamples) : mu0;
  const eyeHeightMv = Math.max(0, minUpper - maxLower);

  const qFactor = s1 + s0 > 1e-6 ? Math.max(0, (mu1 - mu0) / (s1 + s0)) : 20;
  const snrDb = noiseMv > 0.1 ? 20 * Math.log10((mu1 - mu0) / (2 * noiseMv)) : 40;
  const berEstimate = 0.5 * erfcApprox(qFactor / Math.SQRT2);
  const berRiskLabel: EyeSimulationResult['berRiskLabel'] =
    berEstimate < 1e-9 ? 'Low (<1e-9)' : berEstimate < 1e-4 ? 'Moderate' : 'High';

  const riseTimeUi = (0.35 / bandwidthGhz) * symbolRateGhz;
  const zeroCrossingJitterPs = Math.min(uiPs, djPs + 6 * jitterPs + 0.35 * riseTimeUi * uiPs);
  const eyeWidthUi = Math.max(0, Math.min(1.0, 1.0 - 0.5 * riseTimeUi - 4.5 * jitterUi - djUi));
  const eyeWidthPs = eyeWidthUi * uiPs;

  const nominalEyeHeight = modulation === 'nrz' ? swingMv : swingMv / 3;
  const heightRatio = eyeHeightMv / nominalEyeHeight;
  let status: EyeSimulationResult['status'] = 'Eye Open';
  if (eyeHeightMv <= 10 || eyeWidthUi <= 0.12) status = 'Eye Closed';
  else if (heightRatio < 0.45 || eyeWidthUi < 0.45) status = 'Margin Degraded';

  return {
    traces,
    samplesPerUi,
    eyeHeightMv,
    eyeWidthUi,
    eyeWidthPs,
    zeroCrossingJitterPs,
    berEstimate,
    berRiskLabel,
    qFactor,
    snrDb,
    status,
    uiPs,
  };
}

// ==========================================
// 6. Constellation Diagram (I/Q Modulation)
// ==========================================

export type ModulationScheme = 'BPSK' | 'QPSK' | '16-QAM' | '64-QAM';

export interface ConstellationParams {
  scheme: ModulationScheme;
  snrDb: number;
  phaseOffsetDeg: number;
  symbolCount: number;
  seed?: number;
}

export interface ConstellationSymbolPoint {
  i: number;
  q: number;
  txIdx: number;
  rxIdx: number;
  isError: boolean;
}

export interface ConstellationResult {
  idealPoints: Complex[];
  receivedPoints: ConstellationSymbolPoint[];
  symbolErrors: number;
  empiricalSer: number;
  theoreticalSer: number;
  evmPercent: number;
  evmDb: number;
  rmsPhaseErrorDeg: number;
  rmsAmplitudeErrorPct: number;
  bitsPerSymbol: number;
}

export function getIdealConstellation(scheme: ModulationScheme): Complex[] {
  if (scheme === 'BPSK') {
    return [{ re: -1, im: 0 }, { re: 1, im: 0 }];
  }
  if (scheme === 'QPSK') {
    const s = 1 / Math.SQRT2;
    return [
      { re: -s, im: -s },
      { re: -s, im: s },
      { re: s, im: -s },
      { re: s, im: s },
    ];
  }
  const mSide = scheme === '16-QAM' ? 4 : 8;
  const raw: Complex[] = [];
  let energySum = 0;
  for (let ix = 0; ix < mSide; ix++) {
    for (let iq = 0; iq < mSide; iq++) {
      const re = 2 * ix - (mSide - 1);
      const im = 2 * iq - (mSide - 1);
      raw.push({ re, im });
      energySum += re * re + im * im;
    }
  }
  const norm = Math.sqrt(energySum / raw.length);
  return raw.map((p) => ({ re: p.re / norm, im: p.im / norm }));
}

export function simulateConstellation(params: ConstellationParams): ConstellationResult {
  const scheme: ModulationScheme = params.scheme || '16-QAM';
  const snrDb = Math.max(-5, Math.min(40, Number.isFinite(params.snrDb) ? params.snrDb : 16));
  const phaseRad = ((Number.isFinite(params.phaseOffsetDeg) ? params.phaseOffsetDeg : 0) * Math.PI) / 180;
  const symbolCount = Math.max(16, Math.min(2048, Math.floor(params.symbolCount || 256)));

  const idealPoints = getIdealConstellation(scheme);
  const snrLin = Math.pow(10, snrDb / 10);
  const sigma = Math.sqrt(1 / (2 * snrLin));

  const rand = createPrng(params.seed ?? 98765);
  const cosP = Math.cos(phaseRad);
  const sinP = Math.sin(phaseRad);

  const receivedPoints: ConstellationSymbolPoint[] = [];
  let symbolErrors = 0;
  let evmSqSum = 0;
  let phaseErrSqSum = 0;
  let ampErrSqSum = 0;

  for (let k = 0; k < symbolCount; k++) {
    const txIdx = Math.floor(rand() * idealPoints.length);
    const tx = idealPoints[txIdx];

    const rotI = tx.re * cosP - tx.im * sinP;
    const rotQ = tx.re * sinP + tx.im * cosP;
    const rxI = rotI + gaussianSample(rand) * sigma;
    const rxQ = rotQ + gaussianSample(rand) * sigma;

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < idealPoints.length; j++) {
      const dx = rxI - idealPoints[j].re;
      const dy = rxQ - idealPoints[j].im;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestIdx = j;
      }
    }

    const isError = bestIdx !== txIdx;
    if (isError) symbolErrors++;
    evmSqSum += (rxI - tx.re) ** 2 + (rxQ - tx.im) ** 2;

    const txMag = Math.hypot(tx.re, tx.im) || 1;
    const rxMag = Math.hypot(rxI, rxQ);
    ampErrSqSum += ((rxMag - txMag) / txMag) ** 2;

    let dTheta = Math.atan2(rxQ, rxI) - Math.atan2(tx.im, tx.re);
    while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    phaseErrSqSum += ((dTheta * 180) / Math.PI) ** 2;

    receivedPoints.push({ i: rxI, q: rxQ, txIdx, rxIdx: bestIdx, isError });
  }

  let theoreticalSer = 0;
  if (scheme === 'BPSK') {
    theoreticalSer = 0.5 * erfcApprox(Math.sqrt(snrLin));
  } else if (scheme === 'QPSK') {
    const pBit = 0.5 * erfcApprox(Math.sqrt(snrLin / 2));
    theoreticalSer = 1 - (1 - pBit) ** 2;
  } else {
    const M = scheme === '16-QAM' ? 16 : 64;
    const sqrtM = Math.sqrt(M);
    const arg = Math.sqrt((3 * snrLin) / (2 * (M - 1)));
    const pSqrtM = 2 * (1 - 1 / sqrtM) * 0.5 * erfcApprox(arg);
    theoreticalSer = 1 - (1 - pSqrtM) ** 2;
  }

  const bitsPerSymbol = Math.log2(idealPoints.length);
  const empiricalSer = symbolErrors / symbolCount;
  const evmPercent = Math.sqrt(evmSqSum / symbolCount) * 100;
  const evmDb = 20 * Math.log10(Math.max(1e-4, evmPercent / 100));
  const rmsPhaseErrorDeg = Math.sqrt(phaseErrSqSum / symbolCount);
  const rmsAmplitudeErrorPct = Math.sqrt(ampErrSqSum / symbolCount) * 100;

  return {
    idealPoints,
    receivedPoints,
    symbolErrors,
    empiricalSer,
    theoreticalSer,
    evmPercent,
    evmDb,
    rmsPhaseErrorDeg,
    rmsAmplitudeErrorPct,
    bitsPerSymbol,
  };
}

// ==========================================
// 7. Pole–Zero Plot (z-Plane Digital Filters)
// ==========================================

export interface PoleZeroFilterResult {
  frequenciesNorm: number[];
  magnitudeDb: number[];
  magnitudeLinear: number[];
  phaseDeg: number[];
  impulseResponse: number[];
  bCoeffs: number[];
  aCoeffs: number[];
  maxPoleRadius: number;
  passbandGainDb: number;
  stopbandAttenDb: number;
  phaseLinearityLabel: 'Linear' | 'Near-Linear' | 'Non-Linear';
  stability: 'Stable' | 'Marginally Stable' | 'Unstable';
}

function convolveRoot(coeffs: Complex[], root: Complex): Complex[] {
  const out: Complex[] = Array.from({ length: coeffs.length + 1 }, () => ({ re: 0, im: 0 }));
  for (let i = 0; i < coeffs.length; i++) {
    out[i].re += coeffs[i].re;
    out[i].im += coeffs[i].im;
    out[i + 1].re -= coeffs[i].re * root.re - coeffs[i].im * root.im;
    out[i + 1].im -= coeffs[i].re * root.im + coeffs[i].im * root.re;
  }
  return out;
}

export function analyzePoleZeroFilter(poles: Complex[], zeros: Complex[]): PoleZeroFilterResult {
  const safePoles = poles.filter((p) => Number.isFinite(p.re) && Number.isFinite(p.im));
  const safeZeros = zeros.filter((z) => Number.isFinite(z.re) && Number.isFinite(z.im));

  let bPoly: Complex[] = [{ re: 1, im: 0 }];
  for (const z of safeZeros) bPoly = convolveRoot(bPoly, z);

  let aPoly: Complex[] = [{ re: 1, im: 0 }];
  for (const p of safePoles) aPoly = convolveRoot(aPoly, p);

  const rawB = bPoly.map((c) => c.re);
  const rawA = aPoly.map((c) => c.re);

  const numFreq = 129;
  const frequenciesNorm: number[] = [];
  const rawMag: number[] = [];
  const phaseDeg: number[] = [];

  for (let i = 0; i < numFreq; i++) {
    const fNorm = (i / (numFreq - 1)) * 0.5;
    const w = 2 * Math.PI * fNorm;
    frequenciesNorm.push(fNorm);

    const ejw = { re: Math.cos(w), im: Math.sin(w) };
    let numRe = 1;
    let numIm = 0;
    for (const z of safeZeros) {
      const dr = ejw.re - z.re;
      const di = ejw.im - z.im;
      const nr = numRe * dr - numIm * di;
      const ni = numRe * di + numIm * dr;
      numRe = nr;
      numIm = ni;
    }

    let denRe = 1;
    let denIm = 0;
    for (const p of safePoles) {
      const dr = ejw.re - p.re;
      const di = ejw.im - p.im;
      const nr = denRe * dr - denIm * di;
      const ni = denRe * di + denIm * dr;
      denRe = nr;
      denIm = ni;
    }

    const denMag2 = denRe * denRe + denIm * denIm;
    const mag = denMag2 < 1e-12 ? 1e4 : Math.sqrt((numRe * numRe + numIm * numIm) / denMag2);
    rawMag.push(mag);

    const hRe = denMag2 < 1e-12 ? 0 : (numRe * denRe + numIm * denIm) / denMag2;
    const hIm = denMag2 < 1e-12 ? 0 : (numIm * denRe - numRe * denIm) / denMag2;
    phaseDeg.push((Math.atan2(hIm, hRe) * 180) / Math.PI);
  }

  const peakMag = Math.max(1e-6, ...rawMag.filter((m) => m < 500));
  const gainScale = 1 / peakMag;
  const magnitudeLinear = rawMag.map((m) => Math.min(10, m * gainScale));
  const magnitudeDb = magnitudeLinear.map((m) => Math.max(-60, 20 * Math.log10(Math.max(1e-4, m))));

  const bCoeffs = rawB.map((b) => b * gainScale);
  const aCoeffs = rawA;

  const impLen = 40;
  const impulseResponse: number[] = [];
  for (let n = 0; n < impLen; n++) {
    let val = n < bCoeffs.length ? bCoeffs[n] : 0;
    for (let k = 1; k < aCoeffs.length; k++) {
      if (n - k >= 0) {
        val -= aCoeffs[k] * impulseResponse[n - k];
      }
    }
    impulseResponse.push(Math.max(-100, Math.min(100, val / (aCoeffs[0] || 1))));
  }

  let maxPoleRadius = 0;
  for (const p of safePoles) {
    const r = Math.sqrt(p.re * p.re + p.im * p.im);
    if (r > maxPoleRadius) maxPoleRadius = r;
  }

  let stability: PoleZeroFilterResult['stability'] = 'Stable';
  if (maxPoleRadius > 1.005) stability = 'Unstable';
  else if (maxPoleRadius >= 0.995) stability = 'Marginally Stable';

  // Passband (> -3 dB) & Stopband min attenuation
  const passbandGainDb = Math.max(...magnitudeDb);
  const stopbandAttenDb = Math.min(...magnitudeDb);

  // Measure phase linearity in passband (points within 6 dB of peak)
  const unwrapped: number[] = [phaseDeg[0]];
  for (let i = 1; i < phaseDeg.length; i++) {
    let d = phaseDeg[i] - phaseDeg[i - 1];
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    unwrapped.push(unwrapped[i - 1] + d);
  }
  const passIndices = magnitudeDb.map((db, idx) => (db >= -6 ? idx : -1)).filter((idx) => idx >= 0);
  let phaseLinearityLabel: PoleZeroFilterResult['phaseLinearityLabel'] = 'Linear';
  if (safePoles.length === 0) {
    phaseLinearityLabel = 'Linear';
  } else if (passIndices.length >= 3) {
    const first = passIndices[0];
    const last = passIndices[passIndices.length - 1];
    const slope = (unwrapped[last] - unwrapped[first]) / Math.max(1, last - first);
    let maxDev = 0;
    for (const idx of passIndices) {
      const lineVal = unwrapped[first] + slope * (idx - first);
      maxDev = Math.max(maxDev, Math.abs(unwrapped[idx] - lineVal));
    }
    phaseLinearityLabel = maxDev < 8 ? 'Linear' : maxDev < 25 ? 'Near-Linear' : 'Non-Linear';
  } else {
    phaseLinearityLabel = 'Non-Linear';
  }

  return {
    frequenciesNorm,
    magnitudeDb,
    magnitudeLinear,
    phaseDeg,
    impulseResponse,
    bCoeffs,
    aCoeffs,
    maxPoleRadius,
    passbandGainDb,
    stopbandAttenDb,
    phaseLinearityLabel,
    stability,
  };
}
