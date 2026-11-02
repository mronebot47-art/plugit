import type {
  paths,
  Vehicle,
  Station,
  RouteData,
  PlanRequest,
  PlanResponse,
  TripAlternative,
  CommunityReport,
  GeoPoint,
  ApiError,
} from './types';

// Fail loudly in dev if NEXT_PUBLIC_API_URL is missing
const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
if (!BASE && process.env.NODE_ENV === 'development') {
  console.warn('[PlugIt API Client] Warning: NEXT_PUBLIC_API_URL is not defined in environment.');
}

export class ApiClientError extends Error {
  code: string;
  details?: Record<string, any>;
  status: number;
  requestId: string;
  retryAfterSec?: number;

  constructor(params: {
    code: string;
    message: string;
    details?: Record<string, any>;
    status: number;
    requestId: string;
    retryAfterSec?: number;
  }) {
    super(params.message);
    this.name = 'ApiClientError';
    this.code = params.code;
    this.details = params.details;
    this.status = params.status;
    this.requestId = params.requestId;
    this.retryAfterSec = params.retryAfterSec;
  }
}

export interface ApiResponseWithSource<T> {
  data: T;
  source: 'live' | 'cache' | 'fixture';
  requestId: string;
  degraded?: boolean;
}

/**
 * Universal JSON Fetch Wrapper:
 * - 10s AbortController timeout
 * - X-Request-Id header
 * - X-PlugIt-Demo header if demo mode active
 * - Parses and throws typed ApiClientError
 * - Exposes X-PlugIt-Source header
 */
export async function apiFetch<T>(
  endpointPath: string,
  options: RequestInit = {}
): Promise<ApiResponseWithSource<T>> {
  const url = `${BASE || 'http://localhost:8000'}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`;

  // 10s timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;

  // Read demo mode flag from localStorage or Zustand persistence
  let isDemo = false;
  if (typeof window !== 'undefined') {
    try {
      const persisted = localStorage.getItem('plugit.demoMode');
      if (persisted === 'true') isDemo = true;
    } catch {}
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...(isDemo ? { 'X-PlugIt-Demo': '1' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    const source = (res.headers.get('x-plugit-source') as 'live' | 'cache' | 'fixture') || 'live';
    const retryAfter = res.headers.get('retry-after');
    const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;

    if (!res.ok) {
      let errorBody: ApiError | null = null;
      try {
        errorBody = await res.json();
      } catch {}

      const err = errorBody?.error;
      throw new ApiClientError({
        code: err?.code || `HTTP_${res.status}`,
        message: err?.message || `Request failed with status ${res.status}`,
        details: err?.details as Record<string, any> | undefined,
        status: res.status,
        requestId: err?.requestId || requestId,
        retryAfterSec,
      });
    }

    const data: T = await res.json();
    return {
      data,
      source,
      requestId,
    };
  } catch (err: any) {
    if (err instanceof ApiClientError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiClientError({
        code: 'TIMEOUT',
        message: 'Request timed out after 10 seconds. Check connection.',
        status: 408,
        requestId,
      });
    }
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: err.message || 'Network connection failed.',
      status: 0,
      requestId,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Typed API methods ──────────────────────────────────────────

export async function fetchVehicles(): Promise<ApiResponseWithSource<Vehicle[]>> {
  return apiFetch<Vehicle[]>('/api/vehicles');
}

export async function fetchGeocode(q: string, signal?: AbortSignal): Promise<GeoPoint[]> {
  if (q.length < 2) return [];
  const res = await apiFetch<GeoPoint[]>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal });
  return res.data;
}

export async function fetchRoute(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<RouteData> {
  const res = await apiFetch<RouteData>('/api/route', {
    method: 'POST',
    body: JSON.stringify({ origin, dest }),
  });
  return res.data;
}

export async function fetchStations(lat = 12.9716, lng = 77.5946, radiusKm = 100): Promise<Station[]> {
  const res = await apiFetch<Station[]>(`/api/stations?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
  return res.data;
}

export async function fetchCorridorStations(routeId: string): Promise<Station[]> {
  const res = await apiFetch<Station[]>(`/api/stations/corridor?routeId=${encodeURIComponent(routeId)}`);
  return res.data;
}

export async function fetchPlan(planReq: PlanRequest & {
  routeId?: string;
  distanceKm?: number;
  durationMin?: number;
  segments?: unknown[];
}): Promise<ApiResponseWithSource<PlanResponse>> {
  return apiFetch<PlanResponse>('/api/plan', {
    method: 'POST',
    body: JSON.stringify(planReq),
  });
}

export async function fetchReplan(replanReq: {
  routeId: string;
  vehicle: Vehicle;
  mode: string;
  currentDistanceKm: number;
  currentSoc: number;
  failedStationIds: string[];
  departAt?: string;
  previousStopIds?: string[];
}): Promise<{ alternatives: TripAlternative[]; delta: { message: string; addedMinutes: number; addedKm: number; reroutedStopName: string } }> {
  const res = await apiFetch<{
    alternatives: TripAlternative[];
    delta: { message: string; addedMinutes: number; addedKm: number; reroutedStopName: string };
  }>('/api/plan/replan', {
    method: 'POST',
    body: JSON.stringify(replanReq),
  });
  return res.data;
}

export async function fetchSos(lat: number, lng: number, currentSoc: number): Promise<{
  options: Array<{ station: Station; distanceKm: number; etaMin: number; arrivalSoc: number; rationale: string }>;
}> {
  const res = await apiFetch<{
    options: Array<{ station: Station; distanceKm: number; etaMin: number; arrivalSoc: number; rationale: string }>;
  }>('/api/plan/sos', {
    method: 'POST',
    body: JSON.stringify({ lat, lng, currentSoc }),
  });
  return res.data;
}

export async function postReport(report: {
  stationId: string;
  status: 'working' | 'queue' | 'broken' | 'blocked';
  queueMin?: number;
  deviceId: string;
}): Promise<CommunityReport> {
  const res = await apiFetch<{ success: boolean; report: CommunityReport }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
  return res.data.report;
}

export async function saveTrip(tripData: any): Promise<{ id: string }> {
  const res = await apiFetch<{ id: string }>('/api/trips', {
    method: 'POST',
    body: JSON.stringify(tripData),
  });
  return res.data;
}

export async function fetchTrip(id: string): Promise<any> {
  const res = await apiFetch<any>(`/api/trips/${id}`);
  return res.data;
}

export async function fetchAddCharger(data: {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  connectors: Array<{ type: string; kw: number; qty: number }>;
  access: 'public_free' | 'public_paid';
  priceNote?: string;
  hours?: string;
  publicConfirmed: boolean;
  deviceId: string;
}): Promise<{ id: string; status: 'unverified'; editToken: string }> {
  const res = await apiFetch<{ id: string; status: 'unverified'; editToken: string }>('/api/chargers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchConfirmCharger(
  chargerId: string,
  deviceId: string,
  worked: boolean
): Promise<{ ok: boolean; status: string; worked: number; notWorked: number }> {
  const res = await apiFetch<{ ok: boolean; status: string; worked: number; notWorked: number }>(
    `/api/chargers/${encodeURIComponent(chargerId)}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({ deviceId, worked }),
    }
  );
  return res.data;
}

export async function fetchDeleteCharger(chargerId: string, editToken: string): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ ok: boolean }>(`/api/chargers/${encodeURIComponent(chargerId)}`, {
    method: 'DELETE',
    headers: {
      'X-Edit-Token': editToken,
    },
  });
  return res.data;
}
