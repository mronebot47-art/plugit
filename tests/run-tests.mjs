import assert from 'node:assert/strict';
import { VEHICLES } from '../lib/data/vehicles.ts';
import { planTrip } from '../lib/planner/dijkstra.ts';

console.log('--- Running PlugIt Unit Test Suite (Node.js Test Runner) ---');

const nexon = VEHICLES.find((v) => v.id === 'nexon-lr');
assert.ok(nexon, 'Tata Nexon profile should exist');

const mockShortRoute = {
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

const mockLongRoute = {
  id: 'blr-chennai',
  geometry: {
    type: 'LineString',
    coordinates: [
      [77.6097, 12.9756],
      [77.7712, 12.7785],
      [78.2144, 12.5266],
      [79.1325, 12.9165],
      [80.2785, 13.0334],
    ],
  },
  distanceKm: 345,
  durationMin: 360,
  segments: [
    { from: { lat: 12.9756, lng: 77.6097 }, to: { lat: 12.7785, lng: 77.7712 }, km: 35 },
    { from: { lat: 12.7785, lng: 77.7712 }, to: { lat: 12.5266, lng: 78.2144 }, km: 75 },
    { from: { lat: 12.5266, lng: 78.2144 }, to: { lat: 12.9165, lng: 79.1325 }, km: 115 },
    { from: { lat: 12.9165, lng: 79.1325 }, to: { lat: 13.0334, lng: 80.2785 }, km: 120 },
  ],
};

const mockStations = [
  {
    id: 'st-attibele',
    name: 'Zeon Attibele',
    operator: 'Zeon',
    lat: 12.7785,
    lng: 77.7712,
    address: 'NH 44 Attibele',
    connectors: [{ type: 'CCS2', kw: 50, qty: 2 }],
    maxKw: 50,
    status: 'working',
    source: 'fixture',
    probFree: 0.85,
  },
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

// Test 1: Short trip
const shortRes = planTrip({
  route: mockShortRoute,
  stations: mockStations,
  vehicle: nexon,
  startSocPct: 80,
  targetArrivalSocPct: 15,
  mode: 'normal',
});
assert.equal(shortRes.fastest.stops.length, 0, 'Short trip with 80% SoC requires 0 stops');
console.log('✓ Test 1: Short trip requires 0 stops passed.');

// Test 2: Down station never selected
const longRes = planTrip({
  route: mockLongRoute,
  stations: mockStations,
  vehicle: nexon,
  startSocPct: 80,
  targetArrivalSocPct: 15,
  mode: 'normal',
});
const hasBroken = longRes.fastest.stops.some((s) => s.station.status === 'down');
assert.equal(hasBroken, false, 'Broken stations must never be selected in route plan');
console.log('✓ Test 2: Broken/down station exclusion passed.');

// Test 3: Lower SoC never decreases stops
const lowSocRes = planTrip({
  route: mockLongRoute,
  stations: mockStations,
  vehicle: nexon,
  startSocPct: 35,
  targetArrivalSocPct: 15,
  mode: 'normal',
});
assert.ok(
  lowSocRes.fastest.stops.length >= longRes.fastest.stops.length,
  'Lower start SoC must require equal or greater charging stops'
);
console.log('✓ Test 3: Monotonic stop count behavior passed.');

// Test 4: Calm index bounds
assert.ok(longRes.fastest.calmIndex >= 0 && longRes.fastest.calmIndex <= 100, 'Calm index must be between 0 and 100');
assert.ok(longRes.fastest.calmLine.length > 0, 'Calm line text explanation should be populated');
console.log(`✓ Test 4: Calm Index (${longRes.fastest.calmIndex}/100 - "${longRes.fastest.calmLine}") calculation passed.`);

console.log('\nAll 4 Core Unit Tests Passed Successfully!');
