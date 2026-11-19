import React, { useState } from 'react';
import { LABS_CATALOG } from './data/labsCatalog';
import { LabCategory, LabId } from './types';
import LabDirectory from './components/LabDirectory';
import SmithChartLab from './components/labs/SmithChartLab';
import KarnaughMapLab from './components/labs/KarnaughMapLab';
import TransistorLoadLineLab from './components/labs/TransistorLoadLineLab';
import DiodeMosfetIVLab from './components/labs/DiodeMosfetIVLab';
import EyeDiagramLab from './components/labs/EyeDiagramLab';
import ConstellationLab from './components/labs/ConstellationLab';
import PoleZeroFilterLab from './components/labs/PoleZeroFilterLab';
import OpAmpResponseLab from './components/labs/OpAmpResponseLab';
import DigitalTimingLab from './components/labs/DigitalTimingLab';
import VtcCurveLab from './components/labs/VtcCurveLab';

export default function App() {
  const [activeLab, setActiveLab] = useState<LabId>('smith');
  const [viewMode, setViewMode] = useState<'bench' | 'directory'>('bench');
  const [activeCategory, setActiveCategory] = useState<LabCategory>('all');

  const visibleLabs =
    activeCategory === 'all' ? LABS_CATALOG : LABS_CATALOG.filter((l) => l.category === activeCategory);

  const handleCategoryNav = (cat: LabCategory) => {
    setActiveCategory(cat);
    if (cat !== 'all') {
      const firstMatch = LABS_CATALOG.find((l) => l.category === cat);
      if (firstMatch && !LABS_CATALOG.some((l) => l.id === activeLab && l.category === cat)) {
        setActiveLab(firstMatch.id);
      }
    }
  };

  const handleSelectLab = (id: LabId) => {
    setActiveLab(id);
    setViewMode('bench');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="border-b border-slate-800/90 bg-[#07090E]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#bench"
            onClick={(e) => {
              e.preventDefault();
              setViewMode('bench');
            }}
            className="text-base md:text-lg font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            CircuitBench Lab
          </a>

          <nav aria-label="Engineering domains" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            {(
              [
                { id: 'all', label: 'All Labs' },
                { id: 'rf_signals', label: 'RF & Signals' },
                { id: 'analog_devices', label: 'Analog & Devices' },
                { id: 'digital_logic', label: 'Digital & Logic' },
              ] as { id: LabCategory; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => handleCategoryNav(item.id)}
                className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:text-slate-100 ${
                  activeCategory === item.id ? 'text-cyan-300 underline underline-offset-8' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="shrink-0">
            <button
              onClick={() => setViewMode(viewMode === 'directory' ? 'bench' : 'directory')}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {viewMode === 'directory' ? 'Active Bench' : 'All 10 Labs'}
            </button>
          </div>
        </div>
      </header>

      {/* Instrument Selector Strip */}
      <div className="border-b border-slate-800/80 bg-[#0B0F1A]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {visibleLabs.map((lab) => {
            const isActive = viewMode === 'bench' && activeLab === lab.id;
            return (
              <button
                key={lab.id}
                onClick={() => handleSelectLab(lab.id)}
                data-testid={`nav-lab-${lab.id}`}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">{lab.index}</span>
                <span>{lab.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Lab Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        {viewMode === 'directory' ? (
          <LabDirectory
            activeCategory={activeCategory}
            onSelectLab={handleSelectLab}
            onSelectCategory={handleCategoryNav}
          />
        ) : (
          <>
            {activeLab === 'smith' && <SmithChartLab />}
            {activeLab === 'kmap' && <KarnaughMapLab />}
            {activeLab === 'loadline' && <TransistorLoadLineLab />}
            {activeLab === 'ivcurves' && <DiodeMosfetIVLab />}
            {activeLab === 'eyediagram' && <EyeDiagramLab />}
            {activeLab === 'constellation' && <ConstellationLab />}
            {activeLab === 'polezero' && <PoleZeroFilterLab />}
            {activeLab === 'opamp' && <OpAmpResponseLab />}
            {activeLab === 'timing' && <DigitalTimingLab />}
            {activeLab === 'vtc' && <VtcCurveLab />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-[#07090E] py-4 px-6 text-center text-xs text-slate-500">
        CircuitBench Lab · 10 Client-Side Digital &amp; Electronics Engineering Simulators
      </footer>
    </div>
  );
}
