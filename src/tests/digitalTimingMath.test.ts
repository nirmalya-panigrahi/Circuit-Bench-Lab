import { describe, it, expect } from 'vitest';
import { simulateDigitalTiming } from '../utils/digitalTimingMath';

describe('Digital Timing Diagram Engine (Blue Pill & Red Pill)', () => {
  it('Blue Pill: D Flip-Flop captures input cleanly when transition is outside setup/hold window', () => {
    const res = simulateDigitalTiming({
      device: 'dff',
      clockPeriodNs: 20,
      tSetupNs: 3,
      tHoldNs: 2,
      tPdNs: 4,
      transitionOffsetNs: -7,
      inputA: [0, 1, 0, 1, 0, 1, 0, 1],
      inputB: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(res.violationCount).toBe(0);
    expect(res.qSequence).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(res.diagnostics[1].capturedQ).toBe(1);
    expect(res.diagnostics[2].capturedQ).toBe(0);
  });

  it('Blue Pill: 4-Bit Counter increments when EN=1 and resets synchronously when RST=1', () => {
    const res = simulateDigitalTiming({
      device: 'counter4',
      clockPeriodNs: 20,
      tSetupNs: 2,
      tHoldNs: 2,
      tPdNs: 3,
      transitionOffsetNs: -6,
      inputA: [1, 1, 1, 1, 1, 1, 1, 1], // EN
      inputB: [0, 0, 0, 1, 0, 0, 0, 0], // RST at cycle 3
    });
    expect(res.qSequence).toEqual([1, 2, 3, 0, 1, 2, 3, 4]);
    expect(res.diagnostics[0].capturedQ).toBe(1);
    expect(res.diagnostics[1].capturedQ).toBe(2);
    expect(res.diagnostics[2].capturedQ).toBe(3);
    expect(res.diagnostics[3].capturedQ).toBe(0);
    expect(res.diagnostics[4].capturedQ).toBe(1);
  });

  it('Red Pill: flags Setup Violation, Hold Violation, and narrow-pulse Glitch risk when Cycle 3 edge enters forbidden window', () => {
    const setupFail = simulateDigitalTiming({
      device: 'dff',
      clockPeriodNs: 20,
      tSetupNs: 3,
      tHoldNs: 2,
      tPdNs: 4,
      transitionOffsetNs: -1.5, // Inside [-3, 0]
      inputA: [0, 1, 0, 1, 0, 1, 0, 1],
      inputB: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(setupFail.violationCount).toBeGreaterThan(0);
    expect(setupFail.diagnostics[2].hasSetupViolation).toBe(true);

    const holdFail = simulateDigitalTiming({
      device: 'dff',
      clockPeriodNs: 20,
      tSetupNs: 3,
      tHoldNs: 2,
      tPdNs: 4,
      transitionOffsetNs: 1.0, // Inside [0, +2]
      inputA: [0, 1, 0, 1, 0, 1, 0, 1],
      inputB: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(holdFail.violationCount).toBeGreaterThan(0);
    expect(holdFail.diagnostics[2].hasHoldViolation).toBe(true);

    const glitchPulse = simulateDigitalTiming({
      device: 'dff',
      clockPeriodNs: 20,
      tSetupNs: 4,
      tHoldNs: 3,
      tPdNs: 4,
      transitionOffsetNs: 8.0, // Creates <7 ns pulse in Cycle 2
      inputA: [0, 1, 0, 1, 0, 1, 0, 1],
      inputB: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(glitchPulse.glitchCount).toBeGreaterThan(0);
  });
});
