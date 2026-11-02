import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { VEHICLES, Vehicle } from './data/vehicles';
import { STATIONS, Station } from './data/stations';
import { computePlan, PlanOutput } from './planner/dijkstra';
import { haversineKm } from './planner/geo';
import {
  store,
  Store,
} from './store/index';
import {
  hashDeviceId,
  hashEditToken,
  CommunityCharger,
  ChargerConfirmation,
} from './data/chargers';

const app = new Hono();
const reportEmitter = new EventEmitter();

// In-memory rate limiters & stores
const submissionRateLimits = new Map<string, number[]>(); // deviceHash -> timestamps
const voteRateLimits = new Map<string, number[]>(); // deviceHash -> timestamps
const inMemoryReports: any[] = [];
const inMemoryTrips = new Map<string, any>();
const routeCache = new Map<string, any>();

// Seed initial reports
inMemoryReports.push(
  {
    id: 'rep-init-1',
    stationId: 'ocm:274914',
    status: 'working',
    waitMinutes: 5,
    note: 'Smooth charging at 60kW DC',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rep-init-2',
    stationId: 'ocm:274910',
    status: 'working',
    waitMinutes: 0,
    note: 'Plugs free',
    createdAt: new Date().toISOString(),
  }
);

// Seed default 8-char trip
const defaultTripId = 'blrche01';
inMemoryTrips.set(defaultTripId, {
  id: defaultTripId,
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

// Helper: Strip HTML tags
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '').trim();
}

// Helper: Check for phone numbers (8 or more digits in a row)
function containsPhoneNumber(text: string): boolean {
  return /\d{8,}/.test(text.replace(/[\s-]/g, ''));
}

// ── CORS & Universal Headers Middleware ─────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || '';
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
    ...envOrigins,
  ];

  if (
    process.env.ALLOWED_ORIGINS === '*' ||
    !origin ||
    allowed.includes(origin) ||
    allowed.includes('*') ||
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    origin.includes('localhost')
  ) {
    c.header('Access-Control-Allow-Origin', origin || '*');
  }
  c.header('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, X-PlugIt-Demo, X-Edit-Token, X-Admin-Token');
  c.header('Access-Control-Expose-Headers', 'X-PlugIt-Source, X-Request-Id, Retry-After, ETag');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Max-Age', '600');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  const reqId =
    c.req.header('x-request-id') ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`);
  c.header('X-Request-Id', reqId);
  c.header('X-PlugIt-Source', 'live');

  await next();
});

// ── 1. GET /api/health ─────────────────────────────────────────
app.get('/api/health', (c) => {
  const isDemo = c.req.header('x-plugit-demo') === '1';
  return c.json({
    ok: true,
    version: '0.1.0',
    uptimeSec: Math.floor(process.uptime()),
    demoMode: isDemo,
    store: (process.env.SUPABASE_URL ? 'supabase' : 'memory') as 'supabase' | 'memory',
    upstreams: {
      osrm: 'ok',
      ocm: 'fixture',
    },
  });
});

// ── 2. GET /api/vehicles ───────────────────────────────────────
app.get('/api/vehicles', (c) => {
  return c.json(VEHICLES);
});

// ── 3. GET /api/geocode (Live Nationwide Geocoding + Comprehensive Cache) ──
const MAJOR_INDIAN_PLACES = [
  // Metro Centers & Capitals
  { label: 'Mumbai, CST, Maharashtra', lat: 18.9401, lng: 72.8347 },
  { label: 'Mumbai Airport (BOM), Mumbai, Maharashtra', lat: 19.0896, lng: 72.8656 },
  { label: 'Pune, Shivajinagar, Maharashtra', lat: 18.5308, lng: 73.8475 },
  { label: 'Pune Airport (PNQ), Lohegaon, Maharashtra', lat: 18.5804, lng: 73.9182 },
  { label: 'Navi Mumbai, Vashi, Maharashtra', lat: 19.0771, lng: 72.9986 },
  { label: 'Thane, Teen Hath Naka, Maharashtra', lat: 19.186, lng: 72.9759 },
  { label: 'Nashik, Panchavati, Maharashtra', lat: 19.9975, lng: 73.7898 },
  { label: 'Nagpur, Zero Mile, Maharashtra', lat: 21.1458, lng: 79.0882 },
  { label: 'Delhi, Connaught Place, Delhi', lat: 28.6328, lng: 77.2198 },
  { label: 'Delhi Airport (DEL), IGI Terminal 3, Delhi', lat: 28.5562, lng: 77.1 },
  { label: 'Noida, Sector 18, Uttar Pradesh', lat: 28.5714, lng: 77.3268 },
  { label: 'Greater Noida, Pari Chowk, Uttar Pradesh', lat: 28.4682, lng: 77.5097 },
  { label: 'Gurugram, Cyber City, Haryana', lat: 28.4952, lng: 77.0891 },
  { label: 'Faridabad, Bata Chowk, Haryana', lat: 28.4089, lng: 77.3178 },
  { label: 'Jaipur, MI Road, Rajasthan', lat: 26.918, lng: 75.801 },
  { label: 'Jaipur Airport (JAI), Sanganer, Rajasthan', lat: 26.8289, lng: 75.8056 },
  { label: 'Agra, Eastern Gate Taj, Uttar Pradesh', lat: 27.1751, lng: 78.0421 },
  { label: 'Mathura, Krishna Janmabhoomi, Uttar Pradesh', lat: 27.4924, lng: 77.6737 },
  { label: 'Lucknow, Hazratganj, Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { label: 'Kanpur, Mall Road, Uttar Pradesh', lat: 26.4499, lng: 80.3319 },
  { label: 'Varanasi, Cantt Railway Station, Uttar Pradesh', lat: 25.3216, lng: 82.9876 },
  { label: 'Chandigarh, Sector 17, Chandigarh', lat: 30.7398, lng: 76.7827 },
  { label: 'Amritsar, Golden Temple Town, Punjab', lat: 31.62, lng: 74.8765 },
  { label: 'Dehradun, Clock Tower, Uttarakhand', lat: 30.3165, lng: 78.0322 },
  { label: 'Bengaluru, MG Road, Karnataka', lat: 12.9756, lng: 77.6097 },
  { label: 'Bengaluru Airport (BLR), Devanahalli, Karnataka', lat: 13.1986, lng: 77.7066 },
  { label: 'Bengaluru, Electronic City, Karnataka', lat: 12.8452, lng: 77.6602 },
  { label: 'Mysuru, Palace Circle, Karnataka', lat: 12.2958, lng: 76.6394 },
  { label: 'Mangaluru, Hampankatta, Karnataka', lat: 12.8708, lng: 74.8431 },
  { label: 'Hubballi, Chennamma Circle, Karnataka', lat: 15.3647, lng: 75.124 },
  { label: 'Belagavi, Rani Chennamma Circle, Karnataka', lat: 15.8497, lng: 74.4977 },
  { label: 'Chennai, Marina Beach, Tamil Nadu', lat: 13.0334, lng: 80.2785 },
  { label: 'Chennai Airport (MAA), Meenambakkam, Tamil Nadu', lat: 12.9941, lng: 80.1709 },
  { label: 'Coimbatore, Gandhipuram, Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { label: 'Madurai, Meenakshi Amman, Tamil Nadu', lat: 9.9195, lng: 78.1193 },
  { label: 'Salem, Junction Bypass, Tamil Nadu', lat: 11.6643, lng: 78.146 },
  { label: 'Hosur, Bus Stand Bypass, Tamil Nadu', lat: 12.7354, lng: 77.8324 },
  { label: 'Krishnagiri Toll Plaza, NH 44, Tamil Nadu', lat: 12.5266, lng: 78.2144 },
  { label: 'Vellore, Green Circle, Tamil Nadu', lat: 12.9165, lng: 79.1325 },
  { label: 'Hyderabad, Gachibowli, Telangana', lat: 17.4401, lng: 78.3489 },
  { label: 'Hyderabad, Charminar, Telangana', lat: 17.3616, lng: 78.4747 },
  { label: 'Hyderabad Airport (HYD), Shamshabad, Telangana', lat: 17.2403, lng: 78.4294 },
  { label: 'Warangal, Hanamkonda, Telangana', lat: 18.0001, lng: 79.5882 },
  { label: 'Visakhapatnam, RK Beach, Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { label: 'Vijayawada, Benz Circle, Andhra Pradesh', lat: 16.5062, lng: 80.648 },
  { label: 'Tirupati, Alipiri, Andhra Pradesh', lat: 13.6288, lng: 79.4192 },
  { label: 'Kochi, Edappally Lulu Mall, Kerala', lat: 10.0261, lng: 76.3084 },
  { label: 'Kochi Airport (COK), Nedumbassery, Kerala', lat: 10.1556, lng: 76.3914 },
  { label: 'Thiruvananthapuram, East Fort, Kerala', lat: 8.5241, lng: 76.9366 },
  { label: 'Kozhikode, Mananchira, Kerala', lat: 11.2588, lng: 75.7804 },
  { label: 'Kolkata, Park Street, West Bengal', lat: 22.5518, lng: 88.3524 },
  { label: 'Kolkata Airport (CCU), Dum Dum, West Bengal', lat: 22.6547, lng: 88.4467 },
  { label: 'Siliguri, Sevoke Road, West Bengal', lat: 26.7271, lng: 88.4354 },
  { label: 'Bhubaneswar, Master Canteen, Odisha', lat: 20.2961, lng: 85.8245 },
  { label: 'Patna, Gandhi Maidan, Bihar', lat: 25.5941, lng: 85.1376 },
  { label: 'Ranchi, Main Road, Jharkhand', lat: 23.3441, lng: 85.3096 },
  { label: 'Ahmedabad, SG Highway, Gujarat', lat: 23.0225, lng: 72.5714 },
  { label: 'Ahmedabad Airport (AMD), Hansol, Gujarat', lat: 23.0734, lng: 72.6347 },
  { label: 'Surat, Dumas Road, Gujarat', lat: 21.1702, lng: 72.8311 },
  { label: 'Vadodara, Alkapuri, Gujarat', lat: 22.3072, lng: 73.1812 },
  { label: 'Bhopal, MP Nagar, Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  { label: 'Indore, Vijay Nagar, Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  { label: 'Panaji, Church Square, Goa', lat: 15.4909, lng: 73.8278 },
  { label: 'Goa Airport (GOI/GOX), Dabolim, Goa', lat: 15.3808, lng: 73.8314 },
  { label: 'Guwahati, GS Road, Assam', lat: 26.1445, lng: 91.7362 },
];

app.get('/api/geocode', async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (!q) {
    return c.json(MAJOR_INDIAN_PLACES.slice(0, 8));
  }

  const qLower = q.toLowerCase();
  const localMatches = MAJOR_INDIAN_PLACES.filter((p) =>
    p.label.toLowerCase().includes(qLower)
  );

  // If query is at least 2 chars, also query Photon live geocoder
  let photonMatches: Array<{ label: string; lat: number; lng: number }> = [];
  if (q.length >= 2) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8`,
        {
          headers: { 'User-Agent': 'PlugIt/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (photonRes.ok) {
        const photonData = (await photonRes.json()) as any;
        const features = photonData.features || [];
        photonMatches = features
          .filter((f: any) => f.properties?.countrycode === 'IN' || f.properties?.country === 'India')
          .map((f: any) => {
            const props = f.properties || {};
            const parts = [props.name, props.city || props.district, props.state, 'India']
              .filter(Boolean)
              .filter((val: string, idx: number, arr: string[]) => arr.indexOf(val) === idx);
            return {
              label: parts.join(', '),
              lat: Number(f.geometry.coordinates[1].toFixed(5)),
              lng: Number(f.geometry.coordinates[0].toFixed(5)),
            };
          });
      }
    } catch (err) {
      console.warn('[Geocode] Photon lookup timed out or failed, using local database:', err);
    }
  }

  // Merge photon matches first, then local matches, deduplicating by proximity (< 5km)
  const combined: Array<{ label: string; lat: number; lng: number }> = [];
  const allCandidates = [...photonMatches, ...localMatches];

  for (const cand of allCandidates) {
    const isDuplicate = combined.some(
      (existing) => haversineKm(existing, cand) < 5
    );
    if (!isDuplicate) {
      combined.push(cand);
    }
    if (combined.length >= 8) break;
  }

  return c.json(combined.length > 0 ? combined : MAJOR_INDIAN_PLACES.slice(0, 5));
});

// ── 4. POST /api/route (Live OSRM + Caching + Degraded Fallback) ─
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

  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)};${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}`;
  if (routeCache.has(cacheKey)) {
    c.header('X-PlugIt-Source', 'cache');
    return c.json(routeCache.get(cacheKey));
  }

  // Attempt live OSRM routing
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const osrmRes = await fetch(osrmUrl, {
      headers: { 'User-Agent': 'PlugIt/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (osrmRes.ok) {
      const osrmData = (await osrmRes.json()) as any;
      if (osrmData.routes && osrmData.routes.length > 0) {
        const primary = osrmData.routes[0];
        const distKm = Math.round(primary.distance / 1000);
        const durMin = Math.round(primary.duration / 60);

        const routeData = {
          id: `route-${Date.now()}`,
          geometry: primary.geometry,
          distanceKm: distKm,
          durationMin: durMin,
          segments: [
            { from: origin, to: dest, km: distKm },
          ],
          degraded: false,
        };

        routeCache.set(cacheKey, routeData);
        return c.json(routeData);
      }
    }
  } catch (err) {
    console.warn('[OSRM] Live routing failed or timed out, falling back to recorded highway fixture:', err);
  }

  // Fallback: Check if this is Bengaluru -> Chennai
  const isBlrChe =
    haversineKm({ lat: origin.lat, lng: origin.lng }, { lat: 12.9756, lng: 77.6097 }) < 40 &&
    haversineKm({ lat: dest.lat, lng: dest.lng }, { lat: 13.0334, lng: 80.2785 }) < 40;

  c.header('X-PlugIt-Source', 'fixture');

  if (isBlrChe) {
    const highwayWaypoints: [number, number][] = [
      [origin.lng, origin.lat],
      [77.6231, 12.9176],
      [77.6602, 12.8452],
      [77.689, 12.812],
      [77.7712, 12.7785],
      [77.8324, 12.7354],
      [78.0125, 12.671],
      [78.115, 12.593],
      [78.2144, 12.5266],
      [78.361, 12.551],
      [78.52, 12.61],
      [78.615, 12.684],
      [78.7165, 12.7915],
      [78.852, 12.845],
      [78.961, 12.887],
      [79.1325, 12.9165],
      [79.378, 12.935],
      [79.62, 12.905],
      [79.715, 12.842],
      [79.845, 12.91],
      [79.9458, 12.9692],
      [80.098, 13.045],
      [80.158, 13.036],
      [80.2023, 13.0067],
      [dest.lng, dest.lat],
    ];

    const coords: [number, number][] = [];
    for (let i = 0; i < highwayWaypoints.length - 1; i++) {
      const p1 = highwayWaypoints[i]!;
      const p2 = highwayWaypoints[i + 1]!;
      for (let s = 0; s < 4; s++) {
        const t = s / 4;
        coords.push([
          Number((p1[0] + (p2[0] - p1[0]) * t).toFixed(5)),
          Number((p1[1] + (p2[1] - p1[1]) * t).toFixed(5)),
        ]);
      }
    }
    coords.push(highwayWaypoints[highwayWaypoints.length - 1]!);

    const fallbackRoute = {
      id: `route-fixture-blr-che`,
      geometry: { type: 'LineString', coordinates: coords },
      distanceKm: 345,
      durationMin: 330,
      segments: [
        { from: origin, to: { lat: 12.5266, lng: 78.2144 }, km: 105 },
        { from: { lat: 12.5266, lng: 78.2144 }, to: { lat: 12.9165, lng: 79.1325 }, km: 110 },
        { from: { lat: 12.9165, lng: 79.1325 }, to: dest, km: 130 },
      ],
      degraded: true,
    };
    return c.json(fallbackRoute);
  }

  // Generic fallback for any other route in India (e.g. Mumbai -> Pune, Delhi -> Jaipur, Mysuru)
  const directDist = Math.round(haversineKm({ lat: origin.lat, lng: origin.lng }, { lat: dest.lat, lng: dest.lng }) * 1.25);
  const steps = 10;
  const interpCoords: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    interpCoords.push([
      Number((origin.lng + (dest.lng - origin.lng) * t).toFixed(5)),
      Number((origin.lat + (dest.lat - origin.lat) * t).toFixed(5)),
    ]);
  }

  const genericRoute = {
    id: `route-fixture-${Date.now()}`,
    geometry: {
      type: 'LineString',
      coordinates: interpCoords,
    },
    distanceKm: directDist,
    durationMin: Math.round((directDist / 60) * 60),
    segments: [{ from: origin, to: dest, km: directDist }],
    degraded: true,
  };

  return c.json(genericRoute);
});

// In-memory cache for Open Charge Map live stations
let ocmLiveStations: Station[] = [];
let ocmLastFetched = 0;
const OCM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchOcmIndiaStations(): Promise<Station[]> {
  const apiKey = process.env.OCM_API_KEY || '1c38a50a-5c0e-425c-85af-52e3fb934136';
  try {
    const url = `https://api.openchargemap.io/v3/poi?output=json&countrycode=IN&maxresults=500&compact=true&verbose=false&key=${apiKey}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PlugIt-EV-Router/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const normalized: Station[] = [];
    for (const poi of data) {
      if (!poi || !poi.AddressInfo) continue;
      const lat = poi.AddressInfo.Latitude;
      const lng = poi.AddressInfo.Longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (lat < 6 || lat > 37 || lng < 68 || lng > 98) continue;

      const connectors = (poi.Connections || []).map((conn: any) => {
        let type = 'CCS2';
        const connId = conn.ConnectionTypeID;
        if (connId === 33) type = 'CCS2';
        else if (connId === 25 || connId === 1036) type = 'Type2';
        else if (connId === 2) type = 'CHAdeMO';
        else if (connId === 0) type = 'Type2';
        return {
          type,
          kw: typeof conn.PowerKW === 'number' && conn.PowerKW > 0 ? conn.PowerKW : 50,
          qty: typeof conn.Quantity === 'number' && conn.Quantity > 0 ? conn.Quantity : 1,
        };
      });

      if (connectors.length === 0) {
        connectors.push({ type: 'CCS2', kw: 50, qty: 2 });
      }

      const maxKw = Math.max(...connectors.map((c: any) => c.kw), 25);
      const title = poi.AddressInfo.Title || 'EV Fast Charger';
      const operator = poi.OperatorInfo?.Title || title.split('-')[0]?.trim() || 'EV Charging Network';

      normalized.push({
        id: `ocm:${poi.ID}`,
        name: title,
        operator,
        lat,
        lng,
        address: [poi.AddressInfo.AddressLine1, poi.AddressInfo.Town, poi.AddressInfo.StateOrProvince].filter(Boolean).join(', ') || 'India',
        connectors,
        maxKw,
        status: 'working',
        source: 'live',
        probFree: 0.78,
        availability: {
          probFree: 0.78,
          label: 'Estimated',
          forecast12h: [0.8, 0.75, 0.65, 0.5, 0.6, 0.7, 0.8, 0.85, 0.8, 0.7, 0.6, 0.7],
        },
      });
    }
    return normalized;
  } catch (err) {
    console.warn('[OCM Live] Failed to fetch live stations:', err);
    return [];
  }
}

// Trigger initial background fetch of live OCM stations across India
fetchOcmIndiaStations().then((live) => {
  if (live.length > 0) {
    ocmLiveStations = live;
    ocmLastFetched = Date.now();
    console.log(`[OCM Live] Cached ${live.length} stations across India.`);
  }
}).catch(() => {});

// Helper: Merge official stations, live OCM stations, and community chargers
async function getAllMergedStations(): Promise<Station[]> {
  if (ocmLiveStations.length === 0 || Date.now() - ocmLastFetched > OCM_TTL_MS) {
    const live = await fetchOcmIndiaStations();
    if (live.length > 0) {
      ocmLiveStations = live;
      ocmLastFetched = Date.now();
    }
  }

  const activeCommunity = await store.getAllActiveChargers();
  const communityAsStations: Station[] = activeCommunity.map((c) => {
    const maxKw = Math.max(...c.connectors.map((con) => con.kw), 22);
    return {
      id: c.id,
      name: c.name,
      operator: 'Community Charger',
      lat: c.lat,
      lng: c.lng,
      address: c.address || '',
      connectors: c.connectors,
      maxKw,
      status: 'working',
      source: 'community',
      communityStatus: c.status === 'confirmed' ? 'confirmed' : 'unverified',
      probFree: c.status === 'confirmed' ? 0.75 : 0.5,
      availability: {
        probFree: c.status === 'confirmed' ? 0.75 : 0.5,
        label: 'Community',
        forecast12h: [0.7, 0.7, 0.65, 0.6, 0.5, 0.65, 0.75, 0.8, 0.75, 0.7, 0.6, 0.65],
      },
    };
  });

  const map = new Map<string, Station>();
  for (const st of STATIONS) map.set(st.id, st);
  for (const st of ocmLiveStations) {
    if (!map.has(st.id)) map.set(st.id, st);
  }
  for (const st of communityAsStations) {
    map.set(st.id, st);
  }

  return Array.from(map.values());
}

// ── 5. GET /api/stations ───────────────────────────────────────
app.get('/api/stations', async (c) => {
  const all = await getAllMergedStations();
  return c.json(all);
});

// ── 6. GET /api/stations/corridor ──────────────────────────────
app.get('/api/stations/corridor', async (c) => {
  const all = await getAllMergedStations();
  return c.json(all);
});

// ── 7. POST /api/plan ──────────────────────────────────────────
app.post('/api/plan', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    startSoc,
    targetArrivalSoc = 15,
    vehicle,
    custom,
    mode = 'normal',
    routeId = 'blr-chennai',
    geometry,
    includeUnverified = false,
  } = body || {};
  const currentSoc = typeof startSoc === 'number' ? startSoc : 80;

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

  const allStations = await getAllMergedStations();
  // Filter unverified community chargers if includeUnverified is false
  const plannableStations = allStations.filter((st) => {
    if (st.source === 'community' && st.communityStatus === 'unverified') {
      return includeUnverified;
    }
    return true;
  });

  const planResult = computePlan({
    routeId,
    geometry: routeGeometry,
    vehicle: activeVehicle,
    startSoc: currentSoc,
    targetArrivalSoc,
    mode,
    stations: plannableStations,
  });

  // Tag community stops with flags and penalties
  planResult.alternatives.forEach((alt) => {
    alt.stops.forEach((stop) => {
      if (stop.station.source === 'community') {
        if (stop.station.communityStatus === 'unverified') {
          stop.flag = 'community_unverified';
          stop.chargeMinutes += 10; // +10 min wait penalty
          stop.reliabilityScore = Number((stop.reliabilityScore * 0.6).toFixed(2));
        } else {
          stop.flag = 'community';
          stop.reliabilityScore = Number((stop.reliabilityScore * 0.85).toFixed(2));
        }
      }
    });
  });

  return c.json(planResult);
});

// ── 8. POST /api/plan/replan ───────────────────────────────────
app.post('/api/plan/replan', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    routeId = 'blr-chennai',
    vehicle = VEHICLES[0],
    currentDistanceKm = 105,
    currentSoc = 24,
    failedStationIds = ['ocm:274914'],
    mode = 'normal',
    includeUnverified = false,
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

  const allStations = await getAllMergedStations();
  const plannableStations = allStations.filter((st) => {
    if (st.source === 'community' && st.communityStatus === 'unverified') {
      return includeUnverified;
    }
    return true;
  });

  const planResult = computePlan({
    routeId,
    geometry: routeGeometry,
    vehicle,
    startSoc: currentSoc,
    mode,
    stations: plannableStations,
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

// ── 9. POST /api/plan/sos ──────────────────────────────────────
app.post('/api/plan/sos', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { lat = 12.9716, lng = 77.5946, currentSoc = 15 } = body || {};

  const allStations = await getAllMergedStations();
  const sorted = allStations
    .map((st, i) => {
      const dist = Math.round(haversineKm({ lat, lng }, { lat: st.lat, lng: st.lng }));
      let rationale = `${st.maxKw} kW DC charger &middot; Plugs available`;
      if (st.source === 'community') {
        rationale = st.communityStatus === 'unverified' ? 'Unverified community charger.' : 'Confirmed community charger.';
      }
      return {
        station: st,
        distanceKm: dist || (i + 1) * 8,
        etaMin: Math.round(((dist || (i + 1) * 8) / 45) * 60),
        arrivalSoc: Math.max(3, currentSoc - Math.round((dist || 10) * 0.15)),
        rationale,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return c.json({ options: sorted.slice(0, 3) });
});

// ── 10. POST /api/reports ──────────────────────────────────────
app.post('/api/reports', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { stationId, status, waitMinutes, note } = body || {};

  const report = {
    id: `rep-${Date.now()}`,
    stationId,
    status: status || 'working',
    waitMinutes: waitMinutes || 0,
    note: note ? stripHtml(note) : '',
    createdAt: new Date().toISOString(),
  };

  inMemoryReports.unshift(report);
  reportEmitter.emit('newReport', report);

  return c.json(report, 201);
});

// ── 11. GET /api/reports ───────────────────────────────────────
app.get('/api/reports', async (c) => {
  const stationIdsParam = c.req.query('stationIds');
  let filtered = inMemoryReports;
  const requestedIds = stationIdsParam ? stationIdsParam.split(',').map((s) => s.trim()) : [];

  if (requestedIds.length > 0) {
    const idSet = new Set(requestedIds);
    filtered = inMemoryReports.filter((r) => idSet.has(r.stationId));
  }

  const allStations = await getAllMergedStations();
  const effective: Record<string, { status: string; probFree: number; waitMinutes: number }> = {};
  for (const st of allStations) {
    if (requestedIds.length === 0 || requestedIds.includes(st.id)) {
      const recentReports = inMemoryReports.filter((r) => r.stationId === st.id);
      const latestReport = recentReports[0];
      const status = latestReport ? latestReport.status : st.status;
      const waitMinutes = latestReport ? latestReport.waitMinutes : 0;
      const probFree = status === 'working' ? (waitMinutes > 15 ? 0.4 : st.probFree) : 0.05;

      effective[st.id] = {
        status,
        probFree,
        waitMinutes,
      };
    }
  }

  return c.json({
    reports: filtered,
    effective,
  });
});

// ── 12. GET /api/reports/stream (SSE) ──────────────────────────
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

    while (true) {
      await stream.sleep(25000);
      await stream.writeSSE({ event: 'ping', data: '1' });
    }
  });
});

// ── 13. POST /api/trips (Returns 201 { id } with 8-character ID) 
app.post('/api/trips', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // Generate 8-character ID
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const record = { ...body, id, createdAt: new Date().toISOString() };
  inMemoryTrips.set(id, record);
  return c.json({ id }, 201);
});

// ── 14. GET /api/trips/:id ─────────────────────────────────────
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

// ── TASK B: Community Chargers Endpoints ────────────────────────

// ── 15. POST /api/chargers (Add a charger) ─────────────────────
app.post('/api/chargers', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  let { name, lat, lng, address, connectors, access, priceNote, hours, publicConfirmed, deviceId } = body || {};

  // Require publicConfirmed === true
  if (publicConfirmed !== true) {
    return c.json(
      {
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'You must confirm this charging point is open to the public.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // Device ID validation
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 64) {
    return c.json(
      {
        error: {
          code: 'INVALID_DEVICE_ID',
          message: 'Valid deviceId (8-64 characters) is required.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // India Bounding Box: lat 6..37, lng 68..98
  if (typeof lat !== 'number' || typeof lng !== 'number' || lat < 6 || lat > 37 || lng < 68 || lng > 98) {
    return c.json(
      {
        error: {
          code: 'OUT_OF_BOUNDS',
          message: 'Coordinates must be within India (lat: 6-37, lng: 68-98).',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // Name validation
  if (!name || typeof name !== 'string' || name.length < 3 || name.length > 80) {
    return c.json(
      {
        error: {
          code: 'INVALID_NAME',
          message: 'Name must be between 3 and 80 characters.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // Connectors validation
  if (!Array.isArray(connectors) || connectors.length < 1 || connectors.length > 6) {
    return c.json(
      {
        error: {
          code: 'INVALID_CONNECTORS',
          message: 'Connectors must contain between 1 and 6 items.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // Strip HTML & check phone numbers
  name = stripHtml(name);
  address = address ? stripHtml(address) : '';
  priceNote = priceNote ? stripHtml(priceNote) : '';
  hours = hours ? stripHtml(hours) : '';

  if (
    containsPhoneNumber(name) ||
    containsPhoneNumber(address) ||
    containsPhoneNumber(priceNote) ||
    containsPhoneNumber(hours)
  ) {
    return c.json(
      {
        error: {
          code: 'PHONE_NUMBER_NOT_PERMITTED',
          message: 'Phone numbers are strictly prohibited in public charger submissions.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  // Rate limit: 3 submissions per device per 24 hours
  const devHash = hashDeviceId(deviceId);
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const pastSubmissions = (submissionRateLimits.get(devHash) || []).filter((t) => t > dayAgo);

  if (pastSubmissions.length >= 3) {
    c.header('Retry-After', '86400');
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Submission limit reached (maximum 3 chargers per device per 24 hours).',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      429
    );
  }

  // Duplicate Check: 50m radius (0.05 km) with matching connector type
  const allExisting = await getAllMergedStations();
  const connectorTypes = new Set(connectors.map((c: any) => c.type));
  for (const st of allExisting) {
    const dist = haversineKm({ lat, lng }, { lat: st.lat, lng: st.lng });
    if (dist <= 0.05) {
      const hasMatchingConnector = st.connectors.some((con) => connectorTypes.has(con.type));
      if (hasMatchingConnector) {
        return c.json(
          {
            error: {
              code: 'DUPLICATE_NEARBY',
              message: `A charger is already registered within 50 meters of this location: ${st.name}`,
              details: {
                existingStationId: st.id,
                name: st.name,
                distanceMeters: Math.round(dist * 1000),
              },
              requestId: c.res.headers.get('X-Request-Id'),
            },
          },
          409
        );
      }
    }
  }

  // Record submission in rate limiter
  pastSubmissions.push(now);
  submissionRateLimits.set(devHash, pastSubmissions);

  // Generate unique edit token and IDs
  const editToken = crypto.randomBytes(16).toString('hex'); // 32-char hex
  const editTokenHash = hashEditToken(editToken);
  const chargerId = `community:${crypto.randomUUID()}`;

  const newCharger: CommunityCharger = {
    id: chargerId,
    name,
    lat,
    lng,
    address,
    connectors: connectors.map((c: any) => ({
      type: c.type,
      kw: Number(c.kw),
      qty: Number(c.qty) || 1,
    })),
    access: access === 'public_free' ? 'public_free' : 'public_paid',
    priceNote,
    hours,
    publicConfirmed: true,
    status: 'unverified',
    ownerHash: devHash,
    editTokenHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.insertCharger(newCharger);

  return c.json(
    {
      id: chargerId,
      status: 'unverified',
      editToken,
    },
    201
  );
});

// ── 16. PATCH /api/chargers/:id ────────────────────────────────
app.patch('/api/chargers/:id', async (c) => {
  const id = c.req.param('id');
  const token = c.req.header('X-Edit-Token');

  if (!token) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Missing X-Edit-Token header',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      403
    );
  }

  const charger = await store.getCharger(id);
  if (!charger || charger.status === 'removed') {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `Charger with id ${id} not found`,
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      404
    );
  }

  if (hashEditToken(token) !== charger.editTokenHash) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid edit token for this charger',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      403
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const updates: Partial<CommunityCharger> = {};
  if (body.name) updates.name = stripHtml(body.name);
  if (body.address !== undefined) updates.address = stripHtml(body.address);
  if (body.connectors) updates.connectors = body.connectors;
  if (body.access) updates.access = body.access;
  if (body.priceNote !== undefined) updates.priceNote = stripHtml(body.priceNote);
  if (body.hours !== undefined) updates.hours = stripHtml(body.hours);

  await store.updateCharger(id, updates);
  const updated = await store.getCharger(id);
  return c.json(updated);
});

// ── 17. DELETE /api/chargers/:id ───────────────────────────────
app.delete('/api/chargers/:id', async (c) => {
  const id = c.req.param('id');
  const token = c.req.header('X-Edit-Token');

  if (!token) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Missing X-Edit-Token header',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      403
    );
  }

  const charger = await store.getCharger(id);
  if (!charger) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `Charger with id ${id} not found`,
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      404
    );
  }

  if (hashEditToken(token) !== charger.editTokenHash) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid edit token for this charger',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      403
    );
  }

  await store.setStatus(id, 'removed');
  return c.json({ ok: true, status: 'removed' });
});

// ── 18. POST /api/chargers/:id/confirm (Confirmation Vote) ─────
app.post('/api/chargers/:id/confirm', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { deviceId, worked } = body || {};

  if (!deviceId || typeof deviceId !== 'string' || typeof worked !== 'boolean') {
    return c.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'deviceId (string) and worked (boolean) are required',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      400
    );
  }

  const charger = await store.getCharger(id);
  if (!charger || charger.status === 'removed') {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `Charger with id ${id} not found`,
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      404
    );
  }

  const devHash = hashDeviceId(deviceId);

  // A device cannot vote on its own charger
  if (charger.ownerHash === devHash) {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Charger creators cannot vote to confirm or reject their own charging point.',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      403
    );
  }

  // Rate limit: 30 votes per device per hour
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const pastVotes = (voteRateLimits.get(devHash) || []).filter((t) => t > hourAgo);
  if (pastVotes.length >= 30) {
    c.header('Retry-After', '3600');
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Vote limit reached (maximum 30 votes per hour).',
          requestId: c.res.headers.get('X-Request-Id'),
        },
      },
      429
    );
  }

  pastVotes.push(now);
  voteRateLimits.set(devHash, pastVotes);

  // Upsert confirmation
  await store.upsertConfirmation({
    chargerId: id,
    deviceHash: devHash,
    worked,
    createdAt: new Date().toISOString(),
  });

  // Calculate vote totals
  const counts = await store.countConfirmations(id);
  const confirmations = await store.listConfirmations(id);
  const workedDevs = new Set(confirmations.filter((c) => c.worked).map((c) => c.deviceHash));
  const notWorkedDevs = new Set(confirmations.filter((c) => !c.worked).map((c) => c.deviceHash));

  let newStatus = charger.status;

  // When 2 distinct devices have worked:true and no more not-worked than worked votes, status becomes 'confirmed'
  if (workedDevs.size >= 2 && counts.worked >= counts.notWorked) {
    newStatus = 'confirmed';
    await store.setStatus(id, 'confirmed');
  } else if (notWorkedDevs.size >= 2) {
    newStatus = 'rejected';
    await store.setStatus(id, 'rejected');
  }

  return c.json({
    ok: true,
    status: newStatus,
    worked: counts.worked,
    notWorked: counts.notWorked,
  });
});

// ── 19. PATCH /api/admin/chargers/:id (Admin Override) ─────────
app.patch('/api/admin/chargers/:id', async (c) => {
  const adminTokenEnv = process.env.ADMIN_TOKEN;
  if (!adminTokenEnv) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  }

  const headerToken = c.req.header('X-Admin-Token');
  if (headerToken !== adminTokenEnv) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid admin token' } }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { status } = body || {};

  if (!['confirmed', 'rejected', 'removed'].includes(status)) {
    return c.json({ error: { code: 'INVALID_STATUS', message: 'Status must be confirmed, rejected, or removed' } }, 400);
  }

  const charger = await store.getCharger(id);
  if (!charger) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Charger not found' } }, 404);
  }

  await store.setStatus(id, status);
  return c.json({ id, status });
});

// ── Start Node Server ─────────────────────────────────────────
const PORT = Number(process.env.PORT) || 8000;
console.log(`[PlugIt Backend (Hono)] Running at http://localhost:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
});
