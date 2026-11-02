'use client';

import type { RibbonPoint, PlanStop } from '@/lib/types';

interface BatteryRibbonProps {
  series: RibbonPoint[];
  stops: PlanStop[];
  totalKm: number;
  onHoverKm?: (km: number | null) => void;
}

export function BatteryRibbon({ series, stops, totalKm, onHoverKm }: BatteryRibbonProps) {
  if (!series || series.length === 0) return null;

  const width = 600;
  const height = 120;
  const padding = { top: 12, right: 16, bottom: 24, left: 32 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Scale functions
  const getX = (km: number) => padding.left + (km / Math.max(totalKm, 1)) * plotW;
  const getY = (soc: number) => padding.top + plotH - (soc / 100) * plotH;

  // Build SVG path
  let pathD = '';
  series.forEach((pt, idx) => {
    const x = getX(pt.distanceKm);
    const y = getY(pt.socPct);
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  // Area under curve
  const areaD = `${pathD} L ${getX(totalKm)} ${padding.top + plotH} L ${padding.left} ${padding.top + plotH} Z`;

  // 10% Reserve threshold line Y coordinate
  const reserveY = getY(10);

  return (
    <div className="border border-[var(--line)] bg-[var(--paper)] rounded-[2px] p-3 w-full">
      <style>{`
        @keyframes drawRibbon {
          from { stroke-dashoffset: 1200; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInArea {
          from { opacity: 0; }
          to { opacity: 0.15; }
        }
        .anim-ribbon-path {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: drawRibbon 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-ribbon-area {
          animation: fadeInArea 1.4s ease forwards;
        }
      `}</style>
      <div className="flex items-center justify-between mb-2">
        <span className="font-data text-[12px] text-[var(--muted)] tracking-wider uppercase">
          Battery Ribbon (SoC over Distance)
        </span>
        <span className="font-data text-[12px] text-[var(--signal)] flex items-center gap-1">
          <span className="inline-block w-2 h-0.5 bg-[var(--signal)]"></span>
          10% Min Reserve
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        onMouseLeave={() => onHoverKm?.(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const ratio = (mouseX - padding.left) / plotW;
          const km = Math.max(0, Math.min(totalKm, ratio * totalKm));
          onHoverKm?.(km);
        }}
      >
        {/* Fill area */}
        <path d={areaD} fill="var(--volt)" className="anim-ribbon-area" />

        {/* 10% Reserve line */}
        <line
          x1={padding.left}
          y1={reserveY}
          x2={padding.left + plotW}
          y2={reserveY}
          stroke="var(--signal)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* The Sawtooth Curve */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="anim-ribbon-path"
        />

        {/* Stop indicators */}
        {stops.map((stop, i) => {
          const km = stop.station.distanceAlongRoute ?? 0;
          const x = getX(km);
          const yArr = getY(stop.arrivalSocPct ?? 0);
          const yDep = getY(stop.departureSocPct ?? 0);

          if (!Number.isFinite(x) || !Number.isFinite(yArr) || !Number.isFinite(yDep)) return null;

          return (
            <g key={i}>
              {/* Vertical charge bar */}
              <line
                x1={x}
                y1={yArr}
                x2={x}
                y2={yDep}
                stroke="var(--volt)"
                strokeWidth="4"
              />
              <circle cx={x} cy={yArr} r="3" fill="var(--signal)" />
              <circle cx={x} cy={yDep} r="3.5" fill="var(--ok)" />
            </g>
          );
        })}

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 4}
          fill="var(--muted)"
          fontSize="10"
          fontFamily="var(--font-data)"
        >
          0 km
        </text>
        <text
          x={padding.left + plotW}
          y={height - 4}
          textAnchor="end"
          fill="var(--muted)"
          fontSize="10"
          fontFamily="var(--font-data)"
        >
          {Math.round(totalKm)} km
        </text>

        {/* Y-axis labels */}
        <text
          x={padding.left - 6}
          y={padding.top + 8}
          textAnchor="end"
          fill="var(--muted)"
          fontSize="10"
          fontFamily="var(--font-data)"
        >
          100%
        </text>
        <text
          x={padding.left - 6}
          y={reserveY + 3}
          textAnchor="end"
          fill="var(--signal)"
          fontSize="10"
          fontFamily="var(--font-data)"
        >
          10%
        </text>
      </svg>
    </div>
  );
}
