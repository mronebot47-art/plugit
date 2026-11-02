'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { PlannerPanel } from '@/components/planner/PlannerPanel';
import { MapView } from '@/components/map/MapView';
import { BatteryRibbon } from '@/components/planner/BatteryRibbon';
import { StopTimetable } from '@/components/planner/StopTimetable';
import { StationSheet } from '@/components/planner/StationSheet';
import { usePlannerStore } from '@/lib/store/planner';
import { saveTrip } from '@/lib/api';
import type { Station } from '@/lib/types';

export default function PlanPage() {
  const router = useRouter();
  const { alternatives, activeAlt, setActiveAlt, route, origin, destination, startSocPct, targetArrivalSocPct, mode, vehicles, selectedVehicleId, customVehicle } = usePlannerStore();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);

  const activePlan = alternatives[activeAlt];

  const handleStartSimulation = async () => {
    if (!activePlan) return;
    setSavingTrip(true);
    try {
      const activeVehicle = selectedVehicleId === 'custom' ? customVehicle : vehicles.find(v => v.id === selectedVehicleId) || vehicles[0]!;
      const currentRouteId = route?.id || `route-${Date.now()}`;
      const res = await saveTrip({
        routeId: currentRouteId,
        originLabel: origin?.label || 'Current Origin',
        destLabel: destination?.label || 'Destination',
        startSoc: startSocPct,
        targetArrivalSoc: targetArrivalSocPct,
        mode,
        selectedLabel: activePlan.label,
        departAt: new Date().toISOString(),
        plan: activePlan,
        vehicle: activeVehicle,
      });

      if (res.id) {
        router.push(`/trip/${res.id}/live`);
      } else {
        router.push(`/trip/${currentRouteId}/live`);
      }
    } catch {
      router.push(`/trip/${route?.id || 'active'}/live`);
    } finally {
      setSavingTrip(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/t/${route?.id || 'trip'}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const calmScore = activePlan
    ? typeof activePlan.calmIndex === 'object'
      ? activePlan.calmIndex.score
      : activePlan.calmIndex
    : 80;

  const calmLine = activePlan
    ? typeof activePlan.calmIndex === 'object'
      ? activePlan.calmIndex.line
      : (activePlan as any).calmLine
    : '';

  const ribbonPoints = (activePlan?.ribbonSeries as any)?.points || activePlan?.ribbonSeries || [];

  return (
    <Shell>
      <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
        {/* Left Side: Planner Form & Results */}
        <aside className="w-full md:w-[460px] border-r border-[var(--line)] bg-[var(--paper)] flex flex-col flex-shrink-0 h-full overflow-y-auto">
          <PlannerPanel />

          {/* Results section */}
          {activePlan && (
            <div className="p-6 pt-0 border-t border-[var(--line)] flex flex-col gap-5 mt-4">
              {/* Alternatives Toggle */}
              {alternatives.length > 1 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {alternatives.map((alt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveAlt(idx as 0 | 1)}
                      className={`py-2 px-3 text-[12px] font-display font-bold border rounded-[2px] transition-colors ${
                        activeAlt === idx
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                          : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {alt.label} &middot; {Math.round(alt.totals.totalMinutes / 60)}h {alt.totals.totalMinutes % 60}m
                    </button>
                  ))}
                </div>
              )}

              {/* Trip Overview Stat Header */}
              <div className="border border-[var(--line)] p-4 rounded-[2px] bg-[var(--paper)]">
                <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-[var(--line)]">
                  <div>
                    <span className="font-data text-[10px] text-[var(--muted)] uppercase tracking-wider block">
                      Total Time
                    </span>
                    <span className="font-data text-[18px] font-bold text-[var(--ink)]">
                      {Math.floor(activePlan.totals.totalMinutes / 60)}h {activePlan.totals.totalMinutes % 60}m
                    </span>
                  </div>
                  <div>
                    <span className="font-data text-[10px] text-[var(--muted)] uppercase tracking-wider block">
                      Stops
                    </span>
                    <span className="font-data text-[18px] font-bold text-[var(--ink)]">
                      {activePlan.stops.length}
                    </span>
                  </div>
                  <div>
                    <span className="font-data text-[10px] text-[var(--muted)] uppercase tracking-wider block">
                      Arrival SoC
                    </span>
                    <span className="font-data text-[18px] font-bold text-[var(--volt)] bg-[var(--ink)] px-1.5 py-0.5 rounded-[2px]">
                      {activePlan.totals.arrivalSocPct}%
                    </span>
                  </div>
                </div>

                {/* Calm Index line & Live Sim CTA */}
                <div className="pt-3">
                  <div className="flex items-center justify-between text-[12px] font-data mb-1">
                    <span className="text-[var(--muted)]">Calm Index</span>
                    <span className="font-bold text-[var(--ink)]">{calmScore} / 100</span>
                  </div>
                  <p className="text-[12px] text-[var(--muted)] italic leading-tight mb-3">
                    &ldquo;{calmLine}&rdquo;
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleStartSimulation}
                      disabled={savingTrip}
                      className="btn-volt flex-1 justify-center text-[13px] py-2 text-center"
                    >
                      {savingTrip ? 'Starting...' : 'Start Live Trip Simulation \u2192'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="border border-[var(--line)] px-3 text-[12px] font-data rounded-[2px] hover:border-[var(--ink)]"
                    >
                      {copiedLink ? '\u2713 Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Battery Ribbon (Sawtooth curve) */}
              <BatteryRibbon
                series={ribbonPoints}
                stops={activePlan.stops}
                totalKm={activePlan.totals.distanceKm}
              />

              {/* Stops Timetable */}
              <StopTimetable
                stops={activePlan.stops}
                onSelectStation={(stop) => setSelectedStation(stop.station)}
              />
            </div>
          )}

          {/* Selected Station Bottom Sheet */}
          {selectedStation && (
            <div className="mt-auto">
              <StationSheet
                station={selectedStation}
                onClose={() => setSelectedStation(null)}
              />
            </div>
          )}
        </aside>

        {/* Right Side: Map */}
        <main className="flex-1 h-full min-w-0 relative">
          <MapView
            onSelectStation={(st) => setSelectedStation(st)}
            selectedStationId={selectedStation?.id}
          />
        </main>
      </div>
    </Shell>
  );
}
