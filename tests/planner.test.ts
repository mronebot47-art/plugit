import { describe, it, expect } from 'vitest';
import { VEHICLES } from '../lib/data/vehicles';
import { planTrip } from '../lib/planner/dijkstra';
import type { RouteData, Station } from '../lib/types';

describe('PlugIt Dijkstra EV Planner & Energy Model', () => {
  const nexon = VEHICLES.find((v) => v.id === 'nexon-lr')!;

  const mockShortRoute: RouteData = {
    id: 'test-short',
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.5946, 12.9716],
        [77.65, 12.98],
      ],
    },
    distanceKm: 10,
    durationMin: 20,
    segments: [
      {
        from: { lat: 12.9716, lng: 77.5946 },
        to: { lat: 12.98, lng: 77.65 },
        km: 10,
      },
    ],
  };

  const mockLongRoute: RouteData = {
    id: 'blr-chennai',
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.6097, 12.9756],
        [78.2144, 12.5266],
        [79.1325, 12.9165],
        [80.2785, 13.0334],
      ],
    },
    distanceKm: 345,
    durationMin: 360,
    segments: [
      { from: { lat: 12.9756, lng: 77.6097 }, to: { lat: 12.5266, lng: 78.2144 }, km: 110 },
      { from: { lat: 12.5266, lng: 78.2144 }, to: { lat: 12.9165, lng: 79.1325 }, km: 115 },
      { from: { lat: 12.9165, lng: 79.1325 }, to: { lat: 13.0334, lng: 80.2785 }, km: 120 },
    ],
  };

  const mockStations: Station[] = [
    {
      id: 'st-krishnagiri',
      name: 'ChargeZone Krishnagiri',
      operator: 'ChargeZone',
      lat: 12.5266,
      lng: 78.2144,
      address: 'NH 44, Krishnagiri',
      connectors: [{ type: 'CCS2', kw: 60, qty: 4 }],
      maxKw: 60,
      status: 'working',
      source: 'fixture',
      probFree: 0.8,
    },
    {
      id: 'st-vellore',
      name: 'Statiq Vellore',
      operator: 'Statiq',
      lat: 12.9165,
      lng: 79.1325,
      address: 'NH 48, Vellore',
      connectors: [{ type: 'CCS2', kw: 60, qty: 2 }],
      maxKw: 60,
      status: 'working',
      source: 'fixture',
      probFree: 0.75,
    },
    {
      id: 'st-broken',
      name: 'Broken Fast Hub',
      operator: 'Unknown',
      lat: 12.6,
      lng: 78.4,
      address: 'Highway',
      connectors: [{ type: 'CCS2', kw: 60, qty: 2 }],
      maxKw: 60,
      status: 'down',
      source: 'fixture',
      probFree: 0.0,
    },
  ];

  it('1. Short trip with plenty of battery returns zero stops', () => {
    const result = planTrip({
      route: mockShortRoute,
      stations: mockStations,
      vehicle: nexon,
      startSocPct: 80,
      targetArrivalSocPct: 15,
      mode: 'normal',
    });

    expect(result.fastest.stops.length).toBe(0);
  });

  it('2. Down/broken stations are never selected', () => {
    const result = planTrip({
      route: mockLongRoute,
      stations: mockStations,
      vehicle: nexon,
      startSocPct: 80,
      targetArrivalSocPct: 15,
      mode: 'normal',
    });

    const hasBroken = result.fastest.stops.some((s) => s.station.status === 'down');
    expect(hasBroken).toBe(false);
  });

  it('3. Lower initial SoC never decreases stop count', () => {
    const highSocPlan = planTrip({
      route: mockLongRoute,
      stations: mockStations,
      vehicle: nexon,
      startSocPct: 90,
      targetArrivalSocPct: 15,
      mode: 'normal',
    });

    const lowSocPlan = planTrip({
      route: mockLongRoute,
      stations: mockStations,
      vehicle: nexon,
      startSocPct: 35,
      targetArrivalSocPct: 15,
      mode: 'normal',
    });

    expect(lowSocPlan.fastest.stops.length).toBeGreaterThanOrEqual(highSocPlan.fastest.stops.length);
  });

  it('4. Computes valid Calm Index between 0 and 100', () => {
    const result = planTrip({
      route: mockLongRoute,
      stations: mockStations,
      vehicle: nexon,
      startSocPct: 80,
      targetArrivalSocPct: 15,
      mode: 'normal',
    });

    expect(result.fastest.calmIndex).toBeGreaterThanOrEqual(0);
    expect(result.fastest.calmIndex).toBeLessThanOrEqual(100);
    expect(result.fastest.calmLine.length).toBeGreaterThan(0);
  });
});
