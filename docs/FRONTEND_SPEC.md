# FRONTEND SPECIFICATION

<USER_REQUEST>
# ROLE
You are the frontend engineer for PlugIt (formerly WAYVOLT). The backend is a separate service and its contract is FROZEN. This is an INTEGRATION PASS: do not redesign anything and keep all design tokens, fonts, grain overlay, and the signature motion moments. Produce an implementation plan artifact first, then work in the steps below. After each step run the app in the browser agent, verify the acceptance check, fix failures, then continue. No TODOs, no placeholder numbers.

# 1. RENAME
WAYVOLT -> PlugIt everywhere: <title>, metadata, OG tags, README, package.json name, localStorage and sessionStorage keys, component copy, file headers. Tagline stays: "Know where you'll charge before you leave." Hero headline stays. Search the whole repo for "wayvolt" case-insensitively and show the grep result as empty when done.

# 2. API CLIENT (lib/api.ts rewrite)
- BASE = process.env.NEXT_PUBLIC_API_URL (example http://localhost:8000, no trailing slash, no /api). Every call is `${BASE}/api/<path>`. Fail loudly at startup in dev if BASE is missing.
- Types come ONLY from lib/api-types.ts, generated from the backend's openapi.json with: npx openapi-typescript openapi.json -o lib/api-types.ts. Do not hand-write duplicate types for anything the backend returns.
- One fetch wrapper: JSON in/out, 10 s timeout via AbortController, header X-Request-Id (crypto.randomUUID()), header X-PlugIt-Demo: 1 when the Demo mode switch is on (store the switch in Zustand, persisted). Read the response header X-PlugIt-Source (live|cache|fixture) and expose it with the data.
- Errors: parse the body as ApiError { error: { code, message, details?, requestId } }. Throw a typed ApiClientError with code, message, details, status, requestId, retryAfterSec (from Retry-After on 429). Never show raw error text from fetch.
- Use TanStack Query for every GET and Zustand for UI state. Keys: ['geocode', q], ['route', origin, dest], ['stations', bbox], ['corridor', routeId], ['plan', params], ['reports', ids]. Debounce geocode 250 ms.
- Remove all hard-coded base URLs. Remove any remaining internal /app/api handlers.

# 3. SINGLE SOURCE OF TRUTH (delete local planning)
- Vehicles: fetch GET /api/vehicles at app start and use ONLY that list for the dropdown, including usableKwh, whPerKm, maxDcKw. Keep lib/data/vehicles.ts only as an offline fallback and mark every value "approx." in the UI. Add a "Custom" option with fields usableKwh (10-200), whPerKm (80-400), maxDcKw (0-350), maxAcKw (1-22), massKg (800-3500), connector, sent as { custom: Vehicle } in /api/plan.
- Planner: remove local stop planning, energy model, charging curve, and Calm Index from the live flow. /plan page flow: geocode -> POST /api/route -> POST /api/plan { routeId, vehicle, startSoc, targetArrivalSoc, mode, departAt }. Render alternatives[0] (Fastest) and alternatives[1] (Safest) with a toggle. The Battery Ribbon draws from ribbonSeries.points and ribbonSeries.chargeBars. The timetable rows come from stops[]. The Calm Index number and sentence come from calmIndex.score and calmIndex.line verbatim.
- If the backend is unreachable, fall back to the saved local fixtures ONLY after a failed request, and show a fixed top banner: "Backend unreachable. Showing saved sample data." Never mix fixture and live data silently.
- Every number on screen must come from the API response. Search the code for hard-coded strings such as "Vellore", "Zeon Ambur", "+7 min", "+3 km", "28%" outside the landing hero story and delete any that feed real UI.

# 4. SCREEN WIRING
a) Planner inputs: SoC slider 5-100 (default 80), target arrival 10-100 (default 15), mode toggle Cautious / Normal / Optimistic. Changing any input re-requests /api/plan (debounce 300 ms, cancel the previous request). Show the skeleton battery loader while loading.
b) Map: station layer from GET /api/stations (viewport bbox) and corridor stations from GET /api/stations/corridor?routeId=. Ring color: status working = --ok, unknown = --muted, down = --signal. Reachability ring radius = reachabilityKm from the plan response, centred on the start.
c) Station sheet: show availability.probFree as a percentage with the chip availability.label EXACTLY as returned ("Estimated", "Reported 12 min ago", "Operator data"). Never write the word "Live" in any UI string. Add a 12-bar mini chart from availability.forecast12h. Show connectors, maxKw, operator, address, lastReport, usageCost.
d) Report status: a button group Working / Queue (minutes input) / Broken / Blocked -> POST /api/reports with a stable deviceId (random 32 chars in localStorage under plugit.deviceId). On 429 show "Already reported. Try again in {retryAfterSec} s." Subscribe to GET /api/reports/stream?stationIds=... with EventSource, update the map and sheet on each "report" event, reconnect with backoff, close on unmount.
e) SOS button on the map -> POST /api/plan/sos with the current map position (or simulated car position) and current SoC. Show the 3 options with distanceKm, etaMin, arrivalSoc, and rationale as returned.
f) Errors: 422 NO_FEASIBLE_PLAN shows details.longestGapKm, details.vehicleRealRangeKm, and details.suggestion in a plain panel with a "Raise starting charge" action that applies the suggestion. 400 shows the first Zod issue in details. 429 shows the retry time. 502 shows the message. If a response has degraded: true, show a small chip "Using saved data".
g) Demo mode switch (bottom-left, small): sets the Zustand flag and adds the X-PlugIt-Demo: 1 header to every call.

# 5. TRIPS AND LIVE SIMULATION
- When the user presses "Start Live Trip Simulation": POST /api/trips with { routeId, vehicle or custom, startSoc, targetArrivalSoc, mode, selectedLabel, departAt, plan, originLabel, destLabel } and navigate to /trip/{id}/live. The live page loads GET /api/trips/{id}. 404 shows "Trip not found" with a link to /plan.
- The simulated car moves along the saved geometry and drains battery using the plan's own segments data; at each stop it plugs in for the stop's chargeMin and rises from arrivalSoc to departureSoc (simulation time scaled by 1x/10x/60x).
- "Simulate failure" (visible only in Demo mode): marks the NEXT upcoming stop as failed, calls POST /api/plan/replan { routeId, vehicle, mode, currentDistanceKm, currentSoc, failedStationIds: [that stop's station.id], departAt, previousStopIds }. On response: play Signature Moment F (2px inset signal border 400 ms, marker shake, route morph 900 ms) and show the toast text EXACTLY as delta.message. If the call returns NO_FEASIBLE_PLAN, show the nearest reachable stations from details.
- Add GET /t/[id] (read-only shared view, no simulation controls) using the same /api/trips/{id}, with a dynamic OG image via next/og showing route, stop count, and Calm Index. Add a "Copy link" button on the trip result.

# 6. SMALL FIXES
- Replace the "▶" glyph with the Lucide Play icon at 1.5 stroke. Search for any other emoji or symbol glyph in the UI and replace with Lucide icons.
- Landing hero story (Moment A) stays scripted but add a small caption: "Illustrative route and numbers."
- Add the map attribution for OpenStreetMap contributors, Carto, and Open Charge Map.
- PWA: add Serwist, cache the app shell, the last saved trip (from /api/trips/{id}), and tiles for the route corridor. Test with DevTools offline.
- Respect prefers-reduced-motion everywhere.

# 7. ACCEPTANCE CHECKS (paste the evidence for each)
1. grep for "wayvolt" returns nothing.
2. With the backend running, planning Bengaluru -> Chennai at 80% SoC shows API stops (1-2) and the Calm Index line is the backend's text. Change SoC to 40% and the stop count increases (2-3).
3. Stop the backend: banner "Backend unreachable. Showing saved sample data." appears and nothing crashes. Start it again: the banner clears on the next request.
4. Demo mode on: Network tab shows X-PlugIt-Demo: 1 on every request and responses work with the internet disabled.
5. Post a Broken report from the station sheet: the marker turns --signal within 2 seconds and the next plan excludes that station.
6. Simulate failure: the toast text matches delta.message in the Network response character for character, the failed station never appears in the new stops.
7. Create a trip, open /t/{id} in a private window: it renders; the OG image URL returns a 1200x630 image.
8. Lighthouse mobile on /plan: Performance >= 85, Accessibility >= 95.
At the end output: what changed, what was removed, any contract deviation you found (report it, do not work around it silently), and the demo script rewritten from REAL outputs (real stop names and numbers from the API).
# PATCH: FRONTEND HANDOFF (additive; no path, field, or enum changes)
The frontend (Next.js on http://localhost:3000, API base http://localhost:8000) is built and ready to connect. Make these changes, run the checks, and paste the real output.

1. Port and origins: set PORT=8000 in .env and .env.example (keep 8787 out of docs). ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 plus any deployed frontend URL; keep the ALLOW_VERCEL_PREVIEWS option.
2. CORS must be correct for a browser calling from another origin:
   - Access-Control-Allow-Headers: Content-Type, X-Request-Id, X-PlugIt-Demo
   - Access-Control-Expose-Headers: X-PlugIt-Source, X-Request-Id, Retry-After, ETag
   - Access-Control-Allow-Methods: GET, POST, OPTIONS; preflight cache Access-Control-Max-Age: 600
   - The SSE route /api/reports/stream must also send the CORS headers, Cache-Control: no-cache, Connection: keep-alive, and X-Accel-Buffering: no.
   Write a test that sends an OPTIONS preflight with Origin http://localhost:3000, Access-Control-Request-Method POST and Access-Control-Request-Headers x-plugit-demo,content-type and asserts a 204 with those headers, and another test that an origin outside the allowlist gets no Allow-Origin header.
3. Contract exports: run npm run openapi, then npx openapi-typescript openapi.json -o types.ts. Commit both. Confirm openapi.json includes every path from the contract (including /plan/replan, /plan/sos, /reports/stream, /trips, /vehicles) and the ApiError schema with all error codes.
4. Vehicle values: GET /api/vehicles must return the same ids and values as lib/planner/vehicles.ts; there must be no second copy. Add a code comment above each preset: "approximate, verify against manufacturer specs before the pitch".
5. Add `npm run contract-check`: a script that starts the app in-process and calls every endpoint of the Bengaluru -> Chennai flow (geocode, route, corridor, plan at 80% and 40% SoC, replan with the second stop failed, report, trips POST/GET, vehicles, health) and prints a table: endpoint, status, ms, X-PlugIt-Source. Exit non-zero if any status is unexpected.
6. Apply the planner fixes from the code review (Dijkstra, vehicle-aware charging power, charging curve with realMin and costMin, drive time from route average speed, detour energy, NO_FEASIBLE_PLAN instead of partial plans, descent regen formula, wait-time formula) if not done yet, and run the section 11 tests.
7. Checks to paste:
   - curl -i -X OPTIONS http://localhost:8000/api/plan -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-plugit-demo"
   - curl http://localhost:8000/api/vehicles
   - npm run contract-check
   - npm test (all green)
Output: the files changed, the check outputs, and the final base URL and env vars the frontend needs.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-02T10:25:34+05:30.
</ADDITIONAL_METADATA>