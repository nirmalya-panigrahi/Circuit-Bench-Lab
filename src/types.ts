export interface Complex {
  re: number;
  im: number;
}

export type ComponentType =
  | 'series_l'
  | 'series_c'
  | 'series_r'
  | 'shunt_l'
  | 'shunt_c'
  | 'shunt_r'
  | 'tline_series';

export interface MatchComponent {
  id: string;
  type: ComponentType;
  value: number; // nH for L, pF for C, Ohms for R, wavelengths (λ) for tline_series
  normalizedVal: number; // normalized reactance/susceptance/resistance/conductance/electrical deg
}

export interface MatchingState {
  label: string;
  z: Complex; // normalized impedance
  y: Complex; // normalized admittance
  gamma: Complex; // reflection coefficient
  componentId?: string;
}

export interface SavedPoint {
  id: string;
  name: string;
  z: Complex;
  z0: number;
  timestamp: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  highlightRegion?: 'short' | 'open' | 'unity_r' | 'unity_g' | 'inductive' | 'capacitive' | 'center' | 'all';
  setup?: {
    z_load: Complex;
    components: MatchComponent[];
  };
}

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export type LabId =
  | 'smith'
  | 'kmap'
  | 'loadline'
  | 'ivcurves'
  | 'eyediagram'
  | 'constellation'
  | 'polezero'
  | 'opamp'
  | 'timing'
  | 'vtc';

export type LabCategory = 'all' | 'rf_signals' | 'analog_devices' | 'digital_logic';

export interface LabDefinition {
  id: LabId;
  index: string;
  name: string;
  shortName: string;
  category: Exclude<LabCategory, 'all'>;
  domainLabel: string;
  summary: string;
}
