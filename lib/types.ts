import type { components, paths } from './api-types';

export type { paths };

// Exact components from openapi schema
export type Vehicle = components['schemas']['Vehicle'];
export type VehicleProfile = Vehicle;
export type Station = components['schemas']['Station'];
export type Connector = components['schemas']['Connector'];
export type RouteData = components['schemas']['RouteData'];
export type RouteSegment = components['schemas']['RouteSegment'];
export type PlanStop = components['schemas']['PlanStop'];
export type TripAlternative = components['schemas']['TripAlternative'];
export type RibbonPoint = components['schemas']['RibbonPoint'];
export type PlanRequest = components['schemas']['PlanRequest'];
export type PlanResponse = components['schemas']['PlanResponse'];
export type CommunityReport = components['schemas']['CommunityReport'];
export type ApiError = components['schemas']['ApiError'];
export type GeoPoint = components['schemas']['GeoPoint'];
export type LatLng = components['schemas']['LatLng'];
export type TripDetails = components['schemas']['TripDetails'];
export type SaveTripRequest = components['schemas']['SaveTripRequest'];

export type PlanMode = 'cautious' | 'normal' | 'optimistic';
