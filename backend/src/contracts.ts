import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ── Shared Primitives ──────────────────────────────────────────
export const ApiErrorSchema = registry.register(
  'ApiError',
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
      requestId: z.string().optional(),
    }),
  })
);

export const HealthResponseSchema = registry.register(
  'HealthResponse',
  z.object({
    ok: z.boolean(),
    version: z.string(),
    uptimeSec: z.number(),
    demoMode: z.boolean(),
    store: z.enum(['supabase', 'memory']),
    upstreams: z.object({
      osrm: z.string(),
      ocm: z.string(),
    }),
  })
);

export const ConnectorSchema = registry.register(
  'Connector',
  z.object({
    type: z.string(),
    kw: z.number(),
    qty: z.number(),
  })
);

export const StationSchema = registry.register(
  'Station',
  z.object({
    id: z.string(),
    name: z.string(),
    operator: z.string(),
    lat: z.number(),
    lng: z.number(),
    address: z.string(),
    connectors: z.array(ConnectorSchema),
    maxKw: z.number(),
    status: z.enum(['working', 'down', 'unknown']),
    source: z.enum(['live', 'cache', 'fixture', 'community']),
    communityStatus: z.enum(['unverified', 'confirmed']).optional(),
    probFree: z.number(),
    distanceAlongRoute: z.number().optional(),
    detourKm: z.number().optional(),
    detourMin: z.number().optional(),
    usageCost: z.string().optional(),
    lastReport: z.string().optional(),
    availability: z.object({
      probFree: z.number(),
      label: z.string(),
      forecast12h: z.array(z.number()),
    }),
  })
);

export const VehicleSchema = registry.register(
  'Vehicle',
  z.object({
    id: z.string(),
    name: z.string(),
    usableKwh: z.number(),
    whPerKmHwy: z.number(),
    maxDcKw: z.number(),
    maxAcKw: z.number(),
    massKg: z.number(),
    connectors: z.array(z.string()),
    approx: z.boolean().optional(),
  })
);

export const RouteRequestSchema = registry.register(
  'RouteRequest',
  z.object({
    origin: z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() }),
    dest: z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() }),
  })
);

export const RouteSegmentSchema = registry.register(
  'RouteSegment',
  z.object({
    from: z.object({ lat: z.number(), lng: z.number() }),
    to: z.object({ lat: z.number(), lng: z.number() }),
    km: z.number(),
  })
);

export const RouteDataSchema = registry.register(
  'RouteData',
  z.object({
    id: z.string(),
    geometry: z.object({
      type: z.literal('LineString'),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
    }),
    distanceKm: z.number(),
    durationMin: z.number(),
    segments: z.array(RouteSegmentSchema),
    degraded: z.boolean().optional(),
  })
);

export const PlanStopSchema = registry.register(
  'PlanStop',
  z.object({
    station: StationSchema,
    arrivalSocPct: z.number(),
    departureSocPct: z.number(),
    chargeMinutes: z.number(),
    chargeKwh: z.number(),
    costInr: z.number(),
    detourMinutes: z.number(),
    reliabilityScore: z.number(),
    flag: z.string().optional(),
  })
);

export const RibbonPointSchema = registry.register(
  'RibbonPoint',
  z.object({
    distanceKm: z.number(),
    socPct: z.number(),
  })
);

export const TripAlternativeSchema = registry.register(
  'TripAlternative',
  z.object({
    label: z.enum(['Fastest', 'Safest']),
    stops: z.array(PlanStopSchema),
    totals: z.object({
      distanceKm: z.number(),
      driveMinutes: z.number(),
      chargeMinutes: z.number(),
      totalMinutes: z.number(),
      costInr: z.number(),
      arrivalSocPct: z.number(),
    }),
    calmIndex: z.object({
      score: z.number(),
      line: z.string(),
    }),
    ribbonSeries: z.object({
      points: z.array(RibbonPointSchema),
      chargeBars: z.array(z.any()),
    }),
  })
);

export const PlanRequestSchema = registry.register(
  'PlanRequest',
  z.object({
    routeId: z.string().optional(),
    geometry: z.any().optional(),
    vehicle: VehicleSchema.optional(),
    custom: VehicleSchema.optional(),
    startSoc: z.number().min(5).max(100),
    targetArrivalSoc: z.number().min(10).max(100).optional(),
    mode: z.enum(['cautious', 'normal', 'optimistic']).optional(),
    departAt: z.string().optional(),
    includeUnverified: z.boolean().optional(),
  })
);

export const PlanResponseSchema = registry.register(
  'PlanResponse',
  z.object({
    alternatives: z.array(TripAlternativeSchema),
  })
);

export const ReplanRequestSchema = registry.register(
  'ReplanRequest',
  z.object({
    routeId: z.string().optional(),
    vehicle: VehicleSchema.optional(),
    currentDistanceKm: z.number().optional(),
    currentSoc: z.number().optional(),
    failedStationIds: z.array(z.string()).optional(),
    mode: z.enum(['cautious', 'normal', 'optimistic']).optional(),
    includeUnverified: z.boolean().optional(),
  })
);

export const ReplanResponseSchema = registry.register(
  'ReplanResponse',
  z.object({
    alternatives: z.array(TripAlternativeSchema),
    delta: z.object({
      message: z.string(),
      addedMinutes: z.number(),
      addedKm: z.number(),
      reroutedStopName: z.string().optional(),
    }),
  })
);

export const SosRequestSchema = registry.register(
  'SosRequest',
  z.object({
    lat: z.number(),
    lng: z.number(),
    currentSoc: z.number().optional(),
  })
);

export const SosOptionSchema = registry.register(
  'SosOption',
  z.object({
    station: StationSchema,
    distanceKm: z.number(),
    etaMin: z.number(),
    arrivalSoc: z.number(),
    rationale: z.string(),
  })
);

export const SosResponseSchema = registry.register(
  'SosResponse',
  z.object({
    options: z.array(SosOptionSchema),
  })
);

export const CommunityReportSchema = registry.register(
  'CommunityReport',
  z.object({
    id: z.string(),
    stationId: z.string(),
    status: z.enum(['working', 'broken', 'degraded']),
    waitMinutes: z.number(),
    note: z.string().optional(),
    createdAt: z.string(),
  })
);

export const ReportsQueryResponseSchema = registry.register(
  'ReportsQueryResponse',
  z.object({
    reports: z.array(CommunityReportSchema),
    effective: z.record(
      z.string(),
      z.object({
        status: z.string(),
        probFree: z.number(),
        waitMinutes: z.number(),
      })
    ),
  })
);

export const SaveTripRequestSchema = registry.register(
  'SaveTripRequest',
  z.object({
    routeId: z.string().optional(),
    originLabel: z.string().optional(),
    destLabel: z.string().optional(),
    startSoc: z.number().optional(),
    targetArrivalSoc: z.number().optional(),
    mode: z.string().optional(),
    selectedLabel: z.string().optional(),
    plan: z.any().optional(),
    vehicle: z.any().optional(),
  })
);

export const SaveTripResponseSchema = registry.register(
  'SaveTripResponse',
  z.object({
    id: z.string(),
  })
);

export const TripDetailsSchema = registry.register(
  'TripDetails',
  z.object({
    id: z.string(),
    routeId: z.string().optional(),
    originLabel: z.string().optional(),
    destLabel: z.string().optional(),
    startSoc: z.number().optional(),
    targetArrivalSoc: z.number().optional(),
    mode: z.string().optional(),
    selectedLabel: z.string().optional(),
    plan: z.any().optional(),
    vehicle: z.any().optional(),
    createdAt: z.string(),
  })
);

// ── Community Chargers Schemas (TASK B) ────────────────────────
export const CreateChargerRequestSchema = registry.register(
  'CreateChargerRequest',
  z.object({
    name: z.string().min(3).max(80),
    lat: z.number().min(6).max(37),
    lng: z.number().min(68).max(98),
    address: z.string().max(160).optional(),
    connectors: z
      .array(
        z.object({
          type: z.string(),
          kw: z.number().min(1).max(350),
          qty: z.number().min(1).max(20),
        })
      )
      .min(1)
      .max(6),
    access: z.enum(['public_free', 'public_paid']),
    priceNote: z.string().max(80).optional(),
    hours: z.string().max(60).optional(),
    publicConfirmed: z.literal(true),
    deviceId: z.string().min(8).max(64),
  })
);

export const CreateChargerResponseSchema = registry.register(
  'CreateChargerResponse',
  z.object({
    id: z.string(),
    status: z.literal('unverified'),
    editToken: z.string(),
  })
);

export const ConfirmChargerRequestSchema = registry.register(
  'ConfirmChargerRequest',
  z.object({
    deviceId: z.string().min(8).max(64),
    worked: z.boolean(),
  })
);

export const ConfirmChargerResponseSchema = registry.register(
  'ConfirmChargerResponse',
  z.object({
    ok: z.boolean(),
    status: z.enum(['unverified', 'confirmed', 'rejected']),
    worked: z.number(),
    notWorked: z.number(),
  })
);

export const AdminChargerUpdateSchema = registry.register(
  'AdminChargerUpdate',
  z.object({
    status: z.enum(['confirmed', 'rejected', 'removed']),
  })
);

// ── Register Routes in Registry for OpenAPI ────────────────────
registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Health probe',
  responses: { 200: { description: 'OK', content: { 'application/json': { schema: HealthResponseSchema } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/vehicles',
  summary: 'List supported EV models',
  responses: { 200: { description: 'List of vehicles', content: { 'application/json': { schema: z.array(VehicleSchema) } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/stations',
  summary: 'List charging stations in bbox',
  responses: { 200: { description: 'List of stations', content: { 'application/json': { schema: z.array(StationSchema) } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/stations/corridor',
  summary: 'Stations along corridor route',
  responses: { 200: { description: 'Stations along corridor', content: { 'application/json': { schema: z.array(StationSchema) } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/route',
  summary: 'Calculate highway route',
  request: { body: { content: { 'application/json': { schema: RouteRequestSchema } } } },
  responses: { 200: { description: 'Route geometry', content: { 'application/json': { schema: RouteDataSchema } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/plan',
  summary: 'Calculate charging plan',
  request: { body: { content: { 'application/json': { schema: PlanRequestSchema } } } },
  responses: {
    200: { description: 'Plan alternatives', content: { 'application/json': { schema: PlanResponseSchema } } },
    422: { description: 'Unfeasible plan', content: { 'application/json': { schema: ApiErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/plan/replan',
  summary: 'Recalculate plan bypassing failed stop',
  request: { body: { content: { 'application/json': { schema: ReplanRequestSchema } } } },
  responses: { 200: { description: 'Replan alternative with delta', content: { 'application/json': { schema: ReplanResponseSchema } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/plan/sos',
  summary: 'Emergency nearby charging points',
  request: { body: { content: { 'application/json': { schema: SosRequestSchema } } } },
  responses: { 200: { description: 'SOS options', content: { 'application/json': { schema: SosResponseSchema } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/reports',
  summary: 'Community reports and effective statuses',
  responses: { 200: { description: 'Reports list', content: { 'application/json': { schema: ReportsQueryResponseSchema } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/reports',
  summary: 'Submit community report',
  request: { body: { content: { 'application/json': { schema: z.object({ stationId: z.string(), status: z.string(), waitMinutes: z.number().optional(), note: z.string().optional() }) } } } },
  responses: { 201: { description: 'Report created', content: { 'application/json': { schema: CommunityReportSchema } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/trips',
  summary: 'Save trip',
  request: { body: { content: { 'application/json': { schema: SaveTripRequestSchema } } } },
  responses: { 201: { description: 'Trip saved', content: { 'application/json': { schema: SaveTripResponseSchema } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/trips/{id}',
  summary: 'Get saved trip by 8-char id',
  responses: { 200: { description: 'Trip details', content: { 'application/json': { schema: TripDetailsSchema } } } },
});

registry.registerPath({
  method: 'post',
  path: '/api/chargers',
  summary: 'Add public community charger',
  request: { body: { content: { 'application/json': { schema: CreateChargerRequestSchema } } } },
  responses: {
    201: { description: 'Charger submitted', content: { 'application/json': { schema: CreateChargerResponseSchema } } },
    409: { description: 'Duplicate nearby', content: { 'application/json': { schema: ApiErrorSchema } } },
    429: { description: 'Rate limited', content: { 'application/json': { schema: ApiErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/chargers/{id}/confirm',
  summary: 'Confirm community charger worked/broken',
  request: { body: { content: { 'application/json': { schema: ConfirmChargerRequestSchema } } } },
  responses: {
    200: { description: 'Vote recorded', content: { 'application/json': { schema: ConfirmChargerResponseSchema } } },
    403: { description: 'Owner cannot vote', content: { 'application/json': { schema: ApiErrorSchema } } },
  },
});

export function generateOpenApiJson(): any {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'PlugIt Highway EV API',
      version: '0.1.0',
      description: 'Frozen API contract for PlugIt India EV Highway charging platform',
    },
    servers: [{ url: 'http://localhost:8000' }],
  });
}
