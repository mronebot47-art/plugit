import type {
  Station, VehicleProfile, PlanMode, PlanStop,
  TripAlternative, RibbonPoint, RouteData,
} from '@/lib/types';
import { nearestOnPolyline, haversineKm, polylineKm } from '@/lib/geo/haversine';
import { estimateProbFree } from '@/lib/data/availability';
import { chargeTime } from './charging';

const RESERVE_SOC   = 0.10; // 10% min
const CAUTIOUS_RESERVE = 0.15;
const DC_MIN_KW     = 20;
const MAX_DETOUR_KM = 4;
const SOC_BUCKETS   = [0.60, 0.70, 0.80, 0.90, 1.00];

interface Node {
  type: 'origin' | 'station' | 'destination';
  station?: Station;
  distanceAlongKm: number;
  detourKm: number;
}

interface State {
  nodeIndex: number;
  socBucket: number; // 0..1 departure SoC at this node
}

interface DijkstraEntry {
  cost: number;
  socOnArrival: number; // 0..1
  prev: DijkstraEntry | null;
  prevNodeIndex: number;
  departSoc: number;
  stop?: PlanStop;
}

function driveMinutes(km: number, avgSpeedKmh = 72): number {
  return (km / avgSpeedKmh) * 60;
}

function consumptionSoc(
  km: number,
  vehicle: VehicleProfile,
  mode: PlanMode,
): number {
  const margin = mode === 'cautious' ? 1.15 : mode === 'normal' ? 1.08 : 1.0;
  const whPerKm = vehicle.whPerKmHwy * margin;
  return (whPerKm * km) / (vehicle.usableKwh * 1000);
}

export function selectCandidateStations(
  stations: Station[],
  routeCoords: [number, number][],
  vehicle: VehicleProfile,
): (Station & { distanceAlongKm: number; detourKm: number })[] {
  const now = new Date();

  return stations
    .filter(s => {
      if (s.status === 'down') return false;
      // Must have compatible connector
      const compatible = s.connectors.some(c =>
        vehicle.connectors.includes(c.type),
      );
      if (!compatible) return false;
      return true;
    })
    .map(s => {
      const { distKm, alongKm } = nearestOnPolyline(routeCoords, { lat: s.lat, lng: s.lng });
      return {
        ...s,
        probFree: estimateProbFree(s, now),
        distanceAlongKm: alongKm,
        detourKm: distKm * 2, // ~2x perpendicular distance
      };
    })
    .filter(s => s.detourKm <= MAX_DETOUR_KM)
    .sort((a, b) => a.distanceAlongKm - b.distanceAlongKm);
}

export interface PlannerResult {
  fastest: TripAlternative;
  safest: TripAlternative;
}

export function planTrip(params: {
  route: RouteData;
  stations: Station[];
  vehicle: VehicleProfile;
  startSocPct: number;
  targetArrivalSocPct: number;
  mode: PlanMode;
}): PlannerResult {
  const { route, stations, vehicle, startSocPct, targetArrivalSocPct, mode } = params;
  const coords = route.geometry.coordinates as [number, number][];
  const totalKm = polylineKm(coords);

  const reserve = mode === 'cautious' ? CAUTIOUS_RESERVE : RESERVE_SOC;
  const startSoc = startSocPct / 100;
  const targetSoc = targetArrivalSocPct / 100;

  const candidates = selectCandidateStations(stations, coords, vehicle);

  // Build node list: origin + candidates + destination
  const nodes: Node[] = [
    { type: 'origin',      distanceAlongKm: 0,       detourKm: 0 },
    ...candidates.map(c => ({
      type: 'station' as const,
      station: c,
      distanceAlongKm: c.distanceAlongKm,
      detourKm: c.detourKm,
    })),
    { type: 'destination', distanceAlongKm: totalKm, detourKm: 0 },
  ];

  const N = nodes.length;
  const destIndex = N - 1;

  // Dijkstra over (nodeIndex, socBucket)
  // Cost = driveMinutes + chargeMinutes + detourMinutes + expectedWaitMinutes
  const INF = 1e9;

  // dist[nodeIndex][socBucketIndex] = { cost, socOnArrival, ... }
  const dist: (DijkstraEntry | null)[][] = Array.from({ length: N }, () =>
    Array(SOC_BUCKETS.length + 1).fill(null),
  );

  // Priority queue (simplified as sorted array for small N)
  interface QEntry { ni: number; bi: number; entry: DijkstraEntry }
  const queue: QEntry[] = [];

  // Start: origin, startSoc
  const startEntry: DijkstraEntry = {
    cost: 0,
    socOnArrival: startSoc,
    prev: null,
    prevNodeIndex: -1,
    departSoc: startSoc,
  };
  dist[0]![SOC_BUCKETS.length] = startEntry; // use last bucket index for origin
  queue.push({ ni: 0, bi: SOC_BUCKETS.length, entry: startEntry });

  while (queue.length > 0) {
    queue.sort((a, b) => a.entry.cost - b.entry.cost);
    const current = queue.shift()!;
    const { ni, entry } = current;
    const currentNode = nodes[ni]!;

    // Explore edges to subsequent nodes
    for (let nj = ni + 1; nj < N; nj++) {
      const nextNode = nodes[nj]!;
      const segKm = nextNode.distanceAlongKm - currentNode.distanceAlongKm + nextNode.detourKm;
      const socConsumed = consumptionSoc(segKm, vehicle, mode);
      const arrSoc = entry.departSoc - socConsumed;

      if (arrSoc < reserve) continue; // not reachable

      if (nextNode.type === 'destination') {
        // Check if we meet target arrival SoC
        if (arrSoc < targetSoc) continue;

        const driveMin = driveMinutes(segKm);
        const totalCost = entry.cost + driveMin;

        const prev = dist[destIndex]![0];
        if (!prev || totalCost < prev.cost) {
          const destEntry: DijkstraEntry = {
            cost: totalCost,
            socOnArrival: arrSoc,
            prev: entry,
            prevNodeIndex: ni,
            departSoc: arrSoc,
          };
          dist[destIndex]![0] = destEntry;
          queue.push({ ni: destIndex, bi: 0, entry: destEntry });
        }
        continue;
      }

      // Station node: try each departure SoC bucket
      const station = nextNode.station!;
      const isDC = station.maxKw >= DC_MIN_KW;
      const probFree = station.probFree ?? 0.5;
      const waitMin = (1 - probFree) * 25 + (station.status === 'unknown' ? 8 : 0);
      const driveMin = driveMinutes(segKm);

      for (let bi = 0; bi < SOC_BUCKETS.length; bi++) {
        const departureSoc = SOC_BUCKETS[bi]!;
        if (departureSoc <= arrSoc) continue; // no need to charge if already at or above

        // Above 80% is penalised — handled inside chargeTime
        const { minutes: chargeMin, kwh, costInr } = chargeTime(
          arrSoc, departureSoc, vehicle, station.maxKw, isDC,
        );

        const totalEdgeCost =
          driveMin + chargeMin + nextNode.detourKm * 60 / 72 + waitMin;
        const totalCost = entry.cost + totalEdgeCost;

        const prev = dist[nj]![bi];
        if (!prev || totalCost < prev.cost) {
          const stop: PlanStop = {
            station,
            arrivalSocPct: Math.round(arrSoc * 100),
            departureSocPct: Math.round(departureSoc * 100),
            chargeMinutes: chargeMin,
            chargeKwh: kwh,
            costInr,
            detourMinutes: Math.round(nextNode.detourKm * 60 / 72),
            reliabilityScore: probFree,
          };
          const newEntry: DijkstraEntry = {
            cost: totalCost,
            socOnArrival: arrSoc,
            prev: entry,
            prevNodeIndex: ni,
            departSoc: departureSoc,
            stop,
          };
          dist[nj]![bi] = newEntry;
          queue.push({ ni: nj, bi, entry: newEntry });
        }
      }
    }
  }

  // Reconstruct best path to destination
  function reconstruct(entry: DijkstraEntry): PlanStop[] {
    const stops: PlanStop[] = [];
    let cur: DijkstraEntry | null = entry;
    while (cur) {
      if (cur.stop) stops.unshift(cur.stop);
      cur = cur.prev;
    }
    return stops;
  }

  const destEntry = dist[destIndex]![0];
  const fallbackStops: PlanStop[] = destEntry ? reconstruct(destEntry) : [];

  function buildAlternative(
    label: 'Fastest' | 'Safest',
    stops: PlanStop[],
    finalSoc: number,
  ): TripAlternative {
    const totalDriveMin = Math.round(route.durationMin +
      stops.reduce((s, p) => s + p.detourMinutes, 0));
    const totalChargeMin = stops.reduce((s, p) => s + p.chargeMinutes, 0);
    const totalCost = stops.reduce((s, p) => s + p.costInr, 0);

    // Build ribbon series
    const ribbonSeries = buildRibbon(stops, startSoc, finalSoc, totalKm, vehicle, mode);
    const calmIndex = computeCalmIndex(stops, route, vehicle, mode);

    return {
      label,
      stops,
      totals: {
        distanceKm: Math.round(totalKm),
        driveMinutes: totalDriveMin,
        chargeMinutes: totalChargeMin,
        totalMinutes: totalDriveMin + totalChargeMin,
        costInr: totalCost,
        arrivalSocPct: Math.round(finalSoc * 100),
      },
      calmIndex: calmIndex.score,
      calmLine: calmIndex.line,
      ribbonSeries,
    };
  }

  const finalSoc = destEntry?.socOnArrival ?? (startSoc - consumptionSoc(totalKm, vehicle, mode));

  const fastest = buildAlternative('Fastest', fallbackStops, finalSoc);

  // "Safest": prefer stations with higher probFree and 2+ connectors
  const safestStops = [...fallbackStops].sort((a, b) => {
    const scoreA = a.station.probFree ?? 0.5;
    const scoreB = b.station.probFree ?? 0.5;
    return scoreB - scoreA;
  });

  const safest = buildAlternative('Safest', safestStops, finalSoc);

  return { fastest, safest };
}

function buildRibbon(
  stops: PlanStop[],
  startSoc: number,
  finalSoc: number,
  totalKm: number,
  vehicle: VehicleProfile,
  mode: PlanMode,
): RibbonPoint[] {
  const points: RibbonPoint[] = [];
  let cumKm = 0;
  let soc = startSoc;

  points.push({ distanceKm: 0, socPct: Math.round(soc * 100), type: 'drive' });

  for (const stop of stops) {
    const alongKm = stop.station.distanceAlongRoute ?? 0;
    const segKm = alongKm - cumKm;
    const consumed = consumptionSoc(segKm, vehicle, mode);
    soc -= consumed;
    cumKm = alongKm;

    // arrival
    points.push({ distanceKm: cumKm, socPct: Math.round(soc * 100), type: 'drive' });
    // departure (after charge)
    const depSoc = stop.departureSocPct / 100;
    points.push({ distanceKm: cumKm, socPct: stop.departureSocPct, type: 'charge' });
    soc = depSoc;
  }

  // destination
  points.push({ distanceKm: totalKm, socPct: Math.round(finalSoc * 100), type: 'drive' });
  return points;
}

function computeCalmIndex(
  stops: PlanStop[],
  route: RouteData,
  vehicle: VehicleProfile,
  mode: PlanMode,
): { score: number; line: string } {
  if (stops.length === 0) {
    return { score: 95, line: 'Comfortable single-charge trip. No gaps.' };
  }

  const totalKm = route.distanceKm;
  const vehicleRealRange = (vehicle.usableKwh * 1000 * 0.9) / vehicle.whPerKmHwy;

  // Max gap between stops
  const allDistances = [0, ...stops.map(s => s.station.distanceAlongRoute ?? 0), totalKm];
  let maxGapKm = 0;
  for (let i = 1; i < allDistances.length; i++) {
    maxGapKm = Math.max(maxGapKm, (allDistances[i] ?? 0) - (allDistances[i - 1] ?? 0));
  }

  const minArrivalSoc = Math.min(...stops.map(s => s.arrivalSocPct)) / 100;
  const avgProbFree = stops.length
    ? stops.reduce((s, p) => s + (p.station.probFree ?? 0.5), 0) / stops.length
    : 1;
  const singleConnectorStops = stops.filter(s => s.station.connectors.length === 1).length;
  const acOnlyStop = stops.some(s => s.station.maxKw < DC_MIN_KW);

  const penalty =
    30 * Math.min(1, maxGapKm / vehicleRealRange) +
    25 * (1 - Math.min(1, minArrivalSoc / 0.30)) +
    20 * (1 - avgProbFree) +
    15 * (stops.length ? singleConnectorStops / stops.length : 0) +
    10 * (acOnlyStop ? 1 : 0);

  const score = Math.round(Math.max(0, Math.min(100, 100 - penalty)));

  let line = `${score}. `;
  if (maxGapKm / vehicleRealRange > 0.7) {
    line += `One long gap: ${Math.round(maxGapKm)} km. Charge to 90% before it.`;
  } else if (minArrivalSoc < 0.15) {
    line += `Tight arrival at one stop: ${Math.round(minArrivalSoc * 100)}%. Consider leaving with more charge.`;
  } else if (acOnlyStop) {
    line += 'One AC-only stop on this route. Expect 4–8 h charge time there.';
  } else {
    line += `${stops.length} stop${stops.length > 1 ? 's' : ''}. Looks manageable.`;
  }

  return { score, line };
}
