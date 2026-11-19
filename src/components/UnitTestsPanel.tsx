import React from 'react';
import { runMathTests } from '../utils/smithTestsRunner';
import { CheckCircle2, XCircle, ShieldAlert, Award } from 'lucide-react';

export default function UnitTestsPanel() {
  const testResults = runMathTests();
  const allPassed = testResults.every((t) => t.passed);
  const passedCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="bg-[#0B0F1A] border border-slate-800 rounded-xl p-5 flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            Smith Chart Math Assertions
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Verifies Möbius transforms, lumped elements, and transmission line rotation</p>
        </div>
        <span className={`text-xs font-mono font-semibold ${allPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
          {allPassed ? `● ${passedCount}/${testResults.length} Passing` : '✖ Errors Detected'}
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
        {testResults.map((res, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg flex items-start gap-3 border ${
              res.passed
                ? 'bg-emerald-950/15 border-emerald-900/40'
                : 'bg-rose-950/15 border-rose-900/40'
            }`}
          >
            {res.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-slate-200">{res.name}</p>
              <div className="flex flex-wrap gap-3 font-mono text-[11px] text-slate-400 tabular-nums">
                <span>Expected: <strong className="text-slate-300">{res.expected}</strong></span>
                <span>Actual: <strong className="text-slate-300">{res.actual}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
        <span className="text-xs text-slate-400">Run full Vitest suite:</span>
        <code className="text-xs bg-slate-900 px-2.5 py-1 rounded text-cyan-300 font-mono border border-slate-800">
          npm test
        </code>
      </div>
    </div>
  );
}
