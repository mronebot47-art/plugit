export interface CalmIndexResult {
  score: number;
  line: string;
}

export function computeCalmIndex(
  longestGapKm: number,
  vehicleRealRangeKm: number,
  avgProbFree: number,
  stopsCount: number
): CalmIndexResult {
  // Score formula: balance between gap buffer, stop availability, and stop count
  const gapRatio = longestGapKm / Math.max(1, vehicleRealRangeKm);
  let score = Math.round(100 - gapRatio * 45 + avgProbFree * 25 - stopsCount * 2);
  score = Math.max(15, Math.min(98, score));

  let line = '';
  if (score >= 80) {
    line = 'Reachable with low charging anxiety. All gaps comfortably within real battery range.';
  } else if (score >= 60) {
    line = `Manageable trip. Longest corridor gap is ${Math.round(longestGapKm)} km; maintain moderate highway speeds.`;
  } else if (score >= 40) {
    line = `Tight corridor stretch. Longest gap of ${Math.round(longestGapKm)} km requires charging above 80% beforehand.`;
  } else {
    line = `Critical range warning. 142 km gap with limited DC fallback; charge to 95% at earliest available stop.`;
  }

  return { score, line };
}
