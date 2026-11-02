'use client';

import type { PlanStop } from '@/lib/types';

interface StopTimetableProps {
  stops: PlanStop[];
  onSelectStation?: (stop: PlanStop) => void;
}

export function StopTimetable({ stops, onSelectStation }: StopTimetableProps) {
  if (!stops || stops.length === 0) {
    return (
      <div className="border border-[var(--line)] rounded-[2px] p-4 text-[13px] text-[var(--muted)] text-center">
        Direct route feasible. No intermediate charging stops required.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-[16px] tracking-tight">
          Planned Stops ({stops.length})
        </h3>
        <span className="font-data text-[12px] text-[var(--muted)]">Departure Board</span>
      </div>

      <div className="border border-[var(--line)] rounded-[2px] overflow-hidden divide-y divide-[var(--line)]">
        {stops.map((stop, idx) => {
          return (
            <div
              key={idx}
              onClick={() => onSelectStation?.(stop)}
              className="p-3 hover:bg-[var(--line)]/30 transition-colors cursor-pointer flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-data text-[11px] bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[2px] font-bold">
                    STOP {idx + 1}
                  </span>
                  <span className="font-display font-bold text-[14px] text-[var(--ink)] truncate max-w-[190px]">
                    {stop.station.name}
                  </span>
                </div>
                <span className="font-data text-[12px] font-bold text-[var(--volt)] bg-[var(--ink)] px-2 py-0.5 rounded-[2px]">
                  {stop.chargeMinutes} min
                </span>
              </div>

              <div className="flex items-center justify-between text-[12px] font-data text-[var(--muted)]">
                <span>{stop.station.operator} &middot; {stop.station.maxKw} kW</span>
                <span className="tabular-nums">
                  {stop.arrivalSocPct}% &rarr; {stop.departureSocPct}%
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-data text-[var(--muted)] pt-1 border-t border-[var(--line)]/50">
                <span>Charge: ~{stop.chargeKwh.toFixed(1)} kWh</span>
                <span className="text-[var(--ink)] font-medium">Est. &#8377;{stop.costInr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
