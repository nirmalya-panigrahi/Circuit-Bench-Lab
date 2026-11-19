import { describe, it, expect } from 'vitest';
import { KMapCellValue, solveKarnaughMap, getKMapLayout, parseIndexList } from '../utils/kmapSolver';

describe('Karnaugh Map Solver (Blue Pill & Red Pill)', () => {
  it('Blue Pill: simplifies 4-corner wrap-around quad in 4-variable K-map for both SOP and POS', () => {
    // Minterms 0 (0000), 2 (0010), 8 (1000), 10 (1010) => SOP: B'D', POS: (B' + D')? Wait: F=B'D' = (B')(D')
    const cells: KMapCellValue[] = Array(16).fill(0);
    [0, 2, 8, 10].forEach((m) => (cells[m] = 1));

    const sol = solveKarnaughMap(cells, 4);
    expect(sol.expression).toBe("B'D'");
    expect(sol.posExpression.split(' · ').sort()).toEqual(["B'", "D'"]);
    expect(sol.groups).toHaveLength(1);
    expect(sol.groups[0].size).toBe(4);
    expect(sol.groups[0].rects.length).toBe(4); // 4 corner visual boxes
  });

  it('Blue Pill: leverages Don’t Care (X) cells to form larger power-of-two octets', () => {
    // Row AB=00,01 (minterms 0..7): 1s at 0,1,2,4,5,6 and X at 3,7 => A'
    const cells: KMapCellValue[] = Array(16).fill(0);
    [0, 1, 2, 4, 5, 6].forEach((m) => (cells[m] = 1));
    [3, 7].forEach((m) => (cells[m] = 'X'));

    const sol = solveKarnaughMap(cells, 4);
    expect(sol.expression).toBe("A'");
    expect(sol.posExpression).toBe("A'");
    expect(sol.groups[0].size).toBe(8);
  });

  it('Blue Pill: handles 2-, 3-, 5-, and 6-variable layouts accurately', () => {
    const layout3 = getKMapLayout(3);
    expect(layout3.colLabels).toEqual(['00', '01', '11', '10']);
    // 3-var: m1, m3, m5, m7 => C
    const cells3: KMapCellValue[] = [0, 1, 0, 1, 0, 1, 0, 1];
    expect(solveKarnaughMap(cells3, 3).expression).toBe('C');

    // 5-var: A=0 and A=1 planes (32 cells), A'E + AE = E (all odd minterms)
    const layout5 = getKMapLayout(5);
    expect(layout5.planes).toBe(2);
    const cells5: KMapCellValue[] = Array.from({ length: 32 }, (_, m) => (m % 2 === 1 ? 1 : 0));
    const sol5 = solveKarnaughMap(cells5, 5);
    expect(sol5.expression).toBe('E');
    expect(sol5.posExpression).toBe('E');

    // 6-var: 4 planes (64 cells), F' when even minterms only on AB=00..11 => F'
    const layout6 = getKMapLayout(6);
    expect(layout6.planes).toBe(4);
    const cells6: KMapCellValue[] = Array.from({ length: 64 }, (_, m) => (m % 2 === 0 ? 1 : 0));
    const sol6 = solveKarnaughMap(cells6, 6);
    expect(sol6.expression).toBe("F'");
  });

  it('Blue Pill & Red Pill: parseIndexList deduplicates, sorts, and drops out-of-range/non-numeric entries', () => {
    expect(parseIndexList('10, 2; 0 2 5', 16)).toEqual([0, 2, 5, 10]);
    expect(parseIndexList('abc, -1, 16, 999, 3.5, 7', 16)).toEqual([7]);
    expect(parseIndexList('', 16)).toEqual([]);
  });

  it('Red Pill: handles all-zeros, all-ones, all-dont-cares, and truncated/invalid cell arrays', () => {
    const zeros = solveKarnaughMap(Array(16).fill(0), 4);
    expect(zeros.expression).toBe('0');
    expect(zeros.posExpression).toBe('0');
    expect(zeros.groups).toHaveLength(0);

    const ones = solveKarnaughMap(Array(4).fill(1), 2);
    expect(ones.expression).toBe('1');
    expect(ones.posExpression).toBe('1');

    const allX = solveKarnaughMap(Array(8).fill('X'), 3);
    expect(allX.expression).toBe('0');
    expect(allX.posExpression).toBe('1');

    const malformed = solveKarnaughMap([], 4);
    expect(malformed.expression).toBe('0');
  });
});
