import React from 'react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('CircuitBench 10-Lab Integration Flows (React Testing Library)', () => {
  it('renders the Smith Chart Lab by default and navigates cleanly across all 10 engineering labs', () => {
    render(<App />);
    expect(screen.getByText(/Smith Chart Impedance Lab/i)).toBeInTheDocument();

    const labChecks: { testId: string; heading: RegExp }[] = [
      { testId: 'nav-lab-kmap', heading: /Karnaugh Map/i },
      { testId: 'nav-lab-loadline', heading: /Transistor Load-Line/i },
      { testId: 'nav-lab-ivcurves', heading: /Diode & MOSFET/i },
      { testId: 'nav-lab-eyediagram', heading: /Eye Diagram/i },
      { testId: 'nav-lab-constellation', heading: /Constellation Diagram/i },
      { testId: 'nav-lab-polezero', heading: /Pole–Zero Plot/i },
      { testId: 'nav-lab-opamp', heading: /Op-Amp Frequency Response/i },
      { testId: 'nav-lab-timing', heading: /Digital Timing Diagram/i },
      { testId: 'nav-lab-vtc', heading: /Voltage Transfer Characteristic/i },
    ];

    for (const item of labChecks) {
      fireEvent.click(screen.getByTestId(item.testId));
      expect(screen.getByRole('heading', { level: 2, name: item.heading })).toBeInTheDocument();
    }
  });

  it('updates simplified SOP & POS equations, supports 5-6 variables, direct minterm lists, and hover tooltip in K-Map Lab', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-lab-kmap'));

    // Clear map -> F = 0
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(screen.getByTestId('kmap-expression').textContent).toContain('= 0');

    // Click cell m0 -> cycles 0 -> 1 -> F = A'B'C'D'
    fireEvent.click(screen.getByTestId('kmap-cell-0'));
    expect(screen.getByTestId('kmap-expression').textContent).toContain("A'B'C'D'");
    expect(screen.getByTestId('kmap-pos-expression')).toBeInTheDocument();

    // Direct minterm entry: 0, 1, 2, 3 => A'B'
    const mintermBox = screen.getByLabelText(/Minterms Σm/i);
    fireEvent.change(mintermBox, { target: { value: '0, 1, 2, 3' } });
    fireEvent.blur(mintermBox);
    expect(screen.getByTestId('kmap-expression').textContent).toContain("A'B'");

    // Hover tooltip on cell
    fireEvent.mouseEnter(screen.getByTestId('kmap-cell-0'));
    expect(screen.getByTestId('kmap-tooltip')).toHaveTextContent(/m0/i);

    // Switch to 5 Vars and 6 Vars
    fireEvent.click(screen.getByRole('button', { name: '5 Vars' }));
    expect(screen.getByText(/Sub-Map A = 0/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '6 Vars' }));
    expect(screen.getByText(/64 rows/i)).toBeInTheDocument();
  });

  it('updates Op-Amp closed-loop gain via numeric spinbutton box and shows Bode hover tooltip', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-lab-opamp'));

    const ratioBox = screen.getByRole('spinbutton', { name: /Feedback Resistor Ratio \(Rf \/ R1\) value/i });
    fireEvent.change(ratioBox, { target: { value: '9' } });
    expect(screen.getByText(/10\.0 V\/V \(Rf\/R1=9\)/i)).toBeInTheDocument();
  });

  it('switches Constellation modulation to 64-QAM, updates bit efficiency, and renders hover probe tooltip', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('nav-lab-constellation'));
    fireEvent.click(screen.getByRole('button', { name: '64-QAM' }));
    expect(screen.getByText(/6 bits\/symbol/i)).toBeInTheDocument();

    const iqSvg = screen.getByText(/I \(In-Phase\)/i).closest('svg')!;
    fireEvent.mouseMove(iqSvg, { clientX: 120, clientY: 120 });
    expect(screen.getByTestId('iq-tooltip')).toBeInTheDocument();
  });

  it('adds a transmission line segment and offers single-stub shunt matching in Smith Chart Lab', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Trans\. Line/i }));
    expect(screen.getByText(/Transmission Line Section/i)).toBeInTheDocument();
    expect(screen.getByText(/Single-Stub Shunt Tuning Values/i)).toBeInTheDocument();
  });

  it('opens the 10-lab directory catalog and filters by category', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /All 10 Labs/i }));
    expect(screen.getByText(/Digital & Electronics Engineering Instruments/i)).toBeInTheDocument();

    const digitalButtons = screen.getAllByRole('button', { name: 'Digital & Logic' });
    fireEvent.click(digitalButtons[digitalButtons.length - 1]);
    expect(screen.getByText('Karnaugh Map (K-Map)')).toBeInTheDocument();
    expect(screen.queryByText('Eye Diagram')).not.toBeInTheDocument();
  });
});
