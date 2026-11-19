import React from 'react';
import { LABS_CATALOG } from '../data/labsCatalog';
import { LabCategory, LabId } from '../types';
import { ArrowRight } from 'lucide-react';

interface LabDirectoryProps {
  activeCategory: LabCategory;
  onSelectLab: (id: LabId) => void;
  onSelectCategory: (cat: LabCategory) => void;
}

function MiniSchematic({ id }: { id: LabId }) {
  switch (id) {
    case 'smith':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <circle cx="60" cy="32" r="24" fill="none" stroke="#334155" strokeWidth="1.5" />
          <circle cx="72" cy="32" r="12" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.6" />
          <line x1="36" y1="32" x2="84" y2="32" stroke="#475569" strokeWidth="1" />
          <path d="M 46 42 Q 62 18 60 32" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <circle cx="60" cy="32" r="2.5" fill="#10b981" />
        </svg>
      );
    case 'kmap':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          {[0, 1, 2, 3].map((c) =>
            [0, 1].map((r) => (
              <rect
                key={`${r}-${c}`}
                x={28 + c * 16}
                y={14 + r * 18}
                width="14"
                height="16"
                rx="2"
                fill="none"
                stroke="#334155"
                strokeWidth="1.2"
              />
            ))
          )}
          <rect x="27" y="13" width="32" height="36" rx="4" fill="rgba(6,182,212,0.16)" stroke="#06b6d4" strokeWidth="1.5" />
        </svg>
      );
    case 'loadline':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 20 50 Q 32 30 100 28" fill="none" stroke="#334155" strokeWidth="1.2" />
          <path d="M 20 50 Q 32 40 100 38" fill="none" stroke="#334155" strokeWidth="1.2" />
          <line x1="20" y1="14" x2="98" y2="50" stroke="#06b6d4" strokeWidth="2" />
          <circle cx="58" cy="32" r="3" fill="#10b981" />
        </svg>
      );
    case 'ivcurves':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 20 50 Q 35 22 100 20" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <path d="M 20 50 Q 35 34 100 32" fill="none" stroke="#334155" strokeWidth="1.5" />
          <path d="M 20 50 Q 50 18 72 16" fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 3" />
        </svg>
      );
    case 'eyediagram':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 16 16 C 36 16, 44 48, 60 48 C 76 48, 84 16, 104 16" fill="none" stroke="#06b6d4" strokeWidth="1.8" />
          <path d="M 16 48 C 36 48, 44 16, 60 16 C 76 16, 84 48, 104 48" fill="none" stroke="#06b6d4" strokeWidth="1.8" />
        </svg>
      );
    case 'constellation':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <line x1="30" y1="32" x2="90" y2="32" stroke="#334155" strokeWidth="1" />
          <line x1="60" y1="8" x2="60" y2="56" stroke="#334155" strokeWidth="1" />
          {[42, 54, 66, 78].flatMap((x) =>
            [16, 26, 38, 48].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#22d3ee" />)
          )}
        </svg>
      );
    case 'polezero':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <circle cx="60" cy="32" r="22" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
          <line x1="66" y1="20" x2="72" y2="26" stroke="#fb7185" strokeWidth="1.8" />
          <line x1="66" y1="26" x2="72" y2="20" stroke="#fb7185" strokeWidth="1.8" />
          <circle cx="38" cy="32" r="3.5" fill="none" stroke="#22d3ee" strokeWidth="1.8" />
        </svg>
      );
    case 'opamp':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 16 14 L 40 14 L 100 50" fill="none" stroke="#475569" strokeWidth="1.6" />
          <path d="M 16 28 L 62 28 L 100 50" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <circle cx="62" cy="28" r="2.5" fill="#10b981" />
        </svg>
      );
    case 'timing':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 16 24 H 34 V 12 H 52 V 24 H 70 V 12 H 88 V 24 H 104" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M 16 48 H 40 V 36 H 76 V 48 H 104" fill="none" stroke="#10b981" strokeWidth="1.8" />
          <rect x="31" y="10" width="6" height="42" fill="rgba(244,63,94,0.22)" />
        </svg>
      );
    case 'vtc':
      return (
        <svg viewBox="0 0 120 64" className="w-full h-16">
          <path d="M 18 14 L 48 14 Q 60 14 60 32 Q 60 50 72 50 L 102 50" fill="none" stroke="#06b6d4" strokeWidth="2" />
          <line x1="20" y1="52" x2="100" y2="12" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="60" cy="32" r="2.5" fill="#10b981" />
        </svg>
      );
  }
}

export default function LabDirectory({ activeCategory, onSelectLab, onSelectCategory }: LabDirectoryProps) {
  const filtered =
    activeCategory === 'all' ? LABS_CATALOG : LABS_CATALOG.filter((l) => l.category === activeCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-50 text-balance">
            Digital &amp; Electronics Engineering Instruments
          </h2>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
            Ten interactive, deterministic client-side simulation laboratories spanning RF impedance matching, semiconductor physics, signal integrity, DSP filters, and digital logic.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'All (10)' },
              { id: 'rf_signals', label: 'RF & Signals' },
              { id: 'analog_devices', label: 'Analog & Devices' },
              { id: 'digital_logic', label: 'Digital & Logic' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                activeCategory === cat.id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((lab) => (
          <button
            key={lab.id}
            onClick={() => onSelectLab(lab.id)}
            className="text-left bg-[#0B0F1A] hover:bg-[#0F1524] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 transition-colors flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>
                  {lab.index} · {lab.domainLabel}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition-colors" />
              </div>

              <div className="bg-[#060911] border border-slate-800/80 rounded-lg p-2">
                <MiniSchematic id={lab.id} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-100 group-hover:text-cyan-200 transition-colors">
                  {lab.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{lab.summary}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
