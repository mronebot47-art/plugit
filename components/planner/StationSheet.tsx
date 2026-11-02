'use client';

import { useState, useEffect } from 'react';
import type { Station, CommunityReport } from '@/lib/types';
import { usePlannerStore } from '@/lib/store/planner';
import { postReport, ApiClientError } from '@/lib/api';

interface StationSheetProps {
  station: Station | null;
  onClose: () => void;
  onStatusChanged?: (stationId: string, status: 'working' | 'broken' | 'queue') => void;
}

export function StationSheet({ station, onClose, onStatusChanged }: StationSheetProps) {
  const { deviceId } = usePlannerStore();

  const [reportState, setReportState] = useState<'idle' | 'reporting' | 'reported' | 'error'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [queueMinutes, setQueueMinutes] = useState<number>(15);
  const [showQueueInput, setShowQueueInput] = useState(false);
  const [liveReports, setLiveReports] = useState<CommunityReport[]>([]);

  // Real-time EventSource subscription for station reports
  useEffect(() => {
    if (!station) return;

    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    const sseUrl = `${base}/api/reports/stream?stationIds=${encodeURIComponent(station.id)}`;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('report', (e) => {
        try {
          const report: CommunityReport = JSON.parse(e.data);
          if (report.stationId === station.id) {
            setLiveReports((prev) => [report, ...prev].slice(0, 5));
            if (report.status === 'broken') {
              onStatusChanged?.(station.id, 'broken');
            } else if (report.status === 'working') {
              onStatusChanged?.(station.id, 'working');
            }
          }
        } catch {}
      });
    } catch (e) {
      console.warn('SSE stream failed to connect:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [station, onStatusChanged]);

  if (!station) return null;

  const availability = station.availability || {
    probFree: 0.78,
    label: 'Estimated' as const,
    forecast12h: [0.8, 0.75, 0.65, 0.5, 0.6, 0.7, 0.85, 0.9, 0.8, 0.7, 0.6, 0.75],
  };

  const probFreePct = Math.round(availability.probFree * 100);
  const forecastBars = availability.forecast12h || [0.8, 0.7, 0.6, 0.5, 0.8];

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;

  const submitReport = async (status: 'working' | 'queue' | 'broken' | 'blocked') => {
    setReportState('reporting');
    setReportError(null);

    try {
      await postReport({
        stationId: station.id,
        status,
        queueMin: status === 'queue' ? queueMinutes : undefined,
        deviceId,
      });

      setReportState('reported');
      onStatusChanged?.(station.id, status === 'broken' ? 'broken' : 'working');
      setTimeout(() => setReportState('idle'), 4000);
    } catch (err: any) {
      setReportState('error');
      if (err instanceof ApiClientError && err.status === 429) {
        setReportError(`Already reported. Try again in ${err.retryAfterSec || 60} s.`);
      } else {
        setReportError(err.message || 'Report submission failed.');
      }
    }
  };

  return (
    <div className="border-t border-[var(--line)] bg-[var(--paper)] p-4 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                station.status === 'working'
                  ? 'bg-[var(--ok)]'
                  : station.status === 'down'
                  ? 'bg-[var(--signal)]'
                  : 'bg-[var(--muted)]'
              }`}
            />
            <span className="font-data text-[11px] uppercase tracking-wider text-[var(--muted)]">
              {station.operator}
            </span>
            {/* EXACT CHIP TEXT: Never write "Live" */}
            <span className="font-data text-[11px] bg-[var(--line)] text-[var(--ink)] px-1.5 py-0.5 rounded-[2px] font-medium">
              {availability.label}
            </span>
          </div>

          <h3 className="font-display font-bold text-[18px] text-[var(--ink)] leading-snug">
            {station.name}
          </h3>
          <p className="text-[12px] text-[var(--muted)] mt-0.5">{station.address}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close station sheet"
          className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-[20px] leading-none"
        >
          &times;
        </button>
      </div>

      {/* Availability Metric & 12-Hour Forecast Mini Chart */}
      <div className="border border-[var(--line)] p-3 rounded-[2px] bg-[var(--paper)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider">
            Estimated Availability
          </span>
          <span className="font-data text-[13px] font-bold text-[var(--ink)]">
            {probFreePct}% Free Chance
          </span>
        </div>

        {/* 12-Bar Mini Chart */}
        <div className="flex items-end gap-1 h-9 pt-1 border-t border-[var(--line)]/50">
          {forecastBars.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
              <div
                className="w-full bg-[var(--ink)] rounded-[1px] transition-all hover:bg-[var(--volt)]"
                style={{ height: `${Math.max(15, Math.round(val * 100))}%` }}
                title={`Hour +${idx + 1}: ${Math.round(val * 100)}% availability`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] font-data text-[var(--muted)]">
          <span>Now</span>
          <span>+6h</span>
          <span>+12h</span>
        </div>
      </div>

      {/* Connectors info */}
      <div className="border border-[var(--line)] rounded-[2px] p-2.5 bg-[var(--paper)]">
        <div className="font-data text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2">
          Connectors ({station.connectors.length}) &middot; Max Power {station.maxKw} kW
        </div>
        <div className="grid grid-cols-2 gap-2">
          {station.connectors.map((c, idx) => (
            <div key={idx} className="border border-[var(--line)] p-2 rounded-[2px]">
              <div className="font-display font-bold text-[13px]">{c.type}</div>
              <div className="font-data text-[11px] text-[var(--muted)]">
                {c.kw} kW &middot; {c.qty} plug{c.qty > 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Status Reporting */}
      <div className="border border-[var(--line)] rounded-[2px] p-3 flex flex-col gap-2">
        <span className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider">
          Report Status
        </span>

        {reportState === 'reported' ? (
          <div className="font-data text-[12px] text-[var(--ok)] font-medium">
            &check; Report logged. Updates in real-time.
          </div>
        ) : reportState === 'error' ? (
          <div className="font-data text-[12px] text-[var(--signal)] font-medium">
            {reportError}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => submitReport('working')}
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data hover:border-[var(--ok)] hover:text-[var(--ok)]"
              >
                Working
              </button>
              <button
                type="button"
                onClick={() => setShowQueueInput(!showQueueInput)}
                className={`py-1.5 border rounded-[2px] text-[11px] font-data ${
                  showQueueInput ? 'border-[var(--ink)] bg-[var(--line)]' : 'border-[var(--line)]'
                }`}
              >
                Queue
              </button>
              <button
                type="button"
                onClick={() => submitReport('broken')}
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data text-[var(--signal)] hover:border-[var(--signal)]"
              >
                Broken
              </button>
              <button
                type="button"
                onClick={() => submitReport('blocked')}
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data hover:border-[var(--ink)]"
              >
                Blocked
              </button>
            </div>

            {showQueueInput && (
              <div className="flex items-center gap-2 pt-1 font-data text-[11px]">
                <span className="text-[var(--muted)]">Wait min:</span>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={queueMinutes}
                  onChange={(e) => setQueueMinutes(Number(e.target.value))}
                  className="w-16 border border-[var(--line)] p-1 text-center bg-transparent rounded-[2px]"
                />
                <button
                  type="button"
                  onClick={() => submitReport('queue')}
                  className="btn-volt py-1 px-3 text-[11px]"
                >
                  Confirm Queue
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deep Link Navigation */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-volt justify-center py-2 text-[13px] text-center no-underline"
      >
        Navigate (Google Maps)
      </a>
    </div>
  );
}
