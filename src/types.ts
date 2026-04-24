export interface PressurePoint {
  depth: number;
  porePressure: number;
  fractureGradient: number;
  mudWeight?: number;
}

export interface CasingSection {
  id: string;
  name: string;
  holeSize: string;
  casingSize: string;
  depth: number;
  lithology: string;
}

export interface FluidPolicy {
  section: string;
  fluidType: 'WBM' | 'OBM' | 'Synthetic';
  density: number; // Mud Weight
  funnelViscosity: number;
  pv: number;      // Plastic Viscosity
  yp: number;      // Yield Point
  gels10s: number;
  gels10m: number;
  fluidLoss: number;
}

export interface WellDesign {
  id: string;
  projectName: string;
  wellName: string;
  asset?: 'Mumbai' | 'Western' | 'Eastern' | 'Southern' | 'Cauvery' | 'Assam';
  reservoir?: string;
  field?: string;
  casings: CasingSection[];
  pressureProfile: PressurePoint[];
  fluidPolicies: FluidPolicy[];
  isArchived?: boolean;
}
