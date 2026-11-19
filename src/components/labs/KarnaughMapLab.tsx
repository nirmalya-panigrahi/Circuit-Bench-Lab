import React, { useState, useMemo, useEffect } from 'react';
import {
  KMapCellValue,
  KMapVarCount,
  getKMapLayout,
  parseIndexList,
  solveKarnaughMap,
} from '../../utils/kmapSolver';
import { LabHeaderBar, MetricReadout, StatusIndicator } from '../shared/LabPrimitives';
import { RotateCcw } from 'lucide-react';

const GROUP_COLORS = [
  { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.14)', text: 'text-cyan-300', border: 'border-cyan-500/40' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.14)', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.14)', text: 'text-amber-300', border: 'border-amber-500/40' },
  { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.14)', text: 'text-pink-300', border: 'border-pink-500/40' },
  { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.14)', text: 'text-violet-300', border: 'border-violet-500/40' },
  { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.14)', text: 'text-sky-300', border: 'border-sky-500/40' },
];

const INITIAL_4VAR: KMapCellValue[] = [
  1, 1, 0, 0,
  1, 1, 0, 1,
  0, 0, 1, 1,
  0, 0, 1, 1,
];

export default function KarnaughMapLab() {
  const [numVars, setNumVars] = useState<KMapVarCount>(4);
  const [cells, setCells] = useState<KMapCellValue[]>(INITIAL_4VAR);
  const [clickMode, setClickMode] = useState<'cycle' | 'toggle1' | 'dontcare'>('cycle');
  const [activeForm, setActiveForm] = useState<'sop' | 'pos'>('sop');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  const layout = useMemo(() => getKMapLayout(numVars), [numVars]);
  const solution = useMemo(() => solveKarnaughMap(cells, numVars), [cells, numVars]);

  const [mintermInput, setMintermInput] = useState<string>(solution.minterms.join(', '));
  const [maxtermInput, setMaxtermInput] = useState<string>(solution.maxterms.join(', '));
  const [dontCareInput, setDontCareInput] = useState<string>(solution.dontCares.join(', '));

  useEffect(() => {
    setMintermInput(solution.minterms.join(', '));
    setMaxtermInput(solution.maxterms.join(', '));
    setDontCareInput(solution.dontCares.join(', '));
  }, [solution.minterms, solution.maxterms, solution.dontCares]);

  const handleChangeVars = (nextVars: KMapVarCount) => {
    const count = 1 << nextVars;
    setNumVars(nextVars);
    setActiveGroupId(null);
    setHoveredCell(null);
    if (nextVars === 4) {
      setCells(INITIAL_4VAR);
    } else if (nextVars === 3) {
      setCells([0, 1, 1, 0, 1, 1, 0, 1]);
    } else if (nextVars === 5) {
      const arr: KMapCellValue[] = Array(count).fill(0);
      [0, 1, 4, 5, 16, 17, 20, 21, 10, 11, 14, 15].forEach((m) => (arr[m] = 1));
      arr[26] = 'X';
      arr[27] = 'X';
      setCells(arr);
    } else if (nextVars === 6) {
      const arr: KMapCellValue[] = Array(count).fill(0);
      [0, 1, 4, 5, 16, 17, 20, 21, 32, 33, 36, 37, 48, 49, 52, 53].forEach((m) => (arr[m] = 1));
      arr[62] = 'X';
      arr[63] = 'X';
      setCells(arr);
    } else {
      setCells(Array.from({ length: count }, (_, i) => (i === 1 || i === 3 ? 1 : 0)));
    }
  };

  const handleCellClick = (minterm: number) => {
    setCells((prev) => {
      const next = [...prev];
      const cur = next[minterm] ?? 0;
      if (clickMode === 'cycle') {
        next[minterm] = cur === 0 ? 1 : cur === 1 ? 'X' : 0;
      } else if (clickMode === 'toggle1') {
        next[minterm] = cur === 1 ? 0 : 1;
      } else {
        next[minterm] = cur === 'X' ? 0 : 'X';
      }
      return next;
    });
  };

  const applyMintermList = (raw: string) => {
    const total = 1 << numVars;
    const ones = new Set(parseIndexList(raw, total));
    setCells((prev) =>
      Array.from({ length: total }, (_, m) => {
        if (ones.has(m)) return 1;
        return prev[m] === 'X' ? 'X' : 0;
      })
    );
  };

  const applyMaxtermList = (raw: string) => {
    const total = 1 << numVars;
    const zeros = new Set(parseIndexList(raw, total));
    setCells((prev) =>
      Array.from({ length: total }, (_, m) => {
        if (zeros.has(m)) return 0;
        return prev[m] === 'X' ? 'X' : 1;
      })
    );
  };

  const applyDontCareList = (raw: string) => {
    const total = 1 << numVars;
    const xs = new Set(parseIndexList(raw, total));
    setCells((prev) =>
      Array.from({ length: total }, (_, m) => {
        if (xs.has(m)) return 'X';
        return prev[m] === 1 ? 1 : 0;
      })
    );
  };

  const loadPreset = (preset: 'xor' | 'mux' | 'wrap' | 'clear') => {
    const len = 1 << numVars;
    if (preset === 'clear') {
      setCells(Array(len).fill(0));
      return;
    }
    if (preset === 'xor') {
      setCells(
        Array.from({ length: len }, (_, m) => {
          const ones = m.toString(2).split('').filter((b) => b === '1').length;
          return ones % 2 === 1 ? 1 : 0;
        })
      );
      return;
    }
    if (preset === 'wrap') {
      const arr: KMapCellValue[] = Array(len).fill(0);
      if (numVars >= 4) {
        [0, 2, 8, 10, 5, 7, 13, 15].forEach((m) => (arr[m] = 1));
      } else if (numVars === 3) {
        [0, 2, 4, 6].forEach((m) => (arr[m] = 1));
      } else {
        [0, 2].forEach((m) => (arr[m] = 1));
      }
      setCells(arr);
      return;
    }
    setCells(
      Array.from({ length: len }, (_, m) => {
        const ones = m.toString(2).split('').filter((b) => b === '1').length;
        return ones >= Math.ceil(numVars / 2) ? 1 : 0;
      })
    );
  };

  const activeGroups = activeForm === 'sop' ? solution.groups : solution.posGroups;
  const cellSizePx = numVars === 2 ? 92 : numVars === 3 ? 74 : numVars >= 5 ? 52 : 66;
  const gridWidth = layout.cols * cellSizePx;
  const gridHeight = layout.rows * cellSizePx;

  const hoveredInfo = useMemo(() => {
    if (hoveredCell === null) return null;
    const bits = hoveredCell.toString(2).padStart(numVars, '0');
    const assignment = layout.variables.map((v, i) => `${v}=${bits[i]}`).join(' ');
    const val = cells[hoveredCell] ?? 0;
    const covering = activeGroups.filter((g) => g.minterms.includes(hoveredCell)).map((g) => g.term);
    return { m: hoveredCell, bits, assignment, val, covering };
  }, [hoveredCell, numVars, layout.variables, cells, activeGroups]);

  return (
    <div className="space-y-6">
      <LabHeaderBar
        index="02"
        title="Karnaugh Map (K-Map) Simplifier"
        domain="Combinational Boolean Logic"
        description="Click grid cells, enter minterm/maxterm/don't-care index lists, or switch between 2 and 6 variables to compute minimal Sum-of-Products (SOP) and Product-of-Sums (POS) Boolean expressions."
        status={
          <StatusIndicator
            tone={solution.groups.length > 0 || solution.posGroups.length > 0 ? 'nominal' : 'warning'}
            label={
              solution.expression === '0'
                ? 'Constant Low (F = 0)'
                : solution.expression === '1'
                ? 'Tautology (F = 1)'
                : `${activeGroups.length} ${activeForm.toUpperCase()} Implicant${activeGroups.length === 1 ? '' : 's'}`
            }
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex p-1 bg-[#0B0F1A] border border-slate-800 rounded-lg" role="group" aria-label="Variable count">
              {([2, 3, 4, 5, 6] as KMapVarCount[]).map((v) => (
                <button
                  key={v}
                  onClick={() => handleChangeVars(v)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    numVars === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {v} Vars
                </button>
              ))}
            </div>
            <button
              onClick={() => loadPreset('clear')}
              className="px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        }
      />

      {/* Minimized SOP & POS Output Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-center">
          <div className="text-[11px] font-medium text-slate-400">Minimal Sum-of-Products (SOP)</div>
          <div
            data-testid="kmap-expression"
            className="mt-1 text-base md:text-lg font-mono font-semibold text-cyan-300 break-words"
          >
            F({layout.variables.join(', ')}) = {solution.expression}
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-500">
            {solution.groups.length} terms · {solution.literalCount} literals
          </div>
        </div>

        <div className="md:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-center">
          <div className="text-[11px] font-medium text-slate-400">Minimal Product-of-Sums (POS)</div>
          <div
            data-testid="kmap-pos-expression"
            className="mt-1 text-base md:text-lg font-mono font-semibold text-emerald-300 break-words"
          >
            F({layout.variables.join(', ')}) = {solution.posExpression}
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-500">
            {solution.posGroups.length} maxterm loops · {solution.posLiteralCount} literals
          </div>
        </div>

        <div className="md:col-span-2">
          <MetricReadout
            label="Active Terms"
            value={`${solution.minterms.length} / ${1 << numVars}`}
            subtext={`0s: ${solution.maxterms.length} · X: ${solution.dontCares.length}`}
            tone="cyan"
          />
        </div>
      </div>

      {/* Direct Minterm / Maxterm / Don't-Care Index Inputs */}
      <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor="kmap-minterms-input" className="text-xs font-medium text-cyan-300 block">
            Minterms Σm (1s, 0–{(1 << numVars) - 1})
          </label>
          <input
            id="kmap-minterms-input"
            type="text"
            value={mintermInput}
            onChange={(e) => setMintermInput(e.target.value)}
            onBlur={() => applyMintermList(mintermInput)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyMintermList(mintermInput);
            }}
            placeholder="e.g. 0, 1, 4, 5"
            className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="kmap-maxterms-input" className="text-xs font-medium text-emerald-300 block">
            Maxterms ΠM (0s, 0–{(1 << numVars) - 1})
          </label>
          <input
            id="kmap-maxterms-input"
            type="text"
            value={maxtermInput}
            onChange={(e) => setMaxtermInput(e.target.value)}
            onBlur={() => applyMaxtermList(maxtermInput)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyMaxtermList(maxtermInput);
            }}
            placeholder="e.g. 2, 3, 6, 7"
            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="kmap-dontcare-input" className="text-xs font-medium text-amber-300 block">
            Don’t-Cares d (Xs, 0–{(1 << numVars) - 1})
          </label>
          <input
            id="kmap-dontcare-input"
            type="text"
            value={dontCareInput}
            onChange={(e) => setDontCareInput(e.target.value)}
            onBlur={() => applyDontCareList(dontCareInput)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyDontCareList(dontCareInput);
            }}
            placeholder="e.g. 10, 11"
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive K-Map Grid */}
        <div className="lg:col-span-7 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-4 relative">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                onClick={() => setClickMode('cycle')}
                className={`px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                  clickMode === 'cycle' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400'
                }`}
              >
                Cycle (0 → 1 → X)
              </button>
              <button
                onClick={() => setClickMode('toggle1')}
                className={`px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                  clickMode === 'toggle1' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400'
                }`}
              >
                Toggle 0 / 1
              </button>
              <button
                onClick={() => setClickMode('dontcare')}
                className={`px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                  clickMode === 'dontcare' ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-400'
                }`}
              >
                Mark X
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-lg">
                <button
                  onClick={() => {
                    setActiveForm('sop');
                    setActiveGroupId(null);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                    activeForm === 'sop' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  SOP Loops
                </button>
                <button
                  onClick={() => {
                    setActiveForm('pos');
                    setActiveGroupId(null);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                    activeForm === 'pos' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  POS Loops
                </button>
              </div>
              <button
                onClick={() => loadPreset('wrap')}
                className="px-2.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
              >
                Wrap Quad
              </button>
              <button
                onClick={() => loadPreset('xor')}
                className="px-2.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
              >
                Parity
              </button>
            </div>
          </div>

          {/* K-Map Canvas(es) with Toroidal Loop Overlays */}
          <div className={`grid gap-5 justify-items-center py-2 ${layout.planes > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {Array.from({ length: layout.planes }).map((_, planeIdx) => (
              <div key={planeIdx} className="inline-block select-none">
                {layout.planeLabels[planeIdx] && (
                  <div className="text-center text-xs font-mono font-semibold text-cyan-300 mb-2">
                    Sub-Map {layout.planeLabels[planeIdx]}
                  </div>
                )}
                <div className="flex items-end mb-1.5 pl-14">
                  <div className="text-[11px] font-mono text-slate-400 mr-2 mb-0.5">{layout.colVarLabel}</div>
                  <div className="flex" style={{ width: gridWidth }}>
                    {layout.colLabels.map((lbl) => (
                      <div
                        key={lbl}
                        style={{ width: cellSizePx }}
                        className="text-center text-xs font-mono font-semibold text-slate-300"
                      >
                        {lbl}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="flex flex-col items-end pr-2.5 w-14">
                    <span className="text-[10px] font-mono text-slate-500 mb-1">{layout.rowVarLabel}</span>
                    {layout.rowLabels.map((lbl) => (
                      <div
                        key={lbl}
                        style={{ height: cellSizePx }}
                        className="flex items-center justify-end text-xs font-mono font-semibold text-slate-300"
                      >
                        {lbl}
                      </div>
                    ))}
                  </div>

                  {/* Grid + SVG grouping overlay */}
                  <div
                    className="relative bg-slate-950 border border-slate-700 rounded-lg overflow-hidden"
                    style={{ width: gridWidth, height: gridHeight }}
                  >
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${layout.cols}, ${cellSizePx}px)`,
                        gridTemplateRows: `repeat(${layout.rows}, ${cellSizePx}px)`,
                      }}
                    >
                      {Array.from({ length: layout.rows }).map((_, r) =>
                        Array.from({ length: layout.cols }).map((__, c) => {
                          const m = layout.cellToMinterm(r, c, planeIdx);
                          const val = cells[m] ?? 0;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleCellClick(m)}
                              onMouseEnter={() => setHoveredCell(m)}
                              onMouseLeave={() => setHoveredCell(null)}
                              data-testid={`kmap-cell-${m}`}
                              className={`relative border border-slate-800/80 flex items-center justify-center font-mono font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                                numVars >= 5 ? 'text-base' : 'text-xl'
                              } ${
                                val === 1
                                  ? 'text-slate-50 bg-slate-900/60'
                                  : val === 'X'
                                  ? 'text-amber-300 bg-amber-500/5'
                                  : 'text-slate-500 hover:bg-slate-900/40'
                              }`}
                            >
                              <span>{val}</span>
                              <span className="absolute bottom-0.5 right-1 text-[9px] font-normal text-slate-500 tabular-nums">
                                m{m}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* SVG Prime Implicant Group Loops for this plane */}
                    <svg
                      width={gridWidth}
                      height={gridHeight}
                      className="absolute inset-0 pointer-events-none"
                      viewBox={`0 0 ${gridWidth} ${gridHeight}`}
                    >
                      {activeGroups.map((grp, gIdx) => {
                        const color = GROUP_COLORS[grp.colorIndex];
                        const isDimmed = activeGroupId !== null && activeGroupId !== grp.id;
                        const inset = 4 + (gIdx % 4) * 3;
                        const planeRects = grp.rects.filter((rect) => rect.plane === planeIdx);
                        return (
                          <g key={grp.id} opacity={isDimmed ? 0.2 : 1}>
                            {planeRects.map((rect, rIdx) => {
                              const x = rect.colStart * cellSizePx + inset;
                              const y = rect.rowStart * cellSizePx + inset;
                              const w = (rect.colEnd - rect.colStart + 1) * cellSizePx - inset * 2;
                              const h = (rect.rowEnd - rect.rowStart + 1) * cellSizePx - inset * 2;
                              return (
                                <rect
                                  key={rIdx}
                                  x={x}
                                  y={y}
                                  width={Math.max(10, w)}
                                  height={Math.max(10, h)}
                                  rx={8}
                                  fill={color.fill}
                                  stroke={color.stroke}
                                  strokeWidth={2}
                                  strokeDasharray={rect.wrapsRow || rect.wrapsCol ? '5 3' : undefined}
                                />
                              );
                            })}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cell Probe Tooltip Bar */}
          {hoveredInfo && (
            <div
              role="status"
              data-testid="kmap-tooltip"
              className="bg-slate-950/95 border border-slate-700 rounded-lg px-3 py-2 text-[11px] font-mono tabular-nums flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-cyan-300 font-semibold">
                m{hoveredInfo.m} ({hoveredInfo.assignment}) = {hoveredInfo.val}
              </span>
              <span className="text-slate-400">
                {hoveredInfo.covering.length > 0
                  ? `Covered by: ${hoveredInfo.covering.join(', ')}`
                  : `Uncovered in ${activeForm.toUpperCase()} view`}
              </span>
            </div>
          )}

          {/* Detected Optimal Groups */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-xs font-medium text-slate-300">
              Optimal {activeForm.toUpperCase()} Power-of-Two Groupings
            </div>
            {activeGroups.length === 0 ? (
              <p className="text-xs text-slate-500">
                No {activeForm === 'sop' ? 'minterms (1s)' : 'maxterms (0s)'} active.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeGroups.map((grp) => {
                  const color = GROUP_COLORS[grp.colorIndex];
                  const isActive = activeGroupId === grp.id;
                  return (
                    <button
                      key={grp.id}
                      onMouseEnter={() => setActiveGroupId(grp.id)}
                      onMouseLeave={() => setActiveGroupId(null)}
                      onClick={() => setActiveGroupId(isActive ? null : grp.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${color.border} ${
                        isActive ? 'bg-slate-800' : 'bg-slate-950'
                      }`}
                    >
                      <span className={`font-semibold ${color.text}`}>{grp.term}</span>
                      <span className="text-slate-400 ml-2">
                        ({grp.size}-cell)
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Synchronized Truth Table */}
        <div className="lg:col-span-5 bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Synchronized Truth Table</h3>
              <p className="text-xs text-slate-400">Click any output row to cycle 0 / 1 / X</p>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">{1 << numVars} rows</span>
          </div>

          <div className="max-h-[440px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs font-mono tabular-nums border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-left">
                  <th className="py-2 px-1.5">m</th>
                  {layout.variables.map((v) => (
                    <th key={v} className="py-2 px-1.5">
                      {v}
                    </th>
                  ))}
                  <th className="py-2 px-1.5 text-right">F</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 1 << numVars }).map((_, m) => {
                  const bits = m.toString(2).padStart(numVars, '0').split('');
                  const val = cells[m] ?? 0;
                  return (
                    <tr
                      key={m}
                      onMouseEnter={() => setHoveredCell(m)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className="border-b border-slate-900 hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="py-1 px-1.5 text-slate-500">{m}</td>
                      {bits.map((b, bi) => (
                        <td key={bi} className="py-1 px-1.5 text-slate-300">
                          {b}
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-right">
                        <button
                          onClick={() => handleCellClick(m)}
                          className={`min-w-[40px] py-0.5 px-2 rounded font-semibold cursor-pointer border transition-colors ${
                            val === 1
                              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                              : val === 'X'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {val}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
