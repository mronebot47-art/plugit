export interface Point {
  lat: number;
  lng: number;
}

const R = 6371; // Earth radius km

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function projectPointOnSegment(
  p: Point,
  a: Point,
  b: Point
): { t: number; projected: Point; distKm: number } {
  const ax = a.lng,
    ay = a.lat;
  const bx = b.lng,
    by = b.lat;
  const px = p.lng,
    py = p.lat;

  const dx = bx - ax,
    dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projected: Point = { lat: ay + t * dy, lng: ax + t * dx };
  const distKm = haversineKm(p, projected);
  return { t, projected, distKm };
}

export function nearestOnPolyline(
  coords: [number, number][],
  p: Point
): { distKm: number; alongKm: number } {
  let best = Infinity;
  let bestAlong = 0;
  let cumKm = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a: Point = { lat: coords[i]![1], lng: coords[i]![0] };
    const b: Point = { lat: coords[i + 1]![1], lng: coords[i + 1]![0] };
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
