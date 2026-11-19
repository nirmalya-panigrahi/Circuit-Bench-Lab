import React, { useState, useEffect } from 'react';
import { Complex, MatchComponent, SavedPoint, TutorialStep } from '../../types';
import { calculateMatchingPath, zToGamma, magnitude, calculateSWR, calculateReturnLoss } from '../../utils/mathUtils';
import SmithChartVisualizer from '../SmithChartVisualizer';
import MatchingNetworkBuilder from '../MatchingNetworkBuilder';
import TransmissionLineSim from '../TransmissionLineSim';
import EducationalPanel from '../EducationalPanel';
import SavedPointsPool from '../SavedPointsPool';
import UnitTestsPanel from '../UnitTestsPanel';
import { LabHeaderBar, MetricReadout, ParamSlider, StatusIndicator } from '../shared/LabPrimitives';
import { BookOpen, Compass, Layers, Sliders, Award } from 'lucide-react';

export default function SmithChartLab() {
  const [zLoad, setZLoad] = useState<Complex>({ re: 0.5, im: -1.0 });
  const [components, setComponents] = useState<MatchComponent[]>([]);
  const [freq, setFreq] = useState<number>(1.0e9);
  const [z0, setZ0] = useState<number>(50);
  const [showAdmittanceGrid, setShowAdmittanceGrid] = useState<boolean>(false);
  const [highlightRegion, setHighlightRegion] = useState<TutorialStep['highlightRegion']>('all');
  const [activeTab, setActiveTab] = useState<'match' | 'tline' | 'academy' | 'tests'>('match');
  const [vswrCircleVal, setVswrCircleVal] = useState<number | null>(null);

  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>(() => {
    try {
      const stored = localStorage.getItem('smith_chart_saved_points');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('smith_chart_saved_points', JSON.stringify(savedPoints));
    } catch {
      // ignore storage errors
    }
  }, [savedPoints]);

  const handleSavePoint = (name: string, z: Complex) => {
    const newPoint: SavedPoint = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      z,
      z0,
      timestamp: new Date().toISOString(),
    };
    setSavedPoints((prev) => [newPoint, ...prev]);
  };

  const handleDeletePoint = (id: string) => {
    setSavedPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const rLoadActual = Number((zLoad.re * z0).toFixed(1));
  const xLoadActual = Number((zLoad.im * z0).toFixed(1));

  const matchingStates = calculateMatchingPath(zLoad, components, freq, z0);
  const finalState = matchingStates[matchingStates.length - 1];
  const finalSwr = calculateSWR(finalState.gamma);
  const finalRl = calculateReturnLoss(finalState.gamma);
  const finalGammaMag = magnitude(finalState.gamma);

  useEffect(() => {
    if (vswrCircleVal !== null) {
      const gamma = zToGamma(zLoad);
      const mag = Math.sqrt(gamma.re * gamma.re + gamma.im * gamma.im);
      setVswrCircleVal(mag >= 0.999 ? 99.9 : (1 + mag) / (1 - mag));
    }
  }, [zLoad, z0, vswrCircleVal]);

  const matchTone = finalSwr <= 1.25 ? 'nominal' : finalSwr <= 2.5 ? 'warning' : 'critical';
  const matchLabel =
    finalSwr <= 1.25
      ? 'Matched (VSWR ≤ 1.25)'
      : finalSwr <= 2.5
      ? 'Moderate Mismatch'
      : 'High Reflection';

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="01"
        title="Smith Chart Impedance Lab"
        domain="RF & Transmission Lines"
        description="Click the reflection-coefficient plane or tune Z_L, then cascade inductors, capacitors, resistors, and transmission lines to trace trajectories toward the 50 Ω center match."
        status={<StatusIndicator tone={matchTone} label={matchLabel} />}
        actions={
          <button
            onClick={() => setShowAdmittanceGrid(!showAdmittanceGrid)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showAdmittanceGrid
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {showAdmittanceGrid ? 'Hide Y-Grid' : 'Show Y-Grid'}
          </button>
        }
      />

      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricReadout
          label="Final Impedance (Z_in)"
          value={`${(finalState.z.re * z0).toFixed(1)} ${finalState.z.im >= 0 ? '+' : '-'} j${Math.abs(finalState.z.im * z0).toFixed(1)}`}
          unit="Ω"
          tone="cyan"
        />
        <MetricReadout
          label="Reflection |Γ|"
          value={finalGammaMag.toFixed(3)}
          subtext={`∠ ${((Math.atan2(finalState.gamma.im, finalState.gamma.re) * 180) / Math.PI).toFixed(1)}°`}
        />
        <MetricReadout
          label="VSWR"
          value={finalSwr >= 50 ? '>50' : finalSwr.toFixed(2)}
          tone={finalSwr <= 1.5 ? 'emerald' : finalSwr <= 3 ? 'amber' : 'rose'}
        />
        <MetricReadout
          label="Return Loss (S11)"
          value={finalRl >= 90 ? '>90' : finalRl.toFixed(1)}
          unit="dB"
          tone={finalRl >= 15 ? 'emerald' : 'default'}
        />
      </div>

      {/* Main Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-5">
          <SmithChartVisualizer
            zLoad={zLoad}
            onSelectImpedance={setZLoad}
            matchingStates={matchingStates}
            components={components}
            highlightRegion={highlightRegion}
            showAdmittanceGrid={showAdmittanceGrid}
            freq={freq}
            z0={z0}
            vswrCircleVal={vswrCircleVal}
          />

          <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">Load &amp; Line Environment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ParamSlider
                label="Load Resistance (R_L)"
                value={rLoadActual}
                min={0.5}
                max={300}
                step={0.5}
                unit="Ω"
                minLabel="0.5 Ω"
                maxLabel="300 Ω"
                onChange={(val) => setZLoad({ re: Math.max(0.01, val / z0), im: zLoad.im })}
                accentClass="accent-rose-400"
              />
              <ParamSlider
                label="Load Reactance (X_L)"
                value={xLoadActual}
                min={-250}
                max={250}
                step={0.5}
                unit="Ω"
                displayValue={`${xLoadActual >= 0 ? '+' : ''}${xLoadActual}`}
                minLabel="-250 Ω (Cap)"
                maxLabel="+250 Ω (Ind)"
                onChange={(val) => setZLoad({ re: zLoad.re, im: val / z0 })}
                accentClass="accent-cyan-400"
              />
              <ParamSlider
                label="Char. Impedance (Z₀)"
                value={z0}
                min={10}
                max={150}
                step={1}
                unit="Ω"
                onChange={setZ0}
                accentClass="accent-slate-300"
              />
              <ParamSlider
                label="Frequency (f)"
                value={Number((freq / 1e9).toFixed(2))}
                min={0.1}
                max={5.0}
                step={0.1}
                unit="GHz"
                onChange={(val) => setFreq(val * 1e9)}
                accentClass="accent-slate-300"
              />
            </div>
          </div>

          <SavedPointsPool
            activeZ={zLoad}
            z0={z0}
            savedPoints={savedPoints}
            onSavePoint={handleSavePoint}
            onSelectPoint={setZLoad}
            onDeletePoint={handleDeletePoint}
          />
        </div>

        <div className="lg:col-span-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-[#0B0F1A] border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('match');
                setHighlightRegion('all');
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'match' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Network Builder
            </button>
            <button
              onClick={() => {
                setActiveTab('tline');
                setHighlightRegion('all');
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'tline' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Line Rotation
            </button>
            <button
              onClick={() => {
                setActiveTab('academy');
                setHighlightRegion('all');
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'academy' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Guided Steps
            </button>
            <button
              onClick={() => {
                setActiveTab('tests');
                setHighlightRegion('all');
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'tests' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> Math Checks
            </button>
          </div>

          {activeTab === 'match' && (
            <MatchingNetworkBuilder
              zLoad={zLoad}
              components={components}
              onUpdateComponents={setComponents}
              freq={freq}
              z0={z0}
            />
          )}
          {activeTab === 'tline' && (
            <TransmissionLineSim
              zLoad={zLoad}
              z0={z0}
              freq={freq}
              onSetVswrCircle={setVswrCircleVal}
              vswrCircleVal={vswrCircleVal}
            />
          )}
          {activeTab === 'academy' && (
            <EducationalPanel
              onSetHighlight={setHighlightRegion}
              onSetLoadImpedance={setZLoad}
              onSetComponents={setComponents}
              currentHighlight={highlightRegion || 'all'}
            />
          )}
          {activeTab === 'tests' && <UnitTestsPanel />}
        </div>
      </div>
    </div>
  );
}
