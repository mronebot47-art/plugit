import { app } from '../server/index';
import http from 'http';

interface CheckResult {
  endpoint: string;
  status: number;
  expectedStatus: number;
  ms: number;
  plugItSource: string;
}

async function runContractChecks() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(8001, resolve));
  const baseUrl = 'http://localhost:8001';

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

    if (res.status !== expectedStatus) {
      console.error(`FAIL: ${name} returned ${res.status}, expected ${expectedStatus}`);
    }

    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    // 1. Health
    await check('Health', '/api/health', { method: 'GET' });

    // 2. Vehicles
    await check('Vehicles', '/api/vehicles', { method: 'GET' });

    // 3. Geocode
    await check('Geocode (Bengaluru)', '/api/geocode?q=Bengaluru', { method: 'GET' });

    // 4. Route (Bengaluru -> Chennai)
    const route = await check('Route (BLR -> Chennai)', '/api/route', {
      method: 'POST',
      body: JSON.stringify({
        origin: { lat: 12.9756, lng: 77.6097 },
        dest: { lat: 13.0334, lng: 80.2785 },
      }),
    });

    // 5. Corridor Stations
    await check('Corridor Stations', '/api/stations/corridor?routeId=blr-chennai', { method: 'GET' });

    // 6. Plan at 80% SoC
    await check('Plan @ 80% SoC', '/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        routeId: 'blr-chennai',
        startSoc: 80,
        targetArrivalSoc: 15,
        mode: 'normal',
      }),
    });

    // 7. Plan at 40% SoC (stop count increases)
    await check('Plan @ 40% SoC', '/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        routeId: 'blr-chennai',
        startSoc: 40,
        targetArrivalSoc: 15,
        mode: 'normal',
      }),
    });

    // 8. Plan B Replan (second stop failed)
    await check('Plan B Replan', '/api/plan/replan', {
      method: 'POST',
      body: JSON.stringify({
        routeId: 'blr-chennai',
        currentDistanceKm: 150,
        currentSoc: 48,
        failedStationIds: ['vellore-1'],
      }),
    });

    // 9. Plan SOS (low battery)
    await check('Plan SOS', '/api/plan/sos', {
      method: 'POST',
      body: JSON.stringify({
        lat: 12.8,
        lng: 78.4,
        currentSoc: 11,
      }),
    });

    // 10. Submit Report
    await check('Submit Report', '/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        stationId: 'krishnagiri-1',
        status: 'working',
        deviceId: 'device-test-verifier-001',
      }),
    }, 201);

    // 11. Trips POST & GET
    const trip = await check('Save Trip', '/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        originLabel: 'Bengaluru, MG Road',
        destLabel: 'Chennai, Marina Beach',
        plan: { label: 'Fastest', totals: { distanceKm: 345, driveMinutes: 330, chargeMinutes: 40, totalMinutes: 370, costInr: 680, arrivalSocPct: 24 } },
      }),
    });

    if (trip && trip.id) {
      await check('Get Trip by ID', `/api/trips/${trip.id}`, { method: 'GET' });
    }

  } finally {
    server.close();
  }

  // Print Formatted Table
  console.log('| Endpoint'.padEnd(46) + '| Status'.padEnd(10) + '| Time'.padEnd(10) + '| X-PlugIt-Source |');
  console.log('|' + '-'.repeat(45) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(17) + '|');

  let hasFailure = false;
  for (const r of results) {
    const passed = r.status === r.expectedStatus;
    if (!passed) hasFailure = true;
    const statusCol = `${r.status} ${passed ? '✓' : '✗'}`.padEnd(9);
    console.log(
      `| ${r.endpoint.padEnd(44)}| ${statusCol}| ${(r.ms + 'ms').padEnd(8)}| ${r.plugItSource.padEnd(16)}|`
    );
  }
  console.log('\n======================================================');

  if (hasFailure) {
    console.error('Contract checks failed!');
    process.exit(1);
  } else {
    console.log('All contract checks passed successfully! (100% frozen contract compliant)\n');
    process.exit(0);
  }
}

runContractChecks().catch((err) => {
  console.error(err);
  process.exit(1);
});
