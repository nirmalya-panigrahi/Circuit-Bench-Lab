import React, { useState, useMemo } from 'react';
import {
  SequentialDevice,
  simulateDigitalTiming,
  TimingParams,
  WaveformSegment,
} from '../../utils/digitalTimingMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';

const DEVICES: { id: SequentialDevice; label: string; aName: string; bName?: string }[] = [
  { id: 'dff', label: 'D Flip-Flop', aName: 'D' },
  { id: 'jkff', label: 'JK Flip-Flop', aName: 'J', bName: 'K' },
  { id: 'tff', label: 'T Flip-Flop', aName: 'T' },
  { id: 'counter4', label: '4-Bit Counter', aName: 'EN', bName: 'RST' },
];

export default function DigitalTimingLab() {
  const [params, setParams] = useState<TimingParams>({
    device: 'dff',
    clockPeriodNs: 20,
    tSetupNs: 3.0,
    tHoldNs: 2.0,
    tPdNs: 3.5,
    transitionOffsetNs: -6.0,
    inputA: [0, 1, 0, 1, 1, 0, 1, 0],
    inputB: [0, 0, 1, 0, 1, 0, 0, 1],
  });

  const [timingHover, setTimingHover] = useState<{
    tNs: number;
    cycle: number;
    clk: number;
    inA: number;
    inB: number;
    qVal: number;
    inWindow: boolean;
    pctLeft: number;
  } | null>(null);

  const result = useMemo(() => simulateDigitalTiming(params), [params]);
  const devMeta = DEVICES.find((d) => d.id === params.device) ?? DEVICES[0];
  const clockFreqMhz = Number((1000 / params.clockPeriodNs).toFixed(1));

  const toggleBit = (which: 'A' | 'B', idx: number) => {
    setParams((prev) => {
      const key = which === 'A' ? 'inputA' : 'inputB';
      const next = [...prev[key]];
      next[idx] = next[idx] ? 0 : 1;
      return { ...prev, [key]: next };
    });
  };

  // SVG Waveform geometry
  const W = 680;
  const PAD_L = 78;
  const PAD_R = 16;
  const plotW = W - PAD_L - PAD_R;
  const mapT = (t: number) => PAD_L + (t / result.totalTimeNs) * plotW;

  const renderDigitalPath = (segs: WaveformSegment[], yHigh: number, yLow: number) => {
    if (segs.length === 0) return '';
    let d = `M ${mapT(segs[0].tStart).toFixed(1)} ${(segs[0].val ? yHigh : yLow).toFixed(1)}`;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const y = s.val ? yHigh : yLow;
      if (i > 0) {
        d += ` L ${mapT(s.tStart).toFixed(1)} ${y.toFixed(1)}`;
      }
      d += ` L ${mapT(s.tEnd).toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  const sampleSegAt = (segs: WaveformSegment[], t: number) => {
    for (let i = segs.length - 1; i >= 0; i--) {
      if (t >= segs[i].tStart - 1e-6) return segs[i].val;
    }
    return segs[0]?.val ?? 0;
  };

  const handleSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    if (sx < PAD_L || sx > PAD_L + plotW) {
      setTimingHover(null);
      return;
    }
    const tNs = Math.max(0, Math.min(result.totalTimeNs, ((sx - PAD_L) / plotW) * result.totalTimeNs));
    const cycle = Math.min(result.cycles, Math.floor(tNs / params.clockPeriodNs) + 1);
    const inWindow = result.clkEdgesNs.some(
      (edgeT) => tNs >= edgeT - params.tSetupNs && tNs <= edgeT + params.tHoldNs
    );
    setTimingHover({
      tNs,
      cycle,
      clk: sampleSegAt(result.clkSegments, tNs),
      inA: sampleSegAt(result.inputASegments, tNs),
      inB: sampleSegAt(result.inputBSegments, tNs),
      qVal: sampleSegAt(result.qSegments, tNs),
      inWindow,
      pctLeft: (sx / W) * 100,
    });
  };

  const rowsCount = devMeta.bName ? 4 : 3;
  const H = rowsCount * 58 + 38;

  const hasViolation = result.violationCount > 0;
  const cycle2Diag = result.diagnostics[2];

  const qSeqString =
    params.device === 'counter4'
      ? result.qSequence.map((v) => v.toString(16).toUpperCase()).join(' ')
      : result.qSequence.join(' ');

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="09"
        title="Digital Timing Diagram (Flip-Flops & Counters)"
        domain="Synchronous Sequential Logic"
        description="Toggle per-cycle inputs, tune clock frequency, and slide Cycle 3's data transition edge across the rising clock edge to inspect Q sequences, setup/hold violations, and glitch detection."
        status={
          <StatusIndicator
            tone={hasViolation ? 'critical' : result.glitchCount > 0 ? 'warning' : 'nominal'}
            label={
              hasViolation
                ? cycle2Diag?.hasSetupViolation
                  ? 'Setup Time Violation (Metastable Risk)'
                  : 'Hold Time Violation (Metastable Risk)'
                : result.glitchCount > 0
                ? 'Narrow Pulse Glitch Detected'
                : 'Timing Clean (All Edges Satisfied)'
            }
          />
        }
        actions={
          <div className="flex flex-wrap p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setParams((p) => ({ ...p, device: d.id }))}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                  params.device === d.id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout label="Output Sequence (Q)" value={qSeqString} tone="cyan" subtext={`Clock ${clockFreqMhz} MHz (T=${params.clockPeriodNs.toFixed(1)} ns)`} />
        <MetricReadout
          label="Timing Violations"
          value={hasViolation ? `${result.violationCount} Violation` : '0 (8/8 Pass)'}
          tone={hasViolation ? 'rose' : 'emerald'}
          subtext={`t_su=${params.tSetupNs.toFixed(1)}ns · t_h=${params.tHoldNs.toFixed(1)}ns`}
        />
        <MetricReadout
          label="Glitch Detection"
          value={result.glitchCount > 0 ? `${result.glitchCount} Glitch Risk` : 'None (Clean)'}
          tone={result.glitchCount > 0 ? 'amber' : 'emerald'}
          subtext={`Min pulse > ${(params.tSetupNs + params.tHoldNs).toFixed(1)} ns`}
        />
        <MetricReadout label="Propagation Delay (t_pd)" value={params.tPdNs.toFixed(1)} unit="ns" subtext={`CLK→Q transition delay`} />
      </div>

      {/* Multi-Channel Timing Diagram */}
      <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 space-y-4 relative">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-200">Logic Analyzer Timing Trace</span>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span className="text-rose-300">■ Setup/Hold Window</span>
            <span className="text-cyan-300">— {devMeta.aName}</span>
            <span className="text-emerald-400">— {params.device === 'counter4' ? 'Q[3:0]' : 'Q'}</span>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[560px] h-auto cursor-crosshair"
            onMouseMove={handleSvgMove}
            onMouseLeave={() => setTimingHover(null)}
          >
            {/* Setup/Hold shaded windows around every rising edge */}
            {result.clkEdgesNs.map((edgeT, c) => {
              const x1 = mapT(edgeT - params.tSetupNs);
              const x2 = mapT(edgeT + params.tHoldNs);
              const isViolated = result.diagnostics[c]?.isMetastable;
              return (
                <g key={c}>
                  <rect
                    x={x1}
                    y={10}
                    width={Math.max(2, x2 - x1)}
                    height={H - 34}
                    fill={isViolated ? 'rgba(244, 63, 94, 0.25)' : 'rgba(245, 158, 11, 0.09)'}
                  />
                  <line
                    x1={mapT(edgeT)}
                    y1={10}
                    x2={mapT(edgeT)}
                    y2={H - 24}
                    stroke={isViolated ? '#fb7185' : '#334155'}
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text x={mapT(edgeT)} y={H - 8} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    C{c + 1}
                  </text>
                </g>
              );
            })}

            {/* Row 1: CLK */}
            <text x={12} y={38} fill="#94a3b8" className="text-xs font-mono font-semibold">CLK</text>
            <path d={renderDigitalPath(result.clkSegments, 22, 48)} fill="none" stroke="#94a3b8" strokeWidth="2" />

            {/* Row 2: Input A */}
            <text x={12} y={96} fill="#22d3ee" className="text-xs font-mono font-semibold">{devMeta.aName}</text>
            <path d={renderDigitalPath(result.inputASegments, 80, 106)} fill="none" stroke="#06b6d4" strokeWidth="2.2" />

            {/* Row 3 (Optional): Input B */}
            {devMeta.bName && (
              <>
                <text x={12} y={154} fill="#fbbf24" className="text-xs font-mono font-semibold">{devMeta.bName}</text>
                <path d={renderDigitalPath(result.inputBSegments, 138, 164)} fill="none" stroke="#f59e0b" strokeWidth="2.2" />
              </>
            )}

            {/* Final Row: Q or Q[3:0] */}
            {(() => {
              const baseY = devMeta.bName ? 212 : 154;
              if (params.device === 'counter4') {
                return (
                  <>
                    <text x={12} y={baseY} fill="#34d399" className="text-xs font-mono font-semibold">Q[3:0]</text>
                    {result.qSegments.map((seg, i) => {
                      const x1 = mapT(seg.tStart);
                      const x2 = mapT(seg.tEnd);
                      return (
                        <g key={i}>
                          <rect
                            x={x1}
                            y={baseY - 16}
                            width={Math.max(2, x2 - x1)}
                            height={26}
                            fill="rgba(16, 185, 129, 0.12)"
                            stroke="#10b981"
                            strokeWidth="1.5"
                          />
                          {x2 - x1 > 18 && (
                            <text x={(x1 + x2) / 2} y={baseY + 1} textAnchor="middle" fill="#6ee7b7" className="text-[11px] font-mono font-semibold tabular-nums">
                              0x{seg.val.toString(16).toUpperCase()}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              }
              return (
                <>
                  <text x={12} y={baseY} fill="#34d399" className="text-xs font-mono font-semibold">Q</text>
                  <path d={renderDigitalPath(result.qSegments, baseY - 16, baseY + 10)} fill="none" stroke="#10b981" strokeWidth="2.5" />
                </>
              );
            })()}

            {timingHover && (
              <line
                x1={mapT(timingHover.tNs)}
                y1={10}
                x2={mapT(timingHover.tNs)}
                y2={H - 24}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                pointerEvents="none"
              />
            )}
          </svg>

          {timingHover && (
            <div
              data-testid="timing-tooltip"
              className="absolute top-2 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
              style={{ left: `${Math.min(68, Math.max(12, timingHover.pctLeft))}%` }}
            >
              <div className="text-slate-200 font-semibold">
                t = {timingHover.tNs.toFixed(1)} ns (C{timingHover.cycle})
              </div>
              <div className="text-cyan-300">
                CLK={timingHover.clk} · {devMeta.aName}={timingHover.inA}
                {devMeta.bName ? ` · ${devMeta.bName}=${timingHover.inB}` : ''}
              </div>
              <div className="text-emerald-300">
                {params.device === 'counter4' ? `Q=0x${timingHover.qVal.toString(16).toUpperCase()}` : `Q=${timingHover.qVal}`}
                {timingHover.inWindow ? ' · Inside t_su/t_h Window' : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls: Input Cycle Matrix + Timing Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Cycle-by-Cycle Input Stimulus (Click Bits to Toggle)
          </h3>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-12 text-xs font-mono font-semibold text-cyan-300 shrink-0">{devMeta.aName}:</span>
              <div className="grid grid-cols-8 gap-1.5 flex-1">
                {params.inputA.map((val, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleBit('A', idx)}
                    className={`py-2.5 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                      val
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {devMeta.bName && (
              <div className="flex items-center gap-2">
                <span className="w-12 text-xs font-mono font-semibold text-amber-300 shrink-0">{devMeta.bName}:</span>
                <div className="grid grid-cols-8 gap-1.5 flex-1">
                  {params.inputB.map((val, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleBit('B', idx)}
                      className={`py-2.5 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                        val
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Timing Constraints &amp; Clock Frequency
          </h3>
          <ParamSlider
            label="Clock Frequency"
            value={clockFreqMhz}
            min={10}
            max={250}
            step={5}
            unit="MHz"
            displayValue={`T = ${params.clockPeriodNs.toFixed(1)} ns`}
            onChange={(freq) => setParams((p) => ({ ...p, clockPeriodNs: Number((1000 / Math.max(10, freq)).toFixed(2)) }))}
          />
          <ParamSlider
            label="Cycle 3 Edge Offset (vs CLK ↑)"
            value={params.transitionOffsetNs}
            min={-8}
            max={8}
            step={0.5}
            unit="ns"
            displayValue={`${params.transitionOffsetNs >= 0 ? '+' : ''}${params.transitionOffsetNs.toFixed(1)}`}
            minLabel="-8 ns (Early)"
            maxLabel="+8 ns (Late)"
            onChange={(v) => setParams((p) => ({ ...p, transitionOffsetNs: v }))}
            accentClass="accent-rose-400"
          />
          <ParamSlider label="Setup Time (t_su)" value={params.tSetupNs} min={0.5} max={6} step={0.5} unit="ns" onChange={(v) => setParams((p) => ({ ...p, tSetupNs: v }))} />
          <ParamSlider label="Hold Time (t_h)" value={params.tHoldNs} min={0.5} max={5} step={0.5} unit="ns" onChange={(v) => setParams((p) => ({ ...p, tHoldNs: v }))} />
          <ParamSlider label="Propagation Delay (t_pd)" value={params.tPdNs} min={1} max={10} step={0.5} unit="ns" onChange={(v) => setParams((p) => ({ ...p, tPdNs: v }))} />
        </div>
      </div>
    </div>
  );
}
