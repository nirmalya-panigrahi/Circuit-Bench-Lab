import React, { useState, useMemo } from 'react';
import {
  analyzeDiodeIV,
  analyzeMosfetIV,
  DiodeParams,
  MosfetParams,
} from '../../utils/electronicsMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';

export default function DiodeMosfetIVLab() {
  const [device, setDevice] = useState<'mosfet' | 'diode'>('mosfet');

  const [mosfet, setMosfet] = useState<MosfetParams>({
    vgs: 3.0,
    vdsOp: 2.5,
    vth0: 1.0,
    tempK: 300,
    kn0Ma: 6.0,
    lambda: 0.04,
  });

  const [diode, setDiode] = useState<DiodeParams>({
    tempK: 300,
    isNanoA: 1.0,
    ideality: 1.2,
    rsOhms: 5,
    vdOp: 0.72,
  });

  const [mosHover, setMosHover] = useState<{
    vds: number;
    idMa: number;
    region: string;
    pctLeft: number;
  } | null>(null);
  const [diodeHover, setDiodeHover] = useState<{
    vd: number;
    idMa: number;
    pctLeft: number;
  } | null>(null);

  const mosResult = useMemo(() => analyzeMosfetIV(mosfet), [mosfet]);
  const diodeResult = useMemo(() => analyzeDiodeIV(diode), [diode]);

  const W = 560;
  const H = 340;
  const PAD = { left: 56, right: 24, top: 24, bottom: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // MOSFET coordinate mappers
  const maxVds = 5.0;
  const maxMosId = Math.max(
    10,
    ...mosResult.curves.flatMap((c) => c.points.map((p) => p.idMa))
  ) * 1.08;
  const mapMX = (v: number) => PAD.left + (v / maxVds) * plotW;
  const mapMY = (id: number) => PAD.top + plotH - (Math.min(maxMosId, Math.max(0, id)) / maxMosId) * plotH;

  // Diode coordinate mappers
  const minVd = -3.0;
  const maxVd = 1.2;
  const minDiodeId = -15;
  const maxDiodeId = 100;
  const mapDX = (v: number) => PAD.left + ((v - minVd) / (maxVd - minVd)) * plotW;
  const mapDY = (id: number) =>
    PAD.top + plotH - ((Math.min(maxDiodeId, Math.max(minDiodeId, id)) - minDiodeId) / (maxDiodeId - minDiodeId)) * plotH;

  const formatResistance = (ohms: number) => {
    if (ohms >= 1e5) return 'Open (>100k)';
    if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(2)} kΩ`;
    return `${ohms.toFixed(1)} Ω`;
  };

  const handleMosMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    if (sx < PAD.left || sx > PAD.left + plotW) {
      setMosHover(null);
      return;
    }
    const vds = Math.max(0, Math.min(maxVds, ((sx - PAD.left) / plotW) * maxVds));
    const activeCurve =
      mosResult.curves.find((c) => Math.abs(c.vgs - mosfet.vgs) < 0.05) || mosResult.curves[0];
    const idx = Math.min(activeCurve.points.length - 1, Math.max(0, Math.round((vds / maxVds) * (activeCurve.points.length - 1))));
    const pt = activeCurve.points[idx];
    const reg = mosResult.vov <= 0 ? 'Cutoff' : pt.vds < mosResult.vov ? 'Triode' : 'Saturation';
    setMosHover({
      vds: pt.vds,
      idMa: pt.idMa,
      region: reg,
      pctLeft: (sx / W) * 100,
    });
  };

  const handleDiodeMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    if (sx < PAD.left || sx > PAD.left + plotW) {
      setDiodeHover(null);
      return;
    }
    const vd = Math.max(minVd, Math.min(maxVd, minVd + ((sx - PAD.left) / plotW) * (maxVd - minVd)));
    const idx = Math.min(
      diodeResult.points.length - 1,
      Math.max(0, Math.round(((vd - minVd) / (maxVd - minVd)) * (diodeResult.points.length - 1)))
    );
    const pt = diodeResult.points[idx];
    setDiodeHover({
      vd: pt.vd,
      idMa: pt.idMa,
      pctLeft: (sx / W) * 100,
    });
  };

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="04"
        title="Diode & MOSFET I–V Characteristic Curves"
        domain="Semiconductor Device Physics"
        description="Vary junction temperature, threshold voltage, and gate-source bias to inspect MOSFET cutoff, triode, and saturation regions or Shockley diode forward/reverse conduction."
        status={
          device === 'mosfet' ? (
            <StatusIndicator
              tone={mosResult.region === 'Saturation' ? 'nominal' : mosResult.region === 'Triode' ? 'warning' : 'critical'}
              label={`MOSFET Region: ${mosResult.region}`}
            />
          ) : (
            <StatusIndicator
              tone={diode.vdOp >= diodeResult.kneeVoltage ? 'nominal' : diode.vdOp >= -2.4 ? 'warning' : 'critical'}
              label={diode.vdOp >= diodeResult.kneeVoltage ? 'Forward Conducting' : diode.vdOp < -2.4 ? 'Reverse Breakdown' : 'Blocking / Sub-Knee'}
            />
          )
        }
        actions={
          <div className="flex p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg">
            <button
              onClick={() => setDevice('mosfet')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                device === 'mosfet' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              n-MOSFET (I_D vs V_DS)
            </button>
            <button
              onClick={() => setDevice('diode')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                device === 'diode' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              PN Diode (I_D vs V_D)
            </button>
          </div>
        }
      />

      {device === 'mosfet' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricReadout label="Drain Current (I_D)" value={mosResult.idOpMa.toFixed(2)} unit="mA" tone="cyan" subtext={`V_DS,sat = ${mosResult.vdsSat.toFixed(2)} V`} />
            <MetricReadout label="Transconductance (g_m)" value={mosResult.gmMs.toFixed(2)} unit="mS" tone="emerald" subtext={`k_n(T) = ${mosResult.knTMa.toFixed(2)} mA/V²`} />
            <MetricReadout label="On / Output Res. (r_on)" value={formatResistance(mosResult.ronOhms)} subtext={`Mode: ${mosResult.region}`} />
            <MetricReadout label="Thermal V_TH(T)" value={mosResult.vthT.toFixed(3)} unit="V" subtext={`T = ${(mosfet.tempK - 273.15).toFixed(0)} °C`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                <span className="font-semibold text-slate-200">n-Channel MOSFET Output Curves</span>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                  <span className="text-amber-300">--- Pinch-Off Locus (V_DS = V_GS - V_TH)</span>
                  <span className="text-cyan-300">— Active V_GS</span>
                </div>
              </div>

              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto overflow-visible cursor-crosshair"
                onMouseMove={handleMosMove}
                onMouseLeave={() => setMosHover(null)}
              >
                {/* Triode / Saturation shading relative to active Vgs */}
                {mosResult.vdsSat > 0 && (
                  <rect
                    x={PAD.left}
                    y={PAD.top}
                    width={Math.min(plotW, mapMX(mosResult.vdsSat) - PAD.left)}
                    height={plotH}
                    fill="rgba(245, 158, 11, 0.08)"
                  />
                )}
                <text x={PAD.left + 8} y={PAD.top + 16} fill="#fbbf24" className="text-[10px] font-mono">
                  TRIODE
                </text>
                <text x={PAD.left + plotW - 8} y={PAD.top + 16} textAnchor="end" fill="#34d399" className="text-[10px] font-mono">
                  SATURATION
                </text>

                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = PAD.top + f * plotH;
                  const idVal = maxMosId * (1 - f);
                  const x = PAD.left + f * plotW;
                  const vVal = maxVds * f;
                  return (
                    <g key={f}>
                      <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke="#1e293b" strokeWidth="1" />
                      <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                        {idVal.toFixed(1)}
                      </text>
                      <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH} stroke="#1e293b" strokeWidth="1" />
                      <text x={x} y={PAD.top + plotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                        {vVal.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
                <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
                <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono">
                  Drain-Source Voltage V_DS (V)
                </text>
                <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono" transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
                  Drain Current I_D (mA)
                </text>

                {/* Pinch-off locus */}
                <path
                  d={mosResult.pinchoffBoundary
                    .filter((p) => p.idMa <= maxMosId)
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapMX(p.vds).toFixed(1)} ${mapMY(p.idMa).toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />

                {/* Curves */}
                {mosResult.curves.map((curve) => {
                  const isActive = Math.abs(curve.vgs - mosfet.vgs) < 0.05;
                  const d = curve.points
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapMX(p.vds).toFixed(1)} ${mapMY(p.idMa).toFixed(1)}`)
                    .join(' ');
                  const last = curve.points[curve.points.length - 1];
                  return (
                    <g key={curve.vgs}>
                      <path
                        d={d}
                        fill="none"
                        stroke={isActive ? '#06b6d4' : '#334155'}
                        strokeWidth={isActive ? 2.75 : 1.5}
                      />
                      {last.idMa <= maxMosId * 0.96 && (
                        <text
                          x={mapMX(last.vds) - 4}
                          y={mapMY(last.idMa) - 5}
                          textAnchor="end"
                          fill={isActive ? '#22d3ee' : '#64748b'}
                          className="text-[9px] font-mono"
                        >
                          V_GS={curve.vgs.toFixed(1)}V
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Operating point */}
                <circle cx={mapMX(mosfet.vdsOp)} cy={mapMY(mosResult.idOpMa)} r="5.5" fill="#10b981" stroke="#07090E" strokeWidth="2" />

                {mosHover && (
                  <g pointerEvents="none">
                    <line x1={mapMX(mosHover.vds)} y1={PAD.top} x2={mapMX(mosHover.vds)} y2={PAD.top + plotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                    <circle cx={mapMX(mosHover.vds)} cy={mapMY(mosHover.idMa)} r="4" fill="#22d3ee" />
                  </g>
                )}
              </svg>

              {mosHover && (
                <div
                  data-testid="mosfet-tooltip"
                  className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                  style={{ left: `${Math.min(68, Math.max(8, mosHover.pctLeft))}%` }}
                >
                  <div className="text-slate-200 font-semibold">V_DS = {mosHover.vds.toFixed(2)} V</div>
                  <div className="text-cyan-300">I_D = {mosHover.idMa.toFixed(2)} mA</div>
                  <div className="text-amber-300">Region: {mosHover.region}</div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
                MOSFET Device &amp; Thermal Controls
              </h3>
              <ParamSlider label="Gate-Source Bias (V_GS)" value={mosfet.vgs} min={0} max={5} step={0.1} unit="V" onChange={(v) => setMosfet((p) => ({ ...p, vgs: v }))} />
              <ParamSlider label="Drain-Source Bias (V_DS)" value={mosfet.vdsOp} min={0} max={5} step={0.1} unit="V" onChange={(v) => setMosfet((p) => ({ ...p, vdsOp: v }))} accentClass="accent-emerald-400" />
              <ParamSlider label="Threshold Voltage (V_TH0)" value={mosfet.vth0} min={0.4} max={2.5} step={0.05} unit="V" onChange={(v) => setMosfet((p) => ({ ...p, vth0: v }))} />
              <ParamSlider
                label="Junction Temperature (T)"
                value={mosfet.tempK}
                min={250}
                max={450}
                step={5}
                unit="K"
                displayValue={`${mosfet.tempK} K (${(mosfet.tempK - 273).toFixed(0)}°C)`}
                onChange={(v) => setMosfet((p) => ({ ...p, tempK: v }))}
                accentClass="accent-amber-400"
              />
              <ParamSlider label="Process Gain (k_n0)" value={mosfet.kn0Ma} min={1} max={15} step={0.5} unit="mA/V²" onChange={(v) => setMosfet((p) => ({ ...p, kn0Ma: v }))} />
              <ParamSlider label="Channel Length Mod. (λ)" value={mosfet.lambda} min={0} max={0.15} step={0.01} unit="V⁻¹" onChange={(v) => setMosfet((p) => ({ ...p, lambda: v }))} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricReadout label="Diode Current (I_D)" value={diodeResult.idOpMa.toFixed(2)} unit="mA" tone="cyan" />
            <MetricReadout label="Dynamic Res. (r_d)" value={formatResistance(diodeResult.rdOhms)} tone="emerald" subtext={`R_S = ${diode.rsOhms.toFixed(1)} Ω`} />
            <MetricReadout label="Thermal Voltage (V_T)" value={diodeResult.vtMv.toFixed(2)} unit="mV" subtext={`T = ${(diode.tempK - 273.15).toFixed(0)} °C`} />
            <MetricReadout label="Conduction Knee (1 mA)" value={diodeResult.kneeVoltage.toFixed(3)} unit="V" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold text-slate-200">Shockley Diode I–V Curve</span>
                <span className="font-mono text-slate-400">I_D = I_S (exp(V_D / nV_T) − 1)</span>
              </div>

              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto overflow-visible cursor-crosshair"
                onMouseMove={handleDiodeMove}
                onMouseLeave={() => setDiodeHover(null)}
              >
                {/* Zero axes */}
                <line x1={mapDX(0)} y1={PAD.top} x2={mapDX(0)} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
                <line x1={PAD.left} y1={mapDY(0)} x2={PAD.left + plotW} y2={mapDY(0)} stroke="#475569" strokeWidth="1.5" />

                {[-3, -2, -1, 0, 0.5, 1.0].map((v) => (
                  <g key={v}>
                    <line x1={mapDX(v)} y1={PAD.top} x2={mapDX(v)} y2={PAD.top + plotH} stroke="#1e293b" strokeWidth="1" />
                    <text x={mapDX(v)} y={PAD.top + plotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                      {v.toFixed(1)}V
                    </text>
                  </g>
                ))}
                {[0, 25, 50, 75, 100].map((id) => (
                  <g key={id}>
                    <line x1={PAD.left} y1={mapDY(id)} x2={PAD.left + plotW} y2={mapDY(id)} stroke="#1e293b" strokeWidth="1" />
                    <text x={PAD.left - 8} y={mapDY(id) + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                      {id}
                    </text>
                  </g>
                ))}

                <path
                  d={diodeResult.points
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapDX(p.vd).toFixed(1)} ${mapDY(p.idMa).toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                />
                <circle cx={mapDX(diode.vdOp)} cy={mapDY(diodeResult.idOpMa)} r="5.5" fill="#10b981" stroke="#07090E" strokeWidth="2" />

                {diodeHover && (
                  <g pointerEvents="none">
                    <line x1={mapDX(diodeHover.vd)} y1={PAD.top} x2={mapDX(diodeHover.vd)} y2={PAD.top + plotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                    <circle cx={mapDX(diodeHover.vd)} cy={mapDY(diodeHover.idMa)} r="4" fill="#22d3ee" />
                  </g>
                )}
              </svg>

              {diodeHover && (
                <div
                  data-testid="diode-tooltip"
                  className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                  style={{ left: `${Math.min(68, Math.max(8, diodeHover.pctLeft))}%` }}
                >
                  <div className="text-slate-200 font-semibold">V_D = {diodeHover.vd.toFixed(2)} V</div>
                  <div className="text-cyan-300">I_D = {diodeHover.idMa.toFixed(2)} mA</div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
                Diode Parameters
              </h3>
              <ParamSlider label="Bias Voltage (V_D)" value={diode.vdOp} min={-3.0} max={1.15} step={0.02} unit="V" onChange={(v) => setDiode((p) => ({ ...p, vdOp: v }))} />
              <ParamSlider label="Junction Temperature (T)" value={diode.tempK} min={250} max={450} step={5} unit="K" onChange={(v) => setDiode((p) => ({ ...p, tempK: v }))} accentClass="accent-amber-400" />
              <ParamSlider label="Ideality Factor (n)" value={diode.ideality} min={1.0} max={2.0} step={0.05} onChange={(v) => setDiode((p) => ({ ...p, ideality: v }))} />
              <ParamSlider label="Series Resistance (R_S)" value={diode.rsOhms} min={0} max={30} step={0.5} unit="Ω" onChange={(v) => setDiode((p) => ({ ...p, rsOhms: v }))} />
              <ParamSlider label="Saturation Current (I_S @300K)" value={diode.isNanoA} min={0.1} max={50} step={0.5} unit="nA" onChange={(v) => setDiode((p) => ({ ...p, isNanoA: v }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
