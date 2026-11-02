import type { Station } from '../data/stations';
import type { Vehicle } from '../data/vehicles';
import { nearestOnPolyline } from './geo';
import { calculateChargingTimeMin } from './charging';
import { computeCalmIndex } from './calm';

export interface PlanStop {
  station: Station;
  arrivalSoc: number;
  departureSoc: number;
  chargeTimeMin: number;
  distanceFromPrevKm: number;
  energyAddedKwh: number;
}

export interface RibbonPoint {
  km: number;
  socPct: number;
}

export interface RibbonChargeBar {
  km: number;
  fromSoc: number;
  toSoc: number;
  stationName: string;
}

export interface TripAlternative {
  label: 'Fastest' | 'Safest';
  totals: {
    distanceKm: number;
    totalTimeMin: number;
    driveTimeMin: number;
    chargingTimeMin: number;
    energyKwh: number;
  };
  stops: PlanStop[];
  calmIndex: {
    score: number;
    line: string;
  };
  ribbonSeries: {
    points: RibbonPoint[];
    chargeBars: RibbonChargeBar[];
  };
}

export interface PlanOutput {
  routeId: string;
  reachabilityKm: number;
  alternatives: TripAlternative[];
}

export function computePlan(params: {
  routeId: string;
  geometry: { coordinates: [number, number][] };
  vehicle: Vehicle;
  startSoc: number;
  targetArrivalSoc?: number;
  mode?: string;
  stations: Station[];
  failedStationIds?: string[];
}): PlanOutput {
  const {
    routeId,
    geometry,
    vehicle,
    startSoc,
    targetArrivalSoc = 15,
    mode = 'normal',
    stations,
    failedStationIds = [],
  } = params;

  const coords = geometry.coordinates;
  const margin = mode === 'cautious' ? 1.15 : mode === 'optimistic' ? 1.0 : 1.08;
  const effectiveWhPerKm = vehicle.whPerKmHwy * margin;

  // Real vehicle range at 100% and at startSoc
  const totalRangeKm = (vehicle.usableKwh * 1000) / effectiveWhPerKm;
  const currentRangeKm = totalRangeKm * (startSoc / 100);
  const reachabilityKm = Math.round(currentRangeKm);

  // Compute total route distance from coordinates
  let totalRouteKm = 345;
  if (coords.length >= 2) {
    const { alongKm } = nearestOnPolyline(coords, {
      lat: coords[coords.length - 1]![1],
      lng: coords[coords.length - 1]![0],
    });
    if (alongKm > 10) totalRouteKm = Math.round(alongKm);
  }

  // Filter valid candidate stations along the route
  const failedSet = new Set(failedStationIds);
  const validCandidates = stations
    .filter((s) => s.status !== 'down' && !failedSet.has(s.id))
    .map((s) => {
      const { distKm, alongKm } = nearestOnPolyline(coords, { lat: s.lat, lng: s.lng });
      return {
        ...s,
        distanceAlongRoute: Math.round(alongKm),
        detourKm: Number((distKm * 2).toFixed(1)),
      };
    })
    .filter((s) => (s.detourKm || 0) <= 25 && s.distanceAlongRoute > 5 && s.distanceAlongRoute < totalRouteKm - 5)
    .sort((a, b) => (a.distanceAlongRoute || 0) - (b.distanceAlongRoute || 0));

  // If startSoc is enough to reach destination with targetArrivalSoc reserve, 0 stops needed!
  const energyNeededTotalKwh = (totalRouteKm * effectiveWhPerKm) / 1000;
  const initialAvailableKwh = vehicle.usableKwh * (startSoc / 100);
  const reserveKwh = vehicle.usableKwh * (targetArrivalSoc / 100);

  if (initialAvailableKwh - energyNeededTotalKwh >= reserveKwh) {
    const driveTimeMin = Math.round((totalRouteKm / 68) * 60);
    const arrivalSoc = Math.round(((initialAvailableKwh - energyNeededTotalKwh) / vehicle.usableKwh) * 100);

    const ribbonPoints: RibbonPoint[] = [
      { km: 0, socPct: startSoc },
      { km: totalRouteKm, socPct: arrivalSoc },
    ];

    const alt: TripAlternative = {
      label: 'Fastest',
      totals: {
        distanceKm: totalRouteKm,
        totalTimeMin: driveTimeMin,
        driveTimeMin,
        chargingTimeMin: 0,
        energyKwh: Number(energyNeededTotalKwh.toFixed(1)),
      },
      stops: [],
      calmIndex: computeCalmIndex(totalRouteKm, totalRangeKm, 1.0, 0),
      ribbonSeries: {
        points: ribbonPoints,
        chargeBars: [],
      },
    };

    return {
      routeId,
      reachabilityKm,
      alternatives: [alt],
    };
  }

  // Build alternatives: Fastest (prefer higher kW, 80% charge target) & Safest (more conservative, 85% charge target)
  const buildAlternative = (label: 'Fastest' | 'Safest'): TripAlternative => {
    const isFastest = label === 'Fastest';
    const chargeTargetSoc = isFastest ? 80 : 85;
    const minArrivalSoc = isFastest ? 12 : 18;

    const chosenStops: PlanStop[] = [];
    let currentKm = 0;
    let currentSoc = startSoc;
    let prevKm = 0;
    let longestGapKm = 0;
    const ribbonPoints: RibbonPoint[] = [{ km: 0, socPct: startSoc }];
    const chargeBars: RibbonChargeBar[] = [];

    while (currentKm < totalRouteKm) {
      const remainingKm = totalRouteKm - currentKm;
      const socNeededForRemaining = ((remainingKm * effectiveWhPerKm) / 1000 / vehicle.usableKwh) * 100;

      // Can we reach destination directly?
      if (currentSoc - socNeededForRemaining >= targetArrivalSoc) {
        currentKm = totalRouteKm;
        const finalArrivalSoc = Math.round(currentSoc - socNeededForRemaining);
        ribbonPoints.push({ km: totalRouteKm, socPct: finalArrivalSoc });
        const gap = totalRouteKm - prevKm;
        if (gap > longestGapKm) longestGapKm = gap;
        break;
      }

      // Find reachable stations
      const reachable = validCandidates.filter((s) => {
        const distFromCurrent = (s.distanceAlongRoute || 0) - currentKm;
        if (distFromCurrent <= 5) return false;
        const socNeeded = ((distFromCurrent * effectiveWhPerKm) / 1000 / vehicle.usableKwh) * 100;
        return currentSoc - socNeeded >= minArrivalSoc;
      });

      if (reachable.length === 0) {
        // Fallback: pick the closest station ahead if reachable with 5% emergency buffer
        const emergency = validCandidates.filter((s) => (s.distanceAlongRoute || 0) > currentKm);
        if (emergency.length > 0) {
          reachable.push(emergency[0]!);
        } else {
          break;
        }
      }

      // Pick optimal station:
      // Fastest: maximize kW, further along route
      // Safest: prefer higher probability free and shorter gap
      const selectedStation = isFastest
        ? reachable.reduce((best, s) => {
            const score = s.maxKw * 1.5 + (s.distanceAlongRoute || 0);
            const bestScore = best.maxKw * 1.5 + (best.distanceAlongRoute || 0);
            return score > bestScore ? s : best;
          }, reachable[0]!)
        : reachable.reduce((best, s) => {
            const prob = s.availability?.probFree || 0.7;
            const bestProb = best.availability?.probFree || 0.7;
            return prob >= bestProb ? s : best;
          }, reachable[0]!);

      const legKm = (selectedStation.distanceAlongRoute || 0) - currentKm;
      const legSocUsed = ((legKm * effectiveWhPerKm) / 1000 / vehicle.usableKwh) * 100;
      const arrivalSoc = Math.max(8, Math.round(currentSoc - legSocUsed));

      const chargeMinutes = calculateChargingTimeMin(
        arrivalSoc,
        chargeTargetSoc,
        vehicle.usableKwh,
        selectedStation.maxKw,
        vehicle.maxDcKw
      );

      const energyAddedKwh = Number((vehicle.usableKwh * ((chargeTargetSoc - arrivalSoc) / 100)).toFixed(1));

      chosenStops.push({
        station: selectedStation,
        arrivalSoc,
        departureSoc: chargeTargetSoc,
        chargeTimeMin: chargeMinutes,
        distanceFromPrevKm: legKm,
        energyAddedKwh,
      });

      // Sawtooth ribbon updates
      ribbonPoints.push({ km: selectedStation.distanceAlongRoute || 0, socPct: arrivalSoc });
      ribbonPoints.push({ km: selectedStation.distanceAlongRoute || 0, socPct: chargeTargetSoc });
      chargeBars.push({
        km: selectedStation.distanceAlongRoute || 0,
        fromSoc: arrivalSoc,
        toSoc: chargeTargetSoc,
        stationName: selectedStation.name,
      });

      const gap = (selectedStation.distanceAlongRoute || 0) - prevKm;
      if (gap > longestGapKm) longestGapKm = gap;

      prevKm = selectedStation.distanceAlongRoute || 0;
      currentKm = selectedStation.distanceAlongRoute || 0;
      currentSoc = chargeTargetSoc;
    }

    const driveTimeMin = Math.round((totalRouteKm / 68) * 60);
    const chargingTimeMin = chosenStops.reduce((sum, s) => sum + s.chargeTimeMin, 0);
    const totalTimeMin = driveTimeMin + chargingTimeMin;
    const avgProb = chosenStops.length > 0
      ? chosenStops.reduce((sum, s) => sum + (s.station.availability?.probFree || 0.7), 0) / chosenStops.length
      : 0.85;

    return {
      label,
      totals: {
        distanceKm: totalRouteKm,
        totalTimeMin,
        driveTimeMin,
        chargingTimeMin,
        energyKwh: Number(energyNeededTotalKwh.toFixed(1)),
      },
      stops: chosenStops,
      calmIndex: computeCalmIndex(longestGapKm || 120, totalRangeKm, avgProb, chosenStops.length),
      ribbonSeries: {
        points: ribbonPoints,
        chargeBars,
      },
    };
  };

  const fastest = buildAlternative('Fastest');
  const safest = buildAlternative('Safest');

  return {
    routeId,
    reachabilityKm,
    alternatives: [fastest, safest],
  };
}
