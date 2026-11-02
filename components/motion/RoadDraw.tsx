'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export function RoadDrawHero() {
  const [progress, setProgress] = useState(0.05);
  const [isPlaying, setIsPlaying] = useState(true);
  const animRef = useRef<number | null>(null);

  // Road SVG path dimensions
  const pathLength = 1200;

  // Compute battery SoC based on route progress
  // Journey: BLR (100%) -> Krishnagiri (28%) -> Charge to 80% -> Vellore (35%) -> Charge to 75% -> Arrive Chennai (14%)
  let displaySoC = 100;
  let stageLabel = 'Departing Bengaluru (MG Road)';
  let isCharging = false;

  if (progress < 0.35) {
    // Leg 1: 0 -> 0.35
    const ratio = progress / 0.35;
    displaySoC = Math.round(100 - ratio * 72); // 100 -> 28
    stageLabel = `Highway NH 44 · ~${Math.round(ratio * 105)} km`;
  } else if (progress < 0.45) {
    // Charging Stop 1: Krishnagiri Hub
    isCharging = true;
    const ratio = (progress - 0.35) / 0.10;
    displaySoC = Math.round(28 + ratio * 52); // 28 -> 80
    stageLabel = 'Charging at ChargeZone Krishnagiri (60 kW)';
  } else if (progress < 0.75) {
    // Leg 2: 0.45 -> 0.75
    const ratio = (progress - 0.45) / 0.30;
    displaySoC = Math.round(80 - ratio * 45); // 80 -> 35
    stageLabel = `NH 48 Vellore Corridor · ~${Math.round(105 + ratio * 110)} km`;
  } else if (progress < 0.85) {
    // Charging Stop 2: Vellore Superhub
    isCharging = true;
    const ratio = (progress - 0.75) / 0.10;
    displaySoC = Math.round(35 + ratio * 40); // 35 -> 75
    stageLabel = 'Fast charging at Statiq Vellore (120 kW)';
  } else {
    // Final stretch to Chennai
    const ratio = (progress - 0.85) / 0.15;
    displaySoC = Math.round(75 - ratio * 61); // 75 -> 14
    stageLabel = ratio >= 0.95 ? 'Arrived: Marina Beach, Chennai · 14% SoC' : `Final stretch to Chennai · ~${Math.round(215 + ratio * 130)} km`;
  }

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    function tick(now: number) {
      const dt = now - lastTime;
      lastTime = now;
      setProgress((prev) => {
        const next = prev + (dt / 14000); // 14s full journey
        return next >= 1 ? 0 : next;
      });
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  // SVG road geometry points
  const pX = 50 + progress * 800;
  const pY = 110 + Math.sin(progress * Math.PI * 3.5) * 45;

  return (
    <div className="w-full border-t border-b border-[var(--line)] py-10 my-8 bg-[var(--paper)] overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* Top telemetry status */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isCharging ? 'bg-[var(--volt)] animate-ping' : 'bg-[var(--ok)]'}`} />
              <span className="font-data text-[12px] uppercase tracking-wider text-[var(--muted)]">
                Signature Moment A &middot; Road Telemetry
              </span>
            </div>
            <p className="font-display font-bold text-[18px] text-[var(--ink)]">
              {stageLabel}
            </p>
          </div>

          {/* Oversized 96px/120px JetBrains Mono Battery Numeral */}
          <div className="flex items-baseline gap-2">
            <span
              className={`font-data font-black leading-none tracking-tighter tabular-nums ${
                displaySoC <= 15 ? 'text-[var(--signal)]' : isCharging ? 'text-[var(--volt)] bg-[var(--ink)] px-3 py-1 rounded-[4px]' : 'text-[var(--ink)]'
              }`}
              style={{ fontSize: '96px' }}
            >
              {displaySoC}%
            </span>
            <div className="flex flex-col text-[11px] font-data text-[var(--muted)]">
              <span>{isCharging ? '+ FAST CHARGING' : 'BATTERY SoC'}</span>
              <span>ESTIMATED RESERVE</span>
            </div>
          </div>
        </div>

        {/* The Animated SVG Road that draws itself */}
        <div className="relative w-full h-44 border border-[var(--line)] rounded-[2px] bg-[#E9E4DB] dark:bg-[#181714] overflow-hidden flex items-center">
          <svg viewBox="0 0 900 220" className="w-full h-full select-none">
            {/* Road casing */}
            <path
              d="M 40 110 C 180 30, 280 190, 420 110 C 560 30, 680 190, 860 110"
              fill="none"
              stroke="#D3CDC0"
              strokeWidth="28"
              strokeLinecap="round"
            />
            
            {/* Road asphalt */}
            <path
              d="M 40 110 C 180 30, 280 190, 420 110 C 560 30, 680 190, 860 110"
              fill="none"
              stroke="#2A2924"
              strokeWidth="20"
              strokeLinecap="round"
            />

            {/* Road center dashed line */}
            <path
              d="M 40 110 C 180 30, 280 190, 420 110 C 560 30, 680 190, 860 110"
              fill="none"
              stroke="#F2EEE6"
              strokeWidth="2"
              strokeDasharray="8 8"
              opacity="0.6"
            />

            {/* Progressive energized road line */}
            <path
              d="M 40 110 C 180 30, 280 190, 420 110 C 560 30, 680 190, 860 110"
              fill="none"
              stroke="var(--volt)"
              strokeWidth="5"
              strokeDasharray={pathLength}
              strokeDashoffset={pathLength * (1 - progress)}
              strokeLinecap="round"
            />

            {/* Stop Node 1: Krishnagiri */}
            <g transform="translate(330, 110)">
              <circle r="10" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
              <circle r="5" fill="var(--ok)" />
              <text y="-16" textAnchor="middle" fill="var(--ink)" fontSize="11" fontFamily="var(--font-data)" fontWeight="bold">
                Krishnagiri (60kW)
              </text>
            </g>

            {/* Stop Node 2: Vellore */}
            <g transform="translate(620, 110)">
              <circle r="10" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
              <circle r="5" fill="var(--ok)" />
              <text y="-16" textAnchor="middle" fill="var(--ink)" fontSize="11" fontFamily="var(--font-data)" fontWeight="bold">
                Vellore (120kW)
              </text>
            </g>

            {/* Destination Node: Chennai */}
            <g transform="translate(860, 110)">
              <circle r="12" fill="var(--volt)" stroke="var(--ink)" strokeWidth="2" />
              <text y="-18" textAnchor="middle" fill="var(--ink)" fontSize="11" fontFamily="var(--font-data)" fontWeight="bold">
                Chennai
              </text>
            </g>

            {/* Animated Car Marker following the path */}
            <g transform={`translate(${pX}, ${pY})`}>
              <circle r="16" fill="var(--ink)" />
              <circle r="12" fill="var(--volt)" />
              {/* Plug icon if charging, else EV icon */}
              {isCharging ? (
                <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <polygon points="2 -4 -4 0 0 2 -2 6 5 0 1 -2" fill="var(--ink)" />
              )}
            </g>
          </svg>
        </div>

        {/* Controls beneath interactive road story */}
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-volt py-1.5 px-4 text-[13px]"
            >
              {isPlaying ? 'Pause Road Simulation' : 'Resume Road'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={progress}
              onChange={(e) => {
                setIsPlaying(false);
                setProgress(parseFloat(e.target.value));
              }}
              className="w-48 accent-[var(--volt)] cursor-pointer"
            />
          </div>

          <Link href="/plan" className="btn-volt text-[14px] py-1.5 px-5">
            Plan your exact route &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
}
