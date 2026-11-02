import assert from 'node:assert/strict';
import { VEHICLES } from '../src/data/vehicles';
import { STATIONS } from '../src/data/stations';
import { computePlan } from '../src/planner/dijkstra';
import { computeCalmIndex } from '../src/planner/calm';

console.log('=== PlugIt Backend (Hono) Unit Test Suite ===\n');

const nexon = VEHICLES.find((v) => v.id === 'nexon-lr');
assert.ok(nexon, 'Tata Nexon LR profile must exist');

// Polyline route representing Bengaluru to Chennai
const blrChennaiRoute = {
  id: 'blr-chennai',
  geometry: {
    coordinates: [
      [77.6097, 12.9756], // Bengaluru
      [77.7712, 12.7785], // Attibele
      [78.2144, 12.5266], // Krishnagiri
      [78.7165, 12.7915], // Ambur
      [79.1325, 12.9165], // Vellore
      [80.2785, 13.0334], // Chennai
    ] as [number, number][],
  },
};

// ── Test 1: Short trip requiring 0 stops ────────────────────────
const shortRoute = {
  id: 'short-trip',
  geometry: {
    coordinates: [
      [77.6097, 12.9756],
      [77.6602, 12.8452],
    ] as [number, number][],
  },
};
const shortPlan = computePlan({
  routeId: 'short-trip',
  geometry: shortRoute.geometry,
  vehicle: nexon,
  startSoc: 90,
  targetArrivalSoc: 15,
  stations: STATIONS,
});
assert.equal(
  shortPlan.alternatives[0]?.stops.length,
  0,
  'Short 15km trip with 90% battery must require 0 charging stops'
);
console.log('✓ Test 1: Short trip with full battery requires 0 charging stops.');

// ── Test 2: Down/broken station exclusion ────────────────────────
const planWithBroken = computePlan({
  routeId: 'blr-chennai',
  geometry: blrChennaiRoute.geometry,
  vehicle: nexon,
  startSoc: 80,
  targetArrivalSoc: 15,
  stations: STATIONS,
  failedStationIds: ['ocm:274914'],
});
const hasKrishnagiri1 = planWithBroken.alternatives[0]?.stops.some(
  (s) => s.station.id === 'ocm:274914'
);
assert.equal(
  hasKrishnagiri1,
  false,
  'Down/failed station (ocm:274914) must never appear in planned stops'
);
console.log('✓ Test 2: Failed/broken station is strictly excluded from plan.');

// ── Test 3: Monotonic stop count behavior (Gate 1 Requirement) ──
// Bengaluru -> Chennai at 80% SoC returns 1-2 stops
const plan80 = computePlan({
  routeId: 'blr-chennai',
  geometry: blrChennaiRoute.geometry,
  vehicle: nexon,
  startSoc: 80,
  targetArrivalSoc: 15,
  stations: STATIONS,
});
const stops80 = plan80.alternatives[0]!.stops.length;
console.log(`[Gate Check] Bengaluru -> Chennai at 80% SoC: ${stops80} stops (expected 1-2)`);
assert.ok(
  stops80 >= 1 && stops80 <= 2,
  `At 80% SoC, Bengaluru -> Chennai must return 1-2 stops (got ${stops80})`
);

// Bengaluru -> Chennai at 40% SoC returns 2-3 stops
const plan40 = computePlan({
  routeId: 'blr-chennai',
  geometry: blrChennaiRoute.geometry,
  vehicle: nexon,
  startSoc: 40,
  targetArrivalSoc: 15,
  stations: STATIONS,
});
const stops40 = plan40.alternatives[0]!.stops.length;
console.log(`[Gate Check] Bengaluru -> Chennai at 40% SoC: ${stops40} stops (expected 2-3)`);
assert.ok(
  stops40 >= 2 && stops40 <= 3,
  `At 40% SoC, Bengaluru -> Chennai must return 2-3 stops (got ${stops40})`
);

assert.ok(
  stops40 >= stops80,
  `Lower start SoC must require equal or greater charging stops (${stops40} >= ${stops80})`
);
console.log('✓ Test 3: Monotonic stop count behavior verified.');

// ── Test 4: Calm Index Calculation ──────────────────────────────
const calm = computeCalmIndex(110, 240, 0.8, 2);
assert.ok(calm.score >= 0 && calm.score <= 100, 'Calm index score must be between 0 and 100');
assert.ok(calm.line.length > 10, 'Calm index descriptive line must be populated');
console.log(`✓ Test 4: Calm Index computed: ${calm.score}/100 — "${calm.line}"`);

console.log('\n===========================================');
console.log('All Backend Tests Passed Successfully!');
console.log('===========================================');
