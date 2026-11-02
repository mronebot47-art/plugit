'use client';

interface LiquidBatteryProps {
  socPct: number; // 0..100
  isCharging?: boolean;
}

export function LiquidBattery({ socPct, isCharging = false }: LiquidBatteryProps) {
  const clampedSoc = Math.max(0, Math.min(100, socPct));

  // Determine color token based on state
  const isLow = clampedSoc <= 15;
  const fillColor = isLow ? 'var(--signal)' : isCharging ? 'var(--volt)' : 'var(--ok)';

  return (
    <div className="flex items-center gap-3">
      {/* Battery shell */}
      <div className="relative flex items-center">
        <div
          className="relative w-16 h-8 rounded-[4px] border-2 border-[var(--ink)] bg-[var(--paper)] overflow-hidden flex items-center p-0.5"
          style={{ minWidth: 64 }}
        >
          {/* Liquid fill */}
          <div
            className="h-full rounded-[2px] transition-all duration-300 relative overflow-hidden"
            style={{
              width: `${clampedSoc}%`,
              backgroundColor: fillColor,
            }}
          >
            {/* Liquid wave surface overlay */}
            <div
              className={`absolute inset-0 opacity-40 bg-white/30 ${isCharging ? 'animate-pulse' : ''}`}
            />
          </div>

          {/* Charging icon indicator inside shell */}
          {isCharging && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink)" stroke="none">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          )}
        </div>

        {/* Positive terminal nub */}
        <div className="w-1.5 h-3.5 bg-[var(--ink)] rounded-r-[1px] -ml-[1px]" />
      </div>

      {/* Numerical SoC readout */}
      <div className="flex flex-col">
        <span className="font-data text-[18px] font-bold tabular-nums text-[var(--ink)] leading-none">
          {Math.round(clampedSoc)}%
        </span>
        <span className="font-data text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {isCharging ? 'Fast Charging' : isLow ? 'Low Battery' : 'Discharging'}
        </span>
      </div>
    </div>
  );
}
