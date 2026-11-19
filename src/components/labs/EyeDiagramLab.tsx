import React, { useState, useMemo, useRef, useEffect } from 'react';
import { simulateEyeDiagram, EyeParams } from '../../utils/signalsDspMath';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';
import { RefreshCw } from 'lucide-react';

export default function EyeDiagramLab() {
  const [params, setParams] = useState<EyeParams>({
    modulation: 'nrz',
    dataRateGbps: 10,
    bandwidthGhz: 8.5,
    jitterPs: 4.0,
    deterministicJitterPs: 3.0,
    noiseMv: 18,
    swingMv: 800,
    seed: 1042,
  });

  const [hoverInfo, setHoverInfo] = useState<{
    ui: number;
    tPs: number;
    vMv: number;
    zone: string;
    pctLeft: number;
    pctTop: number;
  } | null>(null);

  const result = useMemo(() => simulateEyeDiagram(params), [params]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);

    const padL = 48;
    const padR = 18;
    const padT = 18;
    const padB = 28;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const maxV = params.swingMv * 0.72;

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();

      const x = padL + (i / 4) * pw;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ph);
      ctx.stroke();
    }

    // Eye center sampling instants (0.5 UI and 1.5 UI)
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([4, 4]);
    for (const uiFrac of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(padL + pw * uiFrac, padT);
      ctx.lineTo(padL + pw * uiFrac, padT + ph);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Overlaid persistence eye traces
    ctx.strokeStyle =
      result.status === 'Eye Open'
        ? 'rgba(34, 211, 238, 0.24)'
        : result.status === 'Margin Degraded'
        ? 'rgba(251, 191, 36, 0.24)'
        : 'rgba(244, 63, 94, 0.24)';
    ctx.lineWidth = 1.4;

    for (const trace of result.traces) {
      ctx.beginPath();
      for (let i = 0; i < trace.length; i++) {
        const x = padL + (i / (trace.length - 1)) * pw;
        const clamped = Math.max(-maxV, Math.min(maxV, trace[i]));
        const y = padT + ph * 0.5 - (clamped / maxV) * (ph * 0.5);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`+${maxV.toFixed(0)}`, padL - 6, padT + 8);
    ctx.fillText('0 mV', padL - 6, padT + ph * 0.5 + 4);
    ctx.fillText(`-${maxV.toFixed(0)}`, padL - 6, padT + ph);

    ctx.textAlign = 'center';
    ctx.fillText('0.5 UI (Eye)', padL + pw * 0.25, h - 8);
    ctx.fillText('1.0 UI (Cross)', padL + pw * 0.5, h - 8);
    ctx.fillText('1.5 UI (Eye)', padL + pw * 0.75, h - 8);
  }, [result, params.swingMv]);

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const padL = 48;
    const padR = 18;
    const padT = 18;
    const padB = 28;
    const pw = canvas.width - padL - padR;
    const ph = canvas.height - padT - padB;
    const maxV = params.swingMv * 0.72;

    if (sx < padL || sx > padL + pw || sy < padT || sy > padT + ph) {
      setHoverInfo(null);
      return;
    }

    const ui = ((sx - padL) / pw) * 2.0;
    const vMv = (1 - ((sy - padT) / ph) * 2) * maxV;
    const distCross = Math.min(Math.abs(ui - 1.0), Math.abs(ui - 0.0), Math.abs(ui - 2.0));
    const zone = distCross < 0.16 ? 'Crossing Window' : 'Eye Sampling Center';

    setHoverInfo({
      ui,
      tPs: ui * result.uiPs,
      vMv,
      zone,
      pctLeft: (sx / canvas.width) * 100,
      pctTop: (sy / canvas.height) * 100,
    });
  };

  const statusTone =
    result.status === 'Eye Open' ? 'nominal' : result.status === 'Margin Degraded' ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="05"
        title="Eye Diagram (Signal Integrity)"
        domain="High-Speed Serial Links"
        description="Simulate intersymbol interference (ISI), random & deterministic jitter, and additive noise across NRZ or PAM4 links to inspect eye height, eye width, crossing jitter, and bit-error risk."
        status={<StatusIndicator tone={statusTone} label={result.status} />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg">
              {(['nrz', 'pam4'] as const).map((mod) => (
                <button
                  key={mod}
                  onClick={() => setParams((p) => ({ ...p, modulation: mod }))}
                  className={`px-3 py-1.5 text-xs font-medium uppercase rounded-md cursor-pointer transition-colors ${
                    params.modulation === mod ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
            <button
              onClick={() => setParams((p) => ({ ...p, seed: (p.seed ?? 1) + 77 }))}
              className="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" /> New PRBS
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout
          label="Eye Height (Noise Margin)"
          value={result.eyeHeightMv.toFixed(0)}
          unit="mV"
          tone="cyan"
          subtext={`SNR ${result.snrDb.toFixed(1)} dB · Q=${result.qFactor.toFixed(1)}`}
        />
        <MetricReadout
          label="Eye Width (Timing Margin)"
          value={result.eyeWidthUi.toFixed(2)}
          unit="UI"
          subtext={`${result.eyeWidthPs.toFixed(1)} ps (1 UI = ${result.uiPs.toFixed(0)} ps)`}
        />
        <MetricReadout
          label="Zero-Crossing Jitter"
          value={result.zeroCrossingJitterPs.toFixed(1)}
          unit="ps"
          subtext={`RJ ${params.jitterPs}ps · DJ ${params.deterministicJitterPs ?? 0}ps`}
        />
        <MetricReadout
          label="Bit-Error Risk (BER)"
          value={result.berRiskLabel}
          tone={result.berRiskLabel === 'Low (<1e-9)' ? 'emerald' : result.berRiskLabel === 'Moderate' ? 'amber' : 'rose'}
          subtext={`Est. BER ≈ ${result.berEstimate < 1e-12 ? '<1e-12' : result.berEstimate.toExponential(1)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 relative">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-200">2-UI Persistence Eye Scope ({result.traces.length} overlaid traces)</span>
            <span className="font-mono text-slate-400">
              {params.dataRateGbps} Gbps {params.modulation.toUpperCase()}
            </span>
          </div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={620}
              height={340}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setHoverInfo(null)}
              className="w-full h-auto rounded-lg border border-slate-800/80 cursor-crosshair"
            />
            {hoverInfo && (
              <>
                <div
                  className="absolute top-3 bottom-6 w-px bg-slate-400/50 pointer-events-none"
                  style={{ left: `${hoverInfo.pctLeft}%` }}
                />
                <div
                  data-testid="eye-tooltip"
                  className="absolute z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-mono tabular-nums pointer-events-none shadow-lg space-y-0.5"
                  style={{
                    left: `${Math.min(64, Math.max(8, hoverInfo.pctLeft + 2))}%`,
                    top: `${Math.min(68, Math.max(8, hoverInfo.pctTop))}%`,
                  }}
                >
                  <div className="text-cyan-300 font-semibold">
                    {hoverInfo.ui.toFixed(2)} UI ({hoverInfo.tPs.toFixed(1)} ps)
                  </div>
                  <div className="text-slate-200">Level: {hoverInfo.vMv >= 0 ? '+' : ''}{hoverInfo.vMv.toFixed(0)} mV</div>
                  <div className="text-slate-400">{hoverInfo.zone}</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-2.5">
            Channel &amp; Impairment Controls
          </h3>
          <ParamSlider
            label="Data Rate"
            value={params.dataRateGbps}
            min={1}
            max={25}
            step={0.5}
            unit="Gbps"
            onChange={(v) => setParams((p) => ({ ...p, dataRateGbps: v }))}
          />
          <ParamSlider
            label="Channel -3 dB Bandwidth"
            value={params.bandwidthGhz}
            min={0.5}
            max={20}
            step={0.25}
            unit="GHz"
            onChange={(v) => setParams((p) => ({ ...p, bandwidthGhz: v }))}
          />
          <ParamSlider
            label="RMS Random Jitter (RJ)"
            value={params.jitterPs}
            min={0}
            max={25}
            step={0.5}
            unit="ps"
            onChange={(v) => setParams((p) => ({ ...p, jitterPs: v }))}
            accentClass="accent-amber-400"
          />
          <ParamSlider
            label="Deterministic Jitter (DJ / DCD)"
            value={params.deterministicJitterPs ?? 0}
            min={0}
            max={30}
            step={0.5}
            unit="ps"
            onChange={(v) => setParams((p) => ({ ...p, deterministicJitterPs: v }))}
            accentClass="accent-amber-400"
          />
          <ParamSlider
            label="Gaussian Noise (σ)"
            value={params.noiseMv}
            min={0}
            max={100}
            step={1}
            unit="mV"
            onChange={(v) => setParams((p) => ({ ...p, noiseMv: v }))}
            accentClass="accent-rose-400"
          />
          <ParamSlider
            label="Differential Swing"
            value={params.swingMv}
            min={200}
            max={1200}
            step={50}
            unit="mVpp"
            onChange={(v) => setParams((p) => ({ ...p, swingMv: v }))}
          />
        </div>
      </div>
    </div>
  );
}
