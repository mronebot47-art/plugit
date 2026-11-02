import type { LatLng } from '@/lib/types';

const R = 6371; // Earth radius km

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Project point P onto segment AB; return { t, projected, distKm } */
export function projectPointOnSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { t: number; projected: LatLng; distKm: number } {
  // Use equirectangular approximation (fine for segments < 50 km)
  const ax = a.lng, ay = a.lat;
  const bx = b.lng, by = b.lat;
  const px = p.lng, py = p.lat;

  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projected: LatLng = { lat: ay + t * dy, lng: ax + t * dx };
  const distKm = haversineKm(p, projected);
  return { t, projected, distKm };
}

/**
 * Given a GeoJSON LineString coordinates array and a point,
 * return the closest point on the line and its distance-along in km.
 */
export function nearestOnPolyline(
  coords: [number, number][],
  p: LatLng,
): { distKm: number; alongKm: number } {
  let best = Infinity;
  let bestAlong = 0;
  let cumKm = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a: LatLng = { lat: coords[i]![1], lng: coords[i]![0] };
    const b: LatLng = { lat: coords[i + 1]![1], lng: coords[i + 1]![0] };
    const segKm = haversineKm(a, b);
    const { t, distKm } = projectPointOnSegment(p, a, b);
    if (distKm < best) {
      best = distKm;
      bestAlong = cumKm + t * segKm;
    }
    cumKm += segKm;
  }

  return { distKm: best, alongKm: bestAlong };
}

/** Total length of a GeoJSON coordinate array in km */
export function polylineKm(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineKm(
      { lat: coords[i]![1], lng: coords[i]![0] },
      { lat: coords[i + 1]![1], lng: coords[i + 1]![0] },
    );
  }
  return total;
}

/** Sample a polyline every ~stepKm, return LatLng array */
export function samplePolyline(
  coords: [number, number][],
  stepKm: number,
): LatLng[] {
  const result: LatLng[] = [{ lat: coords[0]![1], lng: coords[0]![0] }];
  let cumKm = 0;
  let lastSample = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a: LatLng = { lat: coords[i]![1], lng: coords[i]![0] };
    const b: LatLng = { lat: coords[i + 1]![1], lng: coords[i + 1]![0] };
    const segKm = haversineKm(a, b);
    cumKm += segKm;
    if (cumKm - lastSample >= stepKm) {
      result.push(b);
      lastSample = cumKm;
    }
  }

  // Always include last point
  const last = coords[coords.length - 1]!;
  result.push({ lat: last[1], lng: last[0] });
  return result;
}
