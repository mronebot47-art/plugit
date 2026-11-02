interface CheckResult {
  endpoint: string;
  status: number;
  expectedStatus: number;
  ms: number;
  plugItSource: string;
}

async function runContractChecks() {
  const baseUrl = process.env.API_URL || 'http://localhost:8000';

  console.log('\n======================================================');
  console.log('       PlugIt API Contract Verification Suite         ');
  console.log('======================================================\n');

  const results: CheckResult[] = [];

  async function check(name: string, path: string, options: RequestInit, expectedStatus = 200): Promise<any> {
    const start = performance.now();
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'check-req-' + Math.random().toString(36).slice(2, 8),
        'X-PlugIt-Demo': '1',
        ...(options.headers || {}),
      },
    });
    const ms = Math.round(performance.now() - start);
    const plugItSource = res.headers.get('x-plugit-source') || '-';

    results.push({
      endpoint: `${options.method || 'GET'} ${path}`,
      status: res.status,
      expectedStatus,
      ms,
      plugItSource,
    });

    let body: any = null;
    try {
      body = await res.json();
    } catch {}

    if (res.status !== expectedStatus) {
      console.error(`FAIL: ${name} [${options.method || 'GET'} ${path}] expected ${expectedStatus}, got ${res.status}`);
      console.error('Body:', body);
      process.exit(1);
    }

    return body;
  }

  // 1. GET /api/health
  await check('Health probe', '/api/health', { method: 'GET' });

  // 2. GET /api/vehicles
  const vehicles = await check('Vehicles list', '/api/vehicles', { method: 'GET' });
  if (!Array.isArray(vehicles) || vehicles.length < 5) {
    console.error('FAIL: vehicles should return at least 5 profiles');
    process.exit(1);
  }

  // 3. GET /api/geocode
  await check('Geocode autocomplete', '/api/geocode?q=Bengaluru', { method: 'GET' });

  // 4. POST /api/route
  const route = await check('Route calculation', '/api/route', {
    method: 'POST',
    body: JSON.stringify({
      origin: { lat: 12.9756, lng: 77.6097, label: 'Bengaluru' },
      dest: { lat: 13.0334, lng: 80.2785, label: 'Chennai' },
    }),
  });

  // 5. GET /api/stations/corridor
  await check('Corridor stations', `/api/stations/corridor?routeId=blr-chennai`, { method: 'GET' });

  // 6. POST /api/plan (Normal 80%)
  const plan = await check('Compute Plan (80% SoC)', '/api/plan', {
    method: 'POST',
    body: JSON.stringify({
      routeId: 'blr-chennai',
      geometry: route.geometry,
      vehicle: vehicles[0],
      startSoc: 80,
      targetArrivalSoc: 15,
      mode: 'normal',
    }),
  });

  // 7. POST /api/plan (422 Low SoC check)
  await check(
    'Low SoC 422 Rejection',
    '/api/plan',
    {
      method: 'POST',
      body: JSON.stringify({
        routeId: 'blr-chennai',
        geometry: route.geometry,
        vehicle: vehicles[0],
        startSoc: 8,
        targetArrivalSoc: 15,
        mode: 'normal',
      }),
    },
    422
  );

  // 8. POST /api/plan/replan
  await check('Plan B Replan', '/api/plan/replan', {
    method: 'POST',
    body: JSON.stringify({
      routeId: 'blr-chennai',
      vehicle: vehicles[0],
      currentDistanceKm: 105,
      currentSoc: 24,
      failedStationIds: ['krishnagiri-1'],
    }),
  });

  // 9. POST /api/plan/sos
  await check('SOS Emergency search', '/api/plan/sos', {
    method: 'POST',
    body: JSON.stringify({
      lat: 12.8,
      lng: 78.0,
      currentSoc: 12,
    }),
  });

  // 10. POST /api/reports
  await check(
    'Submit community report',
    '/api/reports',
    {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'krishnagiri-1',
        status: 'working',
        waitMinutes: 5,
        note: 'Smooth charging at 60kW DC',
      }),
    },
    201
  );

  // 11. POST /api/trips
  const savedTrip = await check('Save trip', '/api/trips', {
    method: 'POST',
    body: JSON.stringify({
      routeId: 'blr-chennai',
      originLabel: 'Bengaluru, MG Road',
      destLabel: 'Chennai, Marina Beach',
      startSoc: 80,
      targetArrivalSoc: 15,
      mode: 'normal',
      selectedLabel: 'Fastest',
      plan: plan.alternatives[0],
      vehicle: vehicles[0],
    }),
  });

  // 12. GET /api/trips/:id
  await check('Retrieve trip', `/api/trips/${savedTrip.id}`, { method: 'GET' });

  // Print Summary Table
  console.log('| Endpoint                                    | Status  | Time    | X-PlugIt-Source |');
  console.log('|---------------------------------------------|---------|---------|-----------------|');
  results.forEach((r) => {
    const endp = r.endpoint.padEnd(43, ' ');
    const stat = `${r.status} ✓`.padEnd(7, ' ');
    const time = `${r.ms}ms`.padEnd(7, ' ');
    const src = r.plugItSource.padEnd(15, ' ');
    console.log(`| ${endp} | ${stat} | ${time} | ${src} |`);
  });

  console.log('\n======================================================');
  console.log('All contract checks passed successfully! (100% frozen contract compliant)\n');
}

runContractChecks().catch((err) => {
  console.error('Contract check failed:', err);
  process.exit(1);
});
