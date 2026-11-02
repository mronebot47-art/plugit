# BACKEND SPECIFICATION

<USER_REQUEST>
i no i want api  it api key for map is  1c38a50a-5c0e-425c-85af-52e3fb934136 # ROLE
You are a senior product engineer and motion designer building a hackathon-winning web app in one focused build. Work in milestones (section 14). Before writing code, produce an implementation plan artifact. After each milestone, run the app in the browser agent, verify the acceptance checks listed for that milestone, and fix failures before moving on. Do not skip ahead. Do not leave TODOs, lorem ipsum, or placeholder images.

# 1. PRODUCT
Name: PlugIt
Tagline: "Know where you'll charge before you leave."
Problem: EV drivers on long-distance trips struggle to find available charging stations, especially where infrastructure is thin. This causes range anxiety, delays, and inconvenience.
Primary market: India (default start city Bengaluru). Currency INR, distance km, energy kWh. Connector types: CCS2, Type 2 (AC), CHAdeMO, GB/T, Bharat DC001/AC001, 3-pin/15A.
Core promise: enter origin, destination, car and current battery. Get a route with charging stops that are reachable, likely to be available, and timed to waste the least time. Then keep protecting the driver during the trip with Plan B reroutes when a stop fails.

# 2. DESIGN DIRECTION (read carefully, this is what makes it not look AI-made)
Concept: "road sign meets printed timetable." Think highway signage, railway timetables, and instrument clusters. Confident, a little editorial, not startup-generic.

HARD BANS (do not do any of these):
- No purple, indigo, or blue-to-pink gradients. No gradient text.
- No glassmorphism cards stacked everywhere. No heavy drop shadows. Use 1px hairline borders and flat fills.
- No emoji anywhere in UI or copy. Icons: Lucide at 1.5 stroke only, plus custom inline SVG for the car, plug, and battery.
- No symmetrical 3-column "feature cards with icon on top" grid.
- No stock photos. No generic 3D blobs. No Inter, Roboto, or Poppins.
- No copy like "seamless", "revolutionize", "unlock", "empower", "journey made easy", "cutting-edge". Write like a person who drives: short, specific, concrete numbers.
- No fake data like "John Doe" or "Lorem". Use real Indian places, real station operators (Tata Power EZ Charge, Statiq, ChargeZone, Jio-bp pulse, Ather Grid, Zeon) as examples only where data exists in the API response.

TYPOGRAPHY (Google Fonts via next/font):
- Display: "Bricolage Grotesque" (variable, use opsz and wdth axes: wide and bold for hero, narrow for labels)
- Body: "Instrument Sans"
- Data and numerals: "JetBrains Mono" (all kWh, km, %, minutes, prices; use tabular-nums)
- Type scale: 12 / 14 / 16 / 20 / 28 / 44 / 72 / 120 px. Hero numerals can go oversized (120px+) and bleed off the grid on purpose.

COLOR TOKENS (CSS variables, light default, dark via prefers-color-scheme and a manual toggle):
- --paper: #F2EEE6   --ink: #14130F   --road: #2A2924   --muted: #8A8577   --line: #D8D2C4
- --volt: #C6FF3D (accent FILL only, always with --ink text on top; never use volt as text on paper, it fails contrast)
- --signal: #FF5B2E (warnings, broken stations, low battery)
- --ok: #1F8A5B (confirmed working)
- Dark: --paper: #0E0E0B, --ink: #F2EEE6, --line: #2B2A24, keep --volt and --signal.
- Apply a subtle film-grain overlay (SVG feTurbulence noise, 4% opacity, pointer-events none) over the whole app.

LAYOUT:
- 12-col grid, deliberately asymmetric: big left-aligned headlines, numbers offset to the right, sections that overlap by 24-48px. Use a 4px spacing base.
- Border radius: 2px on data surfaces, 999px only on pills and the battery gauge. No 16px rounded-everything look.
- Mobile first (the driver uses a phone). Planner on mobile = full-screen map with a draggable bottom sheet (Vaul). Desktop = 420px left panel + map.

# 3. TECH STACK (pin exact versions: run `npm view <pkg> version` for each and use versions that are at least 14 days old)
- Next.js (App Router) + TypeScript strict + Tailwind CSS + shadcn/ui (only as unstyled primitives, restyled to the tokens above)
- Map: maplibre-gl + react-map-gl (maplibre entry). Tiles: Carto Positron/Dark Matter GL style (https://basemaps.cartocdn.com/gl/positron-gl-style/style.json and .../dark-matter-gl-style/style.json). Fallback: OpenFreeMap.
- Routing: OSRM public demo (https://router.project-osrm.org/route/v1/driving/{lng,lat;lng,lat}?overview=full&geometries=geojson&steps=false). Wrap in /api/route with caching, and a fallback to a pre-saved Bengaluru to Chennai route JSON in /public/fixtures if the call fails.
- Geocoding: Photon (https://photon.komoot.io/api/?q=...&limit=5&lang=en&lat=12.97&lon=77.59 for Bengaluru bias). Debounce 250ms.
- Stations: Open Charge Map API (https://api.openchargemap.io/v3/poi?output=json&compact=true&verbose=false&countrycode=IN&latitude=..&longitude=..&distance=..&distanceunit=KM&maxresults=..&key=KEY). Proxy through /api/stations so the key stays server-side. Cache responses 6 hours (Next fetch revalidate or Upstash/Vercel KV).
- Elevation (optional, for energy model): Open-Meteo elevation API, batches of up to 100 coordinates, sample the route every ~5 km.
- Backend: Next.js Route Handlers. Database: Supabase Postgres with Realtime for community reports. If Supabase env vars are missing, fall back to an in-memory store so the app still runs locally.
- State: Zustand. Data fetching: TanStack Query. Validation: Zod on every API boundary.
- PWA: next-pwa or Serwist, to cache the saved trip, map tiles for the route corridor, and the app shell for offline use.

# 4. ANIMATION STACK (this is the personality of the app, use all of these with purpose)
Install and use:
- gsap (all plugins are now free: ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, MorphSVGPlugin, Flip) and @gsap/react (useGSAP hook, always clean up)
- lenis (smooth scroll on the landing page only; disable on the planner/map screens)
- motion (the library formerly called Framer Motion; use for layout animations, shared-element transitions, bottom sheet, list reordering)
- @number-flow/react (animated numerals for battery %, ETA, cost)
- lottie-react or @lottiefiles/dotlottie-react (one small Lottie for "plug connects" success; keep under 40KB, author or pick a free one from LottieFiles with a permissive licence)
- From the React Bits library (reactbits.dev, copy-paste components): use Click Spark on primary buttons, Magnet on the main CTA, Scroll Float or Scroll Reveal for section headlines, Counter for stat numbers, Spotlight Card on station cards, Target Cursor on desktop only. If a named component does not exist when you check, pick the closest one from the library or build it yourself. Do not invent APIs.
- From Magic UI or Aceternity UI (copy-paste components): at most two components total (suggestions: Animated Beam to show data flowing car > charger > grid, Border Beam on the active trip card). Restyle them to our tokens so they do not look like a template.
- Respect prefers-reduced-motion: wrap every animation in a check; reduced mode = instant state changes, no scroll-scrubbing, no parallax.

SIGNATURE MOMENTS (build these exactly):
A. Landing hero "The road draws itself": a full-width SVG road path (hand-drawn feel, slight wobble) is drawn with DrawSVG as the user scrolls (ScrollTrigger scrub: 0.6). A small car glyph follows the path with MotionPath. A huge battery percentage in JetBrains Mono (NumberFlow, 120px) ticks down from 100 as the car moves. At three marked nodes along the road, the car stops, a plug glyph snaps in (Lottie, 600ms, with a short navigator.vibrate(12) on mobile), and the percentage counts back up. At the end the number reads "Arrived. 14%" in signal orange to show a realistic, honest result.
B. Headline reveal: SplitText by lines, each line masked and sliding up 100% with stagger 0.08s, ease "expo.out", duration 0.9s. Do not animate every heading on the page, only hero and the three section openers.
C. Route draw on map: when a plan is computed, draw the route polyline progressively over 1.4s (animate a sliced coordinate array with requestAnimationFrame, ease-in-out cubic), then drop charging-stop markers one by one with a 120ms stagger and a small overshoot scale (1 > 1.25 > 1). Dim non-route stations to 25% opacity with a 300ms fade.
D. Battery Ribbon (the signature data viz): a horizontal timeline under the route summary showing battery % over distance as a stepped sawtooth area chart (custom SVG, not a chart library). Charging stops appear as vertical bars whose height equals charge added; width equals minutes spent. Hovering or scrubbing the ribbon moves a ghost car along the map in sync. Min-reserve line at 10% in signal orange, dashed.
E. Liquid battery gauge: a pill-shaped battery with a wavy fill (two phase-shifted sine paths animated with GSAP, infinite, 6s). Fill level is bound to SoC. When charging simulation runs, wave amplitude increases and a lightning notch pulses at the leading edge.
F. Plan B moment: in Live Trip Simulation, when a stop is reported broken, the screen edge flashes a 2px signal-orange inset border once (400ms), the broken marker shakes (x +-4px, 5 cycles, 300ms), the route line morphs to the new route (Flip or animated coordinate interpolation over 900ms), and a bottom toast slides up: "Stop 2 reported down. Switched to Zeon Hosur. +9 min, +4 km." No modal.
G. Loading states: never a spinner. Use a skeleton battery that fills 0>100 repeatedly with the label "Finding plugs near the route". Skeletons for cards use a slow 2.4s shimmer in --line tones.
H. Micro-interactions: station card hover lifts 2px with a hairline border color change (not shadow); buttons depress 1px on active; number changes always use NumberFlow; the bottom sheet uses spring (stiffness 300, damping 32).

# 5. FEATURES (build in this priority order)
P0 (must work flawlessly in the demo):
1. Trip planner: origin, destination (Photon autocomplete), vehicle select, current SoC slider (5-100%, default 80%), arrival-SoC target (default 15%, min reserve 10%).
2. Vehicle profiles (all values approximate and user-editable; show an "approx." label): Tata Nexon EV LR (~40 kWh usable, ~140 Wh/km highway), Tata Punch EV LR (~35 kWh, ~135), MG ZS EV (~50 kWh, ~160), MG Windsor (~38 kWh, ~140), Mahindra XUV400 (~39 kWh, ~150), Hyundai Ioniq 5 (~72 kWh, ~180), BYD Atto 3 (~60 kWh, ~170), Custom (user enters kWh, Wh/km, max DC kW, connector).
3. Charging stop planner (algorithm in section 7) that returns 0-N stops with arrival SoC, departure SoC, charge minutes, cost estimate in INR, detour minutes, and a reliability score.
4. Station layer on the map with clustering at low zoom (MapLibre cluster), color-coded by status: working (--ok ring), unknown (--muted ring), reported-down (--signal ring), and a "fast DC" badge when power >= 50 kW.
5. Station detail sheet: name, operator, address, connectors with kW per connector, estimated availability (see section 6), last community report, distance off-route, amenities if known, "Navigate" (deep link to Google Maps directions with waypoint) and "Report status" button.
6. Reachability ring: a translucent circle on the map showing how far the car can go on current SoC (remaining range x 0.75 to account for road factor and reserve). Updates live as SoC changes.
7. Range anxiety score ("Calm Index" 0-100) per trip, with a plain-language line, for example "78. One long gap: 142 km between Krishnagiri and Vellore. Charge to 90% at Krishnagiri."
8. Low-battery SOS button on the map: shows the 3 nearest reachable stations sorted by arrival SoC then power, with distance, ETA, and a short rationale.

P1 (build if P0 is stable):
9. Community reports: one-tap "Working / Queue (X min) / Broken / Occupied by non-EV". Stored with timestamp, anonymous device id. Reports decay: full weight under 30 min, half at 2 h, zero at 12 h. Realtime update on map via Supabase Realtime.
10. Live Trip Simulation (the demo showpiece): a simulated car moves along the route at selectable speed (1x, 10x, 60x). Battery drains per the energy model. At each stop it plugs in and charges following the charging curve. A "Simulate failure" dev button marks the next stop as down and triggers the Plan B reroute (Signature Moment F).
11. Offline-capable saved trip (PWA): add to home screen, the saved route, stops, and corridor tiles work with no network.
12. Share trip: generates a short link /t/{id} with a read-only view and an OG image (dynamic, using next/og) showing the route, stops, and Calm Index.

P2 (only if time remains):
13. Cost and CO2 comparison versus a petrol car on the same route.
14. Hindi and Kannada UI strings (i18n with next-intl), at least for the planner screen.
15. Charger-type filter and operator-app deep links.

# 6. DATA HANDLING AND HONESTY ABOUT AVAILABILITY
- Station data comes from Open Charge Map. Normalize into this type: { id, name, operator, lat, lng, address, connectors: [{type, kw, qty}], maxKw, status: 'working'|'unknown'|'down', source: 'ocm'|'community', lastVerified?: ISO }.
- Real-time plug availability is NOT available from OCM for most stations. Implement an Estimated Availability model and label it everywhere as "Estimated":
  probFree = clamp(1 - demand(hour, dow, stationClass) * localFactor, 0.05, 0.95)
  where demand follows a double-peak curve (peaks around 08:00-10:00 and 17:00-20:00, higher on Fri evening and Sun evening, higher at highway hubs), localFactor is a deterministic hash of station id into [0.6, 1.1] so values are stable between refreshes, and the result is overridden by fresh community reports (weighted by decay in section 5.9).
- UI must show a source chip on every availability value: "Estimated", "Reported 12 min ago", or "Operator data" (if present). Never show the word "Live" unless the data is truly from a live source.
- Seed script: /scripts/seed-reports.ts inserts 30-40 realistic community reports along the Bengaluru > Chennai and Bengaluru > Hyderabad corridors so the demo map is not empty.

# 7. ALGORITHMS (implement exactly, put them in /lib/planner with unit tests)
Energy model per route segment (segments ~2 km from OSRM geometry):
  base = vehicle.whPerKm
  speedFactor = 1 + max(0, (avgSpeedKmh - 80)) * 0.006   // +0.6% per km/h above 80
  gradeWh = (mass_kg * 9.81 * deltaElevationM) / 3600 / efficiency   // Wh, only when climbing; descending recovers 55% of that via regen
  segmentWh = base * km * speedFactor + gradeWh   (if no elevation data, gradeWh = 0)
  Add a 12% safety margin on top of total consumption for AC use and traffic. Expose it as a "Cautious / Normal / Optimistic" toggle (15% / 8% / 0%).
Charging curve (piecewise linear, DC): 10-50% at 100% of min(carMaxKw, chargerKw); 50-80% at 70%; 80-100% at 30%. AC: constant at min(carAcKw, chargerKw), default carAcKw 7.2. Charging above 80% is discouraged unless needed (add a 1.8x time penalty in cost).
Candidate stations: stations within 4 km of the route polyline (project each onto the polyline, store distanceAlongRoute and detourKm as 2x perpendicular distance), connector-compatible with the selected car, maxKw >= 20 for DC planning (AC stations only if no DC exists within a 120 km window, and flag them with "slow: 4-8 h").
Planner: Dijkstra over states (nodeIndex, socBucket) where socBucket is 5% steps.
  Nodes: origin, each candidate station sorted by distanceAlongRoute, destination.
  Edge A>B is feasible if arrivalSoc(B) >= reserve (10%, or 15% if "Cautious").
  Cost = driveMinutes + chargeMinutes + detourMinutes + expectedWaitMinutes, where expectedWaitMinutes = (1 - probFree) * 25 and an additional 8 minutes penalty if station status is unknown with no reports. Down stations are excluded.
  At each station, allowed departure SoC targets: {60, 70, 80, 90, 100}. Pick by Dijkstra, tie-break fewer stops.
  Return top 2 alternatives ("Fastest" and "Safest"). Safest maximizes minimum arrival SoC and prefers stations with 2+ connectors and 50 kW+.
Calm Index (0-100) = 100 - 30*(maxGapKm/vehicleRealRangeKm) - 25*(1 - minArrivalSoc/0.30 clamped 0..1) - 20*(avg (1 - probFree) among stops) - 15*(stopsWithOnlyOneConnector/stops) - 10*(any AC-only stop ? 1 : 0). Clamp 0..100. Generate the plain-language line from the largest contributing penalty.
Unit tests (Vitest): origin to destination with enough range returns zero stops; a 400 km trip with a 40 kWh car at 80% SoC returns 2-3 stops; a down station is never selected; changing SoC from 80 to 30 never reduces the stop count; Plan B never picks the failed station.

# 8. API CONTRACTS (Zod-validated; return typed errors, never raw 500s)
- GET /api/geocode?q= > [{label, lat, lng}]
- POST /api/route { origin:{lat,lng}, dest:{lat,lng} } > { geometry: GeoJSON LineString, distanceKm, durationMin, segments:[{from,to,km,elevDeltaM?}] }
- GET /api/stations?lat=&lng=&radiusKm= > Station[]  (server-cached)
- GET /api/stations/corridor?routeId= > Station[] (stations along the route)
- POST /api/plan { routeId | geometry, vehicle, startSoc, targetArrivalSoc, mode:'cautious'|'normal'|'optimistic' } > { alternatives:[{label, stops, totals, calmIndex, ribbonSeries}] }
- POST /api/reports { stationId, status:'working'|'queue'|'broken'|'blocked', queueMin?, deviceId } > 201; rate limit 1 report per station per device per 10 min
- GET /api/reports?stationIds= > Report[]
- POST /api/trips > { id }  and  GET /api/trips/:id
Add a /api/health route and a visible "Demo mode" switch (bottom-left, small) that forces all APIs to use local fixtures, so the demo works if hotel Wi-Fi dies.

# 9. SCREENS AND COPY
1. Landing (/): hero with the road-draw scroll story (Signature Moment A). Headline: "Don't plan around the charger. Plan around the road." Sub: "Pick your car and battery. We find the stops that are working, reachable, and worth the detour." Primary button: "Plan a trip". Below the story: one short asymmetric section "Why range anxiety happens" with three real numbers rendered as huge numerals using the problem statement context (use only figures you can source or phrase as examples, label illustrative ones as "illustrative"), then a live mini-planner preview, then footer. Keep landing under 5 screens of scroll.
2. Planner (/plan): map + panel as described. Empty state copy: "Where to? Start typing a city." Error copy: "Couldn't reach the routing service. Using the saved Bengaluru-Chennai demo route." Be specific in all errors.
3. Trip result: summary header with oversized numerals (total time, stops, Calm Index), Battery Ribbon, stop list as a timetable (departure-board style rows: STOP 1 / 11:42 / Krishnagiri / 62 kW / 22 min / 18% > 80%), alternatives toggle (Fastest / Safest).
4. Live Trip Simulation (/trip/[id]/live): map follows the car, top HUD with liquid battery gauge, speed multiplier control, "Simulate failure" button (visible only in Demo mode).
5. Shared trip (/t/[id]): read-only, fast, great OG image.
Microcopy voice: plain, short, slightly dry. Examples: "Plug in at Krishnagiri. 22 min." / "You'll arrive with 14%. That's enough, but not a lot." / "Reported down 6 min ago."

# 10. ACCESSIBILITY AND PERFORMANCE
- WCAG AA contrast on all text. Visible focus rings (2px ink with 2px paper offset). Full keyboard support for planner and station list. Map has an accessible list alternative (the stop list). aria-live polite for plan results and Plan B toasts.
- Touch targets >= 44px. No horizontal scroll at 360px width.
- Lighthouse targets on /plan (mobile): Performance >= 85, Accessibility >= 95. Lazy-load maplibre, three/lottie assets, and below-the-fold sections. Images as AVIF/WebP. Fonts with display swap and subsetting.
- Landing animations must hold 60fps on a mid-range phone: only animate transform and opacity, use will-change sparingly, kill ScrollTrigger instances on unmount.

# 11. FOLDER STRUCTURE
/app (routes + layouts), /app/api/*, /components/ui (restyled primitives), /components/map, /components/planner, /components/motion (GSAP/Motion wrappers: SplitReveal, RoadDraw, LiquidBattery, BatteryRibbon, PlugSnap), /lib/planner (energy, charging, dijkstra, calm), /lib/data (ocm client, normalize, availability), /lib/geo (project point to polyline, haversine, along-route distance), /lib/store (zustand), /public/fixtures (route and stations JSON for demo mode), /scripts (seed), /tests.
Env vars (.env.example, never commit .env): OCM_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_DEMO_MODE=false.

# 12. DEMO FIXTURES (build these so the pitch never depends on the network)
- Route 1: Bengaluru (MG Road) > Chennai (Marina Beach), ~345 km.
- Route 2: Bengaluru > Hyderabad, ~570 km (shows 3-4 stops).
- Route 3: Bengaluru > Mysuru > Ooty (hilly, shows the elevation effect on range).
Save the real API responses once into /public/fixtures, then use them in Demo mode.

# 13. QUALITY BAR
- TypeScript strict, no `any`. ESLint + Prettier. Meaningful commit messages after each milestone.
- Every async UI state has loading, empty, error, and success designs.
- README with: problem, solution, screenshots, architecture diagram (Mermaid), setup in 5 commands, env vars, honest limitations (availability is estimated), and credits for every open-source library and data source (OpenStreetMap contributors, Open Charge Map, Carto, OSRM, Photon, Open-Meteo, React Bits, etc.).
- Required attribution visible in the map corner.

# 14. MILESTONES (verify each in the browser agent before continuing)
M1 Foundation: scaffold, fonts, tokens, grain overlay, dark mode, layout shell. Check: tokens render correctly in both themes, no banned patterns present.
M2 Map and data: map renders, stations load for Bengaluru via the proxy, clustering works, Demo mode fixtures work. Check: 200+ stations visible near Bengaluru, cluster expands on click.
M3 Routing and planner: geocode, route, energy model, charging planner, tests passing. Check: Bengaluru > Chennai returns a plan with 1-2 stops at 80% SoC and 2-3 at 40%.
M4 Result UI: summary, Battery Ribbon, timetable, Calm Index, station sheet. Check: ribbon scrub moves the ghost car on the map.
M5 Motion pass: landing road-draw story, headline reveals, route draw, marker drops, liquid battery, number flows, reduced-motion mode. Check: record a short browser video and confirm 60fps feel, no layout shift.
M6 Community and live: reports with decay, Live Trip Simulation, Plan B. Check: Simulate failure reroutes in under 1 second and never selects the failed station.
M7 PWA, share link, OG image, README, Lighthouse run, final bug sweep on a 390x844 viewport.
At the end, output: a list of what was built, what was cut, known limitations, and a 90-second demo script with exact clicks.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-02T09:10:17+05:30.
</ADDITIONAL_METADATA>