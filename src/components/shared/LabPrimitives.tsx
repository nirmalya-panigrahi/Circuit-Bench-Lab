import React, { useState, useEffect } from 'react';

interface ParamSliderProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  displayValue?: string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (val: number) => void;
  accentClass?: string;
  showNumberInput?: boolean;
}

export function ParamSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit = '',
  displayValue,
  minLabel,
  maxLabel,
  onChange,
  accentClass = 'accent-cyan-400',
  showNumberInput = true,
}: ParamSliderProps) {
  const inputId = id || `slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(Number(value.toFixed(4))));
  }, [value]);

  const commitDraft = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setDraft(String(Number(clamped.toFixed(4))));
    } else {
      setDraft(String(Number(value.toFixed(4))));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={inputId} className="text-slate-300 font-medium truncate">
          {label}
        </label>
        {showNumberInput ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="number"
              aria-label={`${label} value`}
              min={min}
              max={max}
              step={step}
              value={draft}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const parsed = parseFloat(raw);
                if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
                  onChange(parsed);
                }
              }}
              onBlur={() => commitDraft(draft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft(draft);
              }}
              className="w-20 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-md px-2 py-1 text-right font-mono text-xs tabular-nums text-slate-100 focus:outline-none"
            />
            {unit ? <span className="text-slate-400 font-mono text-[11px] min-w-[24px]">{unit}</span> : null}
          </div>
        ) : (
          <span className="font-mono tabular-nums font-semibold text-slate-100 shrink-0">
            {displayValue ?? value}
            {unit ? <span className="text-slate-400 ml-1 text-[11px]">{unit}</span> : null}
          </span>
        )}
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer ${accentClass}`}
      />
      {(minLabel || maxLabel || (showNumberInput && displayValue)) && (
        <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500">
          <span>{minLabel}</span>
          {showNumberInput && displayValue ? <span className="text-slate-400">{displayValue}</span> : null}
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

interface MetricReadoutProps {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  tone?: 'default' | 'cyan' | 'emerald' | 'amber' | 'rose';
}

export function MetricReadout({ label, value, unit, subtext, tone = 'default' }: MetricReadoutProps) {
  const valueColor =
    tone === 'cyan'
      ? 'text-cyan-300'
      : tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'amber'
      ? 'text-amber-300'
      : tone === 'rose'
      ? 'text-rose-400'
      : 'text-slate-100';

  return (
    <div className="bg-[#0B0F1A] border border-slate-800 rounded-lg p-3">
      <div className="text-[11px] font-medium text-slate-400 truncate">{label}</div>
      <div className={`mt-1 text-lg font-mono font-semibold tabular-nums leading-tight ${valueColor}`}>
        {value}
        {unit ? <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span> : null}
      </div>
      {subtext ? <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 truncate">{subtext}</div> : null}
    </div>
  );
}

interface StatusIndicatorProps {
  tone: 'nominal' | 'warning' | 'critical';
  label: string;
}

export function StatusIndicator({ tone, label }: StatusIndicatorProps) {
  const cfg =
    tone === 'nominal'
      ? { glyph: '●', cls: 'text-emerald-400' }
      : tone === 'warning'
      ? { glyph: '▲', cls: 'text-amber-400' }
      : { glyph: '✖', cls: 'text-rose-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium whitespace-nowrap ${cfg.cls}`}>
      <span aria-hidden="true">{cfg.glyph}</span>
      <span>{label}</span>
    </span>
  );
}

interface LabHeaderBarProps {
  index: string;
  title: string;
  domain: string;
  description: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}

export function LabHeaderBar({ index, title, domain, description, status, actions }: LabHeaderBarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>{index}</span>
          <span aria-hidden="true">·</span>
          <span>{domain}</span>
          {status ? (
            <>
              <span aria-hidden="true">·</span>
              {status}
            </>
          ) : null}
        </div>
        <h2 className="mt-1 text-xl md:text-2xl font-semibold tracking-tight text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div> : null}
    </div>
  );
}
