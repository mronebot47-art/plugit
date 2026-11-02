'use client';

import { useState, useEffect } from 'react';
import type { Station, CommunityReport } from '@/lib/types';
import { usePlannerStore } from '@/lib/store/planner';
import { postReport, fetchConfirmCharger, fetchDeleteCharger, ApiClientError } from '@/lib/api';

interface StationSheetProps {
  station: Station | null;
  onClose: () => void;
  onStatusChanged?: (stationId: string, status: 'working' | 'broken' | 'queue') => void;
  onChargerRemoved?: (stationId: string) => void;
}

export function StationSheet({
  station,
  onClose,
  onStatusChanged,
  onChargerRemoved,
}: StationSheetProps) {
  const { deviceId } = usePlannerStore();

  const [reportState, setReportState] = useState<'idle' | 'reporting' | 'reported' | 'error'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [queueMinutes, setQueueMinutes] = useState<number>(15);
  const [showQueueInput, setShowQueueInput] = useState(false);
  const [liveReports, setLiveReports] = useState<CommunityReport[]>([]);

  // Community vote state
  const [voteState, setVoteState] = useState<'idle' | 'voting' | 'voted' | 'error'>('idle');
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);

  // Check if current user owns this charger
  useEffect(() => {
    if (!station || station.source !== 'community') {
      setIsOwner(false);
      setEditToken(null);
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        const myChargers = JSON.parse(localStorage.getItem('plugit.myChargers') || '[]');
        const found = myChargers.find((c: any) => c.id === station.id);
        if (found) {
          setIsOwner(true);
          setEditToken(found.editToken);
        } else {
          setIsOwner(false);
          setEditToken(null);
        }
      } catch {}
    }
  }, [station]);

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

  const handleVoteConfirmation = async (worked: boolean) => {
    setVoteState('voting');
    setVoteMsg(null);

    // Get deviceId
    let devId = deviceId;
    if (typeof window !== 'undefined') {
      try {
        devId = localStorage.getItem('plugit.deviceId') || deviceId;
      } catch {}
    }

    try {
      const res = await fetchConfirmCharger(station.id, devId, worked);
      setVoteState('voted');
      setVoteMsg(
        worked
          ? `Thanks! Verified working (+1 vote). Current status: ${res.status}.`
          : `Thanks for reporting! Feedback recorded. Current status: ${res.status}.`
      );
    } catch (err: any) {
      setVoteState('error');
      if (err instanceof ApiClientError && err.status === 403) {
        setVoteMsg('You cannot vote on your own charger submission.');
      } else if (err instanceof ApiClientError && err.status === 429) {
        setVoteMsg('Vote rate limit reached (max 30 per hour).');
      } else {
        setVoteMsg(err.message || 'Vote failed.');
      }
    }
  };

  const handleDeleteCharger = async () => {
    if (!editToken || !confirm('Are you sure you want to remove this charger from the public map?')) {
      return;
    }

    try {
      await fetchDeleteCharger(station.id, editToken);
      // Remove from myChargers
      if (typeof window !== 'undefined') {
        try {
          const myChargers = JSON.parse(localStorage.getItem('plugit.myChargers') || '[]');
          const updated = myChargers.filter((c: any) => c.id !== station.id);
          localStorage.setItem('plugit.myChargers', JSON.stringify(updated));
        } catch {}
      }
      onChargerRemoved?.(station.id);
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to delete charger');
    }
  };

  return (
    <div className="border-t border-[var(--line)] bg-[var(--paper)] p-4 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
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

            {/* Community Chip */}
            {station.source === 'community' && (
              <span className="font-data text-[10px] bg-[var(--volt)] text-[var(--ink)] px-1.5 py-0.5 rounded-[2px] font-bold">
                COMMUNITY
              </span>
            )}

            {/* Community Status Badge */}
            {station.communityStatus && (
              <span
                className={`font-data text-[10px] px-1.5 py-0.5 rounded-[2px] font-bold ${
                  station.communityStatus === 'confirmed'
                    ? 'border border-[var(--ok)] text-[var(--ok)]'
                    : 'border border-dashed border-[var(--muted)] text-[var(--muted)]'
                }`}
              >
                {station.communityStatus === 'confirmed' ? 'Confirmed by Community' : 'Unverified (Needs 2 Votes)'}
              </span>
            )}

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
          className="text-[var(--muted)] hover:text-[var(--ink)] p-1 text-[20px] leading-none cursor-pointer"
        >
          &times;
        </button>
      </div>

      {/* Community Confirmation Voting Section */}
      {station.source === 'community' && (
        <div className="border border-[var(--line)] p-3 rounded-[2px] bg-[var(--line)]/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-data text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]">
              Driver Verification
            </span>
            {isOwner && (
              <span className="font-data text-[10px] text-[var(--muted)] bg-[var(--paper)] px-1.5 py-0.5 border border-[var(--line)] rounded-[2px]">
                You submitted this charger
              </span>
            )}
          </div>

          <p className="text-[11px] text-[var(--muted)] leading-tight">
            Help fellow EV drivers! Confirm whether this community charging point worked as expected.
          </p>

          {voteMsg ? (
            <div className="font-data text-[12px] font-medium text-[var(--ink)] bg-[var(--paper)] p-2 border border-[var(--line)] rounded-[2px]">
              {voteMsg}
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleVoteConfirmation(true)}
                disabled={voteState === 'voting'}
                className="btn-volt flex-1 py-1.5 text-[12px] text-center cursor-pointer"
              >
                &check; It worked for me
              </button>
              <button
                type="button"
                onClick={() => handleVoteConfirmation(false)}
                disabled={voteState === 'voting'}
                className="border border-[var(--signal)] text-[var(--signal)] hover:bg-[var(--signal)] hover:text-white flex-1 py-1.5 text-[12px] font-data font-bold rounded-[2px] transition-colors cursor-pointer"
              >
                &times; Not here / Broken
              </button>
            </div>
          )}

          {isOwner && (
            <div className="pt-2 border-t border-[var(--line)]/50 flex justify-end">
              <button
                type="button"
                onClick={handleDeleteCharger}
                className="text-[11px] font-data text-[var(--signal)] hover:underline cursor-pointer"
              >
                Delete this charger submission
              </button>
            </div>
          )}
        </div>
      )}

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
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data hover:border-[var(--ok)] hover:text-[var(--ok)] cursor-pointer"
              >
                Working
              </button>
              <button
                type="button"
                onClick={() => setShowQueueInput(!showQueueInput)}
                className={`py-1.5 border rounded-[2px] text-[11px] font-data cursor-pointer ${
                  showQueueInput ? 'border-[var(--ink)] bg-[var(--line)]' : 'border-[var(--line)]'
                }`}
              >
                Queue
              </button>
              <button
                type="button"
                onClick={() => submitReport('broken')}
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data text-[var(--signal)] hover:border-[var(--signal)] cursor-pointer"
              >
                Broken
              </button>
              <button
                type="button"
                onClick={() => submitReport('blocked')}
                className="py-1.5 border border-[var(--line)] rounded-[2px] text-[11px] font-data hover:border-[var(--ink)] cursor-pointer"
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
                  className="btn-volt py-1 px-3 text-[11px] cursor-pointer"
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
        className="btn-volt justify-center py-2 text-[13px] text-center no-underline cursor-pointer"
      >
        Navigate (Google Maps)
      </a>
    </div>
  );
}
