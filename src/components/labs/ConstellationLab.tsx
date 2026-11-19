import React, { useState, useMemo } from 'react';
import {
  ConstellationParams,
  ModulationScheme,
  simulateConstellation,
} from '../../utils/signalsDspMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';
import { RefreshCw } from 'lucide-react';

const SCHEMES: ModulationScheme[] = ['BPSK', 'QPSK', '16-QAM', '64-QAM'];

export default function ConstellationLab() {
  const [params, setParams] = useState<ConstellationParams>({
    scheme: '16-QAM',
    snrDb: 18,
    phaseOffsetDeg: 0,
    symbolCount: 384,
    seed: 2026,
  });

  const [iqHover, setIqHover] = useState<{
    i: number;
    q: number;
    mag: number;
    angleDeg: number;
    nearestI: number;
    nearestQ: number;
    evmDistPct: number;
    pctLeft: number;
    pctTop: number;
  } | null>(null);

  const result = useMemo(() => simulateConstellation(params), [params]);

  const size = 420;
  const half = size / 2;
  const bound = 1.65;
  const mapI = (v: number) => half + (v / bound) * (half - 28);
  const mapQ = (v: number) => half - (v / bound) * (half - 28);

  const serPct = result.empiricalSer * 100;
  const statusTone = serPct <= 0.5 ? 'nominal' : serPct <= 5.0 ? 'warning' : 'critical';
  const statusLabel =
    serPct <= 0.5
      ? `Clean Demodulation (${serPct.toFixed(2)}% SER)`
      : serPct <= 5.0
      ? `Elevated Symbol Errors (${serPct.toFixed(2)}% SER)`
      : `Severe Error Floor (${serPct.toFixed(1)}% SER)`;

  // Decision grid lines for QPSK / 16-QAM / 64-QAM
  const decisionThresholds = useMemo(() => {
    if (params.scheme === 'BPSK' || params.scheme === 'QPSK') return [0];
    if (params.scheme === '16-QAM') {
      const norm = Math.sqrt(10);
      return [-2 / norm, 0, 2 / norm];
    }
    const norm = Math.sqrt(42);
    return [-6, -4, -2, 0, 2, 4, 6].map((v) => v / norm);
  }, [params.scheme]);

  const handleIqMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * size;
    const sy = ((e.clientY - rect.top) / rect.height) * size;
    const iVal = ((sx - half) / (half - 28)) * bound;
    const qVal = ((half - sy) / (half - 28)) * bound;

    let nearest = result.idealPoints[0];
    let bestD2 = Infinity;
    for (const pt of result.idealPoints) {
      const d2 = (iVal - pt.re) ** 2 + (qVal - pt.im) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearest = pt;
      }
    }

    setIqHover({
      i: iVal,
      q: qVal,
      mag: Math.hypot(iVal, qVal),
      angleDeg: (Math.atan2(qVal, iVal) * 180) / Math.PI,
      nearestI: nearest.re,
      nearestQ: nearest.im,
      evmDistPct: Math.sqrt(bestD2) * 100,
      pctLeft: (sx / size) * 100,
      pctTop: (sy / size) * 100,
    });
  };

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="06"
        title="Constellation Diagram (I/Q Modulation)"
        domain="Digital Telecommunications"
        description="Switch between BPSK, QPSK, 16-QAM, and 64-QAM while adding AWGN noise and carrier phase offset to inspect Voronoi decision boundaries, EVM, SER, and phase/amplitude distortion."
        status={<StatusIndicator tone={statusTone} label={statusLabel} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg">
              {SCHEMES.map((s) => (
                <button
                  key={s}
                  onClick={() => setParams((p) => ({ ...p, scheme: s }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    params.scheme === s ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setParams((p) => ({ ...p, seed: (p.seed ?? 1) + 31 }))}
              className="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" /> New Burst
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout
          label="Symbol Error Rate (SER)"
          value={`${(result.empiricalSer * 100).toFixed(2)}%`}
          subtext={`AWGN Theory: ${result.theoreticalSer < 1e-4 ? result.theoreticalSer.toExponential(1) : `${(result.theoreticalSer * 100).toFixed(2)}%`}`}
          tone={serPct <= 1 ? 'emerald' : 'rose'}
        />
        <MetricReadout
          label="EVM (rms)"
          value={`${result.evmPercent.toFixed(1)}%`}
          subtext={`${result.evmDb.toFixed(1)} dB (${result.symbolErrors} errs)`}
          tone="cyan"
        />
        <MetricReadout
          label="Phase Distortion (rms)"
          value={`${result.rmsPhaseErrorDeg.toFixed(1)}°`}
          subtext={`Carrier Δθ = ${params.phaseOffsetDeg >= 0 ? '+' : ''}${params.phaseOffsetDeg}°`}
        />
        <MetricReadout
          label="Amplitude Distortion (rms)"
          value={`${result.rmsAmplitudeErrorPct.toFixed(1)}%`}
          subtext={`${result.bitsPerSymbol} bits/symbol · SNR ${params.snrDb} dB`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 flex flex-col items-center relative">
          <div className="w-full flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-200">Normalized I/Q Plane ({params.scheme})</span>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span className="text-cyan-300">● Correct</span>
              <span className="text-rose-400">× Symbol Error</span>
              <span className="text-slate-200">+ Ideal Reference</span>
            </div>
          </div>

          <div className="relative w-full max-w-[440px]">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full aspect-square bg-[#060911] rounded-lg border border-slate-800 cursor-crosshair"
              onMouseMove={handleIqMove}
              onMouseLeave={() => setIqHover(null)}
            >
              {/* Decision boundary lines */}
              {decisionThresholds.map((th, idx) => (
                <g key={idx}>
                  <line
                    x1={mapI(th)}
                    y1={20}
                    x2={mapI(th)}
                    y2={size - 20}
                    stroke={th === 0 ? '#334155' : '#1e293b'}
                    strokeDasharray={th === 0 ? undefined : '4 4'}
                    strokeWidth="1"
                  />
                  {params.scheme !== 'BPSK' && (
                    <line
                      x1={20}
                      y1={mapQ(th)}
                      x2={size - 20}
                      y2={mapQ(th)}
                      stroke={th === 0 ? '#334155' : '#1e293b'}
                      strokeDasharray={th === 0 ? undefined : '4 4'}
                      strokeWidth="1"
                    />
                  )}
                </g>
              ))}

              {/* Unit circle reference */}
              <circle cx={half} cy={half} r={mapI(1) - half} fill="none" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Axis Labels */}
              <text x={size - 14} y={half - 6} textAnchor="end" fill="#64748b" className="text-[11px] font-mono">
                I (In-Phase)
              </text>
              <text x={half + 8} y={24} fill="#64748b" className="text-[11px] font-mono">
                Q (Quadrature)
              </text>

              {/* Received noisy scatter */}
              {result.receivedPoints.map((pt, i) => {
                const cx = mapI(Math.max(-bound, Math.min(bound, pt.i)));
                const cy = mapQ(Math.max(-bound, Math.min(bound, pt.q)));
                if (pt.isError) {
                  return (
                    <g key={i} stroke="#fb7185" strokeWidth="1.5">
                      <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} />
                      <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} />
                    </g>
                  );
                }
                return <circle key={i} cx={cx} cy={cy} r={2.2} fill="#22d3ee" fillOpacity="0.65" />;
              })}

              {/* Ideal symbol anchors */}
              {result.idealPoints.map((pt, i) => {
                const cx = mapI(pt.re);
                const cy = mapQ(pt.im);
                return (
                  <g key={`ideal-${i}`} stroke="#f8fafc" strokeWidth="1.5">
                    <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
                    <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} />
                  </g>
                );
              })}

              {iqHover && (
                <g pointerEvents="none">
                  <line
                    x1={mapI(iqHover.nearestI)}
                    y1={mapQ(iqHover.nearestQ)}
                    x2={mapI(iqHover.i)}
                    y2={mapQ(iqHover.q)}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                  <circle cx={mapI(iqHover.i)} cy={mapQ(iqHover.q)} r="4" fill="#fbbf24" />
                </g>
              )}
            </svg>

            {iqHover && (
              <div
                data-testid="iq-tooltip"
                className="absolute z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{
                  left: `${Math.min(58, Math.max(6, iqHover.pctLeft + 3))}%`,
                  top: `${Math.min(68, Math.max(6, iqHover.pctTop))}%`,
                }}
              >
                <div className="text-slate-200 font-semibold">
                  I = {iqHover.i.toFixed(2)}, Q = {iqHover.q.toFixed(2)}
                </div>
                <div className="text-cyan-300">
                  |r| = {iqHover.mag.toFixed(2)} ∠ {iqHover.angleDeg.toFixed(1)}°
                </div>
                <div className="text-amber-300">
                  Nearest: ({iqHover.nearestI.toFixed(2)}, {iqHover.nearestQ.toFixed(2)}) · Δ {iqHover.evmDistPct.toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Channel &amp; Carrier Impairments
          </h3>
          <ParamSlider
            label="Signal-to-Noise Ratio (E_s/N_0)"
            value={params.snrDb}
            min={0}
            max={30}
            step={0.5}
            unit="dB"
            minLabel="0 dB (Noisy)"
            maxLabel="30 dB (Clean)"
            onChange={(v) => setParams((p) => ({ ...p, snrDb: v }))}
          />
          <ParamSlider
            label="Carrier Phase Offset (Δθ)"
            value={params.phaseOffsetDeg}
            min={-30}
            max={30}
            step={0.5}
            unit="°"
            displayValue={`${params.phaseOffsetDeg >= 0 ? '+' : ''}${params.phaseOffsetDeg}`}
            onChange={(v) => setParams((p) => ({ ...p, phaseOffsetDeg: v }))}
            accentClass="accent-amber-400"
          />
          <ParamSlider
            label="Burst Sample Count"
            value={params.symbolCount}
            min={64}
            max={1024}
            step={64}
            unit="syms"
            onChange={(v) => setParams((p) => ({ ...p, symbolCount: v }))}
          />
        </div>
      </div>
    </div>
  );
}
