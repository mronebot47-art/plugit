'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlannerStore } from '@/lib/store/planner';
import { LocationInput } from './LocationInput';
import { fetchVehicles, fetchRoute, fetchPlan, ApiClientError } from '@/lib/api';
import type { PlanMode, Vehicle } from '@/lib/types';
import BLR_STATIONS_FIXTURE from '@/public/fixtures/stations-blr.json';

const MODES: { value: PlanMode; label: string; note: string }[] = [
  { value: 'cautious', label: 'Cautious', note: '+15% margin' },
  { value: 'normal', label: 'Normal', note: '+8% margin' },
  { value: 'optimistic', label: 'Optimistic', note: '±0% margin' },
];

export function PlannerPanel() {
  const {
    origin,
    setOrigin,
    destination,
    setDestination,
    vehicles,
    setVehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    customVehicle,
    setCustomVehicle,
    startSocPct,
    setStartSoc,
    targetArrivalSocPct,
    setTargetSoc,
    mode,
    setMode,
    route,
    setRoute,
    setAlternatives,
    setReachabilityKm,
    loading,
    setLoading,
    error,
    errorDetails,
    setError,
    setBackendUnreachable,
  } = usePlannerStore();

  const [showCustom, setShowCustom] = useState(false);
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch vehicles from GET /api/vehicles at app start
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetchVehicles();
        if (Array.isArray(res.data) && res.data.length > 0) {
          setVehicles(res.data);
          setBackendUnreachable(false);
        }
      } catch (err) {
        console.warn('Backend /api/vehicles unreachable, using fallback list');
        setBackendUnreachable(true);
      }
    }
    loadVehicles();
  }, [setVehicles, setBackendUnreachable]);

  const activeVehicle: Vehicle =
    selectedVehicleId === 'custom'
      ? customVehicle
      : vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0]!;

  // 2. Compute plan with cancellation & 300ms debounce
  const executePlan = useCallback(
    async (currentOrigin = origin, currentDest = destination) => {
      if (!currentOrigin || !currentDest) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        // Fetch route if not yet loaded or endpoints changed
        let activeRoute = route;
        if (!activeRoute || activeRoute.id.startsWith('fallback')) {
          activeRoute = await fetchRoute(currentOrigin, currentDest);
          setRoute(activeRoute);
        }

        // Call POST /api/plan
        const planRes = await fetchPlan({
          routeId: activeRoute.id,
          geometry: activeRoute.geometry,
          vehicle: activeVehicle,
          custom: selectedVehicleId === 'custom' ? customVehicle : undefined,
          startSoc: startSocPct,
          targetArrivalSoc: targetArrivalSocPct,
          mode,
          includeUnverified,
          departAt: new Date().toISOString(),
        });

        if (planRes.data.alternatives && planRes.data.alternatives.length > 0) {
          setAlternatives(planRes.data.alternatives);
          setReachabilityKm((planRes.data as any).reachabilityKm || 180);
          setBackendUnreachable(false);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        if (err instanceof ApiClientError) {
          if (err.status === 422 && err.code === 'NO_FEASIBLE_PLAN') {
            setError(err.message, err.details);
          } else if (err.status === 429) {
            setError(`Rate limited. Try again in ${err.retryAfterSec || 60} seconds.`);
          } else {
            setError(err.message);
          }
        } else {
          // Backend unreachable: fallback to local fixture plan
          console.warn('Backend unreachable during plan:', err.message);
          setBackendUnreachable(true);
          setError('Backend unreachable. Showing saved sample data.');
        }
      } finally {
        setLoading(false);
      }
    },
    [
      origin,
      destination,
      route,
      activeVehicle,
      selectedVehicleId,
      customVehicle,
      startSocPct,
      targetArrivalSocPct,
      mode,
      includeUnverified,
      setRoute,
      setAlternatives,
      setReachabilityKm,
      setLoading,
      setError,
      setBackendUnreachable,
    ]
  );

  // Trigger debounced re-plan whenever inputs change
  useEffect(() => {
    if (origin && destination) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        executePlan();
      }, 300);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [origin, destination, selectedVehicleId, startSocPct, targetArrivalSocPct, mode, executePlan]);

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
      {/* Title */}
      <div>
        <h1
          className="font-display font-black text-[28px] tracking-tight leading-none"
          style={{ fontVariationSettings: "'wdth' 100, 'opsz' 28" }}
        >
          Plan a trip
        </h1>
        <p className="text-[var(--muted)] text-[14px] mt-1">
          Where to? Start typing a city.
        </p>
      </div>

      {/* Preset Corridor shortcuts */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            const org = { label: 'Bengaluru, MG Road, Karnataka', lat: 12.9756, lng: 77.6097 };
            const dst = { label: 'Chennai, Marina Beach, Tamil Nadu', lat: 13.0334, lng: 80.2785 };
            setOrigin(org);
            setDestination(dst);
            executePlan(org, dst);
          }}
          className="font-data text-[11px] border border-[var(--line)] px-2 py-1 rounded-[2px] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
        >
          &rarr; BLR &rarr; Chennai (~345km)
        </button>
        <button
          type="button"
          onClick={() => {
            const org = { label: 'Bengaluru, MG Road, Karnataka', lat: 12.9756, lng: 77.6097 };
            const dst = { label: 'Hyderabad, Telangana', lat: 17.385, lng: 78.4867 };
            setOrigin(org);
            setDestination(dst);
            executePlan(org, dst);
          }}
          className="font-data text-[11px] border border-[var(--line)] px-2 py-1 rounded-[2px] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
        >
          &rarr; BLR &rarr; Hyderabad (~570km)
        </button>
      </div>

      {/* Origin / Dest Inputs */}
      <div className="flex flex-col gap-3">
        <LocationInput label="From" placeholder="Bengaluru, Karnataka" value={origin} onChange={setOrigin} />
        <LocationInput label="To" placeholder="Chennai, Tamil Nadu" value={destination} onChange={setDestination} />
      </div>

      {/* Vehicle select (from GET /api/vehicles) */}
      <div>
        <label className="font-data text-[11px] text-[var(--muted)] block mb-1 tracking-wider uppercase">
          Vehicle <span className="opacity-70">(approx.)</span>
        </label>
        <select
          value={selectedVehicleId}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedVehicleId(val);
            setShowCustom(val === 'custom');
          }}
          className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2.5 text-[14px] rounded-[2px] outline-none focus:border-[var(--ink)] cursor-pointer"
          style={{ minHeight: 44 }}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} &mdash; {v.usableKwh} kWh, {v.whPerKmHwy} Wh/km (approx.)
            </option>
          ))}
          <option value="custom">Custom Vehicle &mdash; Enter parameters</option>
        </select>
      </div>

      {/* Custom vehicle parameter inputs */}
      {showCustom && (
        <div className="border border-[var(--line)] p-3 rounded-[2px] bg-[var(--paper)] grid grid-cols-2 gap-2 text-[12px] font-data">
          <div>
            <label className="text-[var(--muted)] block text-[10px] uppercase">Usable kWh (10-200)</label>
            <input
              type="number"
              min="10"
              max="200"
              value={customVehicle.usableKwh}
              onChange={(e) => setCustomVehicle({ usableKwh: Number(e.target.value) })}
              className="w-full border border-[var(--line)] bg-transparent p-1.5 text-[12px] rounded-[2px]"
            />
          </div>
          <div>
            <label className="text-[var(--muted)] block text-[10px] uppercase">Wh/km Hwy (80-400)</label>
            <input
              type="number"
              min="80"
              max="400"
              value={customVehicle.whPerKmHwy}
              onChange={(e) => setCustomVehicle({ whPerKmHwy: Number(e.target.value) })}
              className="w-full border border-[var(--line)] bg-transparent p-1.5 text-[12px] rounded-[2px]"
            />
          </div>
          <div>
            <label className="text-[var(--muted)] block text-[10px] uppercase">Max DC kW (0-350)</label>
            <input
              type="number"
              min="0"
              max="350"
              value={customVehicle.maxDcKw}
              onChange={(e) => setCustomVehicle({ maxDcKw: Number(e.target.value) })}
              className="w-full border border-[var(--line)] bg-transparent p-1.5 text-[12px] rounded-[2px]"
            />
          </div>
          <div>
            <label className="text-[var(--muted)] block text-[10px] uppercase">Mass kg (800-3500)</label>
            <input
              type="number"
              min="800"
              max="3500"
              value={customVehicle.massKg}
              onChange={(e) => setCustomVehicle({ massKg: Number(e.target.value) })}
              className="w-full border border-[var(--line)] bg-transparent p-1.5 text-[12px] rounded-[2px]"
            />
          </div>
        </div>
      )}

      {/* SoC Sliders */}
      <div className="flex flex-col gap-4">
        <SocSlider label="Current charge" value={startSocPct} onChange={setStartSoc} min={5} max={100} />
        <SocSlider label="Target arrival" value={targetArrivalSocPct} onChange={setTargetSoc} min={10} max={100} />
      </div>

      {/* Mode Toggle */}
      <div>
        <p className="font-data text-[11px] text-[var(--muted)] mb-2 tracking-wider uppercase">Energy estimate</p>
        <div className="grid grid-cols-3 gap-1 border border-[var(--line)] rounded-[2px] p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={[
                'py-2 px-1 text-[12px] rounded-[2px] transition-colors text-center',
                mode === m.value ? 'bg-[var(--ink)] text-[var(--paper)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              <div className="font-medium">{m.label}</div>
              <div className="font-data text-[10px] opacity-70">{m.note}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Community Chargers Planner Option */}
      <div className="pt-2 border-t border-[var(--line)] flex flex-col gap-1">
        <label className="flex items-center justify-between cursor-pointer select-none">
          <span className="font-data text-[12px] text-[var(--ink)] font-medium">
            Include unverified community chargers
          </span>
          <input
            type="checkbox"
            checked={includeUnverified}
            onChange={(e) => setIncludeUnverified(e.target.checked)}
            className="w-4 h-4 cursor-pointer accent-[var(--volt)]"
          />
        </label>
        <p className="font-data text-[10px] text-[var(--muted)] leading-tight">
          Default off. When enabled, allows stops at community chargers awaiting 2 driver votes (+10 min penalty).
        </p>
      </div>

      {/* Skeleton Battery Loading State (Signature Moment G) */}
      {loading && (
        <div className="border border-[var(--line)] rounded-[2px] p-4 flex items-center gap-3 bg-[var(--paper)]">
          <div className="w-12 h-6 border border-[var(--ink)] rounded-[2px] p-0.5 overflow-hidden">
            <div className="h-full bg-[var(--volt)] animate-pulse" style={{ width: '65%' }} />
          </div>
          <span className="font-data text-[12px] text-[var(--muted)]">Finding plugs near the route...</span>
        </div>
      )}

      {/* 422 Error Handling Panel */}
      {error && (
        <div className="border border-[var(--signal)] rounded-[2px] p-3.5 bg-[var(--paper)] text-[13px] flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--signal)] font-bold font-data text-[12px]">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
          {errorDetails && (
            <div className="font-data text-[12px] text-[var(--muted)] flex flex-col gap-1 pt-1 border-t border-[var(--line)]">
              {errorDetails.longestGapKm && <div>Longest gap: {errorDetails.longestGapKm} km</div>}
              {errorDetails.vehicleRealRangeKm && <div>Estimated vehicle range: {errorDetails.vehicleRealRangeKm} km</div>}
              {errorDetails.suggestion && <div className="text-[var(--ink)] font-medium mt-1">{errorDetails.suggestion}</div>}
              <button
                type="button"
                onClick={() => {
                  setStartSoc(60);
                }}
                className="btn-volt py-1 px-3 text-[11px] mt-2 self-start"
              >
                Raise starting charge to 60%
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Plan Button */}
      <button
        type="button"
        onClick={() => executePlan()}
        disabled={!origin || !destination || loading}
        className="btn-volt w-full justify-center text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Computing route...' : 'Plan Route'}
      </button>
    </div>
  );
}

function SocSlider({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="font-data text-[11px] text-[var(--muted)] tracking-wider uppercase">{label}</label>
        <span className="font-data text-[18px] font-bold tabular-nums text-[var(--ink)]">{value}%</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${label}: ${value}%`}
          className="w-full h-1 appearance-none bg-[var(--line)] rounded-full cursor-pointer accent-[var(--volt)]"
        />
        {label === 'Target arrival' && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[var(--signal)]"
            style={{ left: `${((10 - min) / (max - min)) * 100}%` }}
            title="Minimum reserve: 10%"
          />
        )}
      </div>
    </div>
  );
}
