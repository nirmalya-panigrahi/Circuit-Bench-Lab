import React from 'react';
import { Complex, MatchComponent } from '../types';
import { getNormalizedValue, findLMatchSuggestions, findSingleStubMatch } from '../utils/mathUtils';
import { ParamSlider } from './shared/LabPrimitives';
import { Trash2, Sliders, RefreshCw } from 'lucide-react';

interface MatchingNetworkBuilderProps {
  zLoad: Complex;
  components: MatchComponent[];
  onUpdateComponents: (comps: MatchComponent[]) => void;
  freq: number;
  z0: number;
}

export default function MatchingNetworkBuilder({
  zLoad,
  components,
  onUpdateComponents,
  freq,
  z0,
}: MatchingNetworkBuilderProps) {
  const handleAddComponent = (type: MatchComponent['type']) => {
    let defaultValue = 10.0;
    if (type.endsWith('l')) {
      defaultValue = 10.0;
    } else if (type.endsWith('c')) {
      defaultValue = 5.0;
    } else if (type.endsWith('r')) {
      defaultValue = 50.0;
    } else if (type === 'tline_series') {
      defaultValue = 0.125;
    }
    const normVal = getNormalizedValue(type, defaultValue, freq, z0);

    const newComp: MatchComponent = {
      id: Math.random().toString(36).slice(2, 11),
      type,
      value: defaultValue,
      normalizedVal: normVal,
    };

    onUpdateComponents([...components, newComp]);
  };

  const handleRemoveComponent = (id: string) => {
    onUpdateComponents(components.filter((c) => c.id !== id));
  };

  const handleValueChange = (id: string, newVal: number) => {
    const updated = components.map((c) => {
      if (c.id === id) {
        const norm = getNormalizedValue(c.type, newVal, freq, z0);
        const precision = c.type === 'tline_series' ? 3 : 2;
        return { ...c, value: Number(newVal.toFixed(precision)), normalizedVal: norm };
      }
      return c;
    });
    onUpdateComponents(updated);
  };

  const handleClearAll = () => {
    onUpdateComponents([]);
  };

  const zLoadActual = { re: zLoad.re * z0, im: zLoad.im * z0 };
  const suggestions = findLMatchSuggestions(zLoadActual, freq, z0);
  const stubSolutions = findSingleStubMatch(zLoadActual, z0);

  const applySuggestion = (steps: { type: MatchComponent['type']; value: number }[]) => {
    const newComps: MatchComponent[] = steps.map((step) => {
      const norm = getNormalizedValue(step.type, step.value, freq, z0);
      return {
        id: Math.random().toString(36).slice(2, 11),
        type: step.type,
        value: step.value,
        normalizedVal: norm,
      };
    });
    onUpdateComponents(newComps);
  };

  const applyStubMatch = (dLambda: number, lLambda: number, isShorted: boolean) => {
    const omega = 2 * Math.PI * freq;
    const tanVal = Math.tan(2 * Math.PI * lLambda);
    const bs = isShorted
      ? Math.abs(tanVal) < 1e-4
        ? -1 / (z0 * 1e-4)
        : -1 / (z0 * tanVal)
      : tanVal / z0;
    const shuntStep: { type: MatchComponent['type']; value: number } =
      bs >= 0
        ? { type: 'shunt_c', value: Number(Math.max(0.1, (bs / omega) * 1e12).toFixed(2)) }
        : { type: 'shunt_l', value: Number(Math.max(0.1, (-1 / (bs * omega)) * 1e9).toFixed(2)) };

    applySuggestion([
      { type: 'tline_series', value: Number(dLambda.toFixed(3)) },
      shuntStep,
    ]);
  };

  return (
    <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 flex flex-col h-full space-y-5">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Matching Network Builder
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cascade series or shunt inductors, capacitors, resistors, and transmission lines
          </p>
        </div>
        {components.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Clear All
          </button>
        )}
      </div>

      {/* Component Add Buttons */}
      <div className="space-y-3">
        <div>
          <span className="text-xs font-medium text-indigo-300 block mb-1.5">Series Elements</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAddComponent('series_l')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-indigo-500/50 cursor-pointer"
            >
              <span>Series L</span>
              <span className="text-[11px] text-slate-400 font-mono">+jX (nH)</span>
            </button>
            <button
              onClick={() => handleAddComponent('series_c')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-indigo-500/50 cursor-pointer"
            >
              <span>Series C</span>
              <span className="text-[11px] text-slate-400 font-mono">-jX (pF)</span>
            </button>
            <button
              onClick={() => handleAddComponent('series_r')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-indigo-500/50 cursor-pointer"
            >
              <span>Series R</span>
              <span className="text-[11px] text-slate-400 font-mono">+R (Ω)</span>
            </button>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-amber-300 block mb-1.5">Shunt Elements &amp; Transmission Line</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleAddComponent('shunt_l')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-amber-500/50 cursor-pointer"
            >
              <span>Shunt L</span>
              <span className="text-[11px] text-slate-400 font-mono">-jB (nH)</span>
            </button>
            <button
              onClick={() => handleAddComponent('shunt_c')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-amber-500/50 cursor-pointer"
            >
              <span>Shunt C</span>
              <span className="text-[11px] text-slate-400 font-mono">+jB (pF)</span>
            </button>
            <button
              onClick={() => handleAddComponent('shunt_r')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-amber-500/50 cursor-pointer"
            >
              <span>Shunt R</span>
              <span className="text-[11px] text-slate-400 font-mono">+G (Ω)</span>
            </button>
            <button
              onClick={() => handleAddComponent('tline_series')}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-cyan-300 font-medium py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors border border-slate-800 hover:border-cyan-500/50 cursor-pointer"
            >
              <span>Trans. Line</span>
              <span className="text-[11px] text-slate-400 font-mono">Length (λ)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Matching Network Stack */}
      <div className="flex-1 overflow-y-auto min-h-[180px] max-h-[320px] pr-1 space-y-2.5 scrollbar-thin">
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-8 border border-dashed border-slate-800 rounded-lg bg-slate-950/40">
            <p className="text-sm font-medium text-slate-300">No stages in network</p>
            <p className="text-xs max-w-[240px] mt-1 text-slate-500">
              Add lumped elements or a transmission line above, or apply an analytic L-match or stub solution below.
            </p>
          </div>
        ) : (
          components.map((comp, idx) => {
            const isSeries = comp.type.startsWith('series');
            const isTline = comp.type === 'tline_series';
            let label = '';
            let unit = 'nH';
            let minVal = 0.1;
            let maxVal = 150.0;
            let stepVal = 0.1;
            let valType = '';

            if (isTline) {
              label = 'Transmission Line Section';
              unit = 'λ';
              minVal = 0.0;
              maxVal = 0.5;
              stepVal = 0.005;
              valType = 'Electrical Angle';
            } else if (comp.type.endsWith('l')) {
              label = isSeries ? 'Series Inductor' : 'Shunt Inductor';
              unit = 'nH';
              minVal = 0.1;
              maxVal = 150.0;
              valType = isSeries ? 'Reactance' : 'Susceptance';
            } else if (comp.type.endsWith('c')) {
              label = isSeries ? 'Series Capacitor' : 'Shunt Capacitor';
              unit = 'pF';
              minVal = 0.1;
              maxVal = 100.0;
              valType = isSeries ? 'Reactance' : 'Susceptance';
            } else if (comp.type.endsWith('r')) {
              label = isSeries ? 'Series Resistor' : 'Shunt Resistor';
              unit = 'Ω';
              minVal = 1.0;
              maxVal = 500.0;
              stepVal = 1.0;
              valType = isSeries ? 'Resistance' : 'Conductance';
            }

            const topologyTag = isTline ? 'Cascade Line' : isSeries ? 'Series' : 'Shunt';
            const topologyColor = isTline ? 'text-cyan-300' : isSeries ? 'text-indigo-300' : 'text-amber-300';

            return (
              <div
                key={comp.id}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>Stage {idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span className={topologyColor}>{topologyTag}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-100 mt-0.5">{label}</h4>
                  </div>
                  <button
                    onClick={() => handleRemoveComponent(comp.id)}
                    className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                    aria-label={`Remove ${label} stage ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <ParamSlider
                  id={`stage-val-${comp.id}`}
                  label={`Stage ${idx + 1} Value`}
                  value={comp.value}
                  min={minVal}
                  max={maxVal}
                  step={stepVal}
                  unit={unit}
                  displayValue={`${valType}: ${isTline ? `${comp.normalizedVal.toFixed(0)}°` : `${comp.normalizedVal > 0 ? '+' : ''}${comp.normalizedVal.toFixed(3)}`}`}
                  onChange={(val) => handleValueChange(comp.id, val)}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Analytic L-Match & Stub Solver */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-semibold text-slate-200">
          Analytic L-Match Solver (Target {z0} Ω)
        </h4>

        {suggestions.length === 0 ? (
          <p className="text-xs text-slate-400">
            No two-element L-match branch exists for the current load (check if already near {z0} Ω or purely reactive).
          </p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((sol, index) => {
              const stepStrings = sol.steps.map((s) => {
                const label =
                  s.type === 'series_l'
                    ? 'Series L'
                    : s.type === 'series_c'
                    ? 'Series C'
                    : s.type === 'shunt_l'
                    ? 'Shunt L'
                    : 'Shunt C';
                const unit = s.type.endsWith('l') ? 'nH' : 'pF';
                return `${label} (${s.value} ${unit})`;
              });

              return (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg bg-slate-900 border border-slate-800 gap-2"
                >
                  <div>
                    <div className="text-[11px] font-mono text-emerald-400">Branch {index + 1}</div>
                    <p className="text-xs font-medium text-slate-200">{stepStrings.join(' → ')}</p>
                  </div>
                  <button
                    onClick={() => applySuggestion(sol.steps)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Apply Match
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {stubSolutions.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-200">
              Single-Stub Shunt Tuning Values
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stubSolutions.slice(0, 2).map((st, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="text-[11px] font-mono">
                    <div className="text-cyan-300 font-semibold">{st.stubType}</div>
                    <div className="text-slate-300 tabular-nums">
                      d = {st.lineDistanceLambda.toFixed(3)}λ · l = {st.stubLengthLambda.toFixed(3)}λ
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      applyStubMatch(
                        st.lineDistanceLambda,
                        st.stubLengthLambda,
                        st.stubType === 'Shorted Shunt Stub'
                      )
                    }
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium px-2.5 py-1.5 rounded-md border border-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    Apply Stub
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
