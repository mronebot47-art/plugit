'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/layout/Shell';
import type { Station } from '@/lib/types';
import { availabilityChip } from '@/lib/data/availability';
import { fetchStations } from '@/lib/api';

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStations(12.9716, 77.5946, 100);
        if (Array.isArray(data)) setStations(data);
      } catch (err) {
        console.error('Failed to load stations:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = stations.filter((s) => {
    const matchesQuery =
      s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.operator.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'fast'
        ? s.maxKw >= 50
        : s.connectors.some((c) => c.type === filterType);

    return matchesQuery && matchesType;
  });

  return (
    <Shell>
      <div className="max-w-6xl mx-auto p-6 md:p-10 flex flex-col gap-6">
        <div>
          <span className="font-data text-[12px] text-[var(--muted)] tracking-widest uppercase block mb-1">
            Directory &middot; Bengaluru Corridor
          </span>
          <h1 className="font-display font-black text-[32px] md:text-[44px] tracking-tight leading-none">
            Highway Charging Stations
          </h1>
          <p className="text-[14px] md:text-[16px] text-[var(--muted)] mt-2">
            Real station operators across Indian highway corridors with estimated availability and power output.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-y border-[var(--line)] py-4">
          <input
            type="text"
            placeholder="Search operator, highway, city..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] px-3 py-2 text-[14px] rounded-[2px] outline-none focus:border-[var(--ink)] sm:w-80"
          />

          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All Plugs' },
              { id: 'fast', label: 'DC Fast (>=50kW)' },
              { id: 'CCS2', label: 'CCS2' },
              { id: 'Type2', label: 'Type 2' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1.5 text-[12px] font-data rounded-[2px] transition-colors border ${
                  filterType === f.id
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stations Grid */}
        {loading ? (
          <div className="py-20 text-center font-data text-[14px] text-[var(--muted)]">
            Loading corridor stations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center font-data text-[14px] text-[var(--muted)]">
            No charging stations match your filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((st) => (
              <div
                key={st.id}
                className="border border-[var(--line)] bg-[var(--paper)] p-4 rounded-[2px] flex flex-col justify-between hover:border-[var(--ink)] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-data text-[11px] uppercase tracking-wider text-[var(--muted)]">
                      {st.operator}
                    </span>
                    <span className="font-data text-[11px] bg-[var(--line)] text-[var(--ink)] px-1.5 py-0.5 rounded-[2px]">
                      {availabilityChip(st)}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-[16px] text-[var(--ink)] leading-snug mb-1">
                    {st.name}
                  </h3>
                  <p className="text-[12px] text-[var(--muted)] line-clamp-2 mb-3">
                    {st.address}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {st.connectors.map((c, i) => (
                      <span
                        key={i}
                        className="font-data text-[11px] border border-[var(--line)] px-2 py-0.5 rounded-[2px] text-[var(--ink)]"
                      >
                        {c.type} &middot; {c.kw} kW ({c.qty}x)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="font-data text-[12px] font-bold text-[var(--ink)]">
                    {st.maxKw} kW Peak
                  </span>
                  <Link
                    href={`/plan?dest=${encodeURIComponent(st.address)}`}
                    className="font-data text-[12px] text-[var(--volt)] bg-[var(--ink)] px-2.5 py-1 rounded-[2px] no-underline hover:opacity-90"
                  >
                    Route Here &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
