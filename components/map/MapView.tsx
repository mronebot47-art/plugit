'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus } from 'lucide-react';
import { usePlannerStore } from '@/lib/store/planner';
import { useTheme } from '@/components/ui/theme-provider';
import { fetchStations, fetchSos } from '@/lib/api';
import { AddChargerSheet } from '@/components/planner/AddChargerSheet';
import type { Station } from '@/lib/types';

// Configure MapLibre Web Worker URL
if (typeof window !== 'undefined') {
  try {
    const origin = window.location.origin;
    maplibregl.setWorkerUrl(`${origin}/maplibre-gl-worker.mjs`);
  } catch (e) {
    console.warn('MapLibre worker setup:', e);
  }
}

interface MapViewProps {
  onSelectStation?: (station: Station) => void;
  selectedStationId?: string | null;
}

// Generate GeoJSON circular polygon for Reachability Ring
function createGeoJsonCircle(centerLat: number, centerLng: number, radiusKm: number, points = 64) {
  const coords: [number, number][] = [];
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const lat = centerLat + (radiusKm / kmPerDegLat) * Math.sin(angle);
    const lng = centerLng + (radiusKm / kmPerDegLng) * Math.cos(angle);
    coords.push([lng, lat]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  };
}

export function MapView({ onSelectStation, selectedStationId }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const carMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const driveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevThemeRef = useRef<string | null>(null);

  const { theme } = useTheme();
  const {
    origin,
    route,
    stations,
    setStations,
    alternatives,
    activeAlt,
    startSocPct,
    reachabilityKm,
  } = usePlannerStore();

  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDrivingPreview, setIsDrivingPreview] = useState(false);
  const [carProgressPct, setCarProgressPct] = useState(0);
  const [sosLoading, setSosLoading] = useState(false);
  const [showAddCharger, setShowAddCharger] = useState(false);
  const [showCommunityChargers, setShowCommunityChargers] = useState(true);
  const [sosOptions, setSosOptions] = useState<Array<{
    station: Station;
    distanceKm: number;
    etaMin: number;
    arrivalSoc: number;
    rationale: string;
  }> | null>(null);

  const handleSosClick = async () => {
    setSosLoading(true);
    try {
      const center = mapInstance.current?.getCenter() || { lat: 12.9716, lng: 77.5946 };
      const res = await fetchSos(center.lat, center.lng, startSocPct || 15);
      setSosOptions(res.options);
    } catch (e) {
      console.warn('SOS fetch failed:', e);
    } finally {
      setSosLoading(false);
    }
  };

  // Load stations on mount via centralized API client
  useEffect(() => {
    async function loadStations() {
      try {
        const data = await fetchStations(12.9716, 77.5946, 100);
        if (Array.isArray(data) && data.length > 0) {
          setStations(data);
        }
      } catch (err) {
        console.error('Failed to load stations:', err);
      }
    }
    if (stations.length === 0) {
      loadStations();
    }
  }, [stations.length, setStations]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    try {
      const originUrl = window.location.origin;
      maplibregl.setWorkerUrl(`${originUrl}/maplibre-gl-worker.mjs`);
    } catch {}

    const styleUrl =
      theme === 'dark'
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    prevThemeRef.current = theme;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [78.6, 12.85], // Center between BLR & Chennai
      zoom: 7.5,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Carto &copy; OpenStreetMap contributors &copy; PlugIt',
      }),
      'bottom-right'
    );

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapInstance.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (driveIntervalRef.current) clearInterval(driveIntervalRef.current);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update map style ONLY when theme changes from its previous value
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    const styleUrl =
      theme === 'dark'
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    const map = mapInstance.current;
    map.setStyle(styleUrl);

    map.once('style.load', () => {
      renderRouteAndReachability(false);
    });
  }, [theme, mapLoaded]);

  /**
   * Helper to place or move the animated Vehicle Glyph along the route coordinates
   */
  const updateCarPosition = useCallback(
    (ratio: number) => {
      const map = mapInstance.current;
      if (!map || !route?.geometry?.coordinates) return;

      const coords = route.geometry.coordinates as [number, number][];
      if (coords.length < 2) return;

      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const targetIdx = Math.floor(clampedRatio * (coords.length - 1));
      const targetCoord = coords[targetIdx] || coords[0]!;

      if (!carMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'car-glyph-marker flex items-center justify-center';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.zIndex = '60';
        el.innerHTML = `
          <div style="background: var(--ink); border: 2.5px solid var(--volt); border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(198,255,61,0.95);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--volt)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="13" rx="2"></rect>
              <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"></path>
              <circle cx="7" cy="14" r="2"></circle>
              <circle cx="17" cy="14" r="2"></circle>
            </svg>
          </div>
        `;

        carMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(targetCoord)
          .addTo(map);
      } else {
        carMarkerRef.current.setLngLat(targetCoord);
      }
    },
    [route]
  );

  /**
   * Signature Moment C: Progressive Route Draw (1.4s with requestAnimationFrame + cubic ease-in-out)
   * Also ensures Reachability Ring is drawn.
   */
  const renderRouteAndReachability = useCallback(
    (animate = true) => {
      const map = mapInstance.current;
      if (!map || !map.isStyleLoaded()) return;

      // ── 1. Reachability Ring Layer ─────────────────────────────────
      const centerLat = origin?.lat || 12.9756;
      const centerLng = origin?.lng || 77.6097;
      const circleGeo = createGeoJsonCircle(centerLat, centerLng, reachabilityKm || 180);

      if (!map.getSource('reachability')) {
        map.addSource('reachability', {
          type: 'geojson',
          data: circleGeo,
        });

        map.addLayer({
          id: 'reachability-fill',
          type: 'fill',
          source: 'reachability',
          paint: {
            'fill-color': '#1F8A5B',
            'fill-opacity': 0.05,
          },
        });

        map.addLayer({
          id: 'reachability-stroke',
          type: 'line',
          source: 'reachability',
          paint: {
            'line-color': '#1F8A5B',
            'line-width': 1.5,
            'line-dasharray': [3, 2],
            'line-opacity': 0.6,
          },
        });
      } else {
        const rSource = map.getSource('reachability') as maplibregl.GeoJSONSource | undefined;
        rSource?.setData(circleGeo);
      }

      // ── 2. Highway Route Layer ─────────────────────────────────────
      const coordsArr = (route?.geometry?.coordinates as any) || [];
      if (!route || !route.geometry || !coordsArr || coordsArr.length < 2) {
        if (map.getSource('route')) {
          if (map.getLayer('route-line-bg')) map.removeLayer('route-line-bg');
          if (map.getLayer('route-line')) map.removeLayer('route-line');
          map.removeSource('route');
        }
        if (carMarkerRef.current) {
          carMarkerRef.current.remove();
          carMarkerRef.current = null;
        }
        return;
      }

      const fullCoords = route.geometry.coordinates as [number, number][];

      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: animate ? [fullCoords[0]!, fullCoords[0]!] : fullCoords,
            },
          },
        });

        // Background casing line
        map.addLayer({
          id: 'route-line-bg',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#14130F',
            'line-width': 7,
            'line-opacity': 0.85,
          },
        });

        // Foreground energetic volt line
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#C6FF3D',
            'line-width': 4.5,
            'line-opacity': 0.95,
          },
        });
      }

      // Fit bounds to route
      const bounds = fullCoords.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(fullCoords[0] as [number, number], fullCoords[0] as [number, number])
      );
      map.fitBounds(bounds, { padding: 65, maxZoom: 13, duration: 800 });

      if (!animate) {
        const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
        source?.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: fullCoords,
          },
        });
        updateCarPosition(0);
        return;
      }

      // Progressive 1.4s draw with requestAnimationFrame + cubic ease
      const startTime = performance.now();
      const duration = 1400; // 1.4s

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      function animateProgress(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Cubic ease in-out
        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentPointCount = Math.max(2, Math.floor(ease * fullCoords.length));
        const sliced = fullCoords.slice(0, currentPointCount);

        const source = map?.getSource('route') as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: sliced,
            },
          });
        }

        // Animated car glyph follows the leading edge of the drawing highway!
        updateCarPosition(ease);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateProgress);
        } else {
          updateCarPosition(0);
        }
      }

      animFrameRef.current = requestAnimationFrame(animateProgress);
    },
    [route, origin, reachabilityKm, updateCarPosition]
  );

  // Trigger route render when route or mapLoaded changes
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapInstance.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      renderRouteAndReachability(true);
    } else {
      map.once('style.load', () => renderRouteAndReachability(true));
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [route, mapLoaded, renderRouteAndReachability]);

  /**
   * Interactive "Preview Drive" simulation handler
   */
  const toggleDrivePreview = () => {
    if (isDrivingPreview) {
      if (driveIntervalRef.current) clearInterval(driveIntervalRef.current);
      setIsDrivingPreview(false);
    } else {
      setIsDrivingPreview(true);
      let p = 0;
      driveIntervalRef.current = setInterval(() => {
        p += 0.012;
        if (p >= 1) {
          p = 1;
          clearInterval(driveIntervalRef.current!);
          setIsDrivingPreview(false);
        }
        setCarProgressPct(Math.round(p * 100));
        updateCarPosition(p);
      }, 50);
    }
  };

  /**
   * Signature Moment C: Render station markers with sequential drop & overshoot bounce
   */
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;

    // Remove previous markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const activePlan = alternatives[activeAlt];
    const plannedStopIds = new Set(activePlan?.stops.map((s) => s.station.id) ?? []);
    const hasActiveRoute = plannedStopIds.size > 0;

    const visibleStations = showCommunityChargers
      ? stations
      : stations.filter((s) => s.source !== 'community');

    visibleStations.forEach((station) => {
      const isPlannedStop = plannedStopIds.has(station.id);
      const isSelected = selectedStationId === station.id;

      const el = document.createElement('div');
      el.className = 'station-marker-wrapper relative cursor-pointer';

      // Drop entrance animation for planned stops with staggered delay
      if (isPlannedStop) {
        el.classList.add('anim-marker-drop', 'anim-radar-pulse');
        const stopIndex = activePlan?.stops.findIndex((s) => s.station.id === station.id) ?? 0;
        el.style.animationDelay = `${stopIndex * 150}ms`;
      }

      // Pin styling
      const pin = document.createElement('div');
      pin.className =
        'flex items-center justify-center font-bold font-mono transition-transform duration-200';
      pin.style.width = isPlannedStop ? '30px' : '15px';
      pin.style.height = isPlannedStop ? '30px' : '15px';
      pin.style.borderRadius = '9999px';
      pin.style.border = isPlannedStop ? '2.5px solid #14130F' : '1.5px solid #F2EEE6';

      // Color coding & Dimming non-route stations (Signature C)
      if (isPlannedStop) {
        pin.style.backgroundColor = '#C6FF3D';
        pin.style.color = '#14130F';
        pin.style.fontSize = '13px';
        pin.style.fontWeight = '800';
        pin.style.boxShadow = '0 0 16px rgba(198, 255, 61, 0.95)';
        const stopIndex = activePlan?.stops.findIndex((s) => s.station.id === station.id) ?? 0;
        pin.innerText = String(stopIndex + 1);
      } else if (station.source === 'community') {
        // Community charger styling: dashed --muted for unverified, solid --ok for confirmed
        if (station.communityStatus === 'unverified') {
          pin.style.border = '2px dashed #8A8577';
          pin.style.backgroundColor = 'transparent';
          pin.style.boxShadow = '0 0 6px rgba(138, 133, 119, 0.4)';
        } else {
          pin.style.border = '2px solid #1F8A5B';
          pin.style.backgroundColor = '#1F8A5B';
          pin.style.boxShadow = '0 0 8px rgba(31, 138, 91, 0.5)';
        }
        if (hasActiveRoute) {
          pin.style.opacity = '0.45';
        }
      } else {
        const ringColor =
          station.status === 'working' ? '#1F8A5B' : station.status === 'down' ? '#FF5B2E' : '#8A8577';
        pin.style.backgroundColor = ringColor;
        if (hasActiveRoute) {
          pin.style.opacity = '0.35';
          pin.style.transform = 'scale(0.85)';
        }
      }

      if (isSelected) {
        pin.style.transform = 'scale(1.4)';
        pin.style.border = '2.5px solid #FF5B2E';
        pin.style.boxShadow = '0 0 14px rgba(255, 91, 46, 0.9)';
      }

      el.appendChild(pin);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectStation?.(station);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .addTo(map);

      markersRef.current[station.id] = marker;
    });
  }, [stations, alternatives, activeAlt, selectedStationId, mapLoaded, onSelectStation, showCommunityChargers]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Action Bar on Map: Route Preview & Animation Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap">
        {route && (
          <div className="flex items-center gap-2 bg-[var(--paper)]/95 border border-[var(--line)] px-3 py-2 rounded-[2px] shadow-md backdrop-blur-sm">
            <button
              type="button"
              onClick={toggleDrivePreview}
              className="btn-volt py-1 px-3 text-[12px] flex items-center gap-1.5 cursor-pointer"
            >
              {isDrivingPreview ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[var(--ink)] animate-ping" />
                  Driving... {carProgressPct}%
                </>
              ) : (
                <>
                  <span>&#9654;</span>
                  Play Route Drive
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => renderRouteAndReachability(true)}
              className="font-data text-[11px] text-[var(--muted)] hover:text-[var(--ink)] border-l border-[var(--line)] pl-2.5 transition-colors cursor-pointer"
            >
              &#8635; Replay 1.4s Draw
            </button>
          </div>
        )}

        {/* Add a charger button (Lucide Plus 1.5 stroke) */}
        <button
          type="button"
          onClick={() => setShowAddCharger(true)}
          className="btn-volt py-1.5 px-3 text-[12px] flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus size={14} strokeWidth={1.5} />
          <span>Add a charger</span>
        </button>

        {/* Community chargers filter toggle */}
        <button
          type="button"
          onClick={() => setShowCommunityChargers((prev) => !prev)}
          className={`font-data text-[12px] px-2.5 py-1.5 rounded-[2px] border transition-colors flex items-center gap-1.5 cursor-pointer shadow-md ${
            showCommunityChargers
              ? 'bg-[var(--paper)] border-[var(--ink)] text-[var(--ink)] font-bold'
              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--muted)] line-through'
          }`}
        >
          <span>Community ({stations.filter((s) => s.source === 'community').length})</span>
        </button>

        {/* SOS Emergency Button */}
        <button
          type="button"
          onClick={handleSosClick}
          className="border border-[var(--signal)] bg-[var(--paper)] text-[var(--signal)] hover:bg-[var(--signal)] hover:text-white px-3 py-2 text-[12px] font-data font-bold rounded-[2px] shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>&#9888;</span>
          {sosLoading ? 'Scanning...' : 'Low Battery SOS'}
        </button>
      </div>

      {/* Add Charger Bottom Sheet Modal */}
      {showAddCharger && (
        <AddChargerSheet
          initialLat={mapInstance.current?.getCenter().lat || 12.9716}
          initialLng={mapInstance.current?.getCenter().lng || 77.5946}
          onClose={() => setShowAddCharger(false)}
          onChargerAdded={async (created) => {
            try {
              const fresh = await fetchStations(12.9716, 77.5946, 100);
              setStations(fresh);
              const match = fresh.find((s: any) => s.id === created.id);
              if (match) onSelectStation?.(match);
            } catch {}
          }}
        />
      )}

      {/* SOS Drawer Overlay */}
      {sosOptions && (
        <div className="absolute bottom-4 left-4 right-4 max-w-xl z-30 bg-[var(--paper)] border-2 border-[var(--signal)] p-4 rounded-[2px] shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--signal)] animate-ping" />
              <span className="font-display font-bold text-[15px] text-[var(--signal)]">
                Emergency Reachable Stations
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSosOptions(null)}
              className="text-[var(--muted)] hover:text-[var(--ink)] text-[18px] leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-col gap-2 divide-y divide-[var(--line)]">
            {sosOptions.map((opt, i) => (
              <div key={i} className="pt-2 flex items-center justify-between gap-3 text-[12px]">
                <div>
                  <div className="font-display font-bold text-[14px] text-[var(--ink)]">
                    {opt.station.name}
                  </div>
                  <div className="font-data text-[11px] text-[var(--muted)]">
                    {opt.distanceKm} km away &middot; {opt.etaMin} min ETA &middot; Arrive with{' '}
                    {opt.arrivalSoc}%
                  </div>
                  <div className="text-[11px] text-[var(--ok)] mt-0.5">{opt.rationale}</div>
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${opt.station.lat},${opt.station.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-volt text-[11px] py-1 px-2.5 whitespace-nowrap no-underline"
                >
                  Navigate &rarr;
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 bg-[var(--paper)] flex items-center justify-center font-mono text-[13px] text-[var(--muted)]">
          Loading Carto Vector Tiles...
        </div>
      )}
    </div>
  );
}
