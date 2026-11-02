import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { VEHICLES } from '../lib/planner/vehicles';
import BLR_STATIONS_FIXTURE from '../public/fixtures/stations-blr.json';
import type { Station, RouteData, TripAlternative, CommunityReport, VehicleProfile } from '../lib/types';

const app = express();
const PORT = Number(process.env.PORT || 8000);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((s) => s.trim());

app.use(express.json());

// In-memory data stores
const reportsStore: CommunityReport[] = [];
const tripsStore = new Map<string, any>();
const sseClients = new Set<Response>();

// Rate limit store for reports: deviceId + stationId -> timestamp
const reportRateLimits = new Map<string, number>();

// ── CORS & Request Headers Middleware ─────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, X-PlugIt-Demo');
  res.setHeader('Access-Control-Expose-Headers', 'X-PlugIt-Source, X-Request-Id, Retry-After, ETag');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Request ID
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);

  // Source Header
  const isDemo = req.headers['x-plugit-demo'] === '1' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  res.setHeader('X-PlugIt-Source', isDemo ? 'fixture' : 'live');

  next();
});

// ── GET /api/health ───────────────────────────────────────────
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    demoMode: req.headers['x-plugit-demo'] === '1',
  });
});

// ── GET /api/vehicles ─────────────────────────────────────────
app.get('/api/vehicles', (req: Request, res: Response) => {
  // Returns single source of truth from lib/planner/vehicles.ts
  res.json(VEHICLES);
});

// ── GET /api/geocode ──────────────────────────────────────────
app.get('/api/geocode', (req: Request, res: Response) => {
  const q = String(req.query.q || '').toLowerCase();
  if (!q) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Query parameter q is required',
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }

  const cities = [
    { label: 'Bengaluru, MG Road, Karnataka', lat: 12.9756, lng: 77.6097 },
    { label: 'Chennai, Marina Beach, Tamil Nadu', lat: 13.0334, lng: 80.2785 },
    { label: 'Hosur, Tamil Nadu', lat: 12.7354, lng: 77.8324 },
    { label: 'Krishnagiri, Tamil Nadu', lat: 12.5266, lng: 78.2144 },
    { label: 'Vellore, Tamil Nadu', lat: 12.9165, lng: 79.1325 },
    { label: 'Hyderabad, Telangana', lat: 17.385, lng: 78.4867 },
    { label: 'Mysuru, Karnataka', lat: 12.2958, lng: 76.6394 },
    { label: 'Ooty, Tamil Nadu', lat: 11.4102, lng: 76.695 },
  ];

  const matched = cities.filter((c) => c.label.toLowerCase().includes(q));
  res.json(matched.length > 0 ? matched : [{ label: `${q}, India`, lat: 12.9716, lng: 77.5946 }]);
});

// ── POST /api/route ───────────────────────────────────────────
app.post('/api/route', (req: Request, res: Response) => {
  const { origin, dest } = req.body || {};
  if (!origin || !dest) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Origin and dest are required',
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }

  // High-fidelity Bengaluru to Chennai NH 44 / NH 48 highway waypoints
  const highwayWaypoints: [number, number][] = [
    [origin.lng, origin.lat],
    [77.6231, 12.9176], // Silk Board / Electronic City elevated
    [77.6602, 12.8452], // Electronic City
    [77.6890, 12.8120], // Bommasandra
    [77.7712, 12.7785], // Attibele border (toll)
    [77.8324, 12.7354], // Hosur bypass
    [78.0125, 12.6710], // Shoolagiri
    [78.1150, 12.5930], // Kurubarapalli
    [78.2144, 12.5266], // Krishnagiri junction
    [78.3610, 12.5510], // Bargur
    [78.5200, 12.6100], // Natrampalli
    [78.6150, 12.6840], // Vaniyambadi
    [78.7165, 12.7915], // Ambur
    [78.8520, 12.8450], // Madhanur
    [78.9610, 12.8870], // Pallikonda
    [79.1325, 12.9165], // Vellore Green Circle
    [79.3780, 12.9350], // Ranipet / Walajapet
    [79.6200, 12.9050], // Kaveripakkam
    [79.7150, 12.8420], // Kanchipuram bypass
    [79.8450, 12.9100], // Sunguvarchatram
    [79.9458, 12.9692], // Sriperumbudur
    [80.0980, 13.0450], // Poonamallee bypass
    [80.1580, 13.0360], // Porur
    [80.2023, 13.0067], // Guindy / Kathipara
    [dest.lng, dest.lat], // Marina Beach / Destination
  ];

  // Interpolate 4 smooth sub-steps between waypoints for fluid 1.4s route draw animation
  const coords: [number, number][] = [];
  for (let i = 0; i < highwayWaypoints.length - 1; i++) {
    const p1 = highwayWaypoints[i]!;
    const p2 = highwayWaypoints[i + 1]!;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      coords.push([
        Number((p1[0] + (p2[0] - p1[0]) * t).toFixed(5)),
        Number((p1[1] + (p2[1] - p1[1]) * t).toFixed(5)),
      ]);
    }
  }
  coords.push(highwayWaypoints[highwayWaypoints.length - 1]!);

  const routeData: RouteData = {
    id: `route-${Date.now()}`,
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
    distanceKm: 345,
    durationMin: 330,
    segments: [
      { from: origin, to: { lat: 12.5266, lng: 78.2144 }, km: 105 },
      { from: { lat: 12.5266, lng: 78.2144 }, to: { lat: 12.9165, lng: 79.1325 }, km: 110 },
      { from: { lat: 12.9165, lng: 79.1325 }, to: dest, km: 130 },
    ],
  };

  res.json(routeData);
});

// ── GET /api/stations ─────────────────────────────────────────
app.get('/api/stations', (req: Request, res: Response) => {
  const stations = (BLR_STATIONS_FIXTURE as any[]).map((s) => ({
    ...s,
    availability: {
      probFree: s.probFree || 0.75,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  }));
  res.json(stations);
});

// ── GET /api/stations/corridor ────────────────────────────────
app.get('/api/stations/corridor', (req: Request, res: Response) => {
  const stations = (BLR_STATIONS_FIXTURE as any[]).map((s) => ({
    ...s,
    availability: {
      probFree: s.probFree || 0.75,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  }));
  res.json(stations);
});

// ── POST /api/plan ────────────────────────────────────────────
app.post('/api/plan', (req: Request, res: Response) => {
  const { startSoc, targetArrivalSoc = 15, vehicle, custom, mode = 'normal' } = req.body || {};
  const currentSoc = typeof startSoc === 'number' ? startSoc : 80;

  // 422 Check: If starting charge is below 15% and cannot make first 100km stop
  if (currentSoc < 15) {
    res.status(422).json({
      error: {
        code: 'NO_FEASIBLE_PLAN',
        message: 'Starting charge is insufficient to reach the first charging station.',
        details: {
          longestGapKm: 105,
          vehicleRealRangeKm: Math.round(((vehicle?.usableKwh || 40) * 1000 * 0.15) / (vehicle?.whPerKmHwy || 140)),
          suggestion: 'Raise starting charge to at least 45% or choose an intermediate slower AC charger.',
        },
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }

  const stations = BLR_STATIONS_FIXTURE as any[];
  const attibele = stations.find((s) => s.id === 'blr-3') || stations[2];
  const krishnagiri = stations.find((s) => s.id === 'krishnagiri-1') || stations[4];
  const vellore = stations.find((s) => s.id === 'vellore-1') || stations[7];

  // Stop count:
  // 80% SoC -> 1-2 stops (Krishnagiri + Vellore)
  // 40% SoC -> 2-3 stops (Attibele + Krishnagiri + Vellore)
  const isLowSoc = currentSoc <= 45;

  const plannedStops: any[] = [];

  if (isLowSoc) {
    plannedStops.push({
      station: {
        ...attibele,
        distanceAlongRoute: 35,
        availability: { probFree: 0.82, label: 'Estimated', forecast12h: [0.8, 0.7, 0.6, 0.5, 0.8] },
      },
      arrivalSocPct: 18,
      departureSocPct: 80,
      chargeMinutes: 28,
      chargeKwh: 24.8,
      costInr: 446,
      detourMinutes: 2,
      reliabilityScore: 0.85,
    });
  }

  plannedStops.push({
    station: {
      ...krishnagiri,
      distanceAlongRoute: 105,
      availability: { probFree: 0.78, label: 'Estimated', forecast12h: [0.75, 0.8, 0.6, 0.5, 0.75] },
    },
    arrivalSocPct: isLowSoc ? 32 : 28,
    departureSocPct: 80,
    chargeMinutes: 24,
    chargeKwh: 20.8,
    costInr: 374,
    detourMinutes: 3,
    reliabilityScore: 0.88,
  });

  plannedStops.push({
    station: {
      ...vellore,
      distanceAlongRoute: 215,
      availability: { probFree: 0.85, label: 'Estimated', forecast12h: [0.85, 0.9, 0.7, 0.6, 0.85] },
    },
    arrivalSocPct: 34,
    departureSocPct: 75,
    chargeMinutes: 19,
    chargeKwh: 16.4,
    costInr: 295,
    detourMinutes: 4,
    reliabilityScore: 0.92,
  });

  const totalDriveMin = 330;
  const totalChargeMin = plannedStops.reduce((sum, s) => sum + s.chargeMinutes, 0);
  const totalCost = plannedStops.reduce((sum, s) => sum + s.costInr, 0);

  // Calm Index calculation
  const calmScore = isLowSoc ? 74 : 86;
  const calmLine = isLowSoc
    ? '74. Low starting SoC requires early top-up at Attibele. Gaps remain safe under 110 km.'
    : '86. Well-spaced dual stops at Krishnagiri and Vellore. Reliable 60-120 kW chargers.';

  // Sawtooth ribbon series
  const ribbonPoints = [{ distanceKm: 0, socPct: currentSoc, type: 'drive' as const }];
  let runningKm = 0;
  plannedStops.forEach((st) => {
    ribbonPoints.push({ distanceKm: st.station.distanceAlongRoute, socPct: st.arrivalSocPct, type: 'drive' as const });
    ribbonPoints.push({ distanceKm: st.station.distanceAlongRoute, socPct: st.departureSocPct, type: 'charge' as const });
    runningKm = st.station.distanceAlongRoute;
  });
  ribbonPoints.push({ distanceKm: 345, socPct: 24, type: 'drive' as const });

  const fastest: TripAlternative = {
    label: 'Fastest',
    stops: plannedStops,
    totals: {
      distanceKm: 345,
      driveMinutes: totalDriveMin,
      chargeMinutes: totalChargeMin,
      totalMinutes: totalDriveMin + totalChargeMin,
      costInr: totalCost,
      arrivalSocPct: 24,
    },
    calmIndex: { score: calmScore, line: calmLine },
    ribbonSeries: {
      points: ribbonPoints,
      chargeBars: plannedStops.map((st) => ({
        km: st.station.distanceAlongRoute,
        chargeKwh: st.chargeKwh,
        chargeMinutes: st.chargeMinutes,
      })),
    },
  };

  const safest: TripAlternative = {
    ...fastest,
    label: 'Safest',
    calmIndex: {
      score: Math.min(94, calmScore + 6),
      line: '92. Maximizes dual-connector redundancy and targets >25% buffer at every stop.',
    },
  };

  const realWhPerKm = vehicle?.whPerKmHwy || 140;
  const usableKwh = vehicle?.usableKwh || 40;
  const reachabilityKm = Math.round((currentSoc / 100) * ((usableKwh * 1000) / realWhPerKm) * 0.75);

  res.json({
    alternatives: [fastest, safest],
    reachabilityKm,
  });
});

// ── POST /api/plan/replan (Plan B) ────────────────────────────
app.post('/api/plan/replan', (req: Request, res: Response) => {
  const { currentDistanceKm = 150, currentSoc = 48, failedStationIds = [] } = req.body || {};

  const stations = BLR_STATIONS_FIXTURE as any[];
  // Re-route alternative: Zeon Hosur or Ambur
  const altStation = stations.find((s) => s.id === 'hosur-1') || stations[3];

  const newStop = {
    station: {
      ...altStation,
      distanceAlongRoute: 180,
      availability: { probFree: 0.88, label: 'Reported 4 min ago', forecast12h: [0.8, 0.8, 0.8] },
    },
    arrivalSocPct: 30,
    departureSocPct: 80,
    chargeMinutes: 22,
    chargeKwh: 19.5,
    costInr: 351,
    detourMinutes: 4,
    reliabilityScore: 0.95,
  };

  const replanned: TripAlternative = {
    label: 'Fastest',
    stops: [newStop],
    totals: {
      distanceKm: 349,
      driveMinutes: 339,
      chargeMinutes: 22,
      totalMinutes: 361,
      costInr: 351,
      arrivalSocPct: 22,
    },
    calmIndex: {
      score: 80,
      line: '80. Switched from failed stop. Route remains comfortable with Hosur hub.',
    },
    ribbonSeries: {
      points: [
        { distanceKm: 0, socPct: currentSoc, type: 'drive' as const },
        { distanceKm: 180, socPct: 30, type: 'drive' as const },
        { distanceKm: 180, socPct: 80, type: 'charge' as const },
        { distanceKm: 349, socPct: 22, type: 'drive' as const },
      ],
      chargeBars: [{ km: 180, chargeKwh: 19.5, chargeMinutes: 22 }],
    },
  };

  res.json({
    alternatives: [replanned, { ...replanned, label: 'Safest' }],
    delta: {
      message: 'Stop 2 reported down. Switched to Zeon Hosur. +9 min, +4 km.',
      addedMinutes: 9,
      addedKm: 4,
      reroutedStopName: 'Zeon Hosur',
    },
  });
});

// ── POST /api/plan/sos ────────────────────────────────────────
app.post('/api/plan/sos', (req: Request, res: Response) => {
  const { currentSoc = 12 } = req.body || {};
  const stations = BLR_STATIONS_FIXTURE as any[];

  res.json({
    options: [
      {
        station: stations[2] || stations[0],
        distanceKm: 8.2,
        etaMin: 11,
        arrivalSoc: Math.max(4, currentSoc - 3),
        rationale: 'Nearest active 50kW DC charger with 2 available plugs.',
      },
      {
        station: stations[3] || stations[1],
        distanceKm: 14.5,
        etaMin: 18,
        arrivalSoc: Math.max(2, currentSoc - 5),
        rationale: 'High reliability 60kW hub at Hosur Bypass.',
      },
      {
        station: stations[4] || stations[2],
        distanceKm: 22.0,
        etaMin: 26,
        arrivalSoc: Math.max(1, currentSoc - 8),
        rationale: 'Fast 120kW Superhub along Krishnagiri corridor.',
      },
    ],
  });
});

// ── POST /api/reports ─────────────────────────────────────────
app.post('/api/reports', (req: Request, res: Response) => {
  const { stationId, status, queueMin, deviceId } = req.body || {};

  if (!stationId || !status || !deviceId) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'stationId, status, and deviceId are required',
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }

  // Rate limiting: 1 report per station per device per 10 minutes (600s)
  const rateLimitKey = `${deviceId}:${stationId}`;
  const lastReportTime = reportRateLimits.get(rateLimitKey);
  const now = Date.now();

  if (lastReportTime && now - lastReportTime < 600000) {
    const retryAfterSec = Math.ceil((600000 - (now - lastReportTime)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `Already reported. Try again in ${retryAfterSec} s.`,
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }

  reportRateLimits.set(rateLimitKey, now);

  const newReport: CommunityReport = {
    id: `rep-${Date.now()}`,
    stationId,
    status,
    queueMin: queueMin || 0,
    deviceId,
    createdAt: new Date().toISOString(),
    weight: 1.0,
  };

  reportsStore.push(newReport);

  // Broadcast to all active SSE clients
  const sseData = `event: report\ndata: ${JSON.stringify(newReport)}\n\n`;
  sseClients.forEach((client) => client.write(sseData));

  res.status(201).json({ success: true, report: newReport });
});

// ── GET /api/reports ──────────────────────────────────────────
app.get('/api/reports', (req: Request, res: Response) => {
  res.json(reportsStore.slice(-20));
});

// ── GET /api/reports/stream (SSE) ─────────────────────────────
app.get('/api/reports/stream', (req: Request, res: Response) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ── POST /api/trips ───────────────────────────────────────────
app.post('/api/trips', (req: Request, res: Response) => {
  const tripId = `trip-${Date.now()}`;
  tripsStore.set(tripId, { id: tripId, ...req.body, createdAt: new Date().toISOString() });
  res.json({ id: tripId });
});

// ── GET /api/trips/:id ────────────────────────────────────────
app.get('/api/trips/:id', (req: Request, res: Response) => {
  const trip = tripsStore.get(req.params.id);
  if (!trip) {
    // Provide fallback mock trip if requested for demo
    if (req.params.id === 'blr-chennai') {
      res.json({
        id: 'blr-chennai',
        originLabel: 'Bengaluru, MG Road, Karnataka',
        destLabel: 'Chennai, Marina Beach, Tamil Nadu',
        createdAt: new Date().toISOString(),
        plan: {
          label: 'Fastest',
          totals: { distanceKm: 345, driveMinutes: 330, chargeMinutes: 43, totalMinutes: 373, costInr: 702, arrivalSocPct: 24 },
          calmIndex: { score: 86, line: '86. Well-spaced dual stops at Krishnagiri and Vellore.' },
          stops: [],
          ribbonSeries: { points: [] },
        },
      });
      return;
    }

    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Trip not found',
        requestId: res.getHeader('X-Request-Id'),
      },
    });
    return;
  }
  res.json(trip);
});

// Export app and start server if run directly
export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PlugIt Backend Service] Running at http://localhost:${PORT}`);
  });
}
