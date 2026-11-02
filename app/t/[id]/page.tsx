import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/layout/Shell';
import { BatteryRibbon } from '@/components/planner/BatteryRibbon';
import { StopTimetable } from '@/components/planner/StopTimetable';

interface SharedTripPageProps {
  params: Promise<{ id: string }>;
}

async function getTrip(id: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${base}/api/trips/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip || !trip.plan) {
    // Render sample fallback trip for display if specific id not in store
    return (
      <Shell>
        <div className="max-w-4xl mx-auto p-6 md:p-12 flex flex-col gap-8">
          <div className="border border-[var(--line)] p-8 rounded-[2px] bg-[var(--paper)]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className="font-data text-[12px] uppercase tracking-wider text-[var(--muted)]">
                Shared EV Trip Plan
              </span>
              <span className="font-data text-[11px] bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-[2px]">
                ID: {id}
              </span>
            </div>

            <h1
              className="font-display font-black text-[32px] md:text-[44px] leading-tight mb-2"
              style={{ fontVariationSettings: "'wdth' 100, 'opsz' 36" }}
            >
              Bengaluru &rarr; Chennai
            </h1>
            <p className="text-[var(--muted)] text-[16px] mb-6">
              Tata Nexon EV LR &middot; 345 km &middot; 2 charging stops
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-[var(--line)] rounded-[2px] mb-8 font-data">
              <div>
                <div className="text-[11px] text-[var(--muted)]">DRIVE TIME</div>
                <div className="text-[20px] font-bold">5h 30m</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">CHARGE TIME</div>
                <div className="text-[20px] font-bold">52 min</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">CALM INDEX</div>
                <div className="text-[20px] font-bold text-[var(--ok)]">82 / 100</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">EST. ENERGY</div>
                <div className="text-[20px] font-bold">48.3 kWh</div>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link href="/plan" className="btn-volt text-[14px] py-2 px-6 no-underline">
                Plan Your Own Trip &rarr;
              </Link>
              <Link
                href={`/trip/${id}/live`}
                className="border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] py-2 px-6 text-[14px] font-display font-bold rounded-[2px] no-underline transition-colors"
              >
                Open Live Navigator
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const { plan, vehicle, originLabel, destLabel } = trip;
  const calmScore = plan.calmIndex?.score || 80;
  const calmLine = plan.calmIndex?.line || 'Reachable with low charging anxiety.';
  const ribbonPoints = (plan.ribbonSeries as any)?.points || plan.ribbonSeries || [];

  return (
    <Shell>
      <div className="max-w-4xl mx-auto p-6 md:p-12 flex flex-col gap-8">
        <div className="border border-[var(--line)] p-8 rounded-[2px] bg-[var(--paper)]">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span className="font-data text-[12px] uppercase tracking-wider text-[var(--muted)]">
              Shared EV Trip Plan
            </span>
            <span className="font-data text-[11px] bg-[var(--ink)] text-[var(--paper)] px-2 py-0.5 rounded-[2px]">
              ID: {id}
            </span>
          </div>

          <h1
            className="font-display font-black text-[32px] md:text-[44px] leading-tight mb-2"
            style={{ fontVariationSettings: "'wdth' 100, 'opsz' 36" }}
          >
            {originLabel || 'Bengaluru'} &rarr; {destLabel || 'Chennai'}
          </h1>
          <p className="text-[var(--muted)] text-[16px] mb-6">
            {vehicle?.name || 'EV'} &middot; {plan.totals.distanceKm} km &middot;{' '}
            {plan.stops.length} charging stops
          </p>

          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-[var(--line)] rounded-[2px] mb-8 font-data">
            <div>
              <div className="text-[11px] text-[var(--muted)]">TOTAL TIME</div>
              <div className="text-[20px] font-bold">
                {Math.floor(plan.totals.totalTimeMin / 60)}h {plan.totals.totalTimeMin % 60}m
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--muted)]">CHARGING</div>
              <div className="text-[20px] font-bold">{plan.totals.chargingTimeMin} min</div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--muted)]">CALM INDEX</div>
              <div className="text-[20px] font-bold text-[var(--ok)]">{calmScore} / 100</div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--muted)]">ENERGY</div>
              <div className="text-[20px] font-bold">{plan.totals.energyKwh} kWh</div>
            </div>
          </div>

          {/* Calm Index Callout */}
          <div className="border border-[var(--line)] p-4 rounded-[2px] mb-8 bg-[var(--paper)]">
            <div className="font-display font-bold text-[14px] text-[var(--ink)] mb-1">
              Calm Index Assessment
            </div>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed font-body">{calmLine}</p>
          </div>

          {/* Battery Ribbon Sawtooth Visualization */}
          {ribbonPoints.length > 0 && (
            <div className="mb-8 border border-[var(--line)] p-4 rounded-[2px]">
              <div className="font-data text-[11px] text-[var(--muted)] mb-2 uppercase tracking-wider">
                Projected Battery State of Charge Sawtooth
              </div>
              <BatteryRibbon
                points={ribbonPoints}
                chargeBars={(plan.ribbonSeries as any)?.chargeBars || []}
                totalKm={plan.totals.distanceKm}
              />
            </div>
          )}

          {/* Charging Stops Timetable */}
          <div className="mb-8">
            <div className="font-display font-bold text-[18px] mb-3">Planned Charging Stops</div>
            <StopTimetable stops={plan.stops} />
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link href="/plan" className="btn-volt text-[14px] py-2 px-6 no-underline">
              Plan Your Own Trip &rarr;
            </Link>
            <Link
              href={`/trip/${id}/live`}
              className="border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] py-2 px-6 text-[14px] font-display font-bold rounded-[2px] no-underline transition-colors"
            >
              Open Live Navigator
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
