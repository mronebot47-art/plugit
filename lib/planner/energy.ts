import type { RouteSegment, VehicleProfile, PlanMode } from '@/lib/types';

/** Safety margin by mode */
const MARGIN: Record<PlanMode, number> = {
  cautious:   0.15,
  normal:     0.08,
  optimistic: 0.00,
};

/**
 * Compute Wh consumed over a route segment.
 * If elevation data is unavailable, gradeWh = 0.
 */
export function segmentWh(
  seg: RouteSegment,
  vehicle: VehicleProfile,
  avgSpeedKmh = 80,
): number {
  const base = vehicle.whPerKmHwy;

  // Speed factor: +0.6% per km/h above 80
  const speedFactor = 1 + Math.max(0, (avgSpeedKmh - 80)) * 0.006;

  // Grade energy (only for climbs; regen covers 55% of descents)
  let gradeWh = 0;
  if (seg.elevDeltaM !== undefined) {
    const efficiency = 0.90; // drivetrain efficiency
    if (seg.elevDeltaM > 0) {
      // Climbing
      gradeWh = (vehicle.massKg * 9.81 * seg.elevDeltaM) / 3600 / efficiency;
    } else {
      // Descending — recover 55%
      gradeWh = (vehicle.massKg * 9.81 * seg.elevDeltaM) / 3600 / efficiency * 0.55;
    }
  }

  return base * seg.km * speedFactor + gradeWh;
}

/**
 * Total energy consumption for a sequence of segments,
 * including the safety margin for AC use and traffic.
 */
export function totalWhForRoute(
  segments: RouteSegment[],
  vehicle: VehicleProfile,
  mode: PlanMode,
  avgSpeedKmh = 80,
): number {
  const raw = segments.reduce(
    (sum, seg) => sum + segmentWh(seg, vehicle, avgSpeedKmh),
    0,
  );
  return raw * (1 + MARGIN[mode]);
}

/**
 * Given a start SoC and route segments, return arrival SoC (0..1).
 * Returns negative if range is insufficient.
 */
export function arrivalSoc(
  startSoc: number,   // 0..1
  vehicle: VehicleProfile,
  segments: RouteSegment[],
  mode: PlanMode,
  avgSpeedKmh = 80,
): number {
  const usedWh = totalWhForRoute(segments, vehicle, mode, avgSpeedKmh);
  const usedSoc = usedWh / (vehicle.usableKwh * 1000);
  return startSoc - usedSoc;
}

/** Estimated km range from a given SoC (0..1) */
export function rangeKm(
  soc: number,
  vehicle: VehicleProfile,
  mode: PlanMode,
  avgSpeedKmh = 80,
): number {
  const availableWh = soc * vehicle.usableKwh * 1000;
  const whPerKm = vehicle.whPerKmHwy * (1 + Math.max(0, (avgSpeedKmh - 80)) * 0.006);
  const margin = 1 + MARGIN[mode];
  return availableWh / (whPerKm * margin);
}
