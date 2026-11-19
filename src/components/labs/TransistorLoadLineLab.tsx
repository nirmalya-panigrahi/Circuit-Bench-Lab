import React, { useState, useMemo } from 'react';
import { analyzeBjtLoadLine, BjtParams } from '../../utils/electronicsMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';

const DEFAULT_BJT: BjtParams = {
  vcc: 12,
  rc: 1200,
  re: 470,
  r1: 22000,
  r2: 6800,
  rl: 2200,
  beta: 120,
  vinPeakMv: 25,
};

export default function TransistorLoadLineLab() {
  const [params, setParams] = useState<BjtParams>(DEFAULT_BJT);
  const [loadHover, setLoadHover] = useState<{
    xPx: number;
    vce: number;
    icDcMa: number;
    icAcMa: number;
    pctLeft: number;
  } | null>(null);
  const [waveHover, setWaveHover] = useState<{
    tMs: number;
    vce: number;
    vceIdeal: number;
    pctLeft: number;
  } | null>(null);

  const result = useMemo(() => analyzeBjtLoadLine(params), [params]);

  const update = (key: keyof BjtParams, val: number) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  // Chart geometry for I_C vs V_CE
  const W = 560;
  const H = 330;
  const PAD = { left: 54, right: 24, top: 20, bottom: 42 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxVce = Math.max(params.vcc * 1.15, result.vceCutoffAc * 1.05, 5);
  const maxIc = Math.max(result.icSatDcMa * 1.25, result.icSatAcMa * 1.1, 5);

  const mapX = (v: number) => PAD.left + (v / maxVce) * plotW;
  const mapY = (ic: number) => PAD.top + plotH - (Math.min(maxIc, Math.max(0, ic)) / maxIc) * plotH;

  // Waveform geometry
  const WW = 560;
  const WH = 175;
  const WPAD = { left: 54, right: 24, top: 16, bottom: 32 };
  const wPlotW = WW - WPAD.left - WPAD.right;
  const wPlotH = WH - WPAD.top - WPAD.bottom;
  const wMaxV = Math.max(params.vcc * 1.05, 1);

  const mapWX = (tMs: number) => WPAD.left + (tMs / 2.0) * wPlotW;
  const mapWY = (v: number) => WPAD.top + wPlotH - (Math.min(wMaxV, Math.max(0, v)) / wMaxV) * wPlotH;

  const statusTone =
    result.clippingStatus === 'Clean Active'
      ? 'nominal'
      : result.clippingStatus === 'Device in Cutoff' || result.clippingStatus === 'Device Saturated' || result.clippingStatus === 'Dual Clipping'
      ? 'critical'
      : 'warning';

  const applyPreset = (preset: 'centered' | 'cutoff' | 'saturated' | 'heavySwing') => {
    if (preset === 'centered') setParams(DEFAULT_BJT);
    else if (preset === 'cutoff') setParams({ ...DEFAULT_BJT, r1: 68000, r2: 4700, vinPeakMv: 20 });
    else if (preset === 'saturated') setParams({ ...DEFAULT_BJT, r1: 10000, r2: 12000, rc: 2200, vinPeakMv: 20 });
    else setParams({ ...DEFAULT_BJT, vinPeakMv: 85 });
  };

  const handleLoadMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    if (sx < PAD.left || sx > PAD.left + plotW) {
      setLoadHover(null);
      return;
    }
    const vce = Math.max(0, Math.min(maxVce, ((sx - PAD.left) / plotW) * maxVce));
    const rDc = params.rc + params.re;
    const rAc = (params.rc * params.rl) / Math.max(1, params.rc + params.rl);
    const icDcMa = Math.max(0, ((params.vcc - vce) / rDc) * 1000);
    const icAcMa = Math.max(0, result.icqMa - ((vce - result.vceq) / rAc) * 1000);
    setLoadHover({
      xPx: sx,
      vce,
      icDcMa,
      icAcMa,
      pctLeft: ((sx - PAD.left) / W) * 100,
    });
  };

  const handleWaveMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * WW;
    if (sx < WPAD.left || sx > WPAD.left + wPlotW) {
      setWaveHover(null);
      return;
    }
    const tMs = Math.max(0, Math.min(2.0, ((sx - WPAD.left) / wPlotW) * 2.0));
    const idx = Math.min(result.waveform.length - 1, Math.max(0, Math.round((tMs / 2.0) * (result.waveform.length - 1))));
    const pt = result.waveform[idx];
    setWaveHover({
      tMs: pt.tMs,
      vce: pt.vce,
      vceIdeal: pt.vceIdeal,
      pctLeft: (sx / WW) * 100,
    });
  };

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="03"
        title="Transistor Load-Line & Q-Point Plot"
        domain="BJT Common-Emitter Biasing"
        description="Adjust voltage-divider resistors, supply voltage V_CC, and AC input amplitude to observe how the quiescent Q-point moves along DC/AC load lines and triggers cutoff or saturation clipping."
        status={<StatusIndicator tone={statusTone} label={result.clippingStatus} />}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => applyPreset('centered')} className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 cursor-pointer">
              Centered Q-Point
            </button>
            <button onClick={() => applyPreset('heavySwing')} className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 cursor-pointer">
              Overdrive Clipping
            </button>
            <button onClick={() => applyPreset('saturated')} className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 cursor-pointer">
              Saturation Bias
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout label="Q-Point Voltage (V_CEQ)" value={result.vceq.toFixed(2)} unit="V" tone="cyan" subtext={`I_CQ = ${result.icqMa.toFixed(2)} mA`} />
        <MetricReadout label="Max Undistorted Swing" value={`±${result.maxUndistortedSwingPeak.toFixed(2)}`} unit="Vpk" tone="emerald" subtext={`${result.maxUndistortedSwingPp.toFixed(2)} Vpp limit`} />
        <MetricReadout label="Operating Region" value={result.region} tone={result.region === 'Active' ? 'emerald' : 'rose'} subtext={`I_BQ = ${(result.ibqMa * 1000).toFixed(1)} µA`} />
        <MetricReadout label="Small-Signal Gain (|A_v|)" value={result.voltageGain.toFixed(1)} unit="V/V" subtext={`Out Swing ±${result.voutPeakSwing.toFixed(2)} V`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Plots Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Load Line SVG */}
          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
              <span className="font-semibold text-slate-200">Collector Characteristics (I_C vs. V_CE)</span>
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                <span className="text-cyan-300">— DC Load Line</span>
                <span className="text-amber-300">--- AC Load Line</span>
                <span className="text-emerald-400">● Q-Point</span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              onMouseMove={handleLoadMove}
              onMouseLeave={() => setLoadHover(null)}
            >
              {/* Saturation region shading (V_CE < 0.2V) */}
              <rect
                x={PAD.left}
                y={PAD.top}
                width={Math.max(4, mapX(0.2) - PAD.left)}
                height={plotH}
                fill="rgba(244, 63, 94, 0.14)"
              />

              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = PAD.top + f * plotH;
                const icVal = maxIc * (1 - f);
                const x = PAD.left + f * plotW;
                const vVal = maxVce * f;
                return (
                  <g key={f}>
                    <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke="#1e293b" strokeWidth="1" />
                    <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                      {icVal.toFixed(1)}
                    </text>
                    <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH} stroke="#1e293b" strokeWidth="1" />
                    <text x={x} y={PAD.top + plotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                      {vVal.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
              <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
              <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono">
                Collector-Emitter Voltage V_CE (V)
              </text>
              <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono" transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
                I_C (mA)
              </text>

              {/* Family of Ib curves */}
              {result.familyCurves.map((curve, idx) => {
                const d = curve.points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.vce).toFixed(1)} ${mapY(p.icMa).toFixed(1)}`)
                  .join(' ');
                const last = curve.points[curve.points.length - 1];
                return (
                  <g key={idx}>
                    <path d={d} fill="none" stroke="#334155" strokeWidth="1.5" />
                    {last.icMa <= maxIc && (
                      <text x={mapX(last.vce) - 4} y={mapY(last.icMa) - 4} textAnchor="end" fill="#64748b" className="text-[9px] font-mono">
                        {curve.ibUa}µA
                      </text>
                    )}
                  </g>
                );
              })}

              {/* DC Load Line */}
              <line
                x1={mapX(result.dcLoadLine[0].vce)}
                y1={mapY(result.dcLoadLine[0].icMa)}
                x2={mapX(result.dcLoadLine[1].vce)}
                y2={mapY(result.dcLoadLine[1].icMa)}
                stroke="#06b6d4"
                strokeWidth="2.5"
              />

              {/* AC Load Line */}
              <line
                x1={mapX(result.acLoadLine[0].vce)}
                y1={mapY(result.acLoadLine[0].icMa)}
                x2={mapX(result.acLoadLine[1].vce)}
                y2={mapY(result.acLoadLine[1].icMa)}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="6 4"
              />

              {/* Q-Point Marker */}
              <circle cx={mapX(result.vceq)} cy={mapY(result.icqMa)} r="6" fill="#10b981" stroke="#07090E" strokeWidth="2" />
              <text
                x={Math.min(W - 95, mapX(result.vceq) + 10)}
                y={Math.max(PAD.top + 14, mapY(result.icqMa) - 8)}
                fill="#34d399"
                className="text-[11px] font-mono font-semibold"
              >
                Q ({result.vceq.toFixed(1)}V, {result.icqMa.toFixed(1)}mA)
              </text>

              {loadHover && (
                <g pointerEvents="none">
                  <line x1={loadHover.xPx} y1={PAD.top} x2={loadHover.xPx} y2={PAD.top + plotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                  <circle cx={mapX(loadHover.vce)} cy={mapY(loadHover.icDcMa)} r="4" fill="#06b6d4" />
                  <circle cx={mapX(loadHover.vce)} cy={mapY(loadHover.icAcMa)} r="4" fill="#f59e0b" />
                </g>
              )}
            </svg>

            {loadHover && (
              <div
                data-testid="bjt-loadline-tooltip"
                className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{ left: `${Math.min(68, Math.max(8, loadHover.pctLeft))}%` }}
              >
                <div className="text-slate-200 font-semibold">V_CE = {loadHover.vce.toFixed(2)} V</div>
                <div className="text-cyan-300">DC I_C = {loadHover.icDcMa.toFixed(2)} mA</div>
                <div className="text-amber-300">AC I_C = {loadHover.icAcMa.toFixed(2)} mA</div>
              </div>
            )}
          </div>

          {/* Time-Domain Waveform Clipping Monitor */}
          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
              <span className="font-semibold text-slate-200">Output Voltage Waveform v_CE(t)</span>
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                <span className="text-slate-400">--- Unclipped Ideal</span>
                <span className="text-emerald-400">— Actual Output</span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${WW} ${WH}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              onMouseMove={handleWaveMove}
              onMouseLeave={() => setWaveHover(null)}
            >
              {/* Cutoff & Saturation limit lines */}
              <line x1={WPAD.left} y1={mapWY(params.vcc)} x2={WPAD.left + wPlotW} y2={mapWY(params.vcc)} stroke="#f43f5e" strokeOpacity="0.45" strokeDasharray="3 3" />
              <line x1={WPAD.left} y1={mapWY(0.2)} x2={WPAD.left + wPlotW} y2={mapWY(0.2)} stroke="#f43f5e" strokeOpacity="0.45" strokeDasharray="3 3" />
              <line x1={WPAD.left} y1={mapWY(result.vceq)} x2={WPAD.left + wPlotW} y2={mapWY(result.vceq)} stroke="#1e293b" strokeWidth="1" />

              <text x={WPAD.left - 8} y={mapWY(params.vcc) + 4} textAnchor="end" fill="#94a3b8" className="text-[10px] font-mono">
                {params.vcc.toFixed(0)}V
              </text>
              <text x={WPAD.left - 8} y={mapWY(result.vceq) + 4} textAnchor="end" fill="#34d399" className="text-[10px] font-mono">
                {result.vceq.toFixed(1)}V
              </text>
              <text x={WPAD.left - 8} y={mapWY(0.2) + 4} textAnchor="end" fill="#fb7185" className="text-[10px] font-mono">
                0.2V
              </text>

              <line x1={WPAD.left} y1={WPAD.top} x2={WPAD.left} y2={WPAD.top + wPlotH} stroke="#475569" strokeWidth="1.5" />
              <line x1={WPAD.left} y1={WPAD.top + wPlotH} x2={WPAD.left + wPlotW} y2={WPAD.top + wPlotH} stroke="#475569" strokeWidth="1.5" />

              {/* Ideal unclipped path */}
              <path
                d={result.waveform
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapWX(p.tMs).toFixed(1)} ${mapWY(p.vceIdeal).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              {/* Clipped actual waveform */}
              <path
                d={result.waveform
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapWX(p.tMs).toFixed(1)} ${mapWY(p.vce).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke={result.clippingStatus === 'Clean Active' ? '#10b981' : '#f59e0b'}
                strokeWidth="2.5"
              />

              {waveHover && (
                <g pointerEvents="none">
                  <line x1={mapWX(waveHover.tMs)} y1={WPAD.top} x2={mapWX(waveHover.tMs)} y2={WPAD.top + wPlotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                  <circle cx={mapWX(waveHover.tMs)} cy={mapWY(waveHover.vce)} r="4" fill="#10b981" />
                </g>
              )}
            </svg>

            {waveHover && (
              <div
                data-testid="bjt-wave-tooltip"
                className="absolute top-10 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{ left: `${Math.min(68, Math.max(8, waveHover.pctLeft))}%` }}
              >
                <div className="text-slate-200 font-semibold">t = {waveHover.tMs.toFixed(2)} ms</div>
                <div className="text-emerald-300">Actual v_CE = {waveHover.vce.toFixed(2)} V</div>
                <div className="text-slate-400">Ideal v_CE = {waveHover.vceIdeal.toFixed(2)} V</div>
              </div>
            )}
          </div>
        </div>

        {/* Parameter Controls */}
        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Bias Network &amp; Signal Controls
          </h3>
          <ParamSlider label="Supply Voltage (V_CC)" value={params.vcc} min={5} max={24} step={0.5} unit="V" onChange={(v) => update('vcc', v)} />
          <ParamSlider label="Collector Resistor (R_C)" value={params.rc} min={220} max={4700} step={20} unit="Ω" onChange={(v) => update('rc', v)} />
          <ParamSlider label="Emitter Resistor (R_E)" value={params.re} min={0} max={2000} step={10} unit="Ω" onChange={(v) => update('re', v)} />
          <ParamSlider label="Upper Divider (R_1)" value={params.r1} min={4700} max={82000} step={500} unit="Ω" onChange={(v) => update('r1', v)} />
          <ParamSlider label="Lower Divider (R_2)" value={params.r2} min={1000} max={33000} step={200} unit="Ω" onChange={(v) => update('r2', v)} />
          <ParamSlider label="AC Coupled Load (R_L)" value={params.rl} min={470} max={10000} step={100} unit="Ω" onChange={(v) => update('rl', v)} />
          <ParamSlider label="Current Gain (β / h_FE)" value={params.beta} min={50} max={300} step={5} onChange={(v) => update('beta', v)} />
          <ParamSlider
            label="AC Input Peak (v_in)"
            value={params.vinPeakMv}
            min={0}
            max={120}
            step={1}
            unit="mV"
            onChange={(v) => update('vinPeakMv', v)}
            accentClass="accent-amber-400"
          />
        </div>
      </div>
    </div>
  );
}
