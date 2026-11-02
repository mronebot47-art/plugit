import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';
import { VEHICLES, Vehicle } from './data/vehicles';
import { STATIONS, Station } from './data/stations';
import { computePlan, PlanOutput } from './planner/dijkstra';
import { haversineKm } from './planner/geo';

const app = new Hono();
const reportEmitter = new EventEmitter();

// In-memory stores
const inMemoryReports: any[] = [];
const inMemoryTrips = new Map<string, any>();

// Seed default trip
inMemoryTrips.set('blr-chennai', {
  id: 'blr-chennai',
  routeId: 'blr-chennai',
  originLabel: 'Bengaluru, MG Road, Karnataka',
  destLabel: 'Chennai, Marina Beach, Tamil Nadu',
  startSoc: 80,
  targetArrivalSoc: 15,
  mode: 'normal',
  selectedLabel: 'Fastest',
  departAt: new Date().toISOString(),
  vehicle: VEHICLES[0],
});

// ── CORS & Universal Headers Middleware ─────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || '';
  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (allowed.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, X-PlugIt-Demo');
  c.header('Access-Control-Expose-Headers', 'X-PlugIt-Source, X-Request-Id, Retry-After, ETag');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Max-Age', '600');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  const reqId = c.req.header('x-request-id') || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`);
  c.header('X-Request-Id', reqId);
  c.header('X-PlugIt-Source', 'live');

  await next();
});

// ── GET /api/health ───────────────────────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'PlugIt Backend (Hono)',
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/vehicles ─────────────────────────────────────────
app.get('/api/vehicles', (c) => {
  return c.json(VEHICLES);
});

// ── GET /api/geocode ──────────────────────────────────────────
app.get('/api/geocode', (c) => {
  const q = (c.req.query('q') || '').toLowerCase().trim();
  const places = [
    { label: 'Bengaluru, MG Road, Karnataka', lat: 12.9756, lng: 77.6097 },
    { label: 'Bengaluru Airport, Devanahalli, Karnataka', lat: 13.1986, lng: 77.7066 },
    { label: 'Chennai, Marina Beach, Tamil Nadu', lat: 13.0334, lng: 80.2785 },
    { label: 'Chennai Airport, Meenambakkam, Tamil Nadu', lat: 12.9941, lng: 80.1709 },
    { label: 'Hosur Bypass, Tamil Nadu', lat: 12.7354, lng: 77.8324 },
    { label: 'Krishnagiri Toll Plaza, NH 44, Tamil Nadu', lat: 12.5266, lng: 78.2144 },
    { label: 'Vellore Green Circle, NH 48, Tamil Nadu', lat: 12.9165, lng: 79.1325 },
    { label: 'Hyderabad, Gachibowli, Telangana', lat: 17.4401, lng: 78.3489 },
    { label: 'Mysuru, Palace Circle, Karnataka', lat: 12.3051, lng: 76.6551 },
  ];

  const matched = places.filter((p) => p.label.toLowerCase().includes(q));
  return c.json(matched.length > 0 ? matched : places.slice(0, 5));
});

// ── POST /api/route ───────────────────────────────────────────
app.post('/api/route', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { origin, dest } = body || {};

  if (!origin || !dest) {
    return c.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Origin and dest are required',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // High-fidelity Bengaluru to Chennai NH 44 / NH 48 highway waypoints
  const highwayWaypoints: [number, number][] = [
    [origin.lng, origin.lat],
    [77.6231, 12.9176], // Silk Board / Electronic City elevated
    [77.6602, 12.8452], // Electronic City
    [77.689, 12.812], // Bommasandra
    [77.7712, 12.7785], // Attibele border (toll)
    [77.8324, 12.7354], // Hosur bypass
    [78.0125, 12.671], // Shoolagiri
    [78.115, 12.593], // Kurubarapalli
    [78.2144, 12.5266], // Krishnagiri junction
    [78.361, 12.551], // Bargur
    [78.52, 12.61], // Natrampalli
    [78.615, 12.684], // Vaniyambadi
    [78.7165, 12.7915], // Ambur
    [78.852, 12.845], // Madhanur
    [78.961, 12.887], // Pallikonda
    [79.1325, 12.9165], // Vellore Green Circle
    [79.378, 12.935], // Ranipet / Walajapet
    [79.62, 12.905], // Kaveripakkam
    [79.715, 12.842], // Kanchipuram bypass
    [79.845, 12.91], // Sunguvarchatram
    [79.9458, 12.9692], // Sriperumbudur
    [80.098, 13.045], // Poonamallee bypass
    [80.158, 13.036], // Porur
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

  const routeData = {
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

  return c.json(routeData);
});

// ── GET /api/stations ─────────────────────────────────────────
app.get('/api/stations', (c) => {
  return c.json(STATIONS);
});

// ── GET /api/stations/corridor ────────────────────────────────
app.get('/api/stations/corridor', (c) => {
  return c.json(STATIONS);
});

// ── POST /api/plan ────────────────────────────────────────────
app.post('/api/plan', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { startSoc, targetArrivalSoc = 15, vehicle, custom, mode = 'normal', routeId = 'blr-chennai', geometry } = body || {};
  const currentSoc = typeof startSoc === 'number' ? startSoc : 80;

  // 422 Check: If starting charge is below 15% and cannot make first 100km stop
  if (currentSoc < 15) {
    return c.json(
      {
        error: {
          code: 'NO_FEASIBLE_PLAN',
          message: 'Insufficient starting battery to reach the first charging hub. Minimum 15% required.',
          details: {
            longestGapKm: 105,
            vehicleRealRangeKm: 38,
            suggestion: 'Charge to at least 25% locally before departing onto the highway.',
          },
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      422
    );
  }

  const activeVehicle: Vehicle = custom || vehicle || VEHICLES[0]!;
  const routeGeometry = geometry || {
    coordinates: [
      [77.6097, 12.9756],
      [77.7712, 12.7785],
      [78.2144, 12.5266],
      [79.1325, 12.9165],
      [80.2785, 13.0334],
    ],
  };

  const planResult = computePlan({
    routeId,
    geometry: routeGeometry,
    vehicle: activeVehicle,
    startSoc: currentSoc,
    targetArrivalSoc,
    mode,
    stations: STATIONS,
  });

  return c.json(planResult);
});

// ── POST /api/plan/replan ─────────────────────────────────────
app.post('/api/plan/replan', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    routeId = 'blr-chennai',
    vehicle = VEHICLES[0],
    currentDistanceKm = 105,
    currentSoc = 24,
    failedStationIds = ['krishnagiri-1'],
    mode = 'normal',
  } = body || {};

  const routeGeometry = {
    coordinates: [
      [77.6097, 12.9756],
      [77.7712, 12.7785],
      [78.2144, 12.5266],
      [79.1325, 12.9165],
      [80.2785, 13.0334],
    ] as [number, number][],
  };

  const planResult = computePlan({
    routeId,
    geometry: routeGeometry,
    vehicle,
    startSoc: currentSoc,
    mode,
    stations: STATIONS,
    failedStationIds,
  });

  const replanResponse = {
    alternatives: planResult.alternatives,
    delta: {
      message: 'Stop 1 (ChargeZone Krishnagiri) reported down. Rerouted to Tata Power Fast Hub. +7 min, +3 km.',
      addedMinutes: 7,
      addedKm: 3,
      reroutedStopName: 'Tata Power Fast Hub - Krishnagiri',
    },
  };

  return c.json(replanResponse);
});

// ── POST /api/plan/sos ────────────────────────────────────────
app.post('/api/plan/sos', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { lat = 12.9716, lng = 77.5946, currentSoc = 15 } = body || {};

  const options = STATIONS.slice(0, 3).map((st, i) => {
    const dist = Math.round(haversineKm({ lat, lng }, { lat: st.lat, lng: st.lng }));
    return {
      station: st,
      distanceKm: dist || (i + 1) * 8,
      etaMin: Math.round(((dist || (i + 1) * 8) / 45) * 60),
      arrivalSoc: Math.max(3, currentSoc - Math.round(((dist || 10) * 0.15))),
      rationale: `${st.maxKw} kW DC charger &middot; 2 plugs free &middot; Verified working`,
    };
  });

  return c.json({ options });
});

// ── POST /api/reports ─────────────────────────────────────────
app.post('/api/reports', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { stationId, status, waitMinutes, note } = body || {};

  const report = {
    id: `rep-${Date.now()}`,
    stationId,
    status: status || 'working',
    waitMinutes: waitMinutes || 0,
    note: note || '',
    createdAt: new Date().toISOString(),
  };

  inMemoryReports.unshift(report);
  reportEmitter.emit('newReport', report);

  return c.json(report, 201);
});

// ── GET /api/reports ──────────────────────────────────────────
app.get('/api/reports', (c) => {
  return c.json(inMemoryReports);
});

// ── GET /api/reports/stream (SSE) ─────────────────────────────
app.get('/api/reports/stream', async (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ message: 'Connected to PlugIt Community Reports stream' }),
    });

    const listener = async (report: any) => {
      await stream.writeSSE({
        event: 'report',
        data: JSON.stringify(report),
      });
    };

    reportEmitter.on('newReport', listener);

    stream.onAbort(() => {
      reportEmitter.off('newReport', listener);
    });

    // Send keepalive ping every 25 seconds
    while (true) {
      await stream.sleep(25000);
      await stream.writeSSE({ event: 'ping', data: '1' });
    }
  });
});

// ── POST /api/trips ───────────────────────────────────────────
app.post('/api/trips', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = `trip-${Date.now()}`;
  const record = { ...body, id, createdAt: new Date().toISOString() };
  inMemoryTrips.set(id, record);
  return c.json(record);
});

// ── GET /api/trips/:id ────────────────────────────────────────
app.get('/api/trips/:id', (c) => {
  const id = c.req.param('id');
  const trip = inMemoryTrips.get(id);

  if (!trip) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `Trip with id ${id} not found`,
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      404
    );
  }

  return c.json(trip);
});

// ── Start Node Server ─────────────────────────────────────────
const PORT = Number(process.env.PORT) || 8000;
console.log(`[PlugIt Backend (Hono)] Running at http://localhost:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
});
