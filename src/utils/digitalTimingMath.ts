export type SequentialDevice = 'dff' | 'jkff' | 'tff' | 'counter4';

export interface TimingParams {
  device: SequentialDevice;
  clockPeriodNs: number;
  tSetupNs: number;
  tHoldNs: number;
  tPdNs: number;
  transitionOffsetNs: number;
  inputA: number[];
  inputB: number[];
}

export interface EdgeDiagnostic {
  cycle: number;
  edgeTimeNs: number;
  hasSetupViolation: boolean;
  hasHoldViolation: boolean;
  hasGlitchRisk: boolean;
  isMetastable: boolean;
  capturedQ: number;
}

export interface WaveformSegment {
  tStart: number;
  tEnd: number;
  val: number;
}

export interface TimingSimulationResult {
  cycles: number;
  totalTimeNs: number;
  clkEdgesNs: number[];
  clkSegments: WaveformSegment[];
  inputASegments: WaveformSegment[];
  inputBSegments: WaveformSegment[];
  qSegments: WaveformSegment[];
  qSequence: number[];
  diagnostics: EdgeDiagnostic[];
  violationCount: number;
  glitchCount: number;
}

function buildSteppedSegments(
  times: number[],
  values: number[],
  totalTimeNs: number
): WaveformSegment[] {
  const segs: WaveformSegment[] = [];
  for (let i = 0; i < times.length; i++) {
    const tStart = times[i];
    const tEnd = i + 1 < times.length ? times[i + 1] : totalTimeNs;
    if (tEnd > tStart) {
      segs.push({ tStart, tEnd, val: values[i] });
    }
  }
  return segs;
}

export function simulateDigitalTiming(params: TimingParams): TimingSimulationResult {
  const cycles = 8;
  const T = Math.max(4, Number.isFinite(params.clockPeriodNs) ? params.clockPeriodNs : 20);
  const tSu = Math.max(0.5, Math.min(T * 0.4, Number.isFinite(params.tSetupNs) ? params.tSetupNs : 3));
  const tH = Math.max(0.5, Math.min(T * 0.4, Number.isFinite(params.tHoldNs) ? params.tHoldNs : 2));
  const tPd = Math.max(0.5, Math.min(T * 0.6, Number.isFinite(params.tPdNs) ? params.tPdNs : 4));
  const offsetNs = Number.isFinite(params.transitionOffsetNs) ? params.transitionOffsetNs : -6;

  const totalTimeNs = cycles * T;
  const clkEdgesNs: number[] = [];
  const clkSegments: WaveformSegment[] = [];

  for (let c = 0; c < cycles; c++) {
    const t0 = c * T;
    const rise = t0 + T * 0.5;
    clkEdgesNs.push(rise);
    clkSegments.push({ tStart: t0, tEnd: rise, val: 0 });
    clkSegments.push({ tStart: rise, tEnd: t0 + T, val: 1 });
  }

  const inA = Array.from({ length: cycles }, (_, i) => (params.inputA[i] ? 1 : 0));
  const inB = Array.from({ length: cycles }, (_, i) => (params.inputB[i] ? 1 : 0));

  const aTimes: number[] = [0];
  const aVals: number[] = [inA[0]];
  const bTimes: number[] = [0];
  const bVals: number[] = [inB[0]];

  for (let c = 1; c < cycles; c++) {
    let tChangeA = c * T;
    if (c === 2) {
      tChangeA = Math.max(c * T + 0.5, Math.min((c + 1) * T - 0.5, clkEdgesNs[2] + offsetNs));
    }
    if (inA[c] !== aVals[aVals.length - 1]) {
      aTimes.push(tChangeA);
      aVals.push(inA[c]);
    }

    const tChangeB = c * T;
    if (inB[c] !== bVals[bVals.length - 1]) {
      bTimes.push(tChangeB);
      bVals.push(inB[c]);
    }
  }

  const inputASegments = buildSteppedSegments(aTimes, aVals, totalTimeNs);
  const inputBSegments = buildSteppedSegments(bTimes, bVals, totalTimeNs);

  const sampleSignalAt = (segs: WaveformSegment[], t: number): number => {
    for (let i = segs.length - 1; i >= 0; i--) {
      if (t >= segs[i].tStart - 1e-9) return segs[i].val;
    }
    return segs[0]?.val ?? 0;
  };

  let qState = 0;
  const qTimes: number[] = [0];
  const qVals: number[] = [0];
  const qSequence: number[] = [];
  const diagnostics: EdgeDiagnostic[] = [];

  for (let c = 0; c < cycles; c++) {
    const edgeT = clkEdgesNs[c];
    const winStart = edgeT - tSu;
    const winEnd = edgeT + tH;

    let hasSetupViolation = false;
    let hasHoldViolation = false;

    for (const t of [...aTimes.slice(1), ...bTimes.slice(1)]) {
      if (t > winStart + 1e-6 && t <= edgeT + 1e-6) {
        hasSetupViolation = true;
      }
      if (t > edgeT + 1e-6 && t < winEnd - 1e-6) {
        hasHoldViolation = true;
      }
    }

    // Detect narrow pulse glitch (< tSu + tH) on input A in this cycle
    let hasGlitchRisk = false;
    for (const seg of inputASegments) {
      const dur = seg.tEnd - seg.tStart;
      if (seg.tStart >= c * T && seg.tStart < (c + 1) * T && dur < tSu + tH + 0.5) {
        hasGlitchRisk = true;
      }
    }

    const isMetastable = hasSetupViolation || hasHoldViolation;
    const sampledA = sampleSignalAt(inputASegments, edgeT - 1e-4);
    const sampledB = sampleSignalAt(inputBSegments, edgeT - 1e-4);

    let nextQ = qState;
    if (params.device === 'dff') {
      nextQ = sampledA;
    } else if (params.device === 'jkff') {
      if (sampledA === 0 && sampledB === 0) nextQ = qState;
      else if (sampledA === 1 && sampledB === 0) nextQ = 1;
      else if (sampledA === 0 && sampledB === 1) nextQ = 0;
      else nextQ = qState === 1 ? 0 : 1;
    } else if (params.device === 'tff') {
      nextQ = sampledA === 1 ? (qState === 1 ? 0 : 1) : qState;
    } else if (params.device === 'counter4') {
      if (sampledB === 1) nextQ = 0;
      else if (sampledA === 1) nextQ = (qState + 1) % 16;
      else nextQ = qState;
    }

    qState = nextQ;
    qSequence.push(nextQ);
    const qOutTime = Math.min(totalTimeNs, edgeT + tPd);
    if (qOutTime > qTimes[qTimes.length - 1] && nextQ !== qVals[qVals.length - 1]) {
      qTimes.push(qOutTime);
      qVals.push(nextQ);
    }

    diagnostics.push({
      cycle: c,
      edgeTimeNs: edgeT,
      hasSetupViolation,
      hasHoldViolation,
      hasGlitchRisk,
      isMetastable,
      capturedQ: nextQ,
    });
  }

  const qSegments = buildSteppedSegments(qTimes, qVals, totalTimeNs);
  const violationCount = diagnostics.filter((d) => d.isMetastable).length;
  const glitchCount = diagnostics.filter((d) => d.hasGlitchRisk).length;

  return {
    cycles,
    totalTimeNs,
    clkEdgesNs,
    clkSegments,
    inputASegments,
    inputBSegments,
    qSegments,
    qSequence,
    diagnostics,
    violationCount,
    glitchCount,
  };
}
