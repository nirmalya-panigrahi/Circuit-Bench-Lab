import React, { useState, useMemo, useRef } from 'react';
import { Complex } from '../../types';
import { analyzePoleZeroFilter } from '../../utils/signalsDspMath';
import { LabHeaderBar, MetricReadout, StatusIndicator } from '../shared/LabPrimitives';
import { Plus, Trash2 } from 'lucide-react';

interface PoleZeroPair {
  id: string;
  kind: 'pole' | 'zero';
  re: number;
  im: number; // >= 0 when conjugate pair
  conjugate: boolean;
}

const PRESETS: Record<string, { label: string; items: PoleZeroPair[] }> = {
  lpf: {
    label: 'Butterworth LPF',
    items: [
      { id: 'p1', kind: 'pole', re: 0.42, im: 0.36, conjugate: true },
      { id: 'z1', kind: 'zero', re: -1.0, im: 0, conjugate: false },
      { id: 'z2', kind: 'zero', re: -1.0, im: 0, conjugate: false },
    ],
  },
  notch: {
    label: '60 Hz Notch Filter',
    items: [
      { id: 'z1', kind: 'zero', re: 0.707, im: 0.707, conjugate: true },
      { id: 'p1', kind: 'pole', re: 0.64, im: 0.64, conjugate: true },
    ],
  },
  bandpass: {
    label: 'Bandpass Resonator',
    items: [
      { id: 'p1', kind: 'pole', re: 0.0, im: 0.88, conjugate: true },
      { id: 'z1', kind: 'zero', re: 1.0, im: 0, conjugate: false },
      { id: 'z2', kind: 'zero', re: -1.0, im: 0, conjugate: false },
    ],
  },
  hpf: {
    label: 'High-Pass Filter',
    items: [
      { id: 'p1', kind: 'pole', re: -0.35, im: 0.38, conjugate: true },
      { id: 'z1', kind: 'zero', re: 1.0, im: 0, conjugate: false },
      { id: 'z2', kind: 'zero', re: 1.0, im: 0, conjugate: false },
    ],
  },
};

export default function PoleZeroFilterLab() {
  const [items, setItems] = useState<PoleZeroPair[]>(PRESETS.lpf.items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [zHover, setZHover] = useState<{
    re: number;
    im: number;
    radius: number;
    angleDeg: number;
    pctLeft: number;
    pctTop: number;
  } | null>(null);
  const [fHover, setFHover] = useState<{
    fNorm: number;
    magDb: number;
    phaseDeg: number;
    pctLeft: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { poles, zeros } = useMemo(() => {
    const p: Complex[] = [];
    const z: Complex[] = [];
    for (const item of items) {
      const list = item.kind === 'pole' ? p : z;
      list.push({ re: item.re, im: item.im });
      if (item.conjugate && Math.abs(item.im) > 1e-4) {
        list.push({ re: item.re, im: -item.im });
      }
    }
    return { poles: p, zeros: z };
  }, [items]);

  const result = useMemo(() => analyzePoleZeroFilter(poles, zeros), [poles, zeros]);

  const ZSIZE = 340;
  const ZHALF = ZSIZE / 2;
  const ZSCALE = 115; // radius = 1 unit circle = 115px
  const toScreen = (re: number, im: number) => ({ x: ZHALF + re * ZSCALE, y: ZHALF - im * ZSCALE });

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * ZSIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * ZSIZE;
    const re = Math.max(-1.4, Math.min(1.4, (sx - ZHALF) / ZSCALE));
    const imRaw = (ZHALF - sy) / ZSCALE;

    setZHover({
      re,
      im: imRaw,
      radius: Math.hypot(re, imRaw),
      angleDeg: (Math.atan2(imRaw, re) * 180) / Math.PI,
      pctLeft: (sx / ZSIZE) * 100,
      pctTop: (sy / ZSIZE) * 100,
    });

    if (!draggingId) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== draggingId) return it;
        const im = it.conjugate ? Math.max(0.02, Math.min(1.4, Math.abs(imRaw))) : 0;
        return { ...it, re: Number(re.toFixed(3)), im: Number(im.toFixed(3)) };
      })
    );
  };

  const updateCoord = (id: string, axis: 're' | 'im', rawVal: string) => {
    const num = parseFloat(rawVal);
    if (!Number.isFinite(num)) return;
    const clamped = axis === 're' ? Math.max(-1.4, Math.min(1.4, num)) : Math.max(0, Math.min(1.4, Math.abs(num)));
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [axis]: clamped } : it)));
  };

  const addRoot = (kind: 'pole' | 'zero', conjugate: boolean) => {
    const id = `${kind}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        kind,
        re: kind === 'pole' ? 0.3 : -0.5,
        im: conjugate ? 0.5 : 0,
        conjugate,
      },
    ]);
  };

  const removeRoot = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  // Frequency response SVG coordinates
  const FW = 520;
  const FH = 210;
  const FPAD = { left: 48, right: 16, top: 14, bottom: 28 };
  const fPlotW = FW - FPAD.left - FPAD.right;
  const fPlotH = FH - FPAD.top - FPAD.bottom;
  const mapFX = (fNorm: number) => FPAD.left + (fNorm / 0.5) * fPlotW;
  const mapFMag = (db: number) => FPAD.top + fPlotH - ((Math.max(-60, Math.min(6, db)) + 60) / 66) * fPlotH;

  const handleFreqMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * FW;
    if (sx < FPAD.left || sx > FPAD.left + fPlotW) {
      setFHover(null);
      return;
    }
    const fNorm = Math.max(0, Math.min(0.5, ((sx - FPAD.left) / fPlotW) * 0.5));
    const idx = Math.min(
      result.frequenciesNorm.length - 1,
      Math.max(0, Math.round((fNorm / 0.5) * (result.frequenciesNorm.length - 1)))
    );
    setFHover({
      fNorm: result.frequenciesNorm[idx],
      magDb: result.magnitudeDb[idx],
      phaseDeg: result.phaseDeg[idx],
      pctLeft: (sx / FW) * 100,
    });
  };

  const stabilityTone =
    result.stability === 'Stable' ? 'nominal' : result.stability === 'Marginally Stable' ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="07"
        title="Pole–Zero Plot (z-Plane Digital Filters)"
        domain="Discrete-Time Signal Processing"
        description="Drag pole and zero markers across the z-plane unit circle or edit exact Re/Im coordinates to shape magnitude/phase response and verify BIBO stability."
        status={<StatusIndicator tone={stabilityTone} label={`BIBO: ${result.stability} (max |p| = ${result.maxPoleRadius.toFixed(3)})`} />}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button
                key={k}
                onClick={() => setItems(p.items)}
                className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout
          label="BIBO Stability"
          value={result.stability}
          tone={stabilityTone === 'nominal' ? 'emerald' : stabilityTone === 'warning' ? 'amber' : 'rose'}
          subtext={`max |p| = ${result.maxPoleRadius.toFixed(3)} (< 1.0 stable)`}
        />
        <MetricReadout
          label="Passband / Stopband"
          value={`${result.passbandGainDb.toFixed(1)} / ${result.stopbandAttenDb.toFixed(1)}`}
          unit="dB"
          tone="cyan"
          subtext={`DC ${result.magnitudeDb[0].toFixed(1)}dB · Nyq ${result.magnitudeDb[result.magnitudeDb.length - 1].toFixed(1)}dB`}
        />
        <MetricReadout
          label="Phase Linearity"
          value={result.phaseLinearityLabel}
          tone={result.phaseLinearityLabel === 'Linear' ? 'emerald' : 'default'}
          subtext="Passband group-delay flatness"
        />
        <MetricReadout
          label="Filter Order"
          value={`${Math.max(poles.length, zeros.length)}`}
          unit="order"
          subtext={`${zeros.length} zeros · ${poles.length} poles`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive z-Plane */}
        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">Interactive z-Plane (Drag × Poles / ○ Zeros)</span>
            <span className="font-mono text-slate-400">|z| = 1 Unit Circle</span>
          </div>

          <div className="relative max-w-[360px] mx-auto">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${ZSIZE} ${ZSIZE}`}
              className="w-full aspect-square bg-[#060911] rounded-lg border border-slate-800 touch-none select-none cursor-crosshair"
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDraggingId(null)}
              onPointerLeave={() => {
                setDraggingId(null);
                setZHover(null);
              }}
            >
              {/* Axes & Unit Circle */}
              <line x1={12} y1={ZHALF} x2={ZSIZE - 12} y2={ZHALF} stroke="#334155" strokeWidth="1" />
              <line x1={ZHALF} y1={12} x2={ZHALF} y2={ZSIZE - 12} stroke="#334155" strokeWidth="1" />
              <circle cx={ZHALF} cy={ZHALF} r={ZSCALE} fill="rgba(6, 182, 212, 0.04)" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx={ZHALF} cy={ZHALF} r={ZSCALE * 0.5} fill="none" stroke="#1e293b" strokeWidth="1" />

              <text x={ZSIZE - 16} y={ZHALF - 6} textAnchor="end" fill="#64748b" className="text-[10px] font-mono">Re(z)</text>
              <text x={ZHALF + 6} y={20} fill="#64748b" className="text-[10px] font-mono">Im(z)</text>

              {items.map((item) => {
                const pTop = toScreen(item.re, item.im);
                const pBot = toScreen(item.re, -item.im);
                const color = item.kind === 'pole' ? '#fb7185' : '#22d3ee';
                const drawMarker = (pt: { x: number; y: number }, interactive: boolean) =>
                  item.kind === 'pole' ? (
                    <g
                      transform={`translate(${pt.x}, ${pt.y})`}
                      className={interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none opacity-75'}
                      onPointerDown={
                        interactive
                          ? (e) => {
                              e.stopPropagation();
                              setDraggingId(item.id);
                            }
                          : undefined
                      }
                    >
                      <circle r="12" fill="transparent" />
                      <line x1="-6" y1="-6" x2="6" y2="6" stroke={color} strokeWidth="2.5" />
                      <line x1="-6" y1="6" x2="6" y2="-6" stroke={color} strokeWidth="2.5" />
                    </g>
                  ) : (
                    <g
                      transform={`translate(${pt.x}, ${pt.y})`}
                      className={interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none opacity-75'}
                      onPointerDown={
                        interactive
                          ? (e) => {
                              e.stopPropagation();
                              setDraggingId(item.id);
                            }
                          : undefined
                      }
                    >
                      <circle r="12" fill="transparent" />
                      <circle r="6" fill="#060911" stroke={color} strokeWidth="2.5" />
                    </g>
                  );

                return (
                  <g key={item.id}>
                    {drawMarker(pTop, true)}
                    {item.conjugate && Math.abs(item.im) > 1e-4 && drawMarker(pBot, false)}
                  </g>
                );
              })}
            </svg>

            {zHover && (
              <div
                data-testid="zplane-tooltip"
                className="absolute z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{
                  left: `${Math.min(54, Math.max(6, zHover.pctLeft + 3))}%`,
                  top: `${Math.min(70, Math.max(6, zHover.pctTop))}%`,
                }}
              >
                <div className="text-slate-200 font-semibold">
                  z = {zHover.re.toFixed(2)} {zHover.im >= 0 ? '+' : '-'} j{Math.abs(zHover.im).toFixed(2)}
                </div>
                <div className={zHover.radius < 1 ? 'text-emerald-300' : 'text-rose-400'}>
                  |z| = {zHover.radius.toFixed(3)} ∠ {zHover.angleDeg.toFixed(1)}°
                </div>
              </div>
            )}
          </div>

          {/* Root Controls with Direct Numeric Inputs */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addRoot('pole', true)}
                className="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Pole Pair
              </button>
              <button
                onClick={() => addRoot('zero', true)}
                className="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Zero Pair
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {items.map((it, idx) => {
                const rad = Math.sqrt(it.re * it.re + it.im * it.im);
                return (
                  <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <span className={`font-semibold ${it.kind === 'pole' ? 'text-rose-300' : 'text-cyan-300'}`}>
                      {it.kind === 'pole' ? `× P${idx + 1}` : `○ Z${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-slate-400">
                        Re
                        <input
                          type="number"
                          aria-label={`${it.kind} ${idx + 1} Re`}
                          min={-1.4}
                          max={1.4}
                          step={0.05}
                          value={Number(it.re.toFixed(3))}
                          onChange={(e) => updateCoord(it.id, 're', e.target.value)}
                          className="ml-1 w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 tabular-nums"
                        />
                      </label>
                      {it.conjugate && (
                        <label className="text-[10px] text-slate-400">
                          ±j
                          <input
                            type="number"
                            aria-label={`${it.kind} ${idx + 1} Im`}
                            min={0}
                            max={1.4}
                            step={0.05}
                            value={Number(it.im.toFixed(3))}
                            onChange={(e) => updateCoord(it.id, 'im', e.target.value)}
                            className="ml-1 w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 tabular-nums"
                          />
                        </label>
                      )}
                      <span className={`text-[10px] tabular-nums ${rad >= 1 && it.kind === 'pole' ? 'text-rose-400' : 'text-slate-400'}`}>
                        r={rad.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeRoot(it.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      aria-label={`Remove ${it.kind}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Frequency & Impulse Response Column */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-slate-200">Magnitude Response |H(e^jω)| (dB)</span>
              <span className="font-mono text-slate-400">0 → π rad/sample (0 → 0.5 f_s)</span>
            </div>
            <svg
              viewBox={`0 0 ${FW} ${FH}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              onMouseMove={handleFreqMove}
              onMouseLeave={() => setFHover(null)}
            >
              {[-60, -40, -20, 0].map((db) => (
                <g key={db}>
                  <line x1={FPAD.left} y1={mapFMag(db)} x2={FPAD.left + fPlotW} y2={mapFMag(db)} stroke="#1e293b" strokeWidth="1" />
                  <text x={FPAD.left - 8} y={mapFMag(db) + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    {db}
                  </text>
                </g>
              ))}
              {[0, 0.125, 0.25, 0.375, 0.5].map((fn) => (
                <g key={fn}>
                  <line x1={mapFX(fn)} y1={FPAD.top} x2={mapFX(fn)} y2={FPAD.top + fPlotH} stroke="#1e293b" strokeWidth="1" />
                  <text x={mapFX(fn)} y={FPAD.top + fPlotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    {fn.toFixed(2)}
                  </text>
                </g>
              ))}
              <line x1={FPAD.left} y1={FPAD.top} x2={FPAD.left} y2={FPAD.top + fPlotH} stroke="#475569" strokeWidth="1.5" />
              <line x1={FPAD.left} y1={FPAD.top + fPlotH} x2={FPAD.left + fPlotW} y2={FPAD.top + fPlotH} stroke="#475569" strokeWidth="1.5" />

              <path
                d={result.frequenciesNorm
                  .map((fn, i) => `${i === 0 ? 'M' : 'L'} ${mapFX(fn).toFixed(1)} ${mapFMag(result.magnitudeDb[i]).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
              />

              {fHover && (
                <g pointerEvents="none">
                  <line x1={mapFX(fHover.fNorm)} y1={FPAD.top} x2={mapFX(fHover.fNorm)} y2={FPAD.top + fPlotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                  <circle cx={mapFX(fHover.fNorm)} cy={mapFMag(fHover.magDb)} r="4" fill="#22d3ee" />
                </g>
              )}
            </svg>

            {fHover && (
              <div
                data-testid="pz-freq-tooltip"
                className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                style={{ left: `${Math.min(64, Math.max(8, fHover.pctLeft))}%` }}
              >
                <div className="text-slate-200 font-semibold">f = {fHover.fNorm.toFixed(3)} f_s</div>
                <div className="text-cyan-300">|H| = {fHover.magDb.toFixed(1)} dB</div>
                <div className="text-amber-300">∠H = {fHover.phaseDeg.toFixed(1)}°</div>
              </div>
            )}
          </div>

          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-slate-200">Impulse Response h[n] (n = 0..39)</span>
              <span className="font-mono text-slate-400">
                b = [{result.bCoeffs.map((v) => v.toFixed(2)).join(', ')}]
              </span>
            </div>
            <svg viewBox="0 0 520 150" className="w-full h-auto">
              {(() => {
                const maxAmp = Math.max(0.5, ...result.impulseResponse.map((v) => Math.abs(v)));
                const midY = 75;
                return (
                  <>
                    <line x1={32} y1={midY} x2={504} y2={midY} stroke="#334155" strokeWidth="1" />
                    {result.impulseResponse.map((val, n) => {
                      const x = 36 + (n / 39) * 464;
                      const y = midY - (val / maxAmp) * 58;
                      return (
                        <g key={n}>
                          <line x1={x} y1={midY} x2={x} y2={y} stroke="#10b981" strokeWidth="1.75" />
                          <circle cx={x} cy={y} r="2.5" fill="#34d399" />
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
