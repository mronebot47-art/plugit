'use client';

import { useState } from 'react';
import { fetchAddCharger, ApiClientError } from '@/lib/api';
import type { Station } from '@/lib/types';

interface AddChargerSheetProps {
  initialLat: number;
  initialLng: number;
  onClose: () => void;
  onChargerAdded: (charger: any) => void;
}

const CONNECTOR_TYPES = ['CCS2', 'Type2', 'BharatDC001', 'GB/T', 'CHAdeMO', '15A Socket'];

export function AddChargerSheet({
  initialLat,
  initialLng,
  onClose,
  onChargerAdded,
}: AddChargerSheetProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [lat, setLat] = useState<number>(Number(initialLat.toFixed(5)));
  const [lng, setLng] = useState<number>(Number(initialLng.toFixed(5)));
  const [address, setAddress] = useState('');
  const [access, setAccess] = useState<'public_paid' | 'public_free'>('public_paid');
  const [publicConfirmed, setPublicConfirmed] = useState(false);

  // Plugs state
  const [connectors, setConnectors] = useState<Array<{ type: string; kw: number; qty: number }>>([
    { type: 'CCS2', kw: 60, qty: 2 },
  ]);

  // Access & details state
  const [priceNote, setPriceNote] = useState('');
  const [hours, setHours] = useState('24/7');

  const addConnectorRow = () => {
    if (connectors.length < 6) {
      setConnectors([...connectors, { type: 'Type2', kw: 7.2, qty: 1 }]);
    }
  };

  const removeConnectorRow = (idx: number) => {
    if (connectors.length > 1) {
      setConnectors(connectors.filter((_, i) => i !== idx));
    }
  };

  const updateConnector = (idx: number, field: string, value: any) => {
    const updated = [...connectors];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setConnectors(updated);
  };

  const handleSubmit = async () => {
    if (!publicConfirmed) {
      setError('You must confirm this charging point is open to the public.');
      return;
    }
    if (name.trim().length < 3) {
      setError('Name must be at least 3 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    // Get or create persistent device ID
    let devId = '';
    if (typeof window !== 'undefined') {
      try {
        devId = localStorage.getItem('plugit.deviceId') || '';
        if (!devId) {
          devId = 'dev-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
          localStorage.setItem('plugit.deviceId', devId);
        }
      } catch {}
    }
    if (!devId) devId = 'dev-' + Math.random().toString(36).slice(2, 16);

    try {
      const res = await fetchAddCharger({
        name: name.trim(),
        lat: Number(lat),
        lng: Number(lng),
        address: address.trim() || undefined,
        connectors,
        access,
        priceNote: priceNote.trim() || undefined,
        hours: hours.trim() || undefined,
        publicConfirmed: true,
        deviceId: devId,
      });

      // Save to localStorage['plugit.myChargers']
      if (typeof window !== 'undefined') {
        try {
          const myChargers = JSON.parse(localStorage.getItem('plugit.myChargers') || '[]');
          myChargers.push({
            id: res.id,
            name: name.trim(),
            editToken: res.editToken,
            addedAt: new Date().toISOString(),
          });
          localStorage.setItem('plugit.myChargers', JSON.stringify(myChargers));
        } catch {}
      }

      onChargerAdded(res);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setError(
            err.details?.name
              ? `Nearby duplicate: "${err.details.name}" is already listed within 50m.`
              : 'A charger with matching connectors already exists within 50 meters.'
          );
        } else if (err.status === 429) {
          setError('Rate limit reached (max 3 submissions per 24 hours).');
        } else {
          setError(err.message || 'Submission failed.');
        }
      } else {
        setError(err.message || 'Failed to submit charger.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] w-full max-w-lg rounded-t-[4px] sm:rounded-[2px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-[18px] tracking-tight">Add a Charger</span>
            <span className="font-data text-[11px] bg-[var(--line)] px-2 py-0.5 rounded-[2px] font-bold text-[var(--muted)]">
              Step {step} of 3
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] text-[22px] leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-[var(--signal)]/10 border-l-4 border-[var(--signal)] text-[var(--signal)] p-3 text-[12px] font-data font-medium">
            {error}
          </div>
        )}

        {/* Step Contents */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* STEP 1: PLACE */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                  Charger Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Highway Cafe Charging Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[14px] rounded-[2px] outline-none focus:border-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-data">
                <div>
                  <label className="text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[13px] rounded-[2px] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[13px] rounded-[2px] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                  Address / Landmark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Shoolagiri Toll, NH 44"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[14px] rounded-[2px] outline-none focus:border-[var(--ink)]"
                />
              </div>

              <div>
                <label className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                  Access Type
                </label>
                <div className="grid grid-cols-2 gap-2 font-data text-[12px]">
                  <button
                    type="button"
                    onClick={() => setAccess('public_paid')}
                    className={`py-2 px-3 border rounded-[2px] text-center font-bold cursor-pointer ${
                      access === 'public_paid'
                        ? 'border-[var(--ink)] bg-[var(--line)] text-[var(--ink)]'
                        : 'border-[var(--line)] text-[var(--muted)]'
                    }`}
                  >
                    Public (Paid Tariff)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccess('public_free')}
                    className={`py-2 px-3 border rounded-[2px] text-center font-bold cursor-pointer ${
                      access === 'public_free'
                        ? 'border-[var(--ink)] bg-[var(--line)] text-[var(--ink)]'
                        : 'border-[var(--line)] text-[var(--muted)]'
                    }`}
                  >
                    Public (Free to Charge)
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={publicConfirmed}
                    onChange={(e) => setPublicConfirmed(e.target.checked)}
                    className="mt-0.5 cursor-pointer accent-[var(--volt)]"
                  />
                  <span className="font-data text-[12px] leading-snug text-[var(--ink)]">
                    I confirm this charger is open to the public without gated or private residency restrictions.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: PLUGS */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-data text-[12px] text-[var(--muted)] uppercase tracking-wider">
                  Connectors ({connectors.length}/6)
                </span>
                {connectors.length < 6 && (
                  <button
                    type="button"
                    onClick={addConnectorRow}
                    className="font-data text-[11px] text-[var(--ink)] font-bold hover:underline cursor-pointer"
                  >
                    + Add Connector
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {connectors.map((con, idx) => (
                  <div
                    key={idx}
                    className="border border-[var(--line)] p-2.5 rounded-[2px] bg-[var(--paper)] flex items-center gap-2"
                  >
                    <select
                      value={con.type}
                      onChange={(e) => updateConnector(idx, 'type', e.target.value)}
                      className="border border-[var(--line)] p-1.5 text-[12px] font-data bg-[var(--paper)] rounded-[2px] flex-1 outline-none"
                    >
                      {CONNECTOR_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 font-data text-[11px]">
                      <input
                        type="number"
                        min="1"
                        max="350"
                        value={con.kw}
                        onChange={(e) => updateConnector(idx, 'kw', Number(e.target.value))}
                        className="w-14 border border-[var(--line)] p-1 text-center bg-transparent rounded-[2px]"
                      />
                      <span className="text-[var(--muted)]">kW</span>
                    </div>

                    <div className="flex items-center gap-1 font-data text-[11px]">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={con.qty}
                        onChange={(e) => updateConnector(idx, 'qty', Number(e.target.value))}
                        className="w-12 border border-[var(--line)] p-1 text-center bg-transparent rounded-[2px]"
                      />
                      <span className="text-[var(--muted)]">plugs</span>
                    </div>

                    {connectors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeConnectorRow(idx)}
                        className="text-[var(--signal)] hover:text-red-700 px-1 font-bold cursor-pointer"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: ACCESS & PRICING */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                  Tariff / Pricing Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ₹18/kWh or Free for cafe patrons"
                  value={priceNote}
                  onChange={(e) => setPriceNote(e.target.value)}
                  className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[14px] rounded-[2px] outline-none"
                />
              </div>

              <div>
                <label className="font-data text-[11px] text-[var(--muted)] uppercase tracking-wider block mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24/7 or 8:00 AM - 10:00 PM"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[14px] rounded-[2px] outline-none"
                />
              </div>

              <div className="bg-[var(--line)]/30 border border-[var(--line)] p-3 rounded-[2px] text-[12px] font-data text-[var(--muted)] flex flex-col gap-1">
                <span className="font-bold text-[var(--ink)]">Community Verification Rule:</span>
                <span>
                  This charger will display on the map immediately as <strong>unverified</strong> with a dashed ring.
                  Once 2 distinct EV drivers confirm it worked, it will be promoted to <strong>confirmed</strong>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-[var(--line)] flex items-center justify-between bg-[var(--paper)]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-3 py-2 text-[12px] font-data border border-[var(--line)] rounded-[2px] hover:bg-[var(--line)]/50 cursor-pointer"
            >
              &larr; Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !name.trim()) {
                  setError('Charger name is required.');
                  return;
                }
                if (step === 1 && !publicConfirmed) {
                  setError('You must confirm this charging point is public.');
                  return;
                }
                setError(null);
                setStep((s) => (s + 1) as any);
              }}
              className="btn-volt py-2 px-5 text-[13px] cursor-pointer"
            >
              Next: {step === 1 ? 'Connectors' : 'Access & Submit'} &rarr;
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-volt py-2 px-6 text-[13px] cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Charger'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
