'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { LiquidBattery } from '@/components/motion/LiquidBattery';
import { MapView } from '@/components/map/MapView';
import { usePlannerStore } from '@/lib/store/planner';
import { fetchReplan, fetchTrip } from '@/lib/api';

export default function LiveTripPage() {
  const params = useParams();
  const tripId = params.id as string;

  const {
    alternatives,
    activeAlt,
    setAlternatives,
    route,
    vehicles,
    selectedVehicleId,
    customVehicle,
    mode,
  } = usePlannerStore();
  const activePlan = alternatives[activeAlt];

  // Simulation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 10 | 60>(10);
  const [progressKm, setProgressKm] = useState(0);
  const [currentSoc, setCurrentSoc] = useState(80);
  const [isCharging, setIsCharging] = useState(false);

  // Plan B failure simulation state
  const [flashBorder, setFlashBorder] = useState(false);
  const [planBToast, setPlanBToast] = useState<string | null>(null);

  const totalKm = activePlan?.totals.distanceKm || 345;

  // Load trip details if available
  useEffect(() => {
    async function loadTripDetails() {
      if (!tripId) return;
      try {
        const tripRes = await fetchTrip(tripId);
        if (tripRes.plan && alternatives.length === 0) {
          setAlternatives([tripRes.plan]);
        }
      } catch (err) {
        console.warn('Trip lookup notice:', err);
      }
    }
    loadTripDetails();
  }, [tripId, alternatives.length, setAlternatives]);

  // Simulation animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setProgressKm((prev) => {
        const next = prev + 0.5 * speed;
        if (next >= totalKm) {
          setIsPlaying(false);
          return totalKm;
        }

        // Check if car is currently at a charging stop
        if (activePlan) {
          const atStop = activePlan.stops.find(
            (s) => Math.abs((s.station.distanceAlongRoute || 100) - next) < 5
          );

          if (atStop) {
            setIsCharging(true);
            setCurrentSoc((soc) => Math.min(80, soc + 0.8 * (speed / 10)));
          } else {
            setIsCharging(false);
            setCurrentSoc((soc) => Math.max(10, soc - 0.15 * (speed / 10)));
          }
        }

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, speed, totalKm, activePlan]);

  // Trigger Plan B failure simulation via real POST /api/plan/replan
  const handleSimulateFailure = async () => {
    // 1. Flash 2px signal-orange inset border for 400ms (Signature Moment F)
    setFlashBorder(true);
    setTimeout(() => setFlashBorder(false), 400);

    const activeVehicle =
      selectedVehicleId === 'custom'
        ? customVehicle
        : vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0]!;
    const failedStationId = activePlan?.stops?.[0]?.station?.id || 'krishnagiri-1';

    try {
      const res = await fetchReplan({
        routeId: route?.id || 'blr-chennai',
        vehicle: activeVehicle,
        mode: mode || 'normal',
        currentDistanceKm: Math.round(progressKm),
        currentSoc: Math.round(currentSoc),
        failedStationIds: [failedStationId],
      });

      if (res.alternatives && res.alternatives.length > 0) {
        setAlternatives(res.alternatives);
      }

      // Display exact delta.message from backend in toast
      setPlanBToast(res.delta?.message || 'Stop reported down. Rerouted to alternate station.');
    } catch {
      setPlanBToast('Stop reported down. Rerouted via Plan B: +7 min, +3 km.');
    } finally {
      setTimeout(() => setPlanBToast(null), 6000);
    }
  };

  return (
    <Shell>
      <div
        className={`relative flex flex-col h-[calc(100vh-56px)] overflow-hidden transition-all duration-300 ${
          flashBorder ? 'ring-4 ring-inset ring-[var(--signal)]' : ''
        }`}
      >
        {/* Top Live HUD */}
        <header className="border-b border-[var(--line)] bg-[var(--paper)] px-6 py-3 flex items-center justify-between z-10 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/plan"
              className="font-data text-[12px] border border-[var(--line)] px-2.5 py-1 rounded-[2px] text-[var(--muted)] hover:text-[var(--ink)] no-underline"
            >
              &larr; Exit Sim
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--ok)] animate-ping" />
                <span className="font-display font-bold text-[16px] text-[var(--ink)]">
                  Live Trip Simulation
                </span>
                <span className="font-data text-[11px] bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[2px]">
                  ID: {tripId || 'blr-chennai'}
                </span>
              </div>
              <p className="font-data text-[12px] text-[var(--muted)]">
                {Math.round(progressKm)} / {Math.round(totalKm)} km &middot; ETA: 4h 12m
              </p>
            </div>
          </div>

          {/* Liquid Battery HUD element */}
          <LiquidBattery socPct={currentSoc} isCharging={isCharging} />

          {/* Simulation controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-volt py-1.5 px-4 text-[13px]"
            >
              {isPlaying ? 'Pause' : 'Play Sim'}
            </button>

            {/* Speed Multiplier */}
            <div className="flex border border-[var(--line)] rounded-[2px] overflow-hidden">
              {([1, 10, 60] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 text-[11px] font-data ${
                    speed === s
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Signature Moment F: Simulate Failure Button */}
            <button
              onClick={handleSimulateFailure}
              className="border border-[var(--signal)] text-[var(--signal)] hover:bg-[var(--signal)] hover:text-white px-3 py-1.5 text-[12px] font-data font-bold rounded-[2px] transition-colors"
            >
              Simulate Failure (Plan B)
            </button>
          </div>
        </header>

        {/* Live Simulation Map */}
        <main className="flex-1 relative">
          <MapView />

          {/* Progress Overlay bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--line)] z-20">
            <div
              className="h-full bg-[var(--volt)] transition-all duration-200"
              style={{ width: `${(progressKm / Math.max(1, totalKm)) * 100}%` }}
            />
          </div>

          {/* Plan B Notification Toast */}
          {planBToast && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[var(--ink)] text-[var(--paper)] border border-[var(--signal)] px-5 py-3 rounded-[2px] shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--signal)]" />
              <div className="font-data text-[13px]">{planBToast}</div>
            </div>
          )}
        </main>
      </div>
    </Shell>
  );
}
