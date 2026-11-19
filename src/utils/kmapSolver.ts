export type KMapCellValue = 0 | 1 | 'X';
export type KMapVarCount = 2 | 3 | 4 | 5 | 6;

export interface GridRect {
  plane: number; // 0 for 2-4 vars; 0..1 for 5 vars; 0..3 for 6 vars
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  wrapsRow: boolean;
  wrapsCol: boolean;
}

export interface KMapGroup {
  id: string;
  term: string;
  minterms: number[];
  size: number;
  rects: GridRect[];
  colorIndex: number;
}

export interface KMapSolution {
  numVars: KMapVarCount;
  variables: string[];
  expression: string;     // SOP
  posExpression: string;  // POS
  minterms: number[];
  maxterms: number[];
  dontCares: number[];
  groups: KMapGroup[];
  posGroups: KMapGroup[];
  literalCount: number;
  posLiteralCount: number;
}

const GRAY_2 = [0, 1];
const GRAY_4 = [0, 1, 3, 2];

export function getKMapLayout(numVars: KMapVarCount): {
  planes: number;
  planeLabels: string[];
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  rowVarLabel: string;
  colVarLabel: string;
  variables: string[];
  cellToMinterm: (r: number, c: number, plane?: number) => number;
  mintermToCell: (m: number) => { plane: number; row: number; col: number };
} {
  if (numVars === 2) {
    return {
      planes: 1,
      planeLabels: [''],
      rows: 2,
      cols: 2,
      rowLabels: ['0', '1'],
      colLabels: ['0', '1'],
      rowVarLabel: 'A',
      colVarLabel: 'B',
      variables: ['A', 'B'],
      cellToMinterm: (r, c) => (GRAY_2[r] << 1) | GRAY_2[c],
      mintermToCell: (m) => ({ plane: 0, row: (m >> 1) & 1, col: m & 1 }),
    };
  }
  if (numVars === 3) {
    return {
      planes: 1,
      planeLabels: [''],
      rows: 2,
      cols: 4,
      rowLabels: ['0', '1'],
      colLabels: ['00', '01', '11', '10'],
      rowVarLabel: 'A',
      colVarLabel: 'BC',
      variables: ['A', 'B', 'C'],
      cellToMinterm: (r, c) => (GRAY_2[r] << 2) | GRAY_4[c],
      mintermToCell: (m) => ({
        plane: 0,
        row: (m >> 2) & 1,
        col: GRAY_4.indexOf(m & 3),
      }),
    };
  }
  if (numVars === 4) {
    return {
      planes: 1,
      planeLabels: [''],
      rows: 4,
      cols: 4,
      rowLabels: ['00', '01', '11', '10'],
      colLabels: ['00', '01', '11', '10'],
      rowVarLabel: 'AB',
      colVarLabel: 'CD',
      variables: ['A', 'B', 'C', 'D'],
      cellToMinterm: (r, c) => (GRAY_4[r] << 2) | GRAY_4[c],
      mintermToCell: (m) => ({
        plane: 0,
        row: GRAY_4.indexOf((m >> 2) & 3),
        col: GRAY_4.indexOf(m & 3),
      }),
    };
  }
  if (numVars === 5) {
    // 5-var: A selects plane (0,1); BC rows; DE cols
    return {
      planes: 2,
      planeLabels: ['A = 0', 'A = 1'],
      rows: 4,
      cols: 4,
      rowLabels: ['00', '01', '11', '10'],
      colLabels: ['00', '01', '11', '10'],
      rowVarLabel: 'BC',
      colVarLabel: 'DE',
      variables: ['A', 'B', 'C', 'D', 'E'],
      cellToMinterm: (r, c, plane = 0) => (plane << 4) | (GRAY_4[r] << 2) | GRAY_4[c],
      mintermToCell: (m) => ({
        plane: (m >> 4) & 1,
        row: GRAY_4.indexOf((m >> 2) & 3),
        col: GRAY_4.indexOf(m & 3),
      }),
    };
  }
  // 6-var: AB selects plane (00, 01, 11, 10); CD rows; EF cols
  return {
    planes: 4,
    planeLabels: ['AB = 00', 'AB = 01', 'AB = 11', 'AB = 10'],
    rows: 4,
    cols: 4,
    rowLabels: ['00', '01', '11', '10'],
    colLabels: ['00', '01', '11', '10'],
    rowVarLabel: 'CD',
    colVarLabel: 'EF',
    variables: ['A', 'B', 'C', 'D', 'E', 'F'],
    cellToMinterm: (r, c, plane = 0) => (GRAY_4[plane] << 4) | (GRAY_4[r] << 2) | GRAY_4[c],
    mintermToCell: (m) => ({
      plane: GRAY_4.indexOf((m >> 4) & 3),
      row: GRAY_4.indexOf((m >> 2) & 3),
      col: GRAY_4.indexOf(m & 3),
    }),
  };
}

interface Implicant {
  bits: string;
  minterms: number[];
}

function countOnes(s: string): number {
  let c = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '1') c++;
  return c;
}

function combineBits(a: string, b: string): string | null {
  let diff = 0;
  let out = '';
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (a[i] === '-' || b[i] === '-') return null;
      diff++;
      if (diff > 1) return null;
      out += '-';
    } else {
      out += a[i];
    }
  }
  return diff === 1 ? out : null;
}

function implicantToSopTerm(bits: string, variables: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') parts.push(variables[i]);
    else if (bits[i] === '0') parts.push(`${variables[i]}'`);
  }
  return parts.length === 0 ? '1' : parts.join('');
}

function implicantToPosTerm(bits: string, variables: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < bits.length; i++) {
    // POS complements the 0-covering implicant: bit='0' => X, bit='1' => X'
    if (bits[i] === '0') parts.push(variables[i]);
    else if (bits[i] === '1') parts.push(`${variables[i]}'`);
  }
  if (parts.length === 0) return '0';
  return parts.length === 1 ? parts[0] : `(${parts.join(' + ')})`;
}

function countLiterals(bits: string): number {
  let count = 0;
  for (const ch of bits) if (ch !== '-') count++;
  return count;
}

function computeGroupRects(minterms: number[], numVars: KMapVarCount): GridRect[] {
  const layout = getKMapLayout(numVars);
  const { rows, cols, mintermToCell } = layout;

  const byPlane = new Map<number, number[]>();
  for (const m of minterms) {
    const { plane } = mintermToCell(m);
    if (!byPlane.has(plane)) byPlane.set(plane, []);
    byPlane.get(plane)!.push(m);
  }

  const splitContiguous = (indices: number[], maxLen: number): { ranges: [number, number][]; wraps: boolean } => {
    if (indices.length === maxLen) return { ranges: [[0, maxLen - 1]], wraps: false };
    if (indices.length === 2 && maxLen === 4 && indices[0] === 0 && indices[1] === 3) {
      return { ranges: [[0, 0], [3, 3]], wraps: true };
    }
    return { ranges: [[indices[0], indices[indices.length - 1]]], wraps: false };
  };

  const rects: GridRect[] = [];
  for (const [plane, planeMinterms] of byPlane.entries()) {
    const rowSet = new Set<number>();
    const colSet = new Set<number>();
    for (const m of planeMinterms) {
      const { row, col } = mintermToCell(m);
      rowSet.add(row);
      colSet.add(col);
    }
    const rowList = Array.from(rowSet).sort((a, b) => a - b);
    const colList = Array.from(colSet).sort((a, b) => a - b);
    const rInfo = splitContiguous(rowList, rows);
    const cInfo = splitContiguous(colList, cols);

    for (const [rStart, rEnd] of rInfo.ranges) {
      for (const [cStart, cEnd] of cInfo.ranges) {
        rects.push({
          plane,
          rowStart: rStart,
          rowEnd: rEnd,
          colStart: cStart,
          colEnd: cEnd,
          wrapsRow: rInfo.wraps,
          wrapsCol: cInfo.wraps,
        });
      }
    }
  }
  return rects;
}

function solveCover(
  targetIndices: number[],
  dontCareIndices: number[],
  numVars: KMapVarCount,
  variables: string[],
  isPos: boolean
): { expression: string; groups: KMapGroup[]; literalCount: number } {
  const totalCells = 1 << numVars;

  if (targetIndices.length === 0) {
    return {
      expression: isPos ? '1' : '0',
      groups: [],
      literalCount: 0,
    };
  }

  if (targetIndices.length + dontCareIndices.length === totalCells) {
    const allM = Array.from({ length: totalCells }, (_, i) => i);
    return {
      expression: isPos ? '0' : '1',
      groups: [
        {
          id: `${isPos ? 'pos' : 'sop'}-all`,
          term: isPos ? '0' : '1',
          minterms: allM,
          size: totalCells,
          rects: computeGroupRects(allM, numVars),
          colorIndex: 0,
        },
      ],
      literalCount: 0,
    };
  }

  const targetSet = new Set(targetIndices);
  const allOn = [...targetIndices, ...dontCareIndices];
  let currentLevel: Implicant[] = allOn.map((m) => ({
    bits: m.toString(2).padStart(numVars, '0'),
    minterms: [m],
  }));

  const primeImplicants: Implicant[] = [];
  const seenPI = new Set<string>();

  while (currentLevel.length > 0) {
    const buckets = new Map<number, Implicant[]>();
    for (const imp of currentLevel) {
      const ones = countOnes(imp.bits);
      if (!buckets.has(ones)) buckets.set(ones, []);
      buckets.get(ones)!.push(imp);
    }

    const used = new Set<string>();
    const nextLevelMap = new Map<string, Implicant>();

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const k of sortedKeys) {
      const g1 = buckets.get(k) || [];
      const g2 = buckets.get(k + 1) || [];
      for (const a of g1) {
        for (const b of g2) {
          const combined = combineBits(a.bits, b.bits);
          if (combined) {
            used.add(a.bits);
            used.add(b.bits);
            if (!nextLevelMap.has(combined)) {
              const merged = Array.from(new Set([...a.minterms, ...b.minterms])).sort((x, y) => x - y);
              nextLevelMap.set(combined, { bits: combined, minterms: merged });
            }
          }
        }
      }
    }

    for (const imp of currentLevel) {
      if (!used.has(imp.bits) && !seenPI.has(imp.bits)) {
        if (imp.minterms.some((m) => targetSet.has(m))) {
          seenPI.add(imp.bits);
          primeImplicants.push(imp);
        }
      }
    }

    currentLevel = Array.from(nextLevelMap.values());
  }

  // Essential Prime Implicants
  const uncovered = new Set<number>(targetIndices);
  const selectedPIs: Implicant[] = [];

  for (const m of targetIndices) {
    const covering = primeImplicants.filter((pi) => pi.minterms.includes(m));
    if (covering.length === 1) {
      const epi = covering[0];
      if (!selectedPIs.some((p) => p.bits === epi.bits)) {
        selectedPIs.push(epi);
        epi.minterms.forEach((cov) => uncovered.delete(cov));
      }
    }
  }

  // Exact branch & bound with BigInt bitmask (capped safely for 5-6 var dense cyclic maps)
  if (uncovered.size > 0) {
    const remainingPIs = primeImplicants
      .filter((pi) => !selectedPIs.some((s) => s.bits === pi.bits) && pi.minterms.some((m) => uncovered.has(m)))
      .sort((a, b) => b.minterms.length - a.minterms.length);

    const uncoveredArr = Array.from(uncovered);
    const indexMap = new Map<number, bigint>();
    uncoveredArr.forEach((m, i) => indexMap.set(m, BigInt(1) << BigInt(i)));
    const targetMask = (BigInt(1) << BigInt(uncoveredArr.length)) - BigInt(1);

    const piMasks = remainingPIs.map((pi) => {
      let mask = BigInt(0);
      for (const m of pi.minterms) {
        const bit = indexMap.get(m);
        if (bit !== undefined) mask |= bit;
      }
      return mask;
    });

    let bestCombo: Implicant[] | null = null;
    let bestScore = Infinity;
    let steps = 0;

    const search = (idx: number, coveredMask: bigint, chosen: Implicant[]) => {
      if (++steps > 6000) return;
      const score = chosen.length * 100 + chosen.reduce((acc, p) => acc + countLiterals(p.bits), 0);
      if (score >= bestScore) return;

      if (coveredMask === targetMask) {
        bestScore = score;
        bestCombo = [...chosen];
        return;
      }
      if (idx >= remainingPIs.length) return;

      const addMask = piMasks[idx];
      if ((addMask & ~coveredMask) !== BigInt(0)) {
        search(idx + 1, coveredMask | addMask, [...chosen, remainingPIs[idx]]);
      }
      search(idx + 1, coveredMask, chosen);
    };

    search(0, BigInt(0), []);

    if (bestCombo) {
      selectedPIs.push(...(bestCombo as Implicant[]));
    } else {
      // Greedy fallback if step limit reached
      let curMask = BigInt(0);
      while (curMask !== targetMask) {
        let bestPiIdx = -1;
        let bestGain = 0;
        for (let i = 0; i < remainingPIs.length; i++) {
          let gainMask = piMasks[i] & ~curMask;
          let gain = 0;
          while (gainMask > BigInt(0)) {
            gain += Number(gainMask & BigInt(1));
            gainMask >>= BigInt(1);
          }
          if (gain > bestGain) {
            bestGain = gain;
            bestPiIdx = i;
          }
        }
        if (bestPiIdx === -1) break;
        selectedPIs.push(remainingPIs[bestPiIdx]);
        curMask |= piMasks[bestPiIdx];
      }
    }
  }

  selectedPIs.sort((a, b) => b.minterms.length - a.minterms.length || a.bits.localeCompare(b.bits));

  const groups: KMapGroup[] = selectedPIs.map((pi, idx) => ({
    id: `${isPos ? 'pos' : 'sop'}-${idx}-${pi.bits}`,
    term: isPos ? implicantToPosTerm(pi.bits, variables) : implicantToSopTerm(pi.bits, variables),
    minterms: pi.minterms,
    size: pi.minterms.length,
    rects: computeGroupRects(pi.minterms, numVars),
    colorIndex: idx % 6,
  }));

  const expression = isPos ? groups.map((g) => g.term).join(' · ') : groups.map((g) => g.term).join(' + ');
  const literalCount = selectedPIs.reduce((sum, pi) => sum + countLiterals(pi.bits), 0);

  return { expression, groups, literalCount };
}

export function solveKarnaughMap(cells: KMapCellValue[], numVars: KMapVarCount): KMapSolution {
  const layout = getKMapLayout(numVars);
  const totalCells = 1 << numVars;
  const safeCells: KMapCellValue[] = Array.from({ length: totalCells }, (_, i) =>
    cells[i] === 1 || cells[i] === 'X' ? cells[i] : 0
  );

  const minterms: number[] = [];
  const maxterms: number[] = [];
  const dontCares: number[] = [];

  for (let m = 0; m < totalCells; m++) {
    if (safeCells[m] === 1) minterms.push(m);
    else if (safeCells[m] === 'X') dontCares.push(m);
    else maxterms.push(m);
  }

  const sop = solveCover(minterms, dontCares, numVars, layout.variables, false);
  const pos = solveCover(maxterms, dontCares, numVars, layout.variables, true);

  return {
    numVars,
    variables: layout.variables,
    expression: sop.expression,
    posExpression: pos.expression,
    minterms,
    maxterms,
    dontCares,
    groups: sop.groups,
    posGroups: pos.groups,
    literalCount: sop.literalCount,
    posLiteralCount: pos.literalCount,
  };
}

export function parseIndexList(raw: string, maxExclusive: number): number[] {
  const nums = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < maxExclusive);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}
