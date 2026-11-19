import React, { useState, useMemo } from 'react';
import { analyzeVtc, VtcParams, VtcTopology } from '../../utils/electronicsMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';

export default function VtcCurveLab() {
  const [params, setParams] = useState<VtcParams>({
    topology: 'cmos',
    vdd: 3.3,
    wpWnRatio: 2.5,
    vthN: 0.65,
    vthP: 0.65,
    bjtBeta: 100,
    bjtRcRbRatio: 0.25,
  });

  const [vtcHover, setVtcHover] = useState<{
    vin: number;
    vout: number;
    iscMa: number;
    slope: number;
    region: string;
    pctLeft: number;
  } | null>(null);

  const result = useMemo(() => analyzeVtc(params), [params]);

  const W = 560;
  const H = 340;
  const PAD = { left: 54, right: 24, top: 24, bottom: 42 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const mapX = (v: number) => PAD.left + (v / params.vdd) * plotW;
  const mapY = (v: number) => PAD.top + plotH - (v / params.vdd) * plotH;
  const mapIscY = (isc: number) => {
    const peak = Math.max(0.2, result.peakIscMa);
    return PAD.top + plotH - (isc / (peak * 1.15)) * (plotH * 0.45);
  };

  const handleVtcMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    if (sx < PAD.left || sx > PAD.left + plotW) {
      setVtcHover(null);
      return;
    }
    const frac = Math.max(0, Math.min(1, (sx - PAD.left) / plotW));
    const idx = Math.min(result.points.length - 1, Math.max(0, Math.round(frac * (result.points.length - 1))));
    const pt = result.points[idx];
    setVtcHover({
      ...pt,
      pctLeft: (sx / W) * 100,
    });
  };

  const minNm = Math.min(result.nml, result.nmh);
  const symError = Math.abs(result.vm - params.vdd / 2);
  const statusTone = minNm < params.vdd * 0.15 ? 'critical' : symError > params.vdd * 0.12 ? 'warning' : 'nominal';
  const statusLabel =
    minNm < params.vdd * 0.15
      ? 'Low Noise Margin'
      : symError > params.vdd * 0.12
      ? `Asymmetric Threshold (V_M = ${result.vm.toFixed(2)}V)`
      : `Balanced Inverter (V_M = ${result.vm.toFixed(2)}V)`;

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="10"
        title="BJT / CMOS Voltage Transfer Characteristic (VTC)"
        domain="Logic Gate Sizing & Noise Margins"
        description="Explore how PMOS/NMOS width ratios (W_p/W_n) or BJT resistor ratios shift the switching threshold V_M, unity-gain points (V_IL, V_IH), noise margins, and short-circuit current."
        status={<StatusIndicator tone={statusTone} label={statusLabel} />}
        actions={
          <div className="flex p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg">
            {(['cmos', 'bjt'] as VtcTopology[]).map((top) => (
              <button
                key={top}
                onClick={() => setParams((p) => ({ ...p, topology: top }))}
                className={`px-3.5 py-1.5 text-xs font-medium uppercase rounded-md cursor-pointer transition-colors ${
                  params.topology === top ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {top === 'cmos' ? 'CMOS Inverter' : 'BJT Inverter'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout label="Noise Margin Low (NM_L)" value={result.nml.toFixed(2)} unit="V" subtext={`V_IL=${result.vil.toFixed(2)}V · V_OL=${result.vol.toFixed(2)}V`} tone="emerald" />
        <MetricReadout label="Noise Margin High (NM_H)" value={result.nmh.toFixed(2)} unit="V" subtext={`V_OH=${result.voh.toFixed(2)}V · V_IH=${result.vih.toFixed(2)}V`} tone="cyan" />
        <MetricReadout label="Switching Threshold (V_M)" value={result.vm.toFixed(2)} unit="V" subtext={`Ideal V_DD/2 = ${(params.vdd / 2).toFixed(2)}V`} />
        <MetricReadout label="Peak Transition Gain" value={result.peakGain.toFixed(1)} unit="V/V" subtext={`Peak I_sc = ${result.peakIscMa.toFixed(2)} mA`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
            <span className="font-semibold text-slate-200">VTC Curve (V_out vs. V_in)</span>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-cyan-300">— V_out(V_in)</span>
              <span className="text-amber-300">— I_SC Current</span>
              <span className="text-slate-400">--- V_out = V_in</span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
            onMouseMove={handleVtcMove}
            onMouseLeave={() => setVtcHover(null)}
          >
            {/* Undefined transition region shading between V_IL and V_IH */}
            <rect
              x={mapX(result.vil)}
              y={PAD.top}
              width={Math.max(2, mapX(result.vih) - mapX(result.vil))}
              height={plotH}
              fill="rgba(245, 158, 11, 0.1)"
            />

            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const v = params.vdd * f;
              return (
                <g key={f}>
                  <line x1={PAD.left} y1={mapY(v)} x2={PAD.left + plotW} y2={mapY(v)} stroke="#1e293b" strokeWidth="1" />
                  <text x={PAD.left - 8} y={mapY(v) + 4} textAnchor="end" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    {v.toFixed(1)}
                  </text>
                  <line x1={mapX(v)} y1={PAD.top} x2={mapX(v)} y2={PAD.top + plotH} stroke="#1e293b" strokeWidth="1" />
                  <text x={mapX(v)} y={PAD.top + plotH + 16} textAnchor="middle" fill="#64748b" className="text-[10px] font-mono tabular-nums">
                    {v.toFixed(1)}
                  </text>
                </g>
              );
            })}

            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
            <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
            <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono">
              Input Voltage V_in (V)
            </text>
            <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fill="#94a3b8" className="text-[11px] font-mono" transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
              Output Voltage V_out (V)
            </text>

            {/* Unity V_out = V_in diagonal */}
            <line x1={mapX(0)} y1={mapY(0)} x2={mapX(params.vdd)} y2={mapY(params.vdd)} stroke="#475569" strokeDasharray="4 4" strokeWidth="1" />

            {/* Short circuit current bell */}
            <path
              d={result.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.vin).toFixed(1)} ${mapIscY(p.iscMa).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.75"
              strokeOpacity="0.8"
            />

            {/* Primary VTC Curve */}
            <path
              d={result.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.vin).toFixed(1)} ${mapY(p.vout).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.75"
            />

            {/* Key Markers: V_IL, V_M, V_IH */}
            <circle cx={mapX(result.vm)} cy={mapY(result.vm)} r="5" fill="#10b981" stroke="#07090E" strokeWidth="1.5" />
            <text x={mapX(result.vm) + 8} y={mapY(result.vm) - 6} fill="#34d399" className="text-[10px] font-mono font-semibold">
              V_M ({result.vm.toFixed(2)}V)
            </text>

            <line x1={mapX(result.vil)} y1={PAD.top} x2={mapX(result.vil)} y2={PAD.top + plotH} stroke="#10b981" strokeDasharray="3 3" strokeOpacity="0.6" />
            <text x={mapX(result.vil) - 4} y={PAD.top + 14} textAnchor="end" fill="#6ee7b7" className="text-[10px] font-mono">
              V_IL
            </text>

            <line x1={mapX(result.vih)} y1={PAD.top} x2={mapX(result.vih)} y2={PAD.top + plotH} stroke="#38bdf8" strokeDasharray="3 3" strokeOpacity="0.6" />
            <text x={mapX(result.vih) + 4} y={PAD.top + 14} fill="#7dd3fc" className="text-[10px] font-mono">
              V_IH
            </text>

            {vtcHover && (
              <g pointerEvents="none">
                <line x1={mapX(vtcHover.vin)} y1={PAD.top} x2={mapX(vtcHover.vin)} y2={PAD.top + plotH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1" />
                <circle cx={mapX(vtcHover.vin)} cy={mapY(vtcHover.vout)} r="4" fill="#22d3ee" />
              </g>
            )}
          </svg>

          {vtcHover && (
            <div
              data-testid="vtc-tooltip"
              className="absolute top-12 z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
              style={{ left: `${Math.min(60, Math.max(8, vtcHover.pctLeft))}%` }}
            >
              <div className="text-slate-200 font-semibold">V_in = {vtcHover.vin.toFixed(2)} V → V_out = {vtcHover.vout.toFixed(2)} V</div>
              <div className="text-cyan-300">Gain = {vtcHover.slope.toFixed(1)} V/V · I_SC = {vtcHover.iscMa.toFixed(2)} mA</div>
              <div className="text-amber-300">{vtcHover.region}</div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            {params.topology === 'cmos' ? 'CMOS Sizing & Thresholds' : 'BJT Inverter Parameters'}
          </h3>
          <ParamSlider label="Supply Voltage (V_DD / V_CC)" value={params.vdd} min={1.8} max={5.0} step={0.1} unit="V" onChange={(v) => setParams((p) => ({ ...p, vdd: v }))} />

          {params.topology === 'cmos' ? (
            <>
              <ParamSlider
                label="PMOS / NMOS Width Ratio (W_p/W_n)"
                value={params.wpWnRatio}
                min={0.3}
                max={6.0}
                step={0.1}
                minLabel="0.3 (Strong N)"
                maxLabel="6.0 (Strong P)"
                onChange={(v) => setParams((p) => ({ ...p, wpWnRatio: v }))}
                accentClass="accent-emerald-400"
              />
              <ParamSlider label="NMOS Threshold (V_THn)" value={params.vthN} min={0.3} max={1.2} step={0.05} unit="V" onChange={(v) => setParams((p) => ({ ...p, vthN: v }))} />
              <ParamSlider label="PMOS Threshold (|V_THp|)" value={params.vthP} min={0.3} max={1.2} step={0.05} unit="V" onChange={(v) => setParams((p) => ({ ...p, vthP: v }))} />
            </>
          ) : (
            <>
              <ParamSlider label="Transistor Gain (β)" value={params.bjtBeta} min={30} max={250} step={5} onChange={(v) => setParams((p) => ({ ...p, bjtBeta: v }))} />
              <ParamSlider label="Resistor Ratio (R_C / R_B)" value={params.bjtRcRbRatio} min={0.05} max={1.0} step={0.05} onChange={(v) => setParams((p) => ({ ...p, bjtRcRbRatio: v }))} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
