import React, { useState, useMemo } from 'react';
import { analyzeOpAmp, OpAmpParams } from '../../utils/electronicsMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';

export default function OpAmpResponseLab() {
  const [params, setParams] = useState<OpAmpParams>({
    aolDb: 100,
    gbwMhz: 10,
    rfR1Ratio: 19,
    slewRateVus: 5.0,
    vinPeakV: 0.25,
    sigFreqKhz: 250,
  });

  const [bodeHover, setBodeHover] = useState<{
    freqHz: number;
    aolDb: number;
    aclDb: number;
    loopGainDb: number;
    phaseDeg: number;
    pctLeft: number;
  } | null>(null);

  const [waveHover, setWaveHover] = useState<{
    tUs: number;
    idealV: number;
    actualV: number;
    pctLeft: number;
  } | null>(null);

  const result = useMemo(() => analyzeOpAmp(params), [params]);
  const update = (k: keyof OpAmpParams, v: number) => setParams((p) => ({ ...p, [k]: v }));

  // Bode Magnitude SVG Geometry (1 Hz to 100 MHz -> 8 decades)
  const BW = 560;
  const BH = 280;
  const BPAD = { left: 52, right: 20, top: 20, bottom: 38 };
  const bPlotW = BW - BPAD.left - BPAD.right;
  const bPlotH = BH - BPAD.top - BPAD.bottom;

  const mapBX = (fHz: number) => BPAD.left + (Math.log10(Math.max(1, fHz)) / 8) * bPlotW;
  const mapBDb = (db: number) => BPAD.top + bPlotH - ((Math.max(-20, Math.min(120, db)) + 20) / 140) * bPlotH;

  // Waveform SVG
  const WW = 560;
  const WH = 175;
  const WPAD = { left: 52, right: 20, top: 16, bottom: 30 };
  const wPlotW = WW - WPAD.left - WPAD.right;
  const wPlotH = WH - WPAD.top - WPAD.bottom;
  const maxTimeUs = result.waveform[result.waveform.length - 1]?.tUs || 1;
  const maxVolt = Math.max(1, result.idealVoutPeak * 1.15);

  const mapWX = (t: number) => WPAD.left + (t / maxTimeUs) * wPlotW;
  const mapWY = (v: number) => WPAD.top + wPlotH * 0.5 - (v / maxVolt) * (wPlotH * 0.45);

  const fmtHz = (hz: number) =>
    hz >= 1e6 ? `${(hz / 1e6).toFixed(2)} MHz` : hz >= 1e3 ? `${(hz / 1e3).toFixed(1)} kHz` : `${hz.toFixed(0)} Hz`;

  const handleBodeMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * BW;
    if (sx < BPAD.left || sx > BPAD.left + bPlotW) {
      setBodeHover(null);
      return;
    }
    const frac = Math.max(0, Math.min(1, (sx - BPAD.left) / bPlotW));
    const idx = Math.min(result.bodePoints.length - 1, Math.max(0, Math.round(frac * (result.bodePoints.length - 1))));
    const pt = result.bodePoints[idx];
    setBodeHover({
      ...pt,
      pctLeft: (sx / BW) * 100,
    });
  };

  const handleWaveMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * WW;
    if (sx < WPAD.left || sx > WPAD.left + wPlotW) {
      setWaveHover(null);
      return;
    }
    const frac = Math.max(0, Math.min(1, (sx - WPAD.left) / wPlotW));
    const idx = Math.min(result.waveform.length - 1, Math.max(0, Math.round(frac * (result.waveform.length - 1))));
    const pt = result.waveform[idx];
    setWaveHover({
      ...pt,
      pctLeft: (sx / WW) * 100,
    });
  };

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="08"
        title="Op-Amp Frequency Response & Gain-Bandwidth"
        domain="Analog Amplifier Dynamics"
        description="Visualize open-loop versus closed-loop gain roll-off across 8 frequency decades, inspect closed-loop -3 dB bandwidth and loop gain margin, and spot slew-rate waveform distortion."
        status={
          <StatusIndicator
            tone={result.isSlewLimited ? 'critical' : params.sigFreqKhz * 1e3 > result.f3dbHz ? 'warning' : 'nominal'}
            label={
              result.isSlewLimited
                ? `Slew-Rate Distorted (${result.requiredSlewVus.toFixed(1)} > ${params.slewRateVus} V/µs)`
                : params.sigFreqKhz * 1e3 > result.f3dbHz
                ? 'Above -3 dB Bandwidth Roll-off'
                : 'Linear Unclipped Amplification'
            }
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout
          label="Closed-Loop Gain (1 + Rf/R1)"
          value={`${result.aclDb.toFixed(1)}`}
          unit="dB"
          subtext={`${result.aclGain.toFixed(1)} V/V (Rf/R1=${params.rfR1Ratio})`}
          tone="cyan"
        />
        <MetricReadout label="Closed-Loop f_-3dB" value={fmtHz(result.f3dbHz)} subtext={`Dominant f_p = ${fmtHz(result.fpHz)}`} />
        <MetricReadout
          label="Loop Gain Margin (@f_sig)"
          value={`${result.loopGainAtSigDb.toFixed(1)}`}
          unit="dB"
          tone={result.loopGainAtSigDb >= 20 ? 'emerald' : 'amber'}
          subtext={`Phase Margin ≈ ${result.phaseMarginDeg.toFixed(0)}°`}
        />
        <MetricReadout
          label="Full-Power Slew Limit"
          value={fmtHz(result.fullPowerBwHz)}
          tone={result.isSlewLimited ? 'rose' : 'emerald'}
          subtext={`Req ${result.requiredSlewVus.toFixed(2)} / ${params.slewRateVus} V/µs`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {/* Bode Plot */}
          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
              <span className="font-semibold text-slate-200">Bode Magnitude Plot (Open-Loop vs. Closed-Loop)</span>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="text-slate-400">— Open-Loop A_OL</span>
                <span className="text-cyan-300">— Closed-Loop A_CL</span>
                <span className="text-amber-300">│ Signal f_sig</span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${BW} ${BH}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              onMouseMove={handleBodeMove}
              onMouseLeave={() => setBodeHover(null)}
            >
              {[-20, 0, 20, 40, 60, 80, 100, 120].map((db) => (
                <g key={db}>
                  <line x1={BPAD.left} y1={mapBDb(db)} x2={BPAD.left + bPlotW} y2={mapBDb(db)} stroke={db === 0 ? '#334155' : '#1e293b'} strokeWidth="1" />
                  <text x={BPAD.left - 8} y={mapBDb(db) + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    {db}
                  </text>
                </g>
              ))}
              {[0, 2, 4, 6, 8].map((exp) => {
                const f = Math.pow(10, exp);
                const lbl = exp === 0 ? '1Hz' : exp === 2 ? '100Hz' : exp === 4 ? '10k' : exp === 6 ? '1M' : '100M';
                return (
                  <g key={exp}>
                    <line x1={mapBX(f)} y1={BPAD.top} x2={mapBX(f)} y2={BPAD.top + bPlotH} stroke="#1e293b" strokeWidth="1" />
                    <text x={mapBX(f)} y={BPAD.top + bPlotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono">
                      {lbl}
                    </text>
                  </g>
                );
              })}

              {/* Signal frequency marker */}
              <line
                x1={mapBX(params.sigFreqKhz * 1e3)}
                y1={BPAD.top}
                x2={mapBX(params.sigFreqKhz * 1e3)}
                y2={BPAD.top + bPlotH}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Open loop */}
              <path
                d={result.bodePoints
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapBX(p.freqHz).toFixed(1)} ${mapBDb(p.aolDb).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
              />
              {/* Closed loop */}
              <path
                d={result.bodePoints
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapBX(p.freqHz).toFixed(1)} ${mapBDb(p.aclDb).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
              />

              {/* -3dB point */}
              <circle cx={mapBX(result.f3dbHz)} cy={mapBDb(result.aclDb - 3)} r="4.5" fill="#10b981" stroke="#07090E" strokeWidth="1.5" />

              {bodeHover && (
                <g pointerEvents="none">
                  <line x1={mapBX(bodeHover.freqHz)} y1={BPAD.top} x2={mapBX(bodeHover.freqHz)} y2={BPAD.top + bPlotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                  <circle cx={mapBX(bodeHover.freqHz)} cy={mapBDb(bodeHover.aolDb)} r="4" fill="#94a3b8" />
                  <circle cx={mapBX(bodeHover.freqHz)} cy={mapBDb(bodeHover.aclDb)} r="4" fill="#22d3ee" />
                </g>
              )}
            </svg>

            {bodeHover && (
              <div
                data-testid="opamp-bode-tooltip"
                className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{ left: `${Math.min(60, Math.max(8, bodeHover.pctLeft))}%` }}
              >
                <div className="text-slate-200 font-semibold">f = {fmtHz(bodeHover.freqHz)}</div>
                <div className="text-slate-400">A_OL = {bodeHover.aolDb.toFixed(1)} dB</div>
                <div className="text-cyan-300">A_CL = {bodeHover.aclDb.toFixed(1)} dB</div>
                <div className="text-emerald-300">Loop Gain = {bodeHover.loopGainDb.toFixed(1)} dB · ∠{bodeHover.phaseDeg.toFixed(0)}°</div>
              </div>
            )}
          </div>

          {/* Slew-Rate Waveform */}
          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-slate-200">Time-Domain Output v_out(t) &amp; Slew Distortion</span>
              <span className="font-mono text-slate-400">
                Peak: {result.actualVoutPeak.toFixed(2)} V (Ideal {result.idealVoutPeak.toFixed(2)} V)
              </span>
            </div>
            <svg
              viewBox={`0 0 ${WW} ${WH}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              onMouseMove={handleWaveMove}
              onMouseLeave={() => setWaveHover(null)}
            >
              <line x1={WPAD.left} y1={mapWY(0)} x2={WPAD.left + wPlotW} y2={mapWY(0)} stroke="#334155" strokeWidth="1" />
              <path
                d={result.waveform.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapWX(p.tUs).toFixed(1)} ${mapWY(p.idealV).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <path
                d={result.waveform.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapWX(p.tUs).toFixed(1)} ${mapWY(p.actualV).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={result.isSlewLimited ? '#f59e0b' : '#10b981'}
                strokeWidth="2.5"
              />
              <text x={WPAD.left - 8} y={mapWY(maxVolt * 0.85)} textAnchor="end" fill="#64748b" className="text-[10px] font-mono">
                +{(maxVolt * 0.85).toFixed(1)}V
              </text>
              <text x={WPAD.left - 8} y={mapWY(-maxVolt * 0.85)} textAnchor="end" fill="#64748b" className="text-[10px] font-mono">
                -{(maxVolt * 0.85).toFixed(1)}V
              </text>

              {waveHover && (
                <g pointerEvents="none">
                  <line x1={mapWX(waveHover.tUs)} y1={WPAD.top} x2={mapWX(waveHover.tUs)} y2={WPAD.top + wPlotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                  <circle cx={mapWX(waveHover.tUs)} cy={mapWY(waveHover.actualV)} r="4" fill="#10b981" />
                </g>
              )}
            </svg>

            {waveHover && (
              <div
                data-testid="opamp-wave-tooltip"
                className="absolute top-10 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{ left: `${Math.min(64, Math.max(8, waveHover.pctLeft))}%` }}
              >
                <div className="text-slate-200 font-semibold">t = {waveHover.tUs.toFixed(2)} µs</div>
                <div className="text-emerald-300">Actual v_out = {waveHover.actualV.toFixed(2)} V</div>
                <div className="text-slate-400">Ideal v_out = {waveHover.idealV.toFixed(2)} V</div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Op-Amp &amp; Feedback Parameters
          </h3>
          <ParamSlider label="Gain-Bandwidth Product (GBWP)" value={params.gbwMhz} min={0.5} max={50} step={0.5} unit="MHz" onChange={(v) => update('gbwMhz', v)} />
          <ParamSlider label="DC Open-Loop Gain (A_OL0)" value={params.aolDb} min={60} max={120} step={2} unit="dB" onChange={(v) => update('aolDb', v)} />
          <ParamSlider
            label="Feedback Resistor Ratio (Rf / R1)"
            value={params.rfR1Ratio}
            min={0}
            max={199}
            step={1}
            displayValue={`A_CL = ${(1 + params.rfR1Ratio).toFixed(0)} V/V`}
            onChange={(v) => update('rfR1Ratio', v)}
          />
          <ParamSlider label="Slew Rate (SR)" value={params.slewRateVus} min={0.5} max={30} step={0.5} unit="V/µs" onChange={(v) => update('slewRateVus', v)} accentClass="accent-amber-400" />
          <ParamSlider label="Input Signal Frequency" value={params.sigFreqKhz} min={5} max={2000} step={5} unit="kHz" onChange={(v) => update('sigFreqKhz', v)} accentClass="accent-amber-400" />
          <ParamSlider label="Input Peak Amplitude (V_in)" value={params.vinPeakV} min={0.05} max={1.5} step={0.05} unit="V" onChange={(v) => update('vinPeakV', v)} />
        </div>
      </div>
    </div>
  );
}
