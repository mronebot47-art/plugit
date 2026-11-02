'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeoPoint } from '@/lib/types';
import { fetchGeocode } from '@/lib/api';

interface Props {
  placeholder: string;
  value: GeoPoint | null;
  onChange: (p: GeoPoint | null) => void;
  label: string;
}

export function LocationInput({ placeholder, value, onChange, label }: Props) {
  const [query, setQuery]       = useState(value?.label ?? '');
  const [results, setResults]   = useState<GeoPoint[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync internal input query when value prop changes externally
  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value?.label]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGeocode(q);
      if (Array.isArray(data)) setResults(data);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  function select(p: GeoPoint) {
    onChange(p);
    setQuery(p.label || '');
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    setQuery('');
    onChange(null);
    setResults([]);
  }

  return (
    <div className="relative">
      <label className="font-data text-[12px] text-[var(--muted)] block mb-1 tracking-wider uppercase">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              select(results[0]!);
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (query.length >= 2) search(query);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 250)}
          placeholder={placeholder}
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          className="w-full border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]
            px-3 py-2.5 pr-8 text-[14px] rounded-[2px] outline-none
            focus:border-[var(--ink)] transition-colors"
          style={{ minHeight: 44 }}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 text-[var(--muted)] hover:text-[var(--ink)] text-[14px] font-bold p-1"
            title="Clear"
          >
            &times;
          </button>
        )}

        {loading && (
          <span className="absolute right-8 font-data text-[12px] text-[var(--muted)]">
            ...
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60
            bg-[var(--paper)] border border-[var(--line)] rounded-[2px]
            shadow-xl overflow-y-auto divide-y divide-[var(--line)]"
        >
          {results.map((r, i) => (
            <li
              key={i}
              role="option"
              aria-selected={false}
              onMouseDown={() => select(r)}
              className="px-3 py-2.5 text-[13px] cursor-pointer
                hover:bg-[var(--line)] transition-colors flex items-center gap-2"
            >
              <span className="text-[var(--muted)] text-[11px] font-data uppercase">IN</span>
              <span className="text-[var(--ink)] font-medium">{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
