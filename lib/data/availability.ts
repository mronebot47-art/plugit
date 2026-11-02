import type { Station } from '@/lib/types';

/**
 * Estimated availability model.
 * Real-time plug data is NOT available from OCM for most Indian stations.
 * This is clearly labelled "Estimated" everywhere in the UI.
 */

interface DemandFactors {
  hour: number;   // 0-23 local
  dow: number;    // 0=Sun, 6=Sat
  stationMaxKw: number;
}

/** Double-peak demand curve: peaks 08-10 and 17-20 */
function baseDemand(hour: number): number {
  // AM peak
  if (hour >= 8 && hour <= 10)  return 0.70 + (10 - hour) * 0.05;
  // PM peak
  if (hour >= 17 && hour <= 20) return 0.75 + (hour - 17) * 0.04;
  // Night
  if (hour < 6 || hour > 22)   return 0.15;
  // Shoulder
  return 0.35;
}

/** Day-of-week multiplier: higher on Fri/Sun evenings */
function dowMultiplier(dow: number, hour: number): number {
  if ((dow === 5 || dow === 0) && hour >= 16) return 1.25; // Fri/Sun eve
  if (dow === 6) return 1.10; // Saturday
  return 1.0;
}

/** Highway hubs (fast DC ≥ 50 kW) are busier */
function stationClassMultiplier(maxKw: number): number {
  if (maxKw >= 100) return 1.20;
  if (maxKw >= 50)  return 1.10;
  return 0.90;
}

/** Deterministic per-station local factor: [0.6, 1.1] stable across refreshes */
function localFactor(stationId: string): number {
  let hash = 0;
  for (let i = 0; i < stationId.length; i++) {
    hash = (hash * 31 + stationId.charCodeAt(i)) & 0xffffffff;
  }
  return 0.6 + ((Math.abs(hash) % 1000) / 1000) * 0.5;
}

export function estimateProbFree(station: Station, now: Date = new Date()): number {
  const hour = now.getHours();
  const dow  = now.getDay();

  const demand =
    baseDemand(hour) *
    dowMultiplier(dow, hour) *
    stationClassMultiplier(station.maxKw) *
    localFactor(station.id);

  const prob = 1 - demand;
  return Math.max(0.05, Math.min(0.95, prob));
}

/**
 * Report decay weight:
 * - Full weight (1.0) under 30 min
 * - Half (0.5) at 2 h
 * - Zero at 12 h
 */
export function reportDecayWeight(createdAtIso: string, now: Date = new Date()): number {
  const ageMs = now.getTime() - new Date(createdAtIso).getTime();
  const ageMin = ageMs / 60_000;
  if (ageMin < 30)  return 1.0;
  if (ageMin < 120) return 1.0 - ((ageMin - 30) / 90) * 0.5;
  if (ageMin < 720) return 0.5 - ((ageMin - 120) / 600) * 0.5;
  return 0;
}

/** Source chip text for a station */
export function availabilityChip(station: Station, reportAge?: number): string {
  if (reportAge !== undefined) {
    if (reportAge < 60) return `Reported ${Math.round(reportAge)} min ago`;
    return `Reported ${Math.round(reportAge / 60)} h ago`;
  }
  if (station.source === 'ocm') return 'Estimated';
  return 'Estimated';
}
