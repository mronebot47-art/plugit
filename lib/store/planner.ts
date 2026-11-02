import { create } from 'zustand';
import type {
  GeoPoint,
  Vehicle,
  RouteData,
  TripAlternative,
  Station,
  PlanMode,
} from '@/lib/types';
import { VEHICLES } from '@/lib/planner/vehicles';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device-ssr-0000000000000000000000';
  let id = localStorage.getItem('plugit.deviceId');
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem('plugit.deviceId', id);
  }
  return id;
}

function getStoredDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('plugit.demoMode') === 'true';
}

interface PlannerState {
  // Device & Demo Mode
  deviceId: string;
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;

  // Unreachable Backend Banner
  isBackendUnreachable: boolean;
  setBackendUnreachable: (val: boolean) => void;

  // Inputs
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  vehicles: Vehicle[];
  setVehicles: (v: Vehicle[]) => void;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  customVehicle: Vehicle;
  setCustomVehicle: (v: Partial<Vehicle>) => void;
  startSocPct: number;
  targetArrivalSocPct: number;
  mode: PlanMode;

  // Route & Plan output
  route: RouteData | null;
  alternatives: TripAlternative[];
  activeAlt: 0 | 1;
  reachabilityKm: number;

  // Map state
  stations: Station[];
  hoveredStopIdx: number | null;
  sosOptions: Array<{ station: Station; distanceKm: number; etaMin: number; arrivalSoc: number; rationale: string }> | null;
  setSosOptions: (opts: any) => void;

  // UI state
  loading: boolean;
  error: string | null;
  errorDetails?: { longestGapKm?: number; vehicleRealRangeKm?: number; suggestion?: string };

  // Actions
  setOrigin: (p: GeoPoint | null) => void;
  setDestination: (p: GeoPoint | null) => void;
  setStartSoc: (soc: number) => void;
  setTargetSoc: (soc: number) => void;
  setMode: (m: PlanMode) => void;
  setRoute: (r: RouteData | null) => void;
  setAlternatives: (a: TripAlternative[]) => void;
  setActiveAlt: (i: 0 | 1) => void;
  setReachabilityKm: (km: number) => void;
  setStations: (s: Station[]) => void;
  setHoveredStop: (i: number | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null, details?: any) => void;
  reset: () => void;
}

const DEFAULT_CUSTOM: Vehicle = {
  id: 'custom',
  name: 'Custom Vehicle',
  usableKwh: 45,
  whPerKmHwy: 150,
  maxDcKw: 60,
  maxAcKw: 7.2,
  massKg: 1600,
  connectors: ['CCS2', 'Type2'],
};

export const usePlannerStore = create<PlannerState>((set, get) => ({
  deviceId: getOrCreateDeviceId(),
  isDemoMode: getStoredDemoMode(),
  setDemoMode: (val) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('plugit.demoMode', String(val));
    }
    set({ isDemoMode: val });
  },

  isBackendUnreachable: false,
  setBackendUnreachable: (val) => set({ isBackendUnreachable: val }),

  origin: { label: 'Campus Main Gate & Visitor Bay', lat: 13.021, lng: 77.571 },
  destination: { label: 'R&D Innovation Park & Solar Canopy', lat: 13.015, lng: 77.562 },
  vehicles: VEHICLES,
  setVehicles: (v) => set({ vehicles: v }),
  selectedVehicleId: 'ather-450x',
  setSelectedVehicleId: (id) => set({ selectedVehicleId: id }),
  customVehicle: DEFAULT_CUSTOM,
  setCustomVehicle: (v) => set((s) => ({ customVehicle: { ...s.customVehicle, ...v } })),

  startSocPct: 80,
  targetArrivalSocPct: 15,
  mode: 'normal',

  route: null,
  alternatives: [],
  activeAlt: 0,
  reachabilityKm: 180,

  stations: [],
  hoveredStopIdx: null,
  sosOptions: null,
  setSosOptions: (opts) => set({ sosOptions: opts }),

  loading: false,
  error: null,
  errorDetails: undefined,

  setOrigin: (p) => set({ origin: p }),
  setDestination: (p) => set({ destination: p }),
  setStartSoc: (soc) => set({ startSocPct: soc }),
  setTargetSoc: (soc) => set({ targetArrivalSocPct: soc }),
  setMode: (m) => set({ mode: m }),
  setRoute: (r) => set({ route: r }),
  setAlternatives: (a) => set({ alternatives: a }),
  setActiveAlt: (i) => set({ activeAlt: i }),
  setReachabilityKm: (km) => set({ reachabilityKm: km }),
  setStations: (s) => set({ stations: s }),
  setHoveredStop: (i) => set({ hoveredStopIdx: i }),
  setLoading: (b) => set({ loading: b }),
  setError: (e, details) => set({ error: e, errorDetails: details }),
  reset: () =>
    set({
      route: null,
      alternatives: [],
      error: null,
      errorDetails: undefined,
      hoveredStopIdx: null,
      sosOptions: null,
    }),
}));
